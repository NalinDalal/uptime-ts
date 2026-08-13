import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Express middleware that authenticates requests using a Bearer JWT.
 *
 * Expects the `Authorization` header to contain a raw JWT token (no `Bearer ` prefix handling here).
 * On successful verification, attaches `req.userId` (the `sub` claim from the token payload).
 * On failure (missing, expired, or invalid token), responds with HTTP 403 and halts the chain.
 *
 * @param {express.Request} req - Express request object. Populates `req.userId` on success.
 * @param {express.Response} res - Express response object. Sends 403 on auth failure.
 * @param {express.NextFunction} next - Express next-function callback. Called on successful authentication.
 */
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
