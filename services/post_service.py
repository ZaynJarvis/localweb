import asyncio
import json
import mimetypes
import re

import httpx

import db
from config import POST_IMAGES_DIR, DEFAULT_POSTS_PROMPT, OV_STAGING_DIR
from services.env import resolve


OV_BIN = "/Users/bytedance/.local/bin/ov"
_OV_POST_URI_RE = re.compile(r"viking://resources/post-(\d+)")


def _slugify(text: str, max_len: int = 50) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "-", text or "").strip("-")
    return s[:max_len] or "untitled"


async def stage_post_markdown(post_id: int, post: dict) -> "Path":
    """Write a persistent markdown staging file for a post, return path."""
    from pathlib import Path  # local import, module is already available
    OV_STAGING_DIR.mkdir(parents=True, exist_ok=True)
    # Clean up older files for same post-id (title might change)
    for f in OV_STAGING_DIR.glob(f"post-{post_id}-*.md"):
        try:
            f.unlink()
        except OSError:
            pass
    title = post.get("title") or ((post.get("content_markdown") or "").split("\n", 1)[0][:60]) or f"Post {post_id}"
    slug = _slugify(title)
    path = OV_STAGING_DIR / f"post-{post_id}-{slug}.md"
    tags = post.get("tags") or []
    summary_section = ""
    summary = post.get("summary_json")
    if summary:
        try:
            s = json.loads(summary) if isinstance(summary, str) else summary
            if isinstance(s, dict):
                en, zh = s.get("en") or "", s.get("zh") or ""
                if en or zh:
                    summary_section = f"\n\n---\n\n## Summary\n\n### English\n{en}\n\n### 中文\n{zh}\n"
        except Exception:
            pass
    header = (
        f"# {title}\n\n"
        f"- Post ID: {post_id}\n"
        f"- Source: {post.get('source_url')}\n"
        f"- Author: {post.get('author_name')} ({post.get('author_handle') or ''})\n"
        f"- Posted at: {post.get('posted_at')}\n"
        f"- Saved at: {post.get('created_at')}\n"
        f"- Tags: {', '.join(tags) if tags else '(none)'}\n\n---\n\n"
    )
    body = post.get("content_markdown") or ""
    path.write_text(header + body + summary_section, encoding="utf-8")
    return path


