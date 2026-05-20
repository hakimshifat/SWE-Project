import crypto from "node:crypto";
import path from "node:path";
import bmp from "bmp-js";
import { PNG } from "pngjs";

const MAGIC = Buffer.from("SIHS1", "ascii");
const FORMAT_VERSION = 1;
const KDF_ITERATIONS = 390_000;
const SUPPORTED_EXTENSIONS = new Set([".png", ".bmp"]);

export class SteganographyError extends Error {}
export class UnsupportedImageError extends SteganographyError {}
export class CapacityError extends SteganographyError {}
export class NoHiddenDataError extends SteganographyError {}
export class PasswordRequiredError extends SteganographyError {}
export class InvalidPasswordError extends SteganographyError {}

export interface HiddenPayload {
  kind: "text" | "file";
  data: Buffer;
  filename: string | null;
  contentType: string;
  encrypted: boolean;
}

interface RgbaImage {
  width: number;
  height: number;
  data: Buffer;
}

export function embedSecretInCover(input: {
  coverBytes: Buffer;
  coverFilename: string;
  secretData: Buffer;
  payloadKind: "text" | "file";
  payloadFilename?: string | null;
  contentType?: string | null;
  password?: string | null;
}) {
  const packageBytes = buildPackage({
    secretData: input.secretData,
    payloadKind: input.payloadKind,
    payloadFilename: input.payloadFilename ?? null,
    contentType: input.contentType ?? "application/octet-stream",
    password: input.password ?? null
  });
  const image = decodeSupportedImage(input.coverBytes, input.coverFilename);
  return embedPackage(image, packageBytes);
}

export function extractSecretFromImage(stegoBytes: Buffer, password?: string | null): HiddenPayload {
  const image = decodeSupportedImage(stegoBytes, "stego.png", false);
  const packageBytes = extractPackage(image);
  return parsePackage(packageBytes, password ?? null);
}

export function buildPackage(input: {
  secretData: Buffer;
  payloadKind: "text" | "file";
  payloadFilename: string | null;
  contentType: string;
  password: string | null;
}) {
  if (!input.secretData.length) {
    throw new SteganographyError("Secret payload cannot be empty.");
  }

  const encrypted = Boolean(input.password);
  let payloadBytes = input.secretData;
  const metadata: Record<string, unknown> = {
    version: FORMAT_VERSION,
    kind: input.payloadKind,
    filename: input.payloadFilename,
    content_type: input.contentType,
    encrypted
  };

  if (encrypted) {
    const salt = crypto.randomBytes(16);
    const nonce = crypto.randomBytes(12);
    const key = deriveKey(input.password || "", salt, KDF_ITERATIONS);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(MAGIC);
    payloadBytes = Buffer.concat([cipher.update(input.secretData), cipher.final()]);
    const authTag = cipher.getAuthTag();
    metadata.kdf = {
      name: "PBKDF2HMAC-SHA256",
      iterations: KDF_ITERATIONS,
      salt: salt.toString("base64url")
    };
    metadata.nonce = nonce.toString("base64url");
    metadata.auth_tag = authTag.toString("base64url");
  }

  const header = Buffer.from(JSON.stringify(metadata), "utf8");
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(header.length, 0);
  return Buffer.concat([MAGIC, headerLength, header, payloadBytes]);
}

export function parsePackage(packageBytes: Buffer, password: string | null): HiddenPayload {
  if (!packageBytes.subarray(0, MAGIC.length).equals(MAGIC) || packageBytes.length < MAGIC.length + 4) {
    throw new NoHiddenDataError("No hidden SIHS payload was found.");
  }

  const headerLength = packageBytes.readUInt32BE(MAGIC.length);
  const headerStart = MAGIC.length + 4;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd > packageBytes.length) {
    throw new NoHiddenDataError("The hidden payload metadata is invalid.");
  }

  let metadata: Record<string, unknown>;
  try {
    metadata = JSON.parse(packageBytes.subarray(headerStart, headerEnd).toString("utf8"));
  } catch (error) {
    throw new NoHiddenDataError("The hidden payload metadata is invalid.");
  }

  if (metadata.version !== FORMAT_VERSION || (metadata.kind !== "text" && metadata.kind !== "file")) {
    throw new NoHiddenDataError("The hidden payload version or type is not supported.");
  }

  let payloadBytes = packageBytes.subarray(headerEnd);
  const encrypted = Boolean(metadata.encrypted);
  if (encrypted) {
    if (!password) {
      throw new PasswordRequiredError("A password is required to extract this payload.");
    }
    try {
      const kdf = metadata.kdf as { salt: string; iterations: number } | undefined;
      const salt = Buffer.from(String(kdf?.salt ?? ""), "base64url");
      const iterations = Number(kdf?.iterations ?? 0);
      const nonce = Buffer.from(String(metadata.nonce ?? ""), "base64url");
      const authTag = Buffer.from(String(metadata.auth_tag ?? ""), "base64url");
      const key = deriveKey(password, salt, iterations);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(MAGIC);
      decipher.setAuthTag(authTag);
      payloadBytes = Buffer.concat([decipher.update(payloadBytes), decipher.final()]);
    } catch (error) {
      throw new InvalidPasswordError("The provided password is incorrect.");
    }
  }

  return {
    kind: metadata.kind,
    data: payloadBytes,
    filename: metadata.filename ? String(metadata.filename) : null,
    contentType: String(metadata.content_type ?? "application/octet-stream"),
    encrypted
  };
}

