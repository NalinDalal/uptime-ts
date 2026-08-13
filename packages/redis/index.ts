import { createClient } from "redis";

/**
 * Redis client instance used for stream operations.
 *
 * Connects immediately on module load. Error handling is wired via the `"error"` event listener.
 * @type {import("redis").RedisClientType}
 */
const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

/**
 * Shape of an event pushed into the `betteruptime:website` stream.
 *
 * @typedef {Object} WebsiteEvent
 * @property {string} url - The URL of the website being monitored.
 * @property {string} id - The internal UUID of the website record.
 */

/**
 * Shape of a single message read from a Redis consumer group.
 *
 * @typedef {Object} MessageType
 * @property {string} id - The Redis stream entry ID used for acknowledgement.
 * @property {Object} message - The payload posted to the stream.
 * @property {string} message.url - The URL of the website being monitored.
 * @property {string} message.id - The internal UUID of the website record.
 */

/** @type {string} Name of the Redis stream all website monitoring events are published to. */
const STREAM_NAME = "betteruptime:website";

/**
 * Tracks which consumer groups have already been created to avoid
 * repeated `XGROUP CREATE` calls (which throw `BUSYGROUP`).
 *
 * @type {Set<string>}
 */
const createdGroups = new Set<string>();

/**
 * Ensures a Redis consumer group exists on the stream, creating it if necessary.
 *
 * Uses `MKSTREAM: true` so the stream is created implicitly if it does not yet exist.
 * Swallows `BUSYGROUP` errors since the group may already exist from another instance.
 *
 * @param {string} consumerGroup - The name of the consumer group to ensure exists.
 */
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

/**
 * Appends a single website monitoring event to the Redis stream.
 *
 * @param {WebsiteEvent} event - The website event to publish.
 */
async function xAdd({ url, id }: WebsiteEvent) {
  await client.xAdd(STREAM_NAME, "*", {
    url,
    id,
  });
}

/**
 * Appends multiple website monitoring events to the Redis stream in sequence.
 *
 * Useful for bulk re-queueing (e.g. the pusher service) where ordering matters.
 *
 * @param {WebsiteEvent[]} websites - Array of website events to publish.
 */
export async function xAddBulk(websites: WebsiteEvent[]) {
  for (const website of websites) {
    await xAdd({
      url: website.url,
      id: website.id,
    });
  }
}

/**
 * Reads up to 5 pending messages from the Redis stream on behalf of a specific consumer.
 *
 * Blocks for up to 5 seconds waiting for new messages. Creates the consumer group
 * automatically if it has not been created yet.
 *
 * @param {string} consumerGroup - The consumer group name (typically the region).
 * @param {string} workerId - The individual worker identifier (consumer name within the group).
 * @returns {Promise<MessageType[] | undefined>} Array of stream messages, or `undefined` if none were received within the timeout.
 */
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

  // @ts-ignore - redis client return typing for xReadGroup is incomplete
  let messages: MessageType[] | undefined = res?.[0]?.messages;

  return messages;
}

/**
 * Acknowledges a single message so Redis removes it from the consumer's Pending Entry List (PEL).
 *
 * @param {string} consumerGroup - The consumer group the message belongs to.
 * @param {string} eventId - The Redis stream entry ID to acknowledge.
 */
async function xAck(consumerGroup: string, eventId: string) {
  await client.xAck(STREAM_NAME, consumerGroup, eventId);
}

/**
 * Acknowledges multiple messages in bulk.
 *
 * Note: Currently implemented with `Array.map` without awaiting each individual call.
 * All acknowledgements are still initiated because `xAck` returns a Promise.
 *
 * @param {string} consumerGroup - The consumer group the messages belong to.
 * @param {string[]} eventIds - Array of Redis stream entry IDs to acknowledge.
 */
export async function xAckBulk(consumerGroup: string, eventIds: string[]) {
  eventIds.map((eventId) => xAck(consumerGroup, eventId));
}
