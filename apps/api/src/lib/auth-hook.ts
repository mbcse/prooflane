import type { NextFunction, Request, Response } from "express";
import { verifyUserToken } from "./jwt.js";

export type AuthedRequest = Request & { userId: string };

export async function requireBearerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { userId } = await verifyUserToken(h.slice(7));
    (req as AuthedRequest).userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
