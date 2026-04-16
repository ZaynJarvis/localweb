import asyncio
import json

import db
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from config import POST_IMAGES_DIR
from models import PostPayload, TitlePayload, SummaryChatPayload, SaveSummaryPayload, TagsPayload, BulkTagsPayload
from services.post_service import (
    download_post_images,
    auto_generate_post_metadata,
    generate_summary,
    generate_title,
    search_and_stream,
    stream_summary_chat,
    save_summary_from_text,
    add_post_to_ov,
    ov_find,
)

router = APIRouter()


async def _ingest_post_to_ov_with_delay(post_id: int, delay_seconds: float = 2.0):
    """Wait briefly so auto-generated title/summary can land, then ingest."""
    try:
        await asyncio.sleep(delay_seconds)
        await add_post_to_ov(post_id)
    except Exception as e:
        print(f"[ov] delayed ingest error post {post_id}: {e}")


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
    # Delay so title/summary can be generated before ingestion; ingest includes post-id.
    asyncio.create_task(_ingest_post_to_ov_with_delay(post_id, delay_seconds=45.0))
    return {"id": post_id}


@router.get("/api/posts")
async def list_posts():
    return await db.get_all_posts()


@router.get("/api/posts/find")
async def find_posts(q: str, threshold: float = 0.35):
    """Semantic search via `ov find`. Returns mixed list of post/memory cards sorted by score."""
    q = (q or "").strip()
    if not q:
        return {"items": []}
    items = await ov_find(q, threshold=threshold)
    return {"items": items}


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


@router.post("/api/posts/tags/bulk")
async def bulk_update_tags(payload: BulkTagsPayload):
    """Bulk-set tags keyed by source_url. Returns counts of matched/unmatched URLs."""
    matched = []
    unmatched = []
    for url, tags in payload.by_url.items():
        rowcount = await db.update_post_tags_by_url(url, tags)
        (matched if rowcount else unmatched).append(url)
    return {"matched": len(matched), "unmatched": unmatched}


@router.put("/api/posts/{post_id}/tags")
async def update_post_tags_endpoint(post_id: int, payload: TagsPayload):
    post = await db.get_post(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    await db.update_post_tags(post_id, payload.tags)
    return {"ok": True, "tags": payload.tags}


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