async def add_post_to_ov(post_id: int) -> None:
    """Best-effort: stage post to markdown and ingest into OpenViking."""
    try:
        post = await db.get_post(post_id)
        if not post:
            return
        path = await stage_post_markdown(post_id, post)
        reason = f"localweb Post {post_id} — {post.get('title') or post.get('source_url')}"
        instruction = f"localweb-post-id: {post_id}. Source: {post.get('source_url')}"
        proc = await asyncio.create_subprocess_exec(
            OV_BIN, "add-resource", str(path),
            "--reason", reason, "--instruction", instruction,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            print(f"[ov] add-resource failed post {post_id}: {stderr.decode().strip()}")
        else:
            print(f"[ov] added post {post_id}")
    except Exception as e:
        print(f"[ov] error adding post {post_id}: {e}")


def _extract_post_id_from_uri(uri: str):
    m = _OV_POST_URI_RE.search(uri or "")
    return int(m.group(1)) if m else None


async def ov_find(query: str, threshold: float = 0.35, node_limit: int = 20) -> list[dict]:
    """Run `ov find`, filter by threshold, enrich posts via DB, sort by score desc.

    Returns a list of result dicts:
      - Post: {type:'post', score, chunk, uri, id, title, author_name, cover_url}
      - Memory: {type:'memory', score, content, uri}
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            OV_BIN, "find", query,
            "-t", str(threshold),
            "-n", str(node_limit),
            "-o", "json",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            print(f"[ov-find] rc={proc.returncode}: {stderr.decode().strip()}")
            return []
    except Exception as e:
        print(f"[ov-find] error: {e}")
        return []

    # Output starts with a "cmd: ..." line, then the JSON object.
    text = stdout.decode().strip()
    if text.startswith("cmd:"):
        _, _, rest = text.partition("\n")
        text = rest.strip()
    try:
        payload = json.loads(text)
    except Exception as e:
        print(f"[ov-find] json parse error: {e}")
        return []
    if not payload.get("ok"):
        return []
    result = payload.get("result") or {}

    items: list[dict] = []

    # Collapse resources by post_id, keep best-scoring chunk per post
    best_by_post: dict[int, dict] = {}
    for r in result.get("resources") or []:
        score = float(r.get("score") or 0)
        if score < threshold:
            continue
        uri = r.get("uri") or ""
        pid = _extract_post_id_from_uri(uri)
        if pid is None:
            continue
        existing = best_by_post.get(pid)
        if existing and existing["score"] >= score:
            continue
        best_by_post[pid] = {
            "score": score,
            "uri": uri,
            "chunk": r.get("abstract") or "",
        }

    # Enrich with DB rows
    for pid, meta in best_by_post.items():
        post = await db.get_post(pid)
        if not post:
            continue
        content = post.get("content_markdown") or ""
        img_match = re.search(r'!\[[^\]]*\]\(([^)]+)\)', content)
        cover_url = (post.get("cover_url") or (img_match.group(1) if img_match else "")) or ""
        if post.get("title"):
            title = post["title"]
        else:
            # First non-empty, non-image line; strip markdown heading marks
            fallback = ""
            for line in content.splitlines():
                s = line.strip()
                if not s or s.startswith("!["):
                    continue
                fallback = re.sub(r"^#+\s*", "", s)[:80]
                break
            title = fallback or f"Post {pid}"
        items.append({
            "type": "post",
            "id": pid,
            "score": meta["score"],
            "uri": meta["uri"],
            "chunk": meta["chunk"],
            "title": title,
            "author_name": post.get("author_name") or "",
            "cover_url": cover_url,
        })

    for m in result.get("memories") or []:
        score = float(m.get("score") or 0)
        if score < threshold:
            continue
        items.append({
            "type": "memory",
            "score": score,
            "uri": m.get("uri") or "",
            "content": m.get("abstract") or m.get("content") or "",
        })

    items.sort(key=lambda x: x["score"], reverse=True)
    return items


def _parse_bilingual_json(text: str) -> dict:
    """Extract {en, zh} from LLM response. Handles flat and nested JSON."""
    # Try parsing the full response or largest JSON block
    for pattern in [
        r'```(?:json)?\s*(\{[\s\S]*\})\s*```',  # fenced code block
        r'(\{[\s\S]*\})',                          # any JSON object
    ]:
        m = re.search(pattern, text)
        if not m:
            continue
        try:
            obj = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        # Flat case: {"en": "...", "zh": "..."}
        if isinstance(obj.get("en"), str) and isinstance(obj.get("zh"), str):
            return {"en": obj["en"], "zh": obj["zh"]}
        # Nested case: {"eli5": {"en": ..., "zh": ...}, ...}
        # Flatten each section into a combined markdown string per language
        en_parts, zh_parts = [], []
        for key, val in obj.items():
            if isinstance(val, dict) and ("en" in val or "zh" in val):
                en_parts.append(str(val.get("en", "")))
                zh_parts.append(str(val.get("zh", "")))
            elif isinstance(val, list):
                for item in val:
                    if isinstance(item, dict) and ("en" in item or "zh" in item):
                        en_parts.append(str(item.get("en", "")))
                        zh_parts.append(str(item.get("zh", "")))
        if en_parts or zh_parts:
            return {"en": "\n\n".join(en_parts), "zh": "\n\n".join(zh_parts)}
    return {"en": text, "zh": ""}


async def download_post_images(post_id: int, image_urls: list[str], avatar_url: str | None, content_markdown: str):
    """Download images and avatar in background, then update DB."""
    POST_IMAGES_DIR.mkdir(exist_ok=True)
    local_images = []
    url_to_local = {}

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        # Download post images
        for idx, url in enumerate(image_urls):
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                ct = resp.headers.get("content-type", "")
                ext = mimetypes.guess_extension(ct.split(";")[0].strip()) or ".jpg"
                if ext == ".jpe":
                    ext = ".jpg"
                filename = f"{post_id}_{idx}{ext}"
                (POST_IMAGES_DIR / filename).write_bytes(resp.content)
                local_images.append(filename)
                url_to_local[url] = f"/post_images/{filename}"
            except Exception:
                pass

        # Download avatar
        if avatar_url:
            try:
                resp = await client.get(avatar_url)
                resp.raise_for_status()
                ct = resp.headers.get("content-type", "")
                ext = mimetypes.guess_extension(ct.split(";")[0].strip()) or ".jpg"
                if ext == ".jpe":
                    ext = ".jpg"
                filename = f"{post_id}_avatar{ext}"
                (POST_IMAGES_DIR / filename).write_bytes(resp.content)
                url_to_local[avatar_url] = f"/post_images/{filename}"
            except Exception:
                pass

    # Rewrite content_markdown with local paths
    updated_md = content_markdown
    for orig_url, local_path in url_to_local.items():
        updated_md = updated_md.replace(orig_url, local_path)

    await db.update_post_local_images(post_id, local_images, updated_md)


def _find_chat_api(apis: list) -> dict | None:
    """Find the first chat completion or prompt-based API."""
    for api in apis:
        body = api.get("body", {})
        if isinstance(body, dict) and "messages" in body:
            return api
        if isinstance(body, dict) and "prompt" in body:
            return api
    return None


def _extract_text_from_response(result: dict) -> str:
    """Extract text content from OpenAI-style or Bedrock-style API response."""
    if "choices" in result and result["choices"]:
        return result["choices"][0].get("message", {}).get("content", "")
    if "output" in result and result["output"]:
        return result["output"][0].get("content", [{}])[0].get("text", "")
    return ""


async def _call_chat_api(chat_api: dict, prompt: str, timeout: int = 60, temperature: float | None = None) -> str:
    """Call a chat API with the given prompt, return text response."""
    headers = resolve(chat_api["headers"])
    url = resolve(chat_api["url"])
    method = chat_api["method"].upper()
    body = resolve(chat_api["body"])

    if "messages" in body:
        body["messages"] = [{"role": "user", "content": prompt}]
    elif "prompt" in body:
        body["prompt"] = prompt

    if temperature is not None:
        body["temperature"] = temperature

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(method, url, headers=headers, json=body)
        resp.raise_for_status()
        return _extract_text_from_response(resp.json())


async def generate_summary(post_id: int) -> dict:
    """Generate bilingual summary for a post. Returns {"en": ..., "zh": ...}."""
    post = await db.get_post(post_id)
    if not post:
        return None

    user_prompt = await db.get_setting("posts_prompt", DEFAULT_POSTS_PROMPT)
    content = post["content_markdown"]
    full_prompt = f"""{user_prompt}

CRITICAL output format: Return ONLY a JSON object with exactly two string keys:
{{"en": "<full English summary as a single markdown string>", "zh": "<full Chinese summary as a single markdown string>"}}

Each value must be ONE flat markdown string containing ALL sections (ELI5, Expert Nuances, What Changes, The One Thing). Do NOT nest sections as separate JSON keys. Do NOT wrap in code fences.

Article content:
{content[:4000]}"""

    apis = await db.get_all_apis()
    chat_api = _find_chat_api(apis)
    if not chat_api:
        return None

    summary_text = await _call_chat_api(chat_api, full_prompt, timeout=120)

    summary_json = _parse_bilingual_json(summary_text)

    await db.update_post_summary(post_id, summary_json)
    return summary_json


async def generate_title(post_id: int) -> str | None:
    """Generate a 5-word title for a post. Returns title string or None."""
    post = await db.get_post(post_id)
    if not post:
        return None

    content = post["content_markdown"] or ""
    heading_match = re.match(r'^#\s+(.+)$', content, re.MULTILINE)
    title_hint = heading_match.group(1) if heading_match else ""
    words = content.split()[:200]
    text_preview = " ".join(words)

    title_prompt = f"""用中文为这篇文章生成一个简短标题，最多5个词。标题要简洁，适合在窄侧栏显示。只返回标题本身，不要引号、不要解释。

标题提示: {title_hint}
内容预览: {text_preview}"""

    apis = await db.get_all_apis()
    chat_api = _find_chat_api(apis)
    if not chat_api:
        return None

    title = await _call_chat_api(chat_api, title_prompt, timeout=30)
    title = title.strip('"\'').strip()
    if title and len(title) <= 60:
        await db.update_post_title(post_id, title)
        return title
    return None


async def search_and_stream(query: str):
    """Search via OpenViking + local DB, then stream LLM answer as SSE events.

    Yields tuples of (event_type, data_dict).
    """
    # 1. Run ov search for external knowledge
    ov_context = ""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ov", "search", query, "-o", "json", "-c",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode == 0 and stdout:
            ov_results = json.loads(stdout.decode())
            if isinstance(ov_results, list):
                for item in ov_results[:5]:
                    title = item.get("title", "")
                    content = item.get("content", item.get("snippet", ""))
                    uri = item.get("uri", item.get("url", ""))
                    ov_context += f"--- {title} ({uri}) ---\n{content[:1000]}\n\n"
    except Exception as e:
        print(f"[search] ov search error: {e}")

    # 2. Search local posts DB
    local_posts = await db.search_posts(query, limit=10)
    sources = []
    local_context = ""
    for post in local_posts:
        content = post.get("content_markdown", "")
        # Extract first image as cover
        img_match = re.match(r'.*?!\[.*?\]\(([^)]+)\)', content)
        cover_url = img_match.group(1) if img_match else (post.get("cover_url") or "")
        sources.append({
            "id": post["id"],
            "title": post.get("title") or content[:60].strip(),
            "author_name": post.get("author_name", ""),
            "cover_url": cover_url,
        })
        local_context += f"--- {post.get('title', 'Post')} (by {post.get('author_name', 'unknown')}) ---\n{content[:1000]}\n\n"

    # 3. Emit sources event
    yield ("sources", sources)

    # 4. Find chat API and stream LLM response
    apis = await db.get_all_apis()
    chat_api = _find_chat_api(apis)
    if not chat_api:
        yield ("token", "No chat completion API configured. Add one in the APIs section.")
        return

    context = ""
    if ov_context:
        context += "External knowledge:\n" + ov_context + "\n"
    if local_context:
        context += "Saved posts:\n" + local_context + "\n"

    if not context:
        context = "(No relevant context found)\n"

    prompt = f"Based on the following knowledge context, answer this question: {query}\n\nContext:\n{context}"

    headers = resolve(chat_api["headers"])
    url = resolve(chat_api["url"])
    body = resolve(chat_api["body"])

    if "messages" in body:
        body["messages"] = [{"role": "user", "content": prompt}]
    elif "prompt" in body:
        body["prompt"] = prompt

    # Enable streaming
    body["stream"] = True

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                chat_api["method"].upper(), url,
                headers=headers, json=body,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield ("token", content)
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue
    except Exception as e:
        yield ("token", f"\n\n[Error streaming response: {e}]")


async def stream_summary_chat(post_id: int, messages: list[dict]):
    """Stream a chat completion for summary editing. Yields SSE token strings.

    The first call should include the user's instruction about what to change.
    We prepend hidden context with the original content + current summary.
    """
    post = await db.get_post(post_id)
    if not post:
        yield ("error", "Post not found")
        return

    apis = await db.get_all_apis()
    chat_api = _find_chat_api(apis)
    if not chat_api:
        yield ("error", "No chat completion API configured.")
        return

    # Build system context with original content and current summary
    current_summary = ""
    if post.get("summary_json"):
        sj = post["summary_json"]
        if isinstance(sj, str):
            import json as _json
            try:
                sj = _json.loads(sj)
            except Exception:
                sj = {}
        if sj.get("en"):
            current_summary += f"English summary:\n{sj['en']}\n\n"
        if sj.get("zh"):
            current_summary += f"Chinese summary:\n{sj['zh']}\n"

    content_preview = (post.get("content_markdown") or "")[:4000]

    system_msg = f"""You are a summary editor. The user wants to refine the summary of an article.

Original article content:
{content_preview}

Current summary:
{current_summary}

Help the user refine or regenerate the summary. When producing a new summary, output it as a JSON object with "en" and "zh" keys unless the user asks for a specific format. Follow the user's instructions about tone, length, focus, etc."""

    # Build messages for the API call
    api_messages = [{"role": "system", "content": system_msg}]
    for msg in messages:
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    headers = resolve(chat_api["headers"])
    url = resolve(chat_api["url"])
    body = resolve(chat_api["body"])

    if "messages" in body:
        body["messages"] = api_messages
    elif "prompt" in body:
        # Flatten for prompt-based APIs
        body["prompt"] = system_msg + "\n\nUser: " + messages[-1]["content"]

    body["stream"] = True

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                chat_api["method"].upper(), url,
                headers=headers, json=body,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield ("token", content)
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue
    except Exception as e:
        yield ("error", str(e))


async def save_summary_from_text(post_id: int, summary_text: str) -> dict:
    """Parse a summary text (may contain JSON with en/zh) and save it."""
    summary_json = _parse_bilingual_json(summary_text)
    await db.update_post_summary(post_id, summary_json)
    return summary_json


async def auto_generate_post_metadata(post_id: int):
    """Auto-generate summary and title for a new post in background."""
    # Small delay to let image download start first
    await asyncio.sleep(1)
    try:
        await generate_summary(post_id)
        await generate_title(post_id)
    except Exception:
        pass  # Best-effort, don't fail the post creation
