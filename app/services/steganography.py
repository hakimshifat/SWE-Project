from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from PIL import Image, UnidentifiedImageError

MAGIC = b"SIHS1"
FORMAT_VERSION = 1
KDF_ITERATIONS = 390_000
SUPPORTED_IMAGE_FORMATS = {"PNG", "BMP"}
SUPPORTED_EXTENSIONS = {".png", ".bmp"}


class SteganographyError(ValueError):
    pass


class UnsupportedImageError(SteganographyError):
    pass


class CapacityError(SteganographyError):
    pass


class NoHiddenDataError(SteganographyError):
    pass


class PasswordRequiredError(SteganographyError):
    pass


class InvalidPasswordError(SteganographyError):
    pass


@dataclass(slots=True)
class HiddenPayload:
    kind: str
    data: bytes
    filename: str | None
    content_type: str
    encrypted: bool


def embed_secret_in_cover(
    cover_bytes: bytes,
    cover_filename: str,
    *,
    secret_data: bytes,
    payload_kind: str,
    payload_filename: str | None = None,
    content_type: str | None = None,
    password: str | None = None,
) -> bytes:
    package = build_package(
        secret_data=secret_data,
        payload_kind=payload_kind,
        payload_filename=payload_filename,
        content_type=content_type,
        password=password,
    )
    image = open_supported_image(cover_bytes, cover_filename)
    return embed_package(image, package)


def extract_secret_from_image(stego_bytes: bytes, password: str | None = None) -> HiddenPayload:
    image = open_supported_image(stego_bytes, "stego.png", check_extension=False)
    package = extract_package(image)
    return parse_package(package, password=password)


