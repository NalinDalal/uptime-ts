import axios from "axios";
import { xAckBulk, xReadGroup } from "redisstream/client";
import { prismaClient } from "store/client";

/**
 * Supported structured log severity levels.
 *
 * @typedef {"debug" | "info" | "warn" | "error"} LogLevel
 */

/**
 * Numeric priority ordering for log levels.
 *
 * Lower values are more verbose. A log entry is emitted only when its level
 * priority is greater than or equal to the configured `LOG_LEVEL`.
 *
 * @type {Record<LogLevel, number>}
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** @type {LogLevel} The minimum log level to emit. Set via the `LOG_LEVEL` environment variable, defaults to `"info"`. */
const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

/**
 * Formats and conditionally emits a structured JSON log entry.
 *
 * Entries include `level`, `message`, `time` (ISO timestamp), `region`, and `worker`.
 * The entry is only written when `level` is at least as severe as `currentLevel`.
 *
 * @param {LogLevel} level - Severity of this log entry.
 * @param {string} message - Human-readable log message.
 * @param {Record<string, any>} [meta] - Optional key/value metadata attached to the entry.
 */
function structuredLog(level: LogLevel, message: string, meta?: Record<string, any>) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  const entry: Record<string, any> = {
    level,
    message,
    time: new Date().toISOString(),
    region: REGION_ID,
    worker: WORKER_ID,
  };

  if (meta) {
    entry.meta = meta;
  }

  console.log(JSON.stringify(entry));
}

/**
 * Structured logger instance scoped to the current worker and region.
 *
 * @type {{ debug: (message: string, meta?: Record<string, any>) => void; info: (message: string, meta?: Record<string, any>) => void; warn: (message: string, meta?: Record<string, any>) => void; error: (message: string, meta?: Record<string, any>) => void }}
 */
const logger = {
  debug: (message: string, meta?: Record<string, any>) => structuredLog("debug", message, meta),
  info: (message: string, meta?: Record<string, any>) => structuredLog("info", message, meta),
  warn: (message: string, meta?: Record<string, any>) => structuredLog("warn", message, meta),
  error: (message: string, meta?: Record<string, any>) => structuredLog("error", message, meta),
};

/**
 * Unique identifier for the cloud region this worker is running in.
 *
 * Required at startup; the process will throw if it is not provided.
 * @type {string}
 */
const REGION_ID = process.env.REGION_ID!;

/**
 * Unique identifier for this worker process instance within its region.
 *
 * Required at startup; the process will throw if it is not provided.
 * @type {string}
 */
const WORKER_ID = process.env.WORKER_ID!;

if (!REGION_ID) {
  throw new Error("Region not provided");
}

if (!WORKER_ID) {
  throw new Error("Worker ID not provided");
}

/**
 * Main event loop for the uptime-monitoring worker.
 *
 * Continuously pulls batches of website checks from the Redis consumer group,
 * processes each one concurrently, and acknowledges the batch on completion.
 * Backs off for 5 seconds when an unrecoverable batch-level error occurs.
 */
