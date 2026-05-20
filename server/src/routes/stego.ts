import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";

import { prisma } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { requireUpload, safeFilename, saveStegoFile, sha256Digest } from "../services/files.js";
import { logOperation } from "../services/logging.js";
import {
  InvalidPasswordError,
  PasswordRequiredError,
  SteganographyError,
  embedSecretInCover,
  extractSecretFromImage
} from "../services/steganography.js";
import { serializeStegoFile } from "./serializers.js";

export const stegoRouter = Router();

stegoRouter.post(
  "/embed",
  requireUser,
  upload.fields([
    { name: "coverFile", maxCount: 1 },
    { name: "secretFile", maxCount: 1 }
  ]),
  async (req, res) => {
    const user = res.locals.user;
    try {
      const files = req.files as Record<string, Express.Multer.File[] | undefined>;
      const coverFile = requireUpload(files.coverFile?.[0], "Cover image");
      const secretText = String(req.body.secretText ?? "");
      const secretFile = files.secretFile?.[0];
      const hasText = secretText.trim().length > 0;
      const hasFile = Boolean(secretFile?.buffer?.length);
      if (hasText === hasFile) {
        throw new SteganographyError("Provide either secret text or one secret file.");
      }

      const payloadKind = hasText ? "text" : "file";
      const secretData = hasText ? Buffer.from(secretText, "utf8") : Buffer.from(secretFile!.buffer);
      const stegoBytes = embedSecretInCover({
        coverBytes: Buffer.from(coverFile.buffer),
        coverFilename: coverFile.originalname,
        secretData,
        payloadKind,
        payloadFilename: hasFile ? safeFilename(secretFile!.originalname, "secret-file") : null,
        contentType: hasText ? "text/plain; charset=utf-8" : secretFile?.mimetype ?? "application/octet-stream",
        password: String(req.body.stegoPassword ?? "").trim() || null
      });

      const saved = await saveStegoFile(stegoBytes, coverFile.originalname);
      const stegoRecord = await prisma.stegoFile.create({
        data: {
          userId: user.userId,
          coverFileName: safeFilename(coverFile.originalname, "cover"),
          stegoFileName: saved.generatedName,
          fileType: "image/png",
          fileSize: BigInt(stegoBytes.length),
          storagePath: saved.storagePath,
          sha256: sha256Digest(stegoBytes),
          passwordProtected: Boolean(String(req.body.stegoPassword ?? "").trim())
        }
      });
      await logOperation({
        userId: user.userId,
        stegoFileId: stegoRecord.stegoFileId,
        operationType: "Embed",
        operationStatus: "Success",
        message: `Created stego file ${saved.generatedName}.`
      });
      res.status(201).json({ file: serializeStegoFile(stegoRecord) });
    } catch (error) {
      await logOperation({
        userId: user.userId,
        operationType: "Embed",
        operationStatus: "Failed",
        message: error instanceof Error ? error.message : "Embedding failed."
      });
      res.status(400).json({ error: error instanceof Error ? error.message : "Embedding failed." });
    }
  }
);

stegoRouter.get("/files/:id/download", requireUser, async (req, res) => {
  const user = res.locals.user;
  const stegoFileId = Number(req.params.id);
  const file = await prisma.stegoFile.findUnique({ where: { stegoFileId } });
  if (!file || (file.userId !== user.userId && user.role !== "admin")) {
    res.status(404).json({ error: "File was not found." });
    return;
  }
  try {
    await fs.access(file.storagePath);
    res.download(file.storagePath, file.stegoFileName);
  } catch {
    res.status(404).json({ error: "Stored file was not found." });
  }
});

stegoRouter.post("/extract", requireUser, upload.single("stegoFile"), async (req, res) => {
  const user = res.locals.user;
  let matchedStegoFileId: number | null = null;
  try {
    const stegoFile = requireUpload(req.file, "Stego image");
    const stegoBytes = Buffer.from(stegoFile.buffer);
    const matched = await prisma.stegoFile.findFirst({ where: { sha256: sha256Digest(stegoBytes) } });
    matchedStegoFileId = matched?.stegoFileId ?? null;
    const payload = extractSecretFromImage(stegoBytes, String(req.body.stegoPassword ?? "").trim() || null);
    await logOperation({
      userId: user.userId,
      stegoFileId: matchedStegoFileId,
      operationType: "Extract",
      operationStatus: "Success",
      message: "Hidden payload extracted."
    });
    if (payload.kind === "file") {
      res.setHeader("Content-Type", payload.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(payload.filename ?? "extracted-secret.bin")}"`);
      res.send(payload.data);
      return;
    }
    res.json({ kind: payload.kind, text: payload.data.toString("utf8"), encrypted: payload.encrypted });
  } catch (error) {
    const statusText = error instanceof InvalidPasswordError || error instanceof PasswordRequiredError ? "Access Denied" : "Failed";
    await logOperation({
      userId: user.userId,
      stegoFileId: matchedStegoFileId,
      operationType: "Extract",
      operationStatus: statusText,
      message: error instanceof Error ? error.message : "Extraction failed."
    });
    res.status(400).json({ error: error instanceof Error ? error.message : "Extraction failed." });
  }
});

export async function removeGeneratedFiles() {
  const files = await prisma.stegoFile.findMany();
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(path.resolve(file.storagePath));
      } catch {
        // Best-effort cleanup for tests.
      }
    })
  );
}

