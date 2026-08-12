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
    res.status(403).send("");
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
  } catch (e) {
    console.log(e);
    res.status(403).send("");
  }
});
app.post("/user/signin", async (req, res) => {
  const data = AuthInput.safeParse(req.body);
  if (!data.success) {
    res.status(403).send("");
    return;
  }
  const user = await prismaClient.user.findFirst({
    where: {
      username: data.data.username,
    },
  });
  if (!user || !(await bcrypt.compare(data.data.password, user.password))) {
    res.status(403).send("");
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

  const stats = websiteIds.map((id) => ({
    website_id: id,
    periods: {
      d1: uptimePct(b1[id]?.up ?? 0, b1[id]?.down ?? 0),
      d7: uptimePct(b7[id]?.up ?? 0, b7[id]?.down ?? 0),
      d30: uptimePct(b30[id]?.up ?? 0, b30[id]?.down ?? 0),
    },
  }));

  res.json({
    websites,
    incidents,
    stats,
  });
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

console.log("Listening on port 3001");
console.log(
  "Send post request on `localhost:3001/user/signup` with username and password as input",
);
app.listen(process.env.PORT || 3001);
