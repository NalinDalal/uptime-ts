import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
const app = express();
import { prismaClient } from "../../packages/store/index";
import { authMiddleware } from "./middleware";
import { AuthInput } from "./types";

/**
 * Configures Express middleware parsers and CORS policy for the API server.
 *
 * - `express.json()`: Parses incoming JSON request bodies.
 * - `cors()`: Enables Cross-Origin Resource Sharing for all origins.
 */
app.use(express.json());
app.use(cors());

/**
 * In-memory rate-limit state for authentication endpoints.
 *
 * Tracks failed auth attempts per IP address to prevent brute-force attacks.
 *
 * @type {Map<string, { count: number; firstAttempt: number }>}
 */
const authAttempts = new Map<string, { count: number; firstAttempt: number }>();

/**
 * Rate-limits authentication attempts per client IP address.
 *
 * Limits: 10 attempts per 15-minute sliding window per IP.
 *
 * @param {express.Request} req - Express request object.
 * @param {express.Response} res - Express response object.
 * @param {express.NextFunction} next - Express next-function callback.
 */
function rateLimitAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;

  const record = authAttempts.get(key);
  if (record) {
    if (now - record.firstAttempt > windowMs) {
      authAttempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }
    if (record.count >= maxAttempts) {
      return res.status(429).json({ message: "Too many attempts. Try again later." });
    }
    record.count++;
  } else {
    authAttempts.set(key, { count: 1, firstAttempt: now });
  }
  next();
}

/**
 * Periodic cleanup job for expired rate-limit entries.
 *
 * Runs every 60 seconds and removes any IP record whose window has elapsed.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of authAttempts.entries()) {
    if (now - record.firstAttempt > 15 * 60 * 1000) {
      authAttempts.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Registers a new website for the authenticated user.
 *
 * - Requires a valid JWT (via `authMiddleware`).
 * - Normalizes the URL by prepending `https://` if no scheme is present.
 * - Optionally accepts a `component` field for status-page grouping.
 *
 * @route POST /website
 * @param {string} req.body.url - The URL to monitor (required).
 * @param {string | null} [req.body.component] - Optional component name for grouping.
 * @returns {Object} `{ id: string }` — the internal UUID of the newly created website.
 * @returns {number} 411 — if `url` is missing from the request body.
 */
app.post("/website", authMiddleware, async (req, res) => {
  if (!req.body.url) {
    res.status(411).json({});
    return;
  }
  let url = req.body.url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  const website = await prismaClient.website.create({
    data: {
      url,
      time_added: new Date(),
      user_id: req.userId!,
      component: req.body.component ?? null,
    },
  });

  res.json({
    id: website.id,
  });
});

/**
 * Retrieves a specific website and its 10 most recent ticks for the authenticated owner.
 *
 * @route GET /status/:websiteId
 * @param {string} req.params.websiteId - The internal UUID of the website.
 * @returns {Object} `{ website: { id, url, user_id, ticks: Tick[] } }`
 * @returns {number} 409 — if the website does not exist or does not belong to the user.
 */
app.get("/status/:websiteId", authMiddleware, async (req, res) => {
  const website = await prismaClient.website.findFirst({
    where: {
      user_id: req.userId!,
      id: String(req.params.websiteId),
    },
    include: {
      ticks: {
        orderBy: [
          {
            created_at: "desc",
          },
        ],
        take: 10,
      },
    },
  });

  if (!website) {
    res.status(409).json({
      message: "Website Not Found",
    });
    return;
  }

  res.json({ website: { url: website.url, id: website.id, user_id: website.user_id, ticks: website.ticks } });
});

/**
 * Registers a new user account.
 *
 * - Validates input with the `AuthInput` Zod schema.
 * - Hashes the password with bcrypt (10 salt rounds).
 * - Enforces unique usernames at the database level (Prisma unique index).
 *
 * @route POST /user/signup
 * @param {string} req.body.username - Desired username.
 * @param {string} req.body.password - Plain-text password.
 * @returns {Object} `{ id: string }` — the internal UUID of the newly created user.
 * @returns {number} 403 — if the request body fails Zod validation.
 * @returns {number} 409 — if the username is already taken.
 * @returns {number} 500 — on unexpected database errors.
 */
app.post("/user/signup", rateLimitAuth, async (req, res) => {
  const data = AuthInput.safeParse(req.body);
  if (!data.success) {
    res.status(403).json({ message: "Invalid input" });
    return;
  }
  try {
    const hashedPassword = await bcrypt.hash(data.data.password, 10);
    const user = await prismaClient.user.create({
      data: {
        username: data.data.username,
        password: hashedPassword,
      },
    });
    res.json({ id: user.id });
  } catch (e: any) {
    console.error("Signup error:", e);
    if (e.code === "P2002") {
      res.status(409).json({ message: "Username already taken" });
    } else {
      res.status(500).json({ message: "Internal server error" });
    }
  }
});

