import asyncio
import json

import db
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from config import POST_IMAGES_DIR
from models import PostPayload, TitlePayload, SummaryChatPayload, SaveSummaryPayload
from services.post_service import (
    download_post_images,
    auto_generate_post_metadata,
    generate_summary,
    generate_title,
    search_and_stream,
    stream_summary_chat,
    save_summary_from_text,
)

router = APIRouter()


async def add_to_ov(source_url: str):
    """Best-effort: add saved post URL to OpenViking for knowledge indexing."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "/Users/bytedance/.local/bin/ov", "add-resource", source_url,
            "--reason", "Saved post to localweb",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            print(f"[ov] added resource: {source_url}")
        else:
            print(f"[ov] failed (rc={proc.returncode}): {stderr.decode().strip()}")
    except Exception as e:
        print(f"[ov] error adding resource: {e}")


@router.post("/api/posts")
async def save_post(payload: PostPayload):
    # Clean up old images if re-saving the same URL
    old_post = await db.get_post_by_url(payload.source_url)
    if old_post:
        for filename in old_post.get("local_images", []):
            fpath = POST_IMAGES_DIR / filename
            if fpath.exists():
                fpath.unlink()
        for f in POST_IMAGES_DIR.glob(f"{old_post['id']}_avatar.*"):
            f.unlink()

    post_id = await db.create_post(
        payload.source_url, payload.author_name, payload.author_handle,
        payload.author_avatar_url, payload.content_markdown,
        payload.image_urls, payload.post_type, payload.posted_at,
    )
    # Download images in background
    asyncio.create_task(download_post_images(
        post_id, payload.image_urls, payload.author_avatar_url, payload.content_markdown
    ))
    asyncio.create_task(auto_generate_post_metadata(post_id))
    asyncio.create_task(add_to_ov(payload.source_url))
    return {"id": post_id}


@router.get("/api/posts")
async def list_posts():
    return await db.get_all_posts()


@router.get("/api/posts/search")
async def search_posts(q: str, request: Request):
    """Search posts and stream LLM answer with relevant sources via SSE."""
    async def event_stream():
        try:
            async for event_type, data in search_and_stream(q):
                if await request.is_disconnected():
                    break
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/api/posts/{post_id}")
async def get_post(post_id: int):
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    return post


@router.delete("/api/posts/{post_id}")
async def delete_post(post_id: int):
    post = await db.get_post(post_id)
    if post:
        for filename in post.get("local_images", []):
            fpath = POST_IMAGES_DIR / filename
            if fpath.exists():
                fpath.unlink()
        for f in POST_IMAGES_DIR.glob(f"{post_id}_avatar.*"):
            f.unlink()
    await db.delete_post(post_id)
    return {"ok": True}


@router.post("/api/posts/{post_id}/summarize")
async def summarize_post(post_id: int):
    """Generate bilingual summary for a post using chat completion API."""
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    summary_json = await generate_summary(post_id)
    if summary_json is None:
        raise HTTPException(400, "No chat completion API found. Create one in APIs section first.")
    return summary_json


@router.put("/api/posts/{post_id}/title")
async def update_post_title_endpoint(post_id: int, payload: TitlePayload):
    """Update post title (manual rename)."""
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    await db.update_post_title(post_id, payload.title)
    return {"ok": True}


@router.post("/api/posts/{post_id}/generate-title")
async def generate_post_title(post_id: int):
    """Generate a short title for a post using completion API."""
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    title = await generate_title(post_id)
    if title is None:
        raise HTTPException(400, "No chat completion API found.")
    return {"title": title}


@router.post("/api/posts/{post_id}/summary-chat")
async def summary_chat(post_id: int, payload: SummaryChatPayload, request: Request):
    """Stream a chat completion for iterating on a post's summary."""
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]

    async def event_stream():
        try:
            async for event_type, data in stream_summary_chat(post_id, messages):
                if await request.is_disconnected():
                    break
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/posts/{post_id}/save-summary")
async def save_summary_endpoint(post_id: int, payload: SaveSummaryPayload):
    """Save a summary from chat text (parses en/zh JSON if present)."""
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    summary_json = await save_summary_from_text(post_id, payload.summary_text)
    return summary_json