async function main() {
  mainLoop: while (true) {
    try {
      const response = await xReadGroup(REGION_ID, WORKER_ID);

      if (!response) {
        continue mainLoop;
      }

      const promises = response.map(async ({ message, id }) => {
        try {
          await fetchWebsite(message.url, message.id);
        } catch (err) {
          logger.error("Failed to process website", {
            website_id: message.id,
            url: message.url,
            error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
          });
        } finally {
          return id;
        }
      });

      const completedIds = await Promise.all(promises);
      logger.info("Batch processed", { count: completedIds.length });

      xAckBulk(REGION_ID, completedIds);
    } catch (err) {
      logger.error("Worker batch error", {
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Retrieves the webhook URL configured for the owner of a given website.
 *
 * @param {string} websiteId - The internal UUID of the website.
 * @returns {Promise<string | null>} The user's webhook URL, or `null` if none is configured or the website does not exist.
 */
async function getWebhookUrl(websiteId: string): Promise<string | null> {
  const website = await prismaClient.website.findUnique({
    where: { id: websiteId },
    include: {
      user: { select: { webhook_url: true } },
    },
  });
  return website?.user.webhook_url ?? null;
}

/**
 * Sends an incident or recovery alert to the user's configured webhook endpoint.
 *
 * @param {string} webhookUrl - The destination URL to POST the alert to.
 * @param {"incident_started" | "recovered"} event - The type of alert being sent.
 * @param {Object} payload - The alert payload.
 * @param {string} payload.website_url - The URL of the affected website.
 * @param {string} payload.website_id - The internal UUID of the affected website.
 * @param {"Up" | "Down"} payload.status - The current determined status of the website.
 * @param {number} payload.response_time_ms - The HTTP response time in milliseconds for this check.
 */
async function sendAlert(
  webhookUrl: string,
  event: "incident_started" | "recovered",
  payload: {
    website_url: string;
    website_id: string;
    status: "Up" | "Down";
    response_time_ms: number;
  },
) {
  try {
    await axios.post(webhookUrl, {
      event,
      region: REGION_ID,
      time: new Date().toISOString(),
      ...payload,
    });
  } catch (err) {
    logger.warn("Webhook delivery failed", {
      webhook_url: webhookUrl,
      error: err instanceof Error ? { message: err.message } : String(err),
    });
  }
}

/**
 * Performs a single uptime check against a website URL and persists the result.
 *
 * Steps performed:
 * 1. Normalizes the URL (prepends `https://` if no scheme is present).
 * 2. Fetches the previous tick to detect status transitions.
 * 3. Makes an HTTP GET request with a 10-second timeout.
 * 4. Classifies the result as `Up`, `Down`, or `Unknown` based on HTTP status code.
 * 5. Persists a new `website_tick` record with response time and status.
 * 6. On status change, creates or closes an `incident` record accordingly.
 * 7. If a webhook is configured, fires an `incident_started` or `recovered` alert.
 *
 * @param {string} url - The URL of the website to check.
 * @param {string} websiteId - The internal UUID of the website being checked.
 */
async function fetchWebsite(url: string, websiteId: string) {
  const startTime = Date.now();

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const prev = await prismaClient.website_tick.findFirst({
    where: {
      website_id: websiteId,
      region_id: REGION_ID,
    },
    orderBy: { created_at: "desc" },
    take: 1,
  });

  let status: "Up" | "Down" | "Unknown";
  let httpStatus: number | null = null;

  try {
    const res = await axios.get(url, {
      validateStatus: () => true,
      timeout: 10000,
    });
    httpStatus = res.status;
    if (res.status >= 200 && res.status < 400) {
      status = "Up";
    } else if (res.status >= 400 && res.status < 500) {
      status = "Down";
    } else {
      status = "Down";
    }
  } catch (err) {
    status = "Unknown";
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNABORTED") {
        logger.warn("Timeout reaching website", { url, region: REGION_ID });
      } else if (err.code) {
        logger.warn("Network error reaching website", {
          url,
          region: REGION_ID,
          code: err.code,
          message: err.message,
        });
      } else {
        logger.error("Unexpected error reaching website", {
          url,
          region: REGION_ID,
          error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        });
      }
    } else {
      logger.error("Unexpected error reaching website", {
        url,
        region: REGION_ID,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      });
    }
  }
  const endTime = Date.now();

  await prismaClient.website_tick.create({
    data: {
      response_time_ms: endTime - startTime,
      status,
      http_status: httpStatus,
      region_id: REGION_ID,
      website_id: websiteId,
    },
  });

  try {
    if (prev && prev.status !== status) {
      if (status === "Down") {
        const existing = await prismaClient.incident.findFirst({
          where: {
            website_id: websiteId,
            region_id: REGION_ID,
            ended_at: null,
          },
        });
        if (!existing) {
          await prismaClient.incident.create({
            data: {
              website_id: websiteId,
              region_id: REGION_ID,
            },
          });
        }
      } else {
        await prismaClient.incident.updateMany({
          where: {
            website_id: websiteId,
            region_id: REGION_ID,
            ended_at: null,
          },
          data: { ended_at: new Date() },
        });
      }

      const webhookUrl = await getWebhookUrl(websiteId);
      if (webhookUrl) {
        await sendAlert(
          webhookUrl,
          status === "Down" ? "incident_started" : "recovered",
          {
            website_url: url,
            website_id: websiteId,
            status,
            response_time_ms: endTime - startTime,
          },
        );
      }
    }
  } catch (err) {
    logger.error("Post-tick hook failed", {
      website_id: websiteId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
  }
}

main();

/**
 * Gracefully shuts down the worker process.
 *
 * Prevents double-shutdown and attempts a clean Prisma disconnect before exiting.
 */
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Shutting down worker");
  try {
    await prismaClient.$disconnect();
  } catch (err) {
    logger.error("Error during disconnect", {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