def capacity_bytes(cover_bytes: bytes, cover_filename: str) -> int:
    image = open_supported_image(cover_bytes, cover_filename)
    return max((image.width * image.height * 3) // 8 - 4, 0)


def open_supported_image(image_bytes: bytes, filename: str, *, check_extension: bool = True) -> Image.Image:
    if check_extension and Path(filename).suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise UnsupportedImageError("Only PNG and BMP images are supported.")

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.format not in SUPPORTED_IMAGE_FORMATS:
                raise UnsupportedImageError("Only PNG and BMP images are supported.")
            image.load()
            return image.convert("RGB")
    except UnidentifiedImageError as exc:
        raise UnsupportedImageError("The uploaded file is not a readable image.") from exc


def build_package(
    *,
    secret_data: bytes,
    payload_kind: str,
    payload_filename: str | None,
    content_type: str | None,
    password: str | None,
) -> bytes:
    if payload_kind not in {"text", "file"}:
        raise SteganographyError("Secret payload must be text or file.")
    if not secret_data:
        raise SteganographyError("Secret payload cannot be empty.")

    encrypted = bool(password)
    payload_bytes = secret_data
    metadata: dict[str, object] = {
        "version": FORMAT_VERSION,
        "kind": payload_kind,
        "filename": payload_filename,
        "content_type": content_type or "application/octet-stream",
        "encrypted": encrypted,
    }

    if encrypted:
        salt = os.urandom(16)
        nonce = os.urandom(12)
        key = derive_key(password or "", salt, KDF_ITERATIONS)
        payload_bytes = AESGCM(key).encrypt(nonce, secret_data, MAGIC)
        metadata.update(
            {
                "kdf": {
                    "name": "PBKDF2HMAC-SHA256",
                    "iterations": KDF_ITERATIONS,
                    "salt": encode_b64(salt),
                },
                "nonce": encode_b64(nonce),
            }
        )

    header = json.dumps(metadata, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return MAGIC + len(header).to_bytes(4, "big") + header + payload_bytes


def parse_package(package: bytes, *, password: str | None) -> HiddenPayload:
    if not package.startswith(MAGIC):
        raise NoHiddenDataError("No hidden SIHS payload was found.")
    if len(package) < len(MAGIC) + 4:
        raise NoHiddenDataError("The hidden payload is incomplete.")

    offset = len(MAGIC)
    header_length = int.from_bytes(package[offset : offset + 4], "big")
    header_start = offset + 4
    header_end = header_start + header_length
    if header_length <= 0 or header_end > len(package):
        raise NoHiddenDataError("The hidden payload metadata is invalid.")

    try:
        metadata = json.loads(package[header_start:header_end].decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise NoHiddenDataError("The hidden payload metadata is invalid.") from exc

    if metadata.get("version") != FORMAT_VERSION:
        raise NoHiddenDataError("The hidden payload version is not supported.")

    payload_bytes = package[header_end:]
    encrypted = bool(metadata.get("encrypted"))
    if encrypted:
        if not password:
            raise PasswordRequiredError("A password is required to extract this payload.")
        try:
            kdf = metadata["kdf"]
            salt = decode_b64(str(kdf["salt"]))
            iterations = int(kdf["iterations"])
            nonce = decode_b64(str(metadata["nonce"]))
            key = derive_key(password, salt, iterations)
            payload_bytes = AESGCM(key).decrypt(nonce, payload_bytes, MAGIC)
        except (KeyError, ValueError, TypeError, InvalidTag) as exc:
            raise InvalidPasswordError("The provided password is incorrect.") from exc

    kind = str(metadata.get("kind") or "")
    if kind not in {"text", "file"}:
        raise NoHiddenDataError("The hidden payload type is not supported.")

    filename = metadata.get("filename")
    return HiddenPayload(
        kind=kind,
        data=payload_bytes,
        filename=str(filename) if filename else None,
        content_type=str(metadata.get("content_type") or "application/octet-stream"),
        encrypted=encrypted,
    )


def embed_package(image: Image.Image, package: bytes) -> bytes:
    frame = len(package).to_bytes(4, "big") + package
    capacity_bits = image.width * image.height * 3
    required_bits = len(frame) * 8
    if required_bits > capacity_bits:
        raise CapacityError(
            f"Secret payload needs {required_bits // 8} bytes, but this image can hold {capacity_bits // 8} bytes."
        )

    channels = rgb_channels(image)
    for index, bit in enumerate(bytes_to_bits(frame)):
        channels[index] = (channels[index] & 0xFE) | bit

    pixels = [tuple(channels[index : index + 3]) for index in range(0, len(channels), 3)]
    output = Image.new("RGB", image.size)
    output.putdata(pixels)

    buffer = BytesIO()
    output.save(buffer, format="PNG")
    return buffer.getvalue()


def extract_package(image: Image.Image) -> bytes:
    channels = rgb_channels(image)
    if len(channels) < 32:
        raise NoHiddenDataError("No hidden SIHS payload was found.")

    package_length = int.from_bytes(bits_to_bytes((channel & 1 for channel in channels[:32]), 4), "big")
    capacity = len(channels) // 8 - 4
    if package_length <= 0 or package_length > capacity:
        raise NoHiddenDataError("No hidden SIHS payload was found.")

    start = 32
    end = start + package_length * 8
    package = bits_to_bytes((channel & 1 for channel in channels[start:end]), package_length)
    if not package.startswith(MAGIC):
        raise NoHiddenDataError("No hidden SIHS payload was found.")
    return package


def derive_key(password: str, salt: bytes, iterations: int) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(password.encode("utf-8"))


def rgb_channels(image: Image.Image) -> list[int]:
    if hasattr(image, "get_flattened_data"):
        pixels = image.get_flattened_data()
    else:
        pixels = image.getdata()
    return [channel for pixel in pixels for channel in pixel[:3]]


def bytes_to_bits(data: bytes):
    for byte in data:
        for shift in range(7, -1, -1):
            yield (byte >> shift) & 1


def bits_to_bytes(bits, byte_count: int) -> bytes:
    output = bytearray()
    current = 0
    for index, bit in enumerate(bits, start=1):
        current = (current << 1) | int(bit)
        if index % 8 == 0:
            output.append(current)
            current = 0
            if len(output) == byte_count:
                break
    if len(output) != byte_count:
        raise NoHiddenDataError("The hidden payload is incomplete.")
    return bytes(output)


def encode_b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii")


def decode_b64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data.encode("ascii"))
