import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://swe_user:swe_password@localhost:5432/swe_steganography",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret-change-me",
  dataDir: path.resolve(process.env.DATA_DIR ?? "data"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024),
  clientDistDir: path.resolve("dist/client")
};

