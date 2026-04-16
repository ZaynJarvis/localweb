import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.post_service import _find_chat_api, _call_chat_api

TERMINAL_LOGGER_DIR = Path.home() / ".tmux-journal"      # data directory
TERMINAL_LOGGER_SRC = Path.home() / "code" / "tmux-journal"  # source/scripts directory
SUMMARY_LOG = TERMINAL_LOGGER_DIR / "summary.log"
DEBUG_LOG = TERMINAL_LOGGER_DIR / "debug.log"
SUMMARIZE_PY = TERMINAL_LOGGER_SRC / "summarize.py"
VENV_PYTHON = TERMINAL_LOGGER_SRC / ".venv" / "bin" / "python"
MEMORY_DIR = TERMINAL_LOGGER_DIR / "memory"
TOPICS_JSON = MEMORY_DIR / "topics.json"
OVERVIEW_MD = MEMORY_DIR / "overview.md"
MEMORY_PY = TERMINAL_LOGGER_SRC / "memory.py"
ENTITIES_JSON = MEMORY_DIR / "entities.json"

router = APIRouter()


@router.get("/api/logger/summary")
async def get_summary():
    """Read the current LLM-generated summary from summary.log."""
    if not SUMMARY_LOG.exists():
        return {"content": "", "generated_at": None, "exists": False}

    content = SUMMARY_LOG.read_text()
    mtime = SUMMARY_LOG.stat().st_mtime
    generated_at = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
    return {"content": content, "generated_at": generated_at, "exists": True}


