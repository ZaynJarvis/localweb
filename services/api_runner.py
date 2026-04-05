import asyncio
import json
import time

import httpx

import db
from services.env import resolve


async def single_request(url: str, method: str, headers: dict, body: dict) -> dict:
    """Execute a single HTTP request and return result dict."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.request(method, url, headers=headers, json=body)
        return {
            "status_code": resp.status_code,
            "duration_ms": int((time.monotonic() - start) * 1000),
            "body": resp.text,
        }
    except Exception as e:
        return {
            "status_code": 0,
            "duration_ms": int((time.monotonic() - start) * 1000),
            "body": str(e),
        }


async def run_single(api_id: int) -> dict:
    """Run a single request for the given API and save result to DB."""
    api = await db.get_api(api_id)
    if not api:
        return None

    headers = resolve(api["headers"])
    body = resolve(api["body"])
    url = resolve(api["url"])
    method = api["method"].upper()

    snapshot = {"method": method, "url": url, "headers": headers, "body": body}
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.request(method, url, headers=headers, json=body)
        duration_ms = int((time.monotonic() - start) * 1000)
        response_text = resp.text
        status_code = resp.status_code
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        response_text = str(e)
        status_code = 0

    await db.save_run(api_id, snapshot, response_text, status_code, duration_ms)
    return {
        "status_code": status_code,
        "duration_ms": duration_ms,
        "body": response_text,
    }


async def stream_parallel(api_id: int, n: int):
    """Async generator: run N parallel requests, yield SSE events as they complete."""
    api = await db.get_api(api_id)
    if not api:
        return

    headers = resolve(api["headers"])
    body = resolve(api["body"])
    url = resolve(api["url"])
    method = api["method"].upper()
    snapshot = {"method": method, "url": url, "headers": headers, "body": body}

    tasks = [asyncio.create_task(single_request(url, method, headers, body)) for _ in range(n)]
    task_index = {t: i for i, t in enumerate(tasks)}
    remaining = set(tasks)

    while remaining:
        done, remaining = await asyncio.wait(remaining, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            idx = task_index[task]
            result = task.result()
            await db.save_run(api_id, snapshot, result["body"], result["status_code"], result["duration_ms"])
            yield f"data: {json.dumps({'index': idx, **result})}\n\n"

    yield "data: {\"done\": true}\n\n"


async def stream_regions(api_id: int):
    """Async generator: run request against all regional URLs, yield SSE events as they complete."""
    api = await db.get_api(api_id)
    if not api:
        return

    urls = api.get("urls") or []
    headers = resolve(api["headers"])
    body = resolve(api["body"])
    method = api["method"].upper()

    tasks = {
        asyncio.create_task(single_request(resolve(entry["url"]), method, headers, body)): entry
        for entry in urls
    }
    remaining = set(tasks.keys())

    while remaining:
        done, remaining = await asyncio.wait(remaining, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            entry = tasks[task]
            result = task.result()
            snapshot = {"method": method, "url": entry["url"], "headers": headers, "body": body}
            await db.save_run(api_id, snapshot, result["body"], result["status_code"], result["duration_ms"])
            yield f"data: {json.dumps({'label': entry['label'], 'url': entry['url'], **result})}\n\n"

    yield "data: {\"done\": true}\n\n"
