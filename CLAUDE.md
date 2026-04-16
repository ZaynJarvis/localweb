# localweb — Developer Guide

Personal API runner + posts reader at `http://localhost:9701`. FastAPI backend, vanilla JS frontend (ES modules), SQLite storage. No build step.

## Architecture

```
localweb/
├── main.py              # Slim entry point: app creation, lifespan, CORS, router includes, static mounts
├── config.py            # Constants, paths, default settings
├── models.py            # Pydantic request/response models
├── db.py                # SQLite async CRUD via aiosqlite (repository layer)
├── services/
│   ├── env.py           # Zsh env loading, $VAR substitution, resolve()
│   ├── api_runner.py    # API execution: single run, parallel SSE, regional SSE
│   ├── post_service.py  # Image download, summary gen, title gen, auto-metadata
│   ├── showcase_service.py  # Showcase image gen, like/gallery management
│   └── curl_parser.py   # Curl command parsing
├── routes/
│   ├── api_routes.py    # /api/apis/* endpoints
│   ├── post_routes.py   # /api/posts/* endpoints
│   ├── settings_routes.py   # /api/settings/* endpoints
│   └── showcase_routes.py   # /api/showcase/*, /api/gallery/* endpoints
├── frontend/
│   ├── index.html       # SPA shell (type="module" script)
│   ├── favicon.svg      # SVG favicon (terminal prompt icon)
│   ├── app.js           # Entry point: imports modules, event listeners, init
│   ├── style.css        # Dark theme, CSS variables
│   └── modules/
│       ├── state.js     # Shared state object + persistence
│       ├── utils.js     # $(), escHtml, showToast, mdToHtml, formatDate
│       ├── api-client.js    # All fetch() calls to backend
│       ├── api-runner.js    # API runner view: panel, run, history, SSE
│       ├── posts-reader.js  # Posts sidebar, reader, title/cover extraction
│       ├── summary.js       # Summary rendering + polling + generation
│       ├── showcase.js      # Showcase column, regenerate, like
│       ├── gallery.js       # Gallery grid view
│       └── settings.js      # Posts settings view
├── data.db              # SQLite (auto-created)
├── post_images/         # Downloaded post images + avatars (gitignored)
└── gallery/             # Liked showcase images (gitignored)
```

## Running & Restarting

Managed by launchd (`com.localweb`). Plist: `~/Library/LaunchAgents/com.localweb.plist`. Working dir: `/Users/bytedance/code/c/localweb`. Uses venv Python directly.

```bash
# Restart (after any code change)
launchctl kickstart -k gui/$(id -u)/com.localweb
sleep 3

# Logs
tail -f /tmp/localweb.out.log
tail -f /tmp/localweb.err.log

# Health check
curl -s http://localhost:9701/api/apis | python3 -m json.tool
```

## Key Patterns

- **Env var substitution**: `resolve()` in `services/env.py` sources `~/.zshrc` and substitutes `$VAR` in headers/body/url server-side. Browser never sees secrets.
- **Frontend state**: Shared `state` object in `modules/state.js`. All modules import from it.
- **ES modules**: Frontend uses `type="module"` scripts. Each module exports its functions.
- **DB settings**: Generic key/value via `db.get_setting()` / `db.set_setting()`.
- **New DB tables**: `CREATE TABLE IF NOT EXISTS` in `db.init_db()`, migrations via `ALTER TABLE` in `try/except`.
- **Toast notifications**: Use `showToast(msg)` from `modules/utils.js`. No `alert()`.
- **Image preloading**: When swapping images (showcase), preload via `new Image()` before setting `img.src`.
- **Hash routing**: SPA navigation via `location.hash`. Posts use `#posts` or `#posts/{id}`.
- **Summary polling**: When summary_json is null, `modules/summary.js` polls `GET /api/posts/{id}` every 3s (30s timeout), then shows "Generate Summary" button.

## Scoped File Guide (for agents)

When working on a specific feature, **only read the files relevant to that feature**:

### APIs feature (runner, curl import, parallel/regional runs)
- `routes/api_routes.py` — API CRUD + run route handlers
- `services/api_runner.py` — Execution logic (single, parallel SSE, regional SSE)
- `services/curl_parser.py` — Curl import parsing
- `db.py:91–167` — APIs + runs DB functions
- `frontend/modules/api-runner.js` — API panel render, run, history
- `frontend/modules/api-client.js` — API fetch functions
- `index.html:36–103` — APIs view HTML

### Posts feature (reader, sidebar, content rendering)
- `routes/post_routes.py` — Post CRUD route handlers
- `services/post_service.py` — Image download, summary gen, title gen
- `db.py:169–265` — Posts + settings DB functions
- `frontend/modules/posts-reader.js` — Sidebar, reader, title/cover
- `frontend/modules/summary.js` — Summary block + polling
- `frontend/modules/api-client.js` — Posts fetch functions
- `index.html:106–184` — Posts view HTML

### Showcase image feature (generate, like, gallery)
- `routes/showcase_routes.py` — Showcase + gallery route handlers
- `services/showcase_service.py` — Image gen, like/download
- `db.py:268–302` — Gallery DB functions
- `frontend/modules/showcase.js` — Showcase column, regenerate, like
- `frontend/modules/gallery.js` — Gallery grid view

### Settings feature
- `routes/settings_routes.py` — Settings route handlers
- `frontend/modules/settings.js` — Settings view rendering

### Navigation / routing
- `frontend/app.js` — Entry point, event listeners, hashchange, init
- `frontend/modules/state.js` — Shared state
- `index.html:14–16` — Nav tab buttons

## API Routes

### APIs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apis` | List all APIs |
| POST | `/api/apis` | Create API |
| PUT | `/api/apis/{id}` | Update API |
| DELETE | `/api/apis/{id}` | Delete API |
| POST | `/api/apis/{id}/run` | Run single request |
| GET | `/api/apis/{id}/run_stream?n=N` | Parallel run (SSE) |
| GET | `/api/apis/{id}/run_regions` | Regional run (SSE) |
| GET | `/api/apis/{id}/runs` | Run history |
| POST | `/api/import-curl` | Parse curl command |

### Posts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/posts` | List all posts |
| POST | `/api/posts` | Save post (auto-triggers summary + title gen) |
| GET | `/api/posts/{id}` | Get single post |
| DELETE | `/api/posts/{id}` | Delete post + cleanup images |
| POST | `/api/posts/{id}/summarize` | Generate bilingual summary |
| POST | `/api/posts/{id}/generate-title` | Generate 5-word title via LLM |
| PUT | `/api/posts/{id}/title` | Manual title rename |

### Settings & Showcase
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings/posts` | Get posts settings |
| PUT | `/api/settings/posts` | Update posts settings |
| POST | `/api/showcase/generate` | Generate showcase image |
| GET | `/api/showcase` | Get current showcase URL |
| POST | `/api/showcase/like` | Save showcase to gallery |
| GET | `/api/gallery` | List gallery images |
| POST | `/api/gallery/{id}/activate` | Set gallery image as showcase |
| DELETE | `/api/gallery/{id}` | Delete gallery image |

### Logger & Memory
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logger/summary` | Get current session summary |
| POST | `/api/logger/regenerate` | Regenerate session summary |
| GET | `/api/logger/status` | Pane count, last capture, entries |
| GET | `/api/logger/logs` | List pane log files |
| GET | `/api/logger/logs/{name}` | Read a pane log |
| GET | `/api/logger/memory` | Memory overview + topic list |
| GET | `/api/logger/memory/{slug}` | Single topic content |
| POST | `/api/logger/memory/refresh` | Refresh memory from summary |
| POST | `/api/logger/memory/merge` | Merge two topics |
| GET | `/api/logger/entities` | Entity list (consolidated topics) |
| GET | `/api/logger/entities/{slug}` | Entity detail with insights/suggestions |
| POST | `/api/logger/consolidate` | Run topic→entity consolidation |

### Logger feature (modules/logger.js)
- `routes/logger_routes.py` — Logger API endpoints (summary, status, logs, memory, entities)
- `frontend/modules/logger.js` — Logger tab UI (overview, session, entities/topics, pane logs)
- Data source: `~/.tmux-journal/` (pane logs, summary.log, memory/)
- Entity consolidation: `~/code/tmux-journal/memory.py consolidate` — groups topics into entities via LLM, generates insights/suggestions
- Entity files: `~/.tmux-journal/memory/entity_{slug}.md` with Summary, Timeline, Key Facts, Commands, Insights, Suggestions sections
- Resumable: Phase 1 grouping cached in `.entity_grouping.json`, Phase 2 skips existing entity files

## Database

Tables: `apis`, `runs`, `posts`, `settings`, `gallery_images`. Schema in `db.init_db()`.

Posts columns: `id`, `source_url` (unique), `author_name`, `author_handle`, `author_avatar_url`, `content_markdown`, `image_urls` (JSON), `local_images` (JSON), `post_type`, `posted_at`, `created_at`, `title`, `cover_url`, `summary_json` (JSON `{en, zh}`).

## Layout

- **Posts reader**: Two-column flex layout. Left: `.post-reader-main` (flex: 1, max-width 80ch). Right: `.post-showcase-column` (40%, pinned right).
- **Showcase fade**: Right-to-left gradient overlay (30% width). Crossfade uses image preloading.
- **Sidebar titles**: Shows AI-generated title or content preview fallback. Double-click to rename.
- **Like button**: SVG heart icon, fills red when liked.
- **CSS variables**: Defined in `:root` in style.css (`--bg`, `--surface`, `--accent`, etc.).

