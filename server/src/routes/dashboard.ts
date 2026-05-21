import { Router } from "express";

import { prisma } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { serializeStegoFile } from "./serializers.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireUser, async (_req, res) => {
  const user = res.locals.user;
  const files = await prisma.stegoFile.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  });
  res.json({
    files: files.map(serializeStegoFile)
  });
});