@router.post("/api/logger/regenerate")
async def regenerate_summary():
    """Run summarize.py to regenerate summary.log, then return the updated content."""
    if not VENV_PYTHON.exists():
        raise HTTPException(500, f"Python venv not found at {VENV_PYTHON}")
    if not SUMMARIZE_PY.exists():
        raise HTTPException(500, f"summarize.py not found at {SUMMARIZE_PY}")

    try:
        proc = await asyncio.create_subprocess_exec(
            str(VENV_PYTHON),
            str(SUMMARIZE_PY),
            cwd=str(TERMINAL_LOGGER_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(504, "summarize.py timed out after 120s")
    except Exception as e:
        raise HTTPException(500, f"Failed to run summarize.py: {e}")

    if proc.returncode != 0:
        err_text = stderr.decode(errors="replace").strip()
        raise HTTPException(500, f"summarize.py exited with code {proc.returncode}: {err_text}")

    if not SUMMARY_LOG.exists():
        return {"content": "", "generated_at": None, "exists": False}

    content = SUMMARY_LOG.read_text()
    mtime = SUMMARY_LOG.stat().st_mtime
    generated_at = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
    return {"content": content, "generated_at": generated_at, "exists": True}


@router.get("/api/logger/status")
async def get_status():
    """Return pane count, last capture time, and total log entry count."""
    pane_logs = list(TERMINAL_LOGGER_DIR.glob("pane_*.log"))
    pane_count = len(pane_logs)

    # Determine last capture time from the most recently modified pane log or debug.log
    candidate_files = pane_logs[:]
    if DEBUG_LOG.exists():
        candidate_files.append(DEBUG_LOG)

    last_capture_at = None
    if candidate_files:
        latest_file = max(candidate_files, key=lambda p: p.stat().st_mtime)
        latest_mtime = latest_file.stat().st_mtime
        last_capture_at = datetime.fromtimestamp(latest_mtime, tz=timezone.utc).isoformat()

    # Count total non-empty lines across all pane logs and debug.log
    total_entries = 0
    for log_file in candidate_files:
        try:
            lines = log_file.read_text(errors="replace").splitlines()
            total_entries += sum(1 for line in lines if line.strip())
        except OSError:
            pass

    return {
        "pane_count": pane_count,
        "last_capture_at": last_capture_at,
        "total_entries": total_entries,
    }


@router.get("/api/logger/logs")
async def list_logs():
    """List available pane log files with metadata."""
    pane_logs = sorted(TERMINAL_LOGGER_DIR.glob("pane_*.log"), key=lambda p: p.name)
    logs = []
    for log_file in pane_logs:
        stat = log_file.stat()
        text = log_file.read_text(errors="replace")
        line_count = sum(1 for line in text.splitlines() if line.strip())
        name_file = log_file.with_suffix(".name")
        pane_name = name_file.read_text().strip() if name_file.exists() else None
        logs.append({
            "name": log_file.name,
            "pane_name": pane_name,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "line_count": line_count,
        })
    return {"logs": logs}


@router.get("/api/logger/logs/{name}")
async def get_log(name: str):
    """Read content of a specific pane log file."""
    if not re.match(r'^pane_%\w+\.log$', name):
        raise HTTPException(400, "Invalid log name")
    log_file = TERMINAL_LOGGER_DIR / name
    if not log_file.exists():
        raise HTTPException(404, "Log not found")
    content = log_file.read_text(errors="replace")
    mtime = log_file.stat().st_mtime
    return {
        "name": name,
        "content": content,
        "modified_at": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
    }


# --- Memory endpoints ---


def _load_entities() -> dict:
    """Read entities.json, return full structure or empty default."""
    if not ENTITIES_JSON.exists():
        return {"version": 1, "entities": [], "consolidated_at": None}
    try:
        return json.loads(ENTITIES_JSON.read_text())
    except (json.JSONDecodeError, OSError):
        return {"version": 1, "entities": [], "consolidated_at": None}


def _load_topics() -> list:
    """Read topics.json and return the topics list, or empty list on any error."""
    if not TOPICS_JSON.exists():
        return []
    try:
        data = json.loads(TOPICS_JSON.read_text())
        return data.get("topics", [])
    except (json.JSONDecodeError, OSError):
        return []


@router.get("/api/logger/memory")
async def get_memory():
    """Return memory overview and topic list."""
    overview = ""
    overview_generated_at = None
    if OVERVIEW_MD.exists():
        try:
            overview = OVERVIEW_MD.read_text()
            mtime = OVERVIEW_MD.stat().st_mtime
            overview_generated_at = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
        except OSError:
            pass

    topics = _load_topics()
    return {
        "overview": overview,
        "overview_generated_at": overview_generated_at,
        "topics": topics,
    }


@router.get("/api/logger/memory/{slug}")
async def get_memory_topic(slug: str):
    """Return a single topic's content and metadata."""
    if not re.match(r'^[a-z0-9_-]+$', slug):
        raise HTTPException(400, "Invalid slug format")

    topic_file = MEMORY_DIR / f"topic_{slug}.md"
    if not topic_file.exists():
        raise HTTPException(404, "Topic not found")

    content = topic_file.read_text(errors="replace")

    # Find metadata from topics.json
    topics = _load_topics()
    meta = next((t for t in topics if t.get("slug") == slug), {})

    return {
        "slug": slug,
        "name": meta.get("name", slug),
        "category": meta.get("category", ""),
        "status": meta.get("status", ""),
        "content": content,
        "updated_at": meta.get("updated_at"),
        "entry_count": meta.get("entry_count", 0),
    }


@router.post("/api/logger/memory/refresh")
async def refresh_memory():
    """Run memory.py update to refresh memory from latest summary, then return updated state."""
    if not VENV_PYTHON.exists():
        raise HTTPException(500, f"Python venv not found at {VENV_PYTHON}")
    if not MEMORY_PY.exists():
        raise HTTPException(500, f"memory.py not found at {MEMORY_PY}")

    try:
        proc = await asyncio.create_subprocess_exec(
            str(VENV_PYTHON),
            str(MEMORY_PY),
            "update",
            cwd=str(TERMINAL_LOGGER_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=180)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(504, "memory.py update timed out after 180s")
    except Exception as e:
        raise HTTPException(500, f"Failed to run memory.py update: {e}")

    if proc.returncode != 0:
        err_text = stderr.decode(errors="replace").strip()
        raise HTTPException(500, f"memory.py update exited with code {proc.returncode}: {err_text}")

    return await get_memory()


@router.post("/api/logger/memory/merge")
async def merge_memory_topics(body: dict):
    """Merge two topics by slug."""
    slug_a = body.get("slug_a", "")
    slug_b = body.get("slug_b", "")

    if not re.match(r'^[a-z0-9_-]+$', slug_a) or not re.match(r'^[a-z0-9_-]+$', slug_b):
        raise HTTPException(400, "Invalid slug format")

    if not VENV_PYTHON.exists():
        raise HTTPException(500, f"Python venv not found at {VENV_PYTHON}")
    if not MEMORY_PY.exists():
        raise HTTPException(500, f"memory.py not found at {MEMORY_PY}")

    try:
        proc = await asyncio.create_subprocess_exec(
            str(VENV_PYTHON),
            str(MEMORY_PY),
            "merge",
            slug_a,
            slug_b,
            cwd=str(TERMINAL_LOGGER_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(504, "memory.py merge timed out after 120s")
    except Exception as e:
        raise HTTPException(500, f"Failed to run memory.py merge: {e}")

    if proc.returncode != 0:
        err_text = stderr.decode(errors="replace").strip()
        raise HTTPException(500, f"memory.py merge exited with code {proc.returncode}: {err_text}")

    topics = _load_topics()
    return {"topics": topics}


# --- Entity endpoints ---


@router.get("/api/logger/entities")
async def get_entities():
    data = _load_entities()
    entities = data.get("entities", [])
    # Normalize field names (backend uses entity_slug/entity_name, frontend expects slug/name)
    normalized = []
    for e in entities:
        normalized.append({
            "slug": e.get("entity_slug") or e.get("slug", ""),
            "name": e.get("entity_name") or e.get("name", ""),
            "category": e.get("category", ""),
            "topic_count": len(e.get("topic_slugs", [])),
            "original_slugs": e.get("topic_slugs", []),
        })
    return {
        "entities": normalized,
        "consolidated_at": data.get("consolidated_at") or data.get("created_at"),
    }


@router.get("/api/logger/entities/{slug}")
async def get_entity(slug: str):
    if not re.match(r'^[a-z0-9_-]+$', slug):
        raise HTTPException(400, "Invalid slug format")

    entity_file = MEMORY_DIR / f"entity_{slug}.md"
    if not entity_file.exists():
        raise HTTPException(404, "Entity not found")

    content = entity_file.read_text(errors="replace")

    # Find metadata from entities.json (backend uses entity_slug key)
    data = _load_entities()
    meta = next(
        (e for e in data.get("entities", [])
         if (e.get("entity_slug") or e.get("slug")) == slug),
        {},
    )

    return {
        "slug": slug,
        "name": meta.get("entity_name") or meta.get("name", slug),
        "category": meta.get("category", ""),
        "content": content,
        "updated_at": meta.get("updated_at"),
        "topic_count": len(meta.get("topic_slugs", [])),
        "event_count": meta.get("event_count", 0),
        "original_slugs": meta.get("topic_slugs", []),
    }


@router.post("/api/logger/consolidate")
async def consolidate_entities():
    """Run memory.py consolidate to group topics into entities."""
    if not VENV_PYTHON.exists():
        raise HTTPException(500, f"Python venv not found at {VENV_PYTHON}")
    if not MEMORY_PY.exists():
        raise HTTPException(500, f"memory.py not found at {MEMORY_PY}")

    try:
        proc = await asyncio.create_subprocess_exec(
            str(VENV_PYTHON),
            str(MEMORY_PY),
            "consolidate",
            cwd=str(TERMINAL_LOGGER_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(504, "Consolidation timed out after 300s")
    except Exception as e:
        raise HTTPException(500, f"Failed to run consolidation: {e}")

    if proc.returncode != 0:
        err_text = stderr.decode(errors="replace").strip()
        raise HTTPException(500, f"Consolidation failed: {err_text}")

    return await get_entities()


# --- Comment endpoints ---


class CommentCreate(BaseModel):
    content: str
    context_type: str = "general"  # overview | session | topic | entity | pane | general
    context_id: str | None = None   # slug, pane name, etc.
    selected_text: str | None = None


@router.post("/api/logger/comments")
async def create_comment(body: CommentCreate):
    import db
    comment_id = await db.create_logger_comment(
        content=body.content,
        context_type=body.context_type,
        context_id=body.context_id,
        selected_text=body.selected_text,
    )
    # Auto-trigger preference extraction in background
    asyncio.create_task(_ingest_preferences(comment_id, body))
    return {"id": comment_id}


@router.get("/api/logger/comments")
async def list_comments(context_type: str = None, context_id: str = None, limit: int = 100):
    import db
    comments = await db.get_logger_comments(context_type, context_id, limit)
    return {"comments": comments}


@router.delete("/api/logger/comments/{comment_id}")
async def delete_comment(comment_id: int):
    import db
    await db.delete_logger_comment(comment_id)
    return {"ok": True}


# --- Preference ingestion ---


def _get_page_content(context_type: str, context_id: str | None) -> str:
    """Read the brief/page content for a given context."""
    if context_type == "overview" and OVERVIEW_MD.exists():
        return OVERVIEW_MD.read_text(errors="replace")[:3000]
    if context_type == "session" and SUMMARY_LOG.exists():
        return SUMMARY_LOG.read_text(errors="replace")[:3000]
    if context_type == "topic" and context_id:
        f = MEMORY_DIR / f"topic_{context_id}.md"
        if f.exists():
            return f.read_text(errors="replace")[:3000]
    if context_type == "entity" and context_id:
        f = MEMORY_DIR / f"entity_{context_id}.md"
        if f.exists():
            return f.read_text(errors="replace")[:3000]
    return ""


async def _ingest_preferences(comment_id: int, body: CommentCreate):
    """Extract user preferences from a comment via LLM and store them."""
    import db

    page_content = _get_page_content(body.context_type, body.context_id)
    existing_prefs = await db.get_user_preferences(limit=50)
    existing_summary = "\n".join(
        f"- [{p['category']}] {p['content']}" for p in existing_prefs[:20]
    ) or "（暂无已有偏好）"

    prompt = f"""你是一个用户偏好分析助手。根据用户在终端日志页面上留下的评论，提取可复用的偏好信号。

用户评论: "{body.content}"
{f'引用的文本: "{body.selected_text}"' if body.selected_text else ''}
页面上下文类型: {body.context_type}
页面内容摘要:
{page_content[:2000]}

已有偏好（避免重复）:
{existing_summary}

请提取0-3条偏好信号。每条包含:
- category: 必须是以下之一: tool_preference, workflow_pattern, interest_area, opinion, communication_style
- preference: 用简洁中文描述这条偏好（一句话）
- confidence: 0.0-1.0 的置信度（明确表达的偏好=0.8+，隐含的=0.3-0.6）
- reasoning: 为什么你认为这是一条偏好（一句话）

如果评论不包含任何偏好信号（如纯事实性评论），返回空数组。

只返回 JSON 数组，不要其他内容:
[{{"category": "...", "preference": "...", "confidence": 0.8, "reasoning": "..."}}]"""

    try:
        apis = await db.get_all_apis()
        chat_api = _find_chat_api(apis)
        if not chat_api:
            return

        response = await _call_chat_api(chat_api, prompt, timeout=30, temperature=0.3)

        # Parse the JSON array from the response
        m = re.search(r'\[[\s\S]*\]', response)
        if not m:
            return
        items = json.loads(m.group(0))
        if not isinstance(items, list):
            return

        valid_categories = {"tool_preference", "workflow_pattern", "interest_area", "opinion", "communication_style"}
        for item in items:
            cat = item.get("category", "")
            pref = item.get("preference", "")
            conf = item.get("confidence", 0.5)
            if cat in valid_categories and pref:
                await db.create_user_preference(
                    category=cat,
                    content=pref,
                    source_comment_id=comment_id,
                    confidence=float(conf),
                )
    except Exception as e:
        print(f"[preference-ingest] error for comment {comment_id}: {e}")


@router.post("/api/logger/comments/{comment_id}/ingest")
async def ingest_comment(comment_id: int):
    """Manually trigger preference extraction for a comment. Returns learned items."""
    import db

    comments = await db.get_logger_comments()
    comment = next((c for c in comments if c["id"] == comment_id), None)
    if not comment:
        raise HTTPException(404, "Comment not found")

    body = CommentCreate(
        content=comment["content"],
        context_type=comment["context_type"],
        context_id=comment.get("context_id"),
        selected_text=comment.get("selected_text"),
    )
    await _ingest_preferences(comment_id, body)

    prefs = await db.get_preferences_by_comment(comment_id)
    return {"learned": prefs}


@router.get("/api/logger/preferences")
async def list_preferences(category: str = None, comment_id: int = None, limit: int = 100):
    """List user preferences, optionally filtered by category or source comment."""
    import db
    if comment_id:
        prefs = await db.get_preferences_by_comment(comment_id)
        return {"preferences": prefs}
    prefs = await db.get_user_preferences(category=category, limit=limit)
    return {"preferences": prefs}


@router.delete("/api/logger/preferences/{pref_id}")
async def delete_preference(pref_id: int):
    import db
    await db.delete_user_preference(pref_id)
    return {"ok": True}
