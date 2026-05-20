export type UserRole = "user" | "admin";
export type UserStatus = "active" | "inactive" | "blocked";

export interface PublicUser {
  userId: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface StegoFileSummary {
  stegoFileId: number;
  coverFileName: string;
  stegoFileName: string;
  fileType: string;
  fileSize: string;
  passwordProtected: boolean;
  createdAt: string;
}

export interface OperationLogSummary {
  logId: number;
  operationType: string;
  operationStatus: string;
  message: string;
  createdAt: string;
  user?: Pick<PublicUser, "userId" | "username" | "email"> | null;
  stegoFile?: Pick<StegoFileSummary, "stegoFileId" | "stegoFileName"> | null;
}

