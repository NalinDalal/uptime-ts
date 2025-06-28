import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization!;
  try {
    const data = jwt.verify(header, process.env.JWT_SECRET!);
    req.userId = (data as any).sub as string;
    next();
  } catch (err) {
    res.status(403).send("");
  }
}
