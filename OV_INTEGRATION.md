# localweb ↔ OpenViking Integration

How localweb posts are synced into OpenViking (`ov`) so semantic search works on the Posts page. Read this before modifying the OV integration or doing bulk ingestion.

## High-level contract

Every localweb post is mirrored into OV as a markdown resource whose URI **starts with** `viking://resources/post-{id}-...`. The `post-{id}-` prefix is the only reliable key between the two systems — the slug suffix may vary or collide.

- New saves auto-ingest via a background task (`_ingest_post_to_ov_with_delay`, delay 45s so title/summary land first).
- Bulk backfill is done via a one-off script — see "Bulk load" below.
- Search (`GET /api/posts/find`) runs `ov find`, parses the URI back to `post_id`, groups by id (keeps best-scoring chunk), enriches from SQLite, merges memories, sorts by score desc.

## Where the code lives

| Concern | File |
|--------|------|
| Stage markdown + call `ov add-resource` | `services/post_service.py` → `stage_post_markdown`, `add_post_to_ov` |
| Semantic search, URI→id mapping, enrichment | `services/post_service.py` → `ov_find` |
| Route wiring + background ingestion task | `routes/post_routes.py` |
| Staging dir constant | `config.py` → `OV_STAGING_DIR` (`localweb/ov_staging/`) |
| Frontend search UI | `frontend/modules/search.js`, `frontend/style.css` (`.glass-*`) |

## Markdown staging format

Written to `localweb/ov_staging/post-{id}-{slug}.md`. One file per post; older files for the same id are deleted on re-stage.

```markdown
# {title}

- Post ID: {id}
- Source: {url}
- Author: {name} ({handle})
- Posted at: {iso}
- Saved at: {iso}
- Tags: a, b, c

---

{content_markdown}

---

## Summary

### English
{en}

### 中文
{zh}
```

The filename `post-{id}-{slug}.md` becomes the OV URI — the `post-{id}-` prefix is the ONLY load-bearing part. Keep it.

## Bulk load (backfill)

Use when: importing the full existing posts corpus, or after wiping OV data.

Recipe:

1. Snapshot the current posts list: `curl -s http://localhost:9701/api/posts -o /tmp/posts.json`.
2. Write a throwaway Python script (template below). Run it sequentially — `ov add-resource` is a single-process tool; concurrent calls can 500 on the server.
3. Retry failures with a small backoff (saw one transient "API error: Internal server error" out of 47).
4. Verify by comparing `ov ls viking://resources -o json -c` (strip the leading `cmd: ...` line, parse `result[*].uri`, extract ids with `re.search(r"post-(\d+)", uri)`) against the localweb DB. Set-diff should be empty.

Template script shape (see `/tmp/backfill_ov.py` during the April 2026 backfill for the actual code):

```python
# 1. Skip ids already present (either from a prior partial run or the first 3 test posts)
# 2. For each post dict from /api/posts:
#    a. Clean any older `post-{id}-*.md` staging files
#    b. Build header + content + summary section (see "Markdown staging format")
#    c. subprocess.run([OV_BIN, "add-resource", path,
#                      "--reason", f"localweb Post {id} — {title}",
#                      "--instruction", f"localweb-post-id: {id}. Source: {url}"])
# 3. Log ok/fail per id, retry fails with backoff.
```

**Gotchas seen in practice**:
- Don't use `/tmp` as staging — it's wiped on reboot. Use `localweb/ov_staging/`.
- When a post has no title yet (title gen hasn't run), derive a fallback by stripping `#` marks and skipping `![...](...)` lines — see `ov_find` in `post_service.py` for the same logic.
- On URI name collision, OV appends a random hash suffix (seen as `post-129-...-_eacac2a3`). That's fine — the `post-{id}-` regex still matches.
- Duplicate URIs for the same post can exist if you re-ingest; `ov_find` collapses by id and keeps the best chunk, so dedup isn't required.
- `ov add-resource` is fire-and-forget by default; add `--wait` only if you need synchronous indexing (slower, blocks on semantic processing).

## Search endpoint shape

`GET /api/posts/find?q={query}&threshold=0.35` (threshold is tunable; 0.35 is the current working value).

Returns:
```json
{"items": [
  {"type": "post", "id": 107, "score": 0.681, "uri": "...",
   "chunk": "best-scoring abstract text ...",
   "title": "...", "author_name": "...", "cover_url": "..."},
  {"type": "memory", "score": 0.42, "uri": "...", "content": "..."}
]}
```

Sorted by score desc. Posts/memories interleaved.

## Reverse lookup

`services/post_service.py` defines:
```python
_OV_POST_URI_RE = re.compile(r"viking://resources/post-(\d+)")
```

That one regex is the full contract. Preserve the URI prefix shape and nothing else needs to change.
