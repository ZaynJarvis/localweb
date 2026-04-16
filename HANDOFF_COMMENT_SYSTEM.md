# Comment System — Handoff & Remaining Stages

## Completed: Stage 1 — Comment Infrastructure

### What exists
- **DB**: `logger_comments` table — `id, content, context_type, context_id, selected_text, created_at`
- **API**: `POST/GET/DELETE /api/logger/comments` in `routes/logger_routes.py`
- **Frontend**: Notion/Lark-style right panel in `frontend/modules/logger.js`
  - Floating 💬 button on text selection → compose in right panel
  - Panel slides in (280px) when comments exist or composing
  - Text highlights for quoted text, hover cross-reference
  - Comments are context-scoped (overview/session/topic/entity/pane + context_id)
- **API client**: `fetchLoggerComments`, `createLoggerComment`, `deleteLoggerComment` in `api-client.js`

### Key files
- `db.py` — table creation in `init_db()`, CRUD at bottom of file
- `routes/logger_routes.py` — CommentCreate model + 3 endpoints at bottom
- `frontend/modules/logger.js` — all comment UI logic (floating btn, panel, highlights)
- `frontend/modules/api-client.js` — comment fetch functions at bottom
- `frontend/style.css` — comment styles under "Logger Comments" section

---

## Completed: Stage 2 — Preference Ingestion from Comments

### What exists
- **DB**: `user_preferences` table — `id, category, content, source_comment_id, confidence, created_at, updated_at`
  - Categories: tool_preference, workflow_pattern, interest_area, opinion, communication_style
  - CRUD: `create_user_preference`, `get_user_preferences`, `get_preferences_by_comment`, `delete_user_preference`, `update_user_preference` in `db.py`
- **API**:
  - `POST /api/logger/comments/{id}/ingest` — manual preference extraction trigger, returns `{learned: [...]}`
  - `GET /api/logger/preferences?category=&comment_id=` — list preferences
  - `DELETE /api/logger/preferences/{id}` — delete a preference
- **Auto-ingestion**: `asyncio.create_task` on every `POST /api/logger/comments` triggers `_ingest_preferences()` in background
- **LLM extraction**: `_ingest_preferences()` in `routes/logger_routes.py` reads comment + selected_text + page content (topic/entity/overview/session brief), calls chat API with structured prompt, extracts 0-3 preferences per comment
- **Frontend feedback**:
  - After comment submit, polls `GET /api/logger/preferences?comment_id=X` (3s initial, 2s retries, max 3 attempts)
  - Shows `💡 learned: ...` toast on extraction
  - Learned badges (`comment-learned` class) displayed inline on comment cards
- **Preferences viewer**: Bottom section of comments panel showing all preferences with category emoji, confidence %, delete button
- **API client**: `fetchLoggerPreferences`, `deleteLoggerPreference` in `api-client.js`
- **Styles**: `.comment-learned`, `.pref-item`, `.pref-category`, `.pref-content`, `.pref-delete-btn` in `style.css`

### Key files
- `db.py` — `user_preferences` table + CRUD at bottom
- `routes/logger_routes.py` — `_get_page_content()`, `_ingest_preferences()`, ingest/preferences endpoints at bottom
- `frontend/modules/logger.js` — `pollForLearned()`, `showLearnedOnCard()`, `loadPreferencesPanel()`, `PREF_CATEGORY_LABEL`
- `frontend/modules/api-client.js` — `fetchLoggerPreferences`, `deleteLoggerPreference`
- `frontend/style.css` — preference styles after comment highlight section

---

## Stage 3 — Preference-Aware Summary Production

**Goal**: Use accumulated comments + preferences to improve the multi-topic summary prompt in `~/code/tmux-journal/summarize.py`, so summaries gradually align with user interests.

### Tasks
1. **Preferences API** — `GET /api/logger/preferences` returning all active preferences
2. **Inject preferences into summary prompt** — modify `summarize.py:build_prompt()` to optionally load preferences from a JSON file (e.g., `~/.tmux-journal/memory/user_preferences.json`)
3. **Preference sync** — endpoint or script that exports current preferences from localweb SQLite to the JSON file tmux-journal reads
4. **Weighted topics** — preferences with category=interest_area should cause the summarizer to allocate more detail to matching topics and less to uninteresting ones
5. **Feedback loop** — track which summary sections get comments (positive signal = user engaged) vs ignored, update preference confidence over time

---

## Stage 4 — Office-Hour Agent

**Goal**: A proactive 10-minute interactive session where the agent asks the user clarifying questions to sharpen its model of the user.

### Tasks
1. **Question generation** — endpoint that analyzes: recent comments, low-confidence preferences, unused suggestions, ambiguous signals → generates a ranked list of clarifying questions
2. **Office-hour UI** — dedicated view or modal in localweb with:
   - Timer (10 min countdown)
   - Agent asks one question at a time
   - User responds briefly (text input)
   - Agent processes answer → updates preferences → shows next question
3. **Question types**:
   - A/B comparison: "You commented X about topic Y — does that mean you prefer A or B?"
   - Confirmation: "I inferred you like Z — is that accurate?"
   - Usage check: "I suggested W last week — did you use it? Why/why not?"
   - Interest probe: "You've been working on [topic] a lot — should I prioritize this in summaries?"
4. **Session summary** — after office-hour, generate a "what I learned" report stored as a special comment or memory entry
5. **Scheduling** — ability to trigger office-hour manually or on a cadence (e.g., weekly)

---

## Stage 5 — Evaluation Set Generation

**Goal**: From accumulated preferences, comments, decisions, and history, produce eval sets for harness engineering — so any agent/prompt can be tested against the user's actual preferences.

### Tasks
1. **Eval set schema** — define format: `{input_context, expected_behavior, preference_basis, difficulty}`
2. **Eval generation endpoint** — `POST /api/logger/eval/generate` that:
   - Reads preference history, comment history, office-hour transcripts
   - Generates eval cases via LLM: "given this context, the user would prefer X because of preference Y"
   - Stores in `eval_sets` table or JSON file
3. **Eval categories**: summary quality, suggestion relevance, topic prioritization, communication style, tool recommendations
4. **Export** — `GET /api/logger/eval/export` as JSON for use in external harness engineering
5. **Versioning** — eval sets should be versioned and grow over time as more signal accumulates

---

## User preferences to honor
- **Chinese content**: all LLM-generated logger content in 中文 (headings in English)
- **Rank by importance**: suggestions → insights → summary → rest
- **Concise output**: terse, pain-point-first, no info overload
- **Topics by recency**: most recently updated first in sidebar
