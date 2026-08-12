import axios from "axios";
import { xAckBulk, xReadGroup } from "redisstream/client";
import { prismaClient } from "store/client";

const REGION_ID = process.env.REGION_ID!;
const WORKER_ID = process.env.WORKER_ID!;

if (!REGION_ID) {
  throw new Error("Region not provided");
}

if (!WORKER_ID) {
  throw new Error("Region not provided");
}

async function main() {
  while (1) {
    try {
      const response = await xReadGroup(REGION_ID, WORKER_ID);

      if (!response) {
        continue;
      }

      const promises = response.map(async ({ message, id }) => {
        try {
          await fetchWebsite(message.url, message.id);
        } catch (err) {
          console.error(`Failed to process website ${message.id}:`, err);
        } finally {
          return id;
        }
      });

      const completedIds = await Promise.all(promises);
      console.log(completedIds.length);

      xAckBulk(REGION_ID, completedIds);
    } catch (err) {
      console.error("Worker batch error:", err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function getWebhookUrl(websiteId: string): Promise<string | null> {
  const website = await prismaClient.website.findUnique({
    where: { id: websiteId },
    include: {
      user: { select: { webhook_url: true } },
    },
  });
  return website?.user.webhook_url ?? null;
}

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
    console.log("Webhook delivery failed", err);
  }
}

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
    if (axios.isAxiosError(err) && err.code === "ECONNABORTED") {
      console.error(`Timeout reaching ${url} in ${REGION_ID}`);
    } else if (axios.isAxiosError(err) && err.code) {
      console.error(`Network error (${err.code}) reaching ${url} in ${REGION_ID}: ${err.message}`);
    } else {
      console.error(`Unexpected error reaching ${url} in ${REGION_ID}:`, err);
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
    console.error(`Post-tick hook failed for ${websiteId}:`, err);
  }
}

main();

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down worker...");
  try {
    await prismaClient.$disconnect();
  } catch (err) {
    console.error("Error during disconnect:", err);
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down worker...");
  try {
    await prismaClient.$disconnect();
  } catch (err) {
    console.error("Error during disconnect:", err);
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);