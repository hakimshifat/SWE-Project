import { prisma } from "../db.js";

export async function logOperation(input: {
  userId?: number | null;
  stegoFileId?: number | null;
  operationType: string;
  operationStatus: string;
  message: string;
}) {
  return prisma.operationLog.create({
    data: {
      userId: input.userId ?? null,
      stegoFileId: input.stegoFileId ?? null,
      operationType: input.operationType,
      operationStatus: input.operationStatus,
      message: input.message
    }
  });
}

