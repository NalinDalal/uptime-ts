import { createClient } from "redis";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

type WebsiteEvent = { url: string; id: string };
type MessageType = {
  id: string;
  message: {
    url: string;
    id: string;
  };
  //@ts-ignore
};

const STREAM_NAME = "betteruptime:website";

const createdGroups = new Set<string>();

async function ensureGroup(consumerGroup: string) {
  if (createdGroups.has(consumerGroup)) {
    return;
  }
  try {
    await client.xGroupCreate(STREAM_NAME, consumerGroup, "0", {
      MKSTREAM: true,
    });
  } catch (err: any) {
    if (err?.message !== "BUSYGROUP Consumer Group name already exists") {
      throw err;
    }
  }
  createdGroups.add(consumerGroup);
}

async function xAdd({ url, id }: WebsiteEvent) {
  await client.xAdd(STREAM_NAME, "*", {
    url,
    id,
  });
}

export async function xAddBulk(websites: WebsiteEvent[]) {
  for (const website of websites) {
    await xAdd({
      url: website.url,
      id: website.id,
    });
  }
}

export async function xReadGroup(
  consumerGroup: string,
  workerId: string,
): Promise<MessageType[] | undefined> {
  await ensureGroup(consumerGroup);
  const res = await client.xReadGroup(
    consumerGroup,
    workerId,
    {
      key: STREAM_NAME,
      id: ">",
    },
    {
      COUNT: 5,
      BLOCK: 5000,
    },
  );

  //@ts-ignore
  let messages: MessageType[] | undefined = res?.[0]?.messages;

  return messages;
}

async function xAck(consumerGroup: string, eventId: string) {
  await client.xAck(STREAM_NAME, consumerGroup, eventId);
}

export async function xAckBulk(consumerGroup: string, eventIds: string[]) {
  eventIds.map((eventId) => xAck(consumerGroup, eventId));
}

