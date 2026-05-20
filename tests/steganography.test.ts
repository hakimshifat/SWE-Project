import {
  CapacityError,
  InvalidPasswordError,
  NoHiddenDataError,
  PasswordRequiredError,
  UnsupportedImageError,
  embedSecretInCover,
  extractSecretFromImage
} from "../server/src/services/steganography";
import { pngBytes } from "./helpers";

describe("steganography service", () => {
  it("round-trips text without a password", () => {
    const stego = embedSecretInCover({
      coverBytes: pngBytes(),
      coverFilename: "cover.png",
      secretData: Buffer.from("semester demo"),
      payloadKind: "text",
      contentType: "text/plain; charset=utf-8"
    });

    const payload = extractSecretFromImage(stego);

    expect(payload.kind).toBe("text");
    expect(payload.data.toString("utf8")).toBe("semester demo");
    expect(payload.encrypted).toBe(false);
  });

  it("round-trips a file with a password", () => {
    const stego = embedSecretInCover({
      coverBytes: pngBytes(),
      coverFilename: "cover.png",
      secretData: Buffer.from([0, 1, 2, 3]),
      payloadKind: "file",
      payloadFilename: "secret.bin",
      contentType: "application/octet-stream",
      password: "open-sesame"
    });

    const payload = extractSecretFromImage(stego, "open-sesame");

    expect(payload.kind).toBe("file");
    expect(payload.filename).toBe("secret.bin");
    expect(payload.data).toEqual(Buffer.from([0, 1, 2, 3]));
    expect(payload.encrypted).toBe(true);
  });

  it("rejects missing and wrong passwords", () => {
    const stego = embedSecretInCover({
      coverBytes: pngBytes(),
      coverFilename: "cover.png",
      secretData: Buffer.from("private"),
      payloadKind: "text",
      password: "correct"
    });

    expect(() => extractSecretFromImage(stego)).toThrow(PasswordRequiredError);
    expect(() => extractSecretFromImage(stego, "wrong")).toThrow(InvalidPasswordError);
  });

  it("checks capacity", () => {
    expect(() =>
      embedSecretInCover({
        coverBytes: pngBytes(2, 2),
        coverFilename: "tiny.png",
        secretData: Buffer.from("x".repeat(100)),
        payloadKind: "text"
      })
    ).toThrow(CapacityError);
  });

  it("rejects unsupported and non-stego images", () => {
    expect(() =>
      embedSecretInCover({
        coverBytes: Buffer.from("not an image"),
        coverFilename: "cover.jpg",
        secretData: Buffer.from("secret"),
        payloadKind: "text"
      })
    ).toThrow(UnsupportedImageError);

    expect(() => extractSecretFromImage(pngBytes())).toThrow(NoHiddenDataError);
  });
});

