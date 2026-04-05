import db
from fastapi import APIRouter

from config import DEFAULT_POSTS_PROMPT, DEFAULT_POSTS_LANGUAGE, DEFAULT_SHOWCASE_PROMPT, DEFAULT_COLOR_PALETTE, DEFAULT_CUSTOM_COLORS
from models import SettingsPayload

router = APIRouter()


@router.get("/api/settings/posts")
async def get_posts_settings():
    return {
        "posts_prompt": await db.get_setting("posts_prompt", DEFAULT_POSTS_PROMPT),
        "posts_language": await db.get_setting("posts_language", DEFAULT_POSTS_LANGUAGE),
        "showcase_prompt": await db.get_setting("showcase_prompt", DEFAULT_SHOWCASE_PROMPT),
        "color_palette": await db.get_setting("color_palette", DEFAULT_COLOR_PALETTE),
        "custom_colors": await db.get_setting("custom_colors", DEFAULT_CUSTOM_COLORS),
    }


@router.put("/api/settings/posts")
async def update_posts_settings(payload: SettingsPayload):
    if payload.posts_prompt is not None:
        await db.set_setting("posts_prompt", payload.posts_prompt)
    if payload.posts_language is not None:
        await db.set_setting("posts_language", payload.posts_language)
    if payload.showcase_prompt is not None:
        await db.set_setting("showcase_prompt", payload.showcase_prompt)
    if payload.color_palette is not None:
        await db.set_setting("color_palette", payload.color_palette)
    if payload.custom_colors is not None:
        await db.set_setting("custom_colors", payload.custom_colors)
    return {"ok": True}
