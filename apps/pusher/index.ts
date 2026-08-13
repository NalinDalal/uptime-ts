import { prismaClient } from "store/client";
import { xAddBulk } from "redisstream/client";

/**
 * Loads all registered websites from the database and re-publishes them into the
 * Redis monitoring stream. Intended for warming up a fresh Redis instance so the
 * worker processes all known websites immediately.
 */
async function main() {
  let websites = await prismaClient.website.findMany({
    select: {
      url: true,
      id: true,
    },
  });

  await xAddBulk(
    websites.map((w) => ({
      url: w.url,
      id: w.id,
    })),
  );
}

/**
 * Re-runs `main()` on a fixed interval so newly added websites eventually
 * flow into the stream even if the pusher service was down or restarted.
 *
 * Interval: every 3 minutes.
 */
setInterval(
  () => {
    main();
  },
  3 * 1000 * 60,
);

/**
 * Initial load on process start so the stream is populated immediately.
 */
main();
