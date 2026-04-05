import db
from fastapi import APIRouter, HTTPException

from config import GALLERY_DIR
from models import ShowcaseGenerateRequest
from services.showcase_service import generate_showcase_image, like_showcase

router = APIRouter()


@router.post("/api/showcase/generate")
async def generate_showcase(body: ShowcaseGenerateRequest = None):
    """Generate a new showcase image. Accepts optional base_prompt override."""
    override = body.base_prompt if body else None
    url, prompt, error = await generate_showcase_image(base_prompt_override=override)
    if error:
        raise HTTPException(400, error)
    return {"url": url, "prompt": prompt}


@router.get("/api/showcase")
async def get_showcase():
    """Get current showcase image URL."""
    url = await db.get_setting("current_showcase_url", None)
    return {"url": url}


@router.post("/api/showcase/like")
async def like_showcase_endpoint():
    """Like current showcase image - save to gallery."""
    try:
        return await like_showcase()
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Failed to download image: {e}")


@router.get("/api/gallery")
async def list_gallery():
    """List all gallery images."""
    images = await db.get_gallery_images()
    for img in images:
        img["url"] = f"/gallery/{img['filename']}"
    return images


@router.post("/api/gallery/{image_id}/activate")
async def activate_gallery_image(image_id: int):
    """Set a gallery image as the current showcase."""
    images = await db.get_gallery_images()
    img = next((i for i in images if i["id"] == image_id), None)
    if not img:
        raise HTTPException(404, "Image not found")

    src_path = GALLERY_DIR / img["filename"]
    if not src_path.exists():
        raise HTTPException(404, "Image file not found")

    gallery_url = f"/gallery/{img['filename']}"
    await db.set_setting("current_showcase_url", gallery_url)
    return {"url": gallery_url}


@router.delete("/api/gallery/{image_id}")
async def delete_gallery_image(image_id: int):
    """Delete a gallery image."""
    images = await db.get_gallery_images()
    img = next((i for i in images if i["id"] == image_id), None)
    if img:
        fpath = GALLERY_DIR / img["filename"]
        if fpath.exists():
            fpath.unlink()
    await db.delete_gallery_image(image_id)
    return {"ok": True}
