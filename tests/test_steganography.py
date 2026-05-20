from __future__ import annotations

import pytest

from app.services.steganography import (
    CapacityError,
    InvalidPasswordError,
    NoHiddenDataError,
    PasswordRequiredError,
    UnsupportedImageError,
    embed_secret_in_cover,
    extract_secret_from_image,
)
from tests.conftest import image_bytes


def test_text_round_trip_without_password() -> None:
    stego = embed_secret_in_cover(
        image_bytes(),
        "cover.png",
        secret_data=b"semester demo",
        payload_kind="text",
        content_type="text/plain; charset=utf-8",
    )

    payload = extract_secret_from_image(stego)

    assert payload.kind == "text"
    assert payload.data == b"semester demo"
    assert payload.encrypted is False


def test_file_round_trip_with_password() -> None:
    stego = embed_secret_in_cover(
        image_bytes(),
        "cover.bmp",
        secret_data=b"\x00\x01secret-bytes",
        payload_kind="file",
        payload_filename="secret.bin",
        content_type="application/octet-stream",
        password="open-sesame",
    )

    payload = extract_secret_from_image(stego, password="open-sesame")

    assert payload.kind == "file"
    assert payload.filename == "secret.bin"
    assert payload.data == b"\x00\x01secret-bytes"
    assert payload.encrypted is True


def test_encrypted_payload_rejects_missing_and_wrong_password() -> None:
    stego = embed_secret_in_cover(
        image_bytes(),
        "cover.png",
        secret_data=b"private",
        payload_kind="text",
        password="right-password",
    )

    with pytest.raises(PasswordRequiredError):
        extract_secret_from_image(stego)

    with pytest.raises(InvalidPasswordError):
        extract_secret_from_image(stego, password="wrong-password")


def test_capacity_check_blocks_large_secret() -> None:
    with pytest.raises(CapacityError):
        embed_secret_in_cover(
            image_bytes(size=(2, 2)),
            "tiny.png",
            secret_data=b"x" * 100,
            payload_kind="text",
        )


def test_unsupported_and_non_stego_files_are_rejected() -> None:
    with pytest.raises(UnsupportedImageError):
        embed_secret_in_cover(
            image_bytes(image_format="JPEG"),
            "cover.jpg",
            secret_data=b"secret",
            payload_kind="text",
        )

    with pytest.raises(NoHiddenDataError):
        extract_secret_from_image(image_bytes())

