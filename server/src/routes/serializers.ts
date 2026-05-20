import type { OperationLog, StegoFile, User } from "@prisma/client";

import { publicUser } from "../middleware/auth.js";

export function serializeStegoFile(file: StegoFile) {
  return {
    stegoFileId: file.stegoFileId,
    coverFileName: file.coverFileName,
    stegoFileName: file.stegoFileName,
    fileType: file.fileType,
    fileSize: file.fileSize.toString(),
    passwordProtected: file.passwordProtected,
    createdAt: file.createdAt.toISOString()
  };
}

export function serializeLog(
  log: OperationLog & {
    user?: Pick<User, "userId" | "username" | "email" | "role" | "status" | "createdAt"> | null;
    stegoFile?: Pick<StegoFile, "stegoFileId" | "stegoFileName"> | null;
  }
) {
  return {
    logId: log.logId,
    operationType: log.operationType,
    operationStatus: log.operationStatus,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
    user: log.user ? publicUser(log.user) : null,
    stegoFile: log.stegoFile
      ? {
          stegoFileId: log.stegoFile.stegoFileId,
          stegoFileName: log.stegoFile.stegoFileName
        }
      : null
  };
}

