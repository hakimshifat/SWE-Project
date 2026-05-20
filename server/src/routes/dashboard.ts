import { Router } from "express";

import { prisma } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { serializeLog, serializeStegoFile } from "./serializers.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireUser, async (_req, res) => {
  const user = res.locals.user;
  const files = await prisma.stegoFile.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  });
  const logs = await prisma.operationLog.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  res.json({
    files: files.map(serializeStegoFile),
    recentLogs: logs.map(serializeLog)
  });
});
