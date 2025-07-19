import jwt from "jsonwebtoken";
import express from "express";
const app = express();
import { prismaClient } from "../../packages/store/index";
import { authMiddleware } from "./middleware";
app.use(express.json());

app.post("/website", authMiddleware, async (req, res) => {
  if (!req.body.url) {
    res.status(411).json({});
    return;
  }
  const website = await prismaClient.website.create({
    data: {
      url: req.body.url,
      time_added: new Date(),
      user_id: "ads",
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
      id: req.params.websiteId,
    },
    include: {
      ticks: {
        orderBy: [
          {
            createdAt: "desc",
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

  res.json({ url: website.url, id: website.id, user_id: website.user_id });
});

app.get("/user/signup", async (req, res) => {
  const data = AuthInput.safeParse(req.body);
  if (!data.success) {
    console.log(data);
    res.status(403).send("");
    return;
  }
  try {
    await prismaClient.user.create({
      data: {
        username: data.data.username,
        password: date.data.password,
      },
    });
    res.json({ id: user.id });
  } catch (e) {
    console.log(e);

    res.send(403).send("");
  }
});
app.get("/user/signin", async (req, res) => {
  const data = AuthInput.safeParse(req.body);
  if (!data.success) {
    console.log(data);
    res.status(403).send("");
    return;
  }
  let user = await prismaClient.user.findFirst({
    where: {
      username: data.data.username,
    },
  });
  if (user?.password != data.data.password) {
    res.status(403).send("");
    return;
  }
  let token = jwt.sign(
    {
      sub: user.id,
    },
    !process.env.JWT_SECRET!,
  );
  res.json({ jwt: token });
});

console.log("Listening on port 3001");
console.log(
  "Send post request on `localhost:3001/user/signup` with username and password as input",
);
app.listen(process.env.PORT || 3001);
