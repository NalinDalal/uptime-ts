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
    const response = await xReadGroup(REGION_ID, WORKER_ID);

    if (!response) {
      continue;
    }

    let promises = response.map(({ message }) =>
      fetchWebsite(message.url, message.id),
    );
    await Promise.all(promises);
    console.log(promises.length);

    xAckBulk(
      REGION_ID,
      response.map(({ id }) => id),
    );
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

  const prev = await prismaClient.website_tick.findFirst({
    where: {
      website_id: websiteId,
      region_id: REGION_ID,
    },
    orderBy: { created_at: "desc" },
    take: 1,
  });

  let status: "Up" | "Down";
  try {
    const res = await axios.get(url, { validateStatus: () => true });
    status = res.status < 500 ? "Up" : "Down";
  } catch {
    status = "Down";
  }
  const endTime = Date.now();

  await prismaClient.website_tick.create({
    data: {
      response_time_ms: endTime - startTime,
      status,
      region_id: REGION_ID,
      website_id: websiteId,
    },
  });

  if (prev && prev.status !== status) {
    if (status === "Down") {
      await prismaClient.incident.create({
        data: {
          website_id: websiteId,
          region_id: REGION_ID,
        },
      });
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
}

main();