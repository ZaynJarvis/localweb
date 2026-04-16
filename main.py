from contextlib import asynccontextmanager

import db
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import FRONTEND_DIR, POST_IMAGES_DIR, GALLERY_DIR
from services.env import load_zsh_env, set_env
from routes.api_routes import router as api_router
from routes.post_routes import router as post_router
from routes.settings_routes import router as settings_router
from routes.showcase_routes import router as showcase_router
from routes.logger_routes import router as logger_router
from routes.email_routes import router as email_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    env = load_zsh_env()
    set_env(env)
    await db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    """Prevent browsers from heuristically caching stale JS/CSS/HTML."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static") or not path.startswith("/api"):
        response.headers["Cache-Control"] = "no-cache"
    return response

app.include_router(api_router)
app.include_router(post_router)
app.include_router(settings_router)
app.include_router(showcase_router)
app.include_router(logger_router)
app.include_router(email_router)

# Mount static directories BEFORE catch-all
POST_IMAGES_DIR.mkdir(exist_ok=True)
GALLERY_DIR.mkdir(exist_ok=True)
app.mount("/post_images", StaticFiles(directory=POST_IMAGES_DIR), name="post_images")
app.mount("/gallery", StaticFiles(directory=GALLERY_DIR), name="gallery")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse(FRONTEND_DIR / "index.html")
