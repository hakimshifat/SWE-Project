import { Router } from "express";

import { prisma } from "../db.js";
import { publicUser, requireAdmin } from "../middleware/auth.js";
import { logOperation } from "../services/logging.js";
import { serializeLog } from "./serializers.js";

export const adminRouter = Router();

adminRouter.get("/users", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ users: users.map(publicUser) });
});

adminRouter.patch("/users/:id/status", requireAdmin, async (req, res) => {
  const admin = res.locals.user;
  const userId = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!["active", "inactive", "blocked"].includes(status)) {
    res.status(400).json({ error: "Invalid account status." });
    return;
  }
  if (admin.userId === userId && status !== "active") {
    res.status(400).json({ error: "You cannot disable your own admin account." });
    return;
  }

  const target = await prisma.user.update({ where: { userId }, data: { status } });
  await logOperation({
    userId: admin.userId,
    operationType: "Admin Update",
    operationStatus: "Success",
    message: `Set user ${target.username} status to ${status}.`
  });
  res.json({ user: publicUser(target) });
});

adminRouter.get("/logs", requireAdmin, async (_req, res) => {
  const logs = await prisma.operationLog.findMany({
    include: {
      user: true,
      stegoFile: {
        select: { stegoFileId: true, stegoFileName: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  res.json({ logs: logs.map(serializeLog) });
});

