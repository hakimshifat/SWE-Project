import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";

import { config } from "../config.js";

export class FileServiceError extends Error {}

export async function ensureDataDirs() {
  await fs.mkdir(stegoDir(), { recursive: true });
}

export function stegoDir() {
  return path.join(config.dataDir, "stego");
}

export function safeFilename(filename: string | undefined, fallback = "file") {
  const base = path.basename(filename || fallback).trim().replace(/\s+/g, "_");
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+|[._]+$/g, "");
  return (cleaned || fallback).slice(0, 120);
}

export function sha256Digest(data: Buffer) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function saveStegoFile(stegoBytes: Buffer, coverFilename: string) {
  await ensureDataDirs();
  const original = safeFilename(coverFilename, "cover");
  const stem = path.parse(original).name || "cover";
  const generatedName = `${stem}-${uuidv4().replaceAll("-", "").slice(0, 12)}.png`;
  const storagePath = path.join(stegoDir(), generatedName);
  await fs.writeFile(storagePath, stegoBytes);
  return { storagePath, generatedName };
}

export function requireUpload(file: Express.Multer.File | undefined, label: string) {
  if (!file?.buffer?.length) {
    throw new FileServiceError(`${label} was not uploaded.`);
  }
  if (file.size > config.maxUploadBytes) {
    throw new FileServiceError(`${label} is too large.`);
  }
  return file;
}