## Showcase Image

Generated by `/api/showcase/generate` — auto-detects image-gen API by URL keywords. Stores CDN URL in settings as `current_showcase_url`. Liking downloads to `gallery/`.

## Auto-generation

On post creation (`POST /api/posts`), two background tasks auto-fire:
1. `download_post_images()` in `services/post_service.py` — downloads images + avatar to local storage
2. `auto_generate_post_metadata()` in `services/post_service.py` — generates bilingual summary + 7-word title (1s delay, best-effort)

Frontend polls for summary completion via `modules/summary.js` (3s interval, 30s timeout).

## Domain-Driven Design (DDD) Structure

localweb is organized into five bounded contexts plus a shared kernel:

### Bounded Contexts

1. **API Runner Domain** — HTTP request execution engine
   - CRUD for API templates, curl import, run history
   - Single, parallel (SSE), and regional (SSE) execution
   - **Backend**: `services/api_runner.py`, `services/curl_parser.py`, `routes/api_routes.py`, `db.py:91–167`
   - **Frontend**: `modules/api-runner.js`, `modules/api-client.js:4–39`
   - **Aggregate root**: API (with Runs as children, cascade delete)
   - **Used by**: Posts (chat API for summaries), Showcase (image-gen API)

2. **Posts Domain** — Content management + AI metadata
   - Post CRUD, image download/caching, bilingual summary + title generation
   - Search via OpenViking + LLM augmentation, summary chat refinement
   - **Backend**: `services/post_service.py`, `routes/post_routes.py`, `db.py:169–265`
   - **Frontend**: `modules/posts-reader.js`, `modules/summary.js`, `modules/api-client.js:41–208`
   - **Aggregate root**: Post (with images, summary, title)
   - **Depends on**: API Runner (chat APIs), Settings (prompts/language)

3. **Showcase Domain** — AI image generation + gallery curation
   - Two-step generation: LLM prompt expansion → image-gen API
   - Gallery with like/activate/delete lifecycle
   - **Backend**: `services/showcase_service.py`, `routes/showcase_routes.py`, `db.py:268–302`
   - **Frontend**: `modules/showcase.js`, `modules/gallery.js`, `modules/api-client.js:84–120`
   - **Aggregate root**: GalleryImage
   - **Depends on**: API Runner (image-gen + chat APIs), Settings (showcase_prompt)

4. **Settings Domain** — Centralized configuration
   - Key/value store: prompts, language, color palette, custom colors
   - **Backend**: `routes/settings_routes.py`, `db.py` (get/set_setting)
   - **Frontend**: `modules/settings.js`, `modules/api-client.js:64–76`
   - **Consumed by**: Posts, Showcase, frontend (palette)

5. **Logger Domain** — Terminal session history (standalone)
   - Integrates with `~/code/tmux-journal/` (external subprocess calls)
   - Memory topics, entity consolidation, pane logs, session summaries
   - **Backend**: `routes/logger_routes.py`
   - **Frontend**: `modules/logger.js`
   - **Data**: `~/.tmux-journal/` (pane logs, summary.log, memory/)
   - **No dependency** on other domains

6. **Shared Kernel** — Infrastructure
   - `db.py` (SQLite async CRUD, migrations)
   - `services/env.py` (zsh env loading, $VAR substitution)
   - `models.py` (Pydantic DTOs), `config.py` (paths, defaults)
   - `modules/utils.js`, `modules/state.js`, `modules/api-client.js`
   - `app.js`, `index.html` (SPA shell, hash routing)

### Dependency Graph (no cycles)

```
Shared Kernel ← all domains
API Runner ← Posts, Showcase (for HTTP execution)
Settings  ← Posts, Showcase (for config)
Logger    ← (standalone, no inbound deps)
```

### Ubiquitous Language

| Term | Domain | Meaning |
|------|--------|---------|
| API | Runner | HTTP request template (method, url, headers, body) |
| Run / Snapshot | Runner | Execution instance; resolved request state at time of execution |
| Post | Posts | Saved article/tweet with metadata |
| Summary | Posts | Bilingual {en, zh} LLM-generated analysis |
| Showcase | Showcase | Currently displayed AI-generated image |
| Gallery | Showcase | Curated collection of liked images |
| Topic | Logger | Terminal session event cluster |
| Entity | Logger | Consolidated topic representation with insights |
| Brief | Logger | Per-topic/entity detail content (the markdown rendered when you click a topic or entity). Sections ordered: Suggestions → Insights → Summary → rest |
| Comment | Logger | User annotation on a brief, optionally quoting selected text. Stored in SQLite `logger_comments` with context_type + context_id |