function decodeSupportedImage(bytes: Buffer, filename: string, checkExtension = true): RgbaImage {
  const extension = path.extname(filename).toLowerCase();
  if (checkExtension && !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new UnsupportedImageError("Only PNG and BMP images are supported.");
  }

  if (!checkExtension || extension === ".png") {
    try {
      const png = PNG.sync.read(bytes);
      return { width: png.width, height: png.height, data: Buffer.from(png.data) };
    } catch (error) {
      if (checkExtension) {
        throw new UnsupportedImageError("The uploaded file is not a readable PNG image.");
      }
    }
  }

  if (extension === ".bmp") {
    try {
      const decoded = bmp.decode(bytes);
      return { width: decoded.width, height: decoded.height, data: Buffer.from(decoded.data) };
    } catch (error) {
      throw new UnsupportedImageError("The uploaded file is not a readable BMP image.");
    }
  }

  throw new UnsupportedImageError("Only PNG and BMP images are supported.");
}

function embedPackage(image: RgbaImage, packageBytes: Buffer) {
  const frame = Buffer.alloc(4 + packageBytes.length);
  frame.writeUInt32BE(packageBytes.length, 0);
  packageBytes.copy(frame, 4);
  const capacityBits = image.width * image.height * 3;
  const requiredBits = frame.length * 8;
  if (requiredBits > capacityBits) {
    throw new CapacityError(
      `Secret payload needs ${frame.length} bytes, but this image can hold ${Math.floor(capacityBits / 8)} bytes.`
    );
  }

  let bitIndex = 0;
  for (const byte of frame) {
    for (let shift = 7; shift >= 0; shift -= 1) {
      const bit = (byte >> shift) & 1;
      const pixelIndex = Math.floor(bitIndex / 3) * 4;
      const channel = bitIndex % 3;
      image.data[pixelIndex + channel] = (image.data[pixelIndex + channel] & 0xfe) | bit;
      bitIndex += 1;
    }
  }

  const png = new PNG({ width: image.width, height: image.height, inputColorType: 6 });
  image.data.copy(png.data);
  return PNG.sync.write(png);
}

function extractPackage(image: RgbaImage) {
  if (image.width * image.height * 3 < 32) {
    throw new NoHiddenDataError("No hidden SIHS payload was found.");
  }

  const packageLengthBuffer = readBits(image, 0, 32);
  const packageLength = packageLengthBuffer.readUInt32BE(0);
  const capacity = Math.floor((image.width * image.height * 3) / 8) - 4;
  if (packageLength <= 0 || packageLength > capacity) {
    throw new NoHiddenDataError("No hidden SIHS payload was found.");
  }

  const packageBytes = readBits(image, 32, packageLength * 8);
  if (!packageBytes.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new NoHiddenDataError("No hidden SIHS payload was found.");
  }
  return packageBytes;
}

function readBits(image: RgbaImage, startBit: number, bitCount: number) {
  const output = Buffer.alloc(Math.ceil(bitCount / 8));
  for (let i = 0; i < bitCount; i += 1) {
    const bitIndex = startBit + i;
    const pixelIndex = Math.floor(bitIndex / 3) * 4;
    const channel = bitIndex % 3;
    const bit = image.data[pixelIndex + channel] & 1;
    output[Math.floor(i / 8)] = (output[Math.floor(i / 8)] << 1) | bit;
  }
  return output;
}

function deriveKey(password: string, salt: Buffer, iterations: number) {
  if (!salt.length || !iterations) {
    throw new InvalidPasswordError("The provided password is incorrect.");
  }
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}
