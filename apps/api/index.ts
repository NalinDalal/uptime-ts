import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
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
  const website = await prismaClient.website.create({
    data: {
      url: req.body.url,
      time_added: new Date(),
      user_id: req.userId!,
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
    const user = await prismaClient.user.create({
      data: {
        username: data.data.username,
        password: data.data.password,
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
  if (user?.password != data.data.password) {
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
  res.json({
    websites,
    incidents,
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
