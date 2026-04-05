import db
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

import services.api_runner as api_runner
from models import ApiPayload, CurlImport
from services.curl_parser import parse_curl

router = APIRouter()


@router.get("/api/apis")
async def list_apis():
    return await db.get_all_apis()


@router.post("/api/apis")
async def create_api(payload: ApiPayload):
    api_id = await db.create_api(
        payload.name, payload.method, payload.url, payload.headers, payload.body,
        payload.parallel, payload.urls
    )
    return {"id": api_id}


@router.put("/api/apis/{api_id}")
async def update_api(api_id: int, payload: ApiPayload):
    api = await db.get_api(api_id)
    if not api:
        raise HTTPException(404, "API not found")
    await db.update_api(api_id, payload.name, payload.method, payload.url, payload.headers,
                        payload.body, payload.parallel, payload.urls)
    return {"ok": True}


@router.delete("/api/apis/{api_id}")
async def delete_api(api_id: int):
    await db.delete_api(api_id)
    return {"ok": True}


@router.post("/api/import-curl")
async def import_curl(payload: CurlImport):
    """Parse a curl command and return an ApiPayload-compatible dict."""
    return parse_curl(payload.curl_command)


@router.post("/api/apis/{api_id}/run")
async def run_api(api_id: int):
    api = await db.get_api(api_id)
    if not api:
        raise HTTPException(404, "API not found")
    result = await api_runner.run_single(api_id)
    return result


@router.get("/api/apis/{api_id}/run_stream")
async def run_api_stream(api_id: int, n: int = 1):
    api = await db.get_api(api_id)
    if not api:
        raise HTTPException(404, "API not found")

    return StreamingResponse(
        api_runner.stream_parallel(api_id, n),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/apis/{api_id}/run_regions")
async def run_api_regions(api_id: int):
    """Run the same request against all configured regional URLs, stream results as SSE."""
    api = await db.get_api(api_id)
    if not api:
        raise HTTPException(404, "API not found")
    urls = api.get("urls") or []
    if not urls:
        raise HTTPException(400, "No regional URLs configured")

    return StreamingResponse(
        api_runner.stream_regions(api_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/apis/{api_id}/runs")
async def get_runs(api_id: int):
    return await db.get_runs(api_id)
