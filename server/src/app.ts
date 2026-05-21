import connectPgSimple from "connect-pg-simple";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import session from "express-session";
import multer from "multer";
import path from "node:path";
import pg from "pg";

import { config } from "./config.js";
import { ensureDataDirs } from "./services/files.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { stegoRouter } from "./routes/stego.js";

export async function createApp() {
  await ensureDataDirs();
  const app = express();
  const PgSession = connectPgSimple(session);
  const pgPool = new pg.Pool({ connectionString: config.databaseUrl });
  const isProduction = config.nodeEnv === "production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(
    session({
      store: new PgSession({
        pool: pgPool,
        createTableIfMissing: true
      }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );

  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/stego", stegoRouter);
  app.use("/api/admin", adminRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  if (config.nodeEnv === "production") {
    app.use(express.static(config.clientDistDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(config.clientDistDir, "index.html"));
    });
  }

  app.use(apiErrorHandler);

  return app;
}

function apiErrorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    return;
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large." : "Invalid file upload.";
    res.status(400).json({ error: message });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Request body is not valid JSON." });
    return;
  }

  res.status(500).json({ error: "Internal server error." });
}