/**
 * Authenticates an existing user and returns a signed JWT.
 *
 * @route POST /user/signin
 * @param {string} req.body.username - The user's username.
 * @param {string} req.body.password - The user's plain-text password.
 * @returns {Object} `{ jwt: string }` — a JWT valid for subsequent authenticated requests.
 * @returns {number} 403 — if the request body fails Zod validation.
 * @returns {number} 401 — if the username/password combination is incorrect.
 */
app.post("/user/signin", rateLimitAuth, async (req, res) => {
  const data = AuthInput.safeParse(req.body);
  if (!data.success) {
    res.status(403).json({ message: "Invalid input" });
    return;
  }
  const user = await prismaClient.user.findFirst({
    where: {
      username: data.data.username,
    },
  });
  if (!user || !(await bcrypt.compare(data.data.password, user.password))) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }
  const token = jwt.sign(
    {
      sub: user.id,
    },
    process.env.JWT_SECRET!,
  );
  res.json({ jwt: token });
});

/**
 * Lists all websites owned by the authenticated user, each with its most recent tick.
 *
 * @route GET /websites
 * @returns {Object} `{ websites: Array<Website & { ticks: Tick[] }> }`
 */
app.get("/websites", authMiddleware, async (req, res) => {
  const websites = await prismaClient.website.findMany({
    where: {
      user_id: req.userId,
    },
    include: {
      ticks: {
        orderBy: [
          {
            created_at: "desc",
          },
        ],
        take: 1,
      },
    },
  });
  res.json({
    websites,
  });
});

/**
 * Lists up to 50 recent incidents across all websites owned by the authenticated user.
 *
 * @route GET /incidents
 * @returns {Object} `{ incidents: Incident[] }`
 */
app.get("/incidents", authMiddleware, async (req, res) => {
  const incidents = await prismaClient.incident.findMany({
    where: {
      website: {
        user_id: req.userId,
      },
    },
    include: {
      website: { select: { url: true } },
    },
    orderBy: { started_at: "desc" },
    take: 50,
  });
  res.json({ incidents });
});

/**
 * Public status page for a given user.
 *
 * Returns all websites (with latest ticks), recent incidents, active/upcoming maintenances,
 * and computed per-website and per-component uptime statistics for 1-day, 7-day, and 30-day windows.
 *
 * Results are cached publicly for 15 seconds.
 *
 * @route GET /public/status/:userId
 * @param {string} req.params.userId - The internal UUID of the user whose status page to display.
 * @returns {PublicStatusResponse}
 */
