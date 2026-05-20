import type { NextFunction, Request, Response } from "express";

import { prisma } from "../db.js";

export async function currentUser(req: Request) {
  const userId = req.session.userId;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user || user.status !== "active") {
    req.session.userId = undefined;
    return null;
  }
  return user;
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  res.locals.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireUser(req, res, () => {
    if (res.locals.user.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    next();
  });
}

export function publicUser(user: {
  userId: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
}) {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString()
  };
}

