import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
const app = express();
import { prismaClient } from "../../packages/store/index";
import { authMiddleware } from "./middleware";
import { AuthInput } from "./types";
app.use(express.json());
app.use(cors());

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

app.post("/user/signup", async (req, res) => {
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
app.post("/user/signin", async (req, res) => {
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

  type Bucket = Record<string, { up: number; down: number }>;
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

app.get("/user/webhook", authMiddleware, async (req, res) => {
  const user = await prismaClient.user.findUnique({
    where: { id: req.userId },
    select: { webhook_url: true },
  });
  res.json({ url: user?.webhook_url ?? null });
});

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