app.get("/public/status/:userId", async (req, res) => {
  const websites = await prismaClient.website.findMany({
    where: {
      user_id: String(req.params.userId),
    },
    include: {
      ticks: {
        orderBy: [
          {
            created_at: "desc",
          },
        ],
        take: 24,
      },
    },
  });
  const incidents = await prismaClient.incident.findMany({
    where: {
      website: {
        user_id: String(req.params.userId),
      },
    },
    include: {
      website: { select: { url: true } },
    },
    orderBy: { started_at: "desc" },
    take: 10,
  });
  const maintenances = await prismaClient.maintenance.findMany({
    where: {
      website: { user_id: String(req.params.userId) },
      starts_at: { lte: new Date() },
      status: { in: ["scheduled", "in_progress"] },
    },
    include: {
      website: { select: { url: true } },
    },
    orderBy: { starts_at: "asc" },
    take: 20,
  });

  const websiteIds = websites.map((w) => w.id);
  const now = new Date();
  const since = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

  const periods = {
    d1: since(24),
    d7: since(24 * 7),
    d30: since(24 * 30),
  } as const;

  /**
   * Fetches tick counts grouped by `website_id` and `status` for a given time window.
   *
   * @param {Date} createdAfter - Only ticks created after this date are counted.
   * @returns {Promise<{ website_id: string; status: string; _count: { _all: number } }[]>}
   */
  const groupByPeriod = (createdAfter: Date) =>
    prismaClient.website_tick.groupBy({
      by: ["website_id", "status"],
      where: {
        website_id: { in: websiteIds },
        created_at: { gte: createdAfter },
      },
      _count: { _all: true },
    });

  const [d1, d7, d30] = await prismaClient.$transaction([
    groupByPeriod(periods.d1),
    groupByPeriod(periods.d7),
    groupByPeriod(periods.d30),
  ]);

  /**
   * Converts raw Prisma group-by rows into a lookup map keyed by `website_id`.
   *
   * @typedef {Object} Bucket
   * @property {Record<string, { up: number; down: number }>} rows
   */
  type Bucket = Record<string, { up: number; down: number }>;

  /**
   * Transforms group-by query results into a `{ [websiteId]: { up, down } }` bucket.
   *
   * @param {typeof d1} rows - The Prisma group-by result rows.
   * @returns {Bucket} A lookup of tick counts per website.
   */
  const toBucket = (rows: (typeof d1)) => {
    const bucket: Bucket = {};
    for (const row of rows) {
      bucket[row.website_id] ??= { up: 0, down: 0 };
      if (row.status === "Up") bucket[row.website_id].up = row._count._all;
      if (row.status === "Down") bucket[row.website_id].down = row._count._all;
    }
    return bucket;
  };

  const b1 = toBucket(d1);
  const b7 = toBucket(d7);
  const b30 = toBucket(d30);

  /**
   * Calculates uptime percentage from up/down tick counts.
   *
   * @param {number} up - Number of "Up" ticks.
   * @param {number} down - Number of "Down" ticks.
   * @returns {number | null} Uptime percentage (0-100), or `null` if no data.
   */
  const uptimePct = (up: number, down: number) => {
    const total = up + down;
    return total === 0 ? null : Math.round((up / total) * 10000) / 100;
  };

  const websiteStats = websiteIds.map((id) => ({
    website_id: id,
    periods: {
      d1: uptimePct(b1[id]?.up ?? 0, b1[id]?.down ?? 0),
      d7: uptimePct(b7[id]?.up ?? 0, b7[id]?.down ?? 0),
      d30: uptimePct(b30[id]?.up ?? 0, b30[id]?.down ?? 0),
    },
  }));

  const statsMap = new Map(websiteStats.map((s) => [s.website_id, s]));

  const groups = websites.reduce<Record<string, typeof websites>>((acc, w) => {
    const key = w.component || "Uncategorized";
    acc[key] ??= [];
    acc[key].push(w);
    return acc;
  }, {});

  const components = Object.entries(groups).map<{
    name: string;
    websites: (typeof websites)[number][];
    stats: { d1: number | null; d7: number | null; d30: number | null };
    status: "Up" | "Down" | "Unknown";
  }>(([name, group]) => {
    const latest = group
      .flatMap((w) => w.ticks)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    let upD1 = 0;
    let downD1 = 0;
    let upD7 = 0;
    let downD7 = 0;
    let upD30 = 0;
    let downD30 = 0;

    for (const w of group) {
      const s = statsMap.get(w.id);
      if (!s) continue;
      upD1 += s.periods.d1 === null ? 0 : Math.round((s.periods.d1 / 100) * 100) / 100;
      downD1 += s.periods.d1 === null ? 0 : Math.round((100 - s.periods.d1) / 100 * 100) / 100;
      upD7 += s.periods.d7 === null ? 0 : Math.round((s.periods.d7 / 100) * 100) / 100;
      downD7 += s.periods.d7 === null ? 0 : Math.round((100 - s.periods.d7) / 100 * 100) / 100;
      upD30 += s.periods.d30 === null ? 0 : Math.round((s.periods.d30 / 100) * 100) / 100;
      downD30 += s.periods.d30 === null ? 0 : Math.round((100 - s.periods.d30) / 100 * 100) / 100;
    }

    const aggregateUptime = (up: number, down: number) => {
      const total = up + down;
      return total === 0 ? null : Math.round((up / total) * 10000) / 100;
    };

    const status =
      latest?.status === "Up" ? "Up" : latest?.status === "Down" ? "Down" : "Unknown";

    return {
      name,
      websites: group,
      stats: {
        d1: aggregateUptime(upD1, downD1),
        d7: aggregateUptime(upD7, downD7),
        d30: aggregateUptime(upD30, downD30),
      },
      status,
    };
  });

  res.set("Cache-Control", "public, max-age=15, s-maxage=15");
  res.json({
    components,
    incidents,
    maintenances,
    websites,
    stats: websiteStats,
  });
});

/**
 * Returns the combined incident and maintenance timeline for a user's status page.
 *
 * Merges and sorts the most recent 100 incidents and 100 maintenances by `started_at` descending.
 *
 * @route GET /public/status/:userId/history
 * @param {string} req.params.userId - The internal UUID of the user.
 * @returns {HistoryResponse}
 */
