import io
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_BYTES = 5 * 1024 * 1024  # 5 MB per photo
MAX_SIDE = 1280              # longest side after resize
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

Image.MAX_IMAGE_PIXELS = 40_000_000  # giant "decompression bomb" images ko roko


def save_image(raw: bytes) -> str:
    """Validate, clean and save one image. Returns the stored file name."""
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Each photo must be 5 MB or smaller")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        img = Image.open(io.BytesIO(raw))
        if img.format not in ALLOWED_FORMATS:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG or WebP photos are allowed")

        img = ImageOps.exif_transpose(img)  # phone rotation theek karo
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            background = Image.new("RGB", img.size, "white")
            background.paste(img, mask=img.split()[-1])
            img = background
        else:
            img = img.convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE))

        name = uuid.uuid4().hex + ".jpg"
        # Dobara save karne se EXIF (GPS location etc.) hat jaata hai
        img.save(UPLOAD_DIR / name, "JPEG", quality=82, optimize=True)
        return name
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="Invalid or unsupported image file")


def delete_image(name: str) -> None:
    (UPLOAD_DIR / Path(name).name).unlink(missing_ok=True)