import shutil
import uuid

import httpx

import db
from config import GALLERY_DIR, POST_IMAGES_DIR, DEFAULT_SHOWCASE_PROMPT
from services.env import resolve
from services.post_service import _find_chat_api, _call_chat_api


async def _expand_to_creative_prompt(rough_direction: str) -> str:
    """Use high-temperature LLM to expand a rough direction into a vivid image prompt.
    Returns the expanded prompt, or rough_direction if no chat API is available.
    """
    apis = await db.get_all_apis()
    chat_api = _find_chat_api(apis)
    if not chat_api:
        return rough_direction

    meta_prompt = f"""You are an expert cinematic image generation prompt engineer.

Given a rough visual direction, expand it into a single vivid image generation prompt.

Rules:
- Output ONLY the image prompt — no explanation, no preamble, no quotes
- Max 80 words
- Include: subject or scene, visual style, lighting quality, mood/atmosphere, color palette, and one unexpected detail that makes it memorable
- Be bold and specific — avoid generic adjectives like "beautiful" or "stunning"
- The rough direction is a seed only; you can deviate creatively as long as the spirit is preserved

Rough direction: {rough_direction}"""

    try:
        expanded = await _call_chat_api(chat_api, meta_prompt, timeout=30, temperature=1.2)
        expanded = expanded.strip().strip('"\'')
        if expanded and len(expanded) > 10:
            return expanded
    except Exception:
        pass

    return rough_direction


async def generate_showcase_image(base_prompt_override: str | None = None) -> tuple[str | None, str | None, str | None]:
    """Generate a new showcase image using two-step creative prompt.
    Step 1: LLM expands the base direction into a vivid image prompt.
    Step 2: Feed that prompt to the image gen API.
    Returns (image_url, prompt_used, error_message).
    """
    base_prompt = base_prompt_override or await db.get_setting("showcase_prompt", DEFAULT_SHOWCASE_PROMPT)

    # Step 1: Expand to creative prompt
    final_prompt = await _expand_to_creative_prompt(base_prompt)

    # Find an image generation API
    apis = await db.get_all_apis()
    image_api = None
    for api in apis:
        body = api.get("body", {})
        url = api.get("url", "")
        if "image" in url.lower() or "dall-e" in url.lower() or "generations" in url.lower():
            image_api = api
            break
        if isinstance(body, dict) and "prompt" in body and ("size" in body or "n" in body):
            image_api = api
            break

    if not image_api:
        return None, None, "No image generation API found"

    headers = resolve(image_api["headers"])
    url = resolve(image_api["url"])
    method = image_api["method"].upper()
    body = resolve(image_api["body"])

    # Step 2: Use final prompt (base + keywords)
    body["prompt"] = final_prompt

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.request(method, url, headers=headers, json=body)
            if resp.status_code != 200:
                return None, None, f"API returned {resp.status_code}: {resp.text[:500]}"
            result = resp.json()

        # Extract image URL
        image_url = None
        if "data" in result and result["data"]:
            image_url = result["data"][0].get("url", "")
        elif "output" in result and result["output"]:
            image_url = result["output"][0] if isinstance(result["output"][0], str) else result["output"][0].get("url", "")

        if not image_url:
            return None, None, "No image URL in response"

        await db.set_setting("current_showcase_url", image_url)
        await db.set_setting("last_showcase_prompt", final_prompt)
        return image_url, final_prompt, None

    except Exception as e:
        return None, None, str(e)


async def like_showcase() -> dict:
    """Save current showcase image to gallery. Returns gallery image info dict.
    Raises ValueError with a message on failure.
    """
    current_url = await db.get_setting("current_showcase_url", None)
    if not current_url:
        raise ValueError("No showcase image to like")

    GALLERY_DIR.mkdir(exist_ok=True)
    gallery_filename = f"gallery_{uuid.uuid4().hex[:8]}.jpg"

    if current_url.startswith("/gallery/"):
        src = GALLERY_DIR / current_url.split("?")[0].split("/")[-1]
        if not src.exists():
            raise FileNotFoundError("Gallery image file not found")
        shutil.copy(src, GALLERY_DIR / gallery_filename)
    elif current_url.startswith("/post_images/"):
        src = POST_IMAGES_DIR / current_url.split("?")[0].split("/")[-1]
        if not src.exists():
            raise FileNotFoundError("Image file not found")
        shutil.copy(src, GALLERY_DIR / gallery_filename)
    else:
        # External CDN URL - download it
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(current_url)
            resp.raise_for_status()
            (GALLERY_DIR / gallery_filename).write_bytes(resp.content)

    image_id = await db.add_gallery_image(gallery_filename)
    return {"id": image_id, "filename": gallery_filename, "url": f"/gallery/{gallery_filename}"}