app.get("/public/status/:userId/history", async (req, res) => {
  const [incidents, maintenances] = await Promise.all([
    prismaClient.incident.findMany({
      where: {
        website: { user_id: String(req.params.userId) },
      },
      include: {
        website: { select: { url: true } },
      },
      orderBy: { started_at: "desc" },
      take: 100,
    }),
    prismaClient.maintenance.findMany({
      where: {
        website: { user_id: String(req.params.userId) },
      },
      include: {
        website: { select: { url: true } },
      },
      orderBy: { starts_at: "desc" },
      take: 100,
    }),
  ]);

  const history = [
    ...incidents.map((inc) => ({
      type: "incident" as const,
      id: inc.id,
      website_url: inc.website.url,
      started_at: inc.started_at,
      ended_at: inc.ended_at,
      region_id: inc.region_id,
    })),
    ...maintenances.map((m) => ({
      type: "maintenance" as const,
      id: m.id,
      website_url: m.website.url,
      started_at: m.starts_at,
      ended_at: m.ends_at,
      title: m.title,
      status: m.status,
    })),
  ].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  res.json({ history });
});

/**
 * Retrieves the authenticated user's configured webhook URL.
 *
 * @route GET /user/webhook
 * @returns {Object} `{ url: string | null }`
 */
app.get("/user/webhook", authMiddleware, async (req, res) => {
  const user = await prismaClient.user.findUnique({
    where: { id: req.userId },
    select: { webhook_url: true },
  });
  res.json({ url: user?.webhook_url ?? null });
});

/**
 * Updates the authenticated user's webhook URL.
 *
 * @route PATCH /user/webhook
 * @param {string} req.body.url - The new webhook URL to store.
 * @returns {Object} `{ ok: true }`
 * @returns {number} 411 — if `url` is missing or not a string.
 */
app.patch("/user/webhook", authMiddleware, async (req, res) => {
  const { url } = req.body;
  if (typeof url !== "string") {
    res.status(411).json({});
    return;
  }
  await prismaClient.user.update({
    where: { id: req.userId },
    data: { webhook_url: url },
  });
  res.json({ ok: true });
});

/**
 * Creates a new maintenance window for a website owned by the authenticated user.
 *
 * @route POST /maintenance
 * @param {string} req.body.website_id - The internal UUID of the website.
 * @param {string} req.body.title - Short title for the maintenance.
 * @param {string} [req.body.description] - Optional longer description.
 * @param {string} req.body.starts_at - ISO timestamp for when maintenance begins.
 * @param {string} [req.body.ends_at] - Optional ISO timestamp for when maintenance ends.
 * @returns {Object} The created `Maintenance` record.
 * @returns {number} 411 — if required fields are missing.
 * @returns {number} 409 — if the website does not belong to the user or does not exist.
 */
app.post("/maintenance", authMiddleware, async (req, res) => {
  const { website_id, title, description, starts_at, ends_at } = req.body;
  if (!website_id || !title || !starts_at) {
    res.status(411).json({});
    return;
  }
  const website = await prismaClient.website.findFirst({
    where: { id: website_id, user_id: req.userId! },
  });
  if (!website) {
    res.status(409).json({ message: "Website not found" });
    return;
  }
  const maintenance = await prismaClient.maintenance.create({
    data: {
      website_id,
      title,
      description: description || "",
      starts_at: new Date(starts_at),
      ends_at: ends_at ? new Date(ends_at) : null,
      status: "scheduled",
    },
  });
  res.json(maintenance);
});

/**
 * Lists all maintenance windows for websites owned by the authenticated user.
 *
 * @route GET /maintenance
 * @returns {Object} `{ maintenances: Maintenance[] }`
 */
app.get("/maintenance", authMiddleware, async (req, res) => {
  const maintenances = await prismaClient.maintenance.findMany({
    where: {
      website: { user_id: req.userId! },
    },
    include: {
      website: { select: { url: true } },
    },
    orderBy: { starts_at: "desc" },
    take: 50,
  });
  res.json({ maintenances });
});

/**
 * Public endpoint returning active/upcoming maintenance windows for a given user.
 *
 * @route GET /public/maintenance/:userId
 * @param {string} req.params.userId - The internal UUID of the user.
 * @returns {Object} `{ maintenances: Maintenance[] }`
 */
app.get("/public/maintenance/:userId", async (req, res) => {
  const maintenances = await prismaClient.maintenance.findMany({
    where: {
      website: { user_id: String(req.params.userId) },
      starts_at: { lte: new Date() },
      status: { in: ["scheduled", "in_progress"] },
    },
    include: {
      website: { select: { url: true } },
    },
    orderBy: { starts_at: "asc" },
    take: 20,
  });
  res.json({ maintenances });
});

console.log("Listening on port 3001");
console.log(
  "Send post request on `localhost:3001/user/signup` with username and password as input",
);
app.listen(process.env.PORT || 3001);
