import aiosqlite
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "data.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS apis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'POST',
                url TEXT NOT NULL,
                headers TEXT NOT NULL DEFAULT '{}',
                body TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        # Settings table for app configuration
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        # Gallery table for liked showcase images
        await db.execute("""
            CREATE TABLE IF NOT EXISTS gallery_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                liked_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        # Migration: add parallel column if missing
        try:
            await db.execute("ALTER TABLE apis ADD COLUMN parallel INTEGER NOT NULL DEFAULT 1")
            await db.commit()
        except Exception:
            pass  # Column already exists
        # Migration: add urls column (JSON array of {label, url} for multi-region runs)
        try:
            await db.execute("ALTER TABLE apis ADD COLUMN urls TEXT")
            await db.commit()
        except Exception:
            pass  # Column already exists
        await db.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_url TEXT NOT NULL UNIQUE,
                author_name TEXT NOT NULL,
                author_handle TEXT NOT NULL,
                author_avatar_url TEXT,
                content_markdown TEXT NOT NULL,
                image_urls TEXT NOT NULL DEFAULT '[]',
                local_images TEXT NOT NULL DEFAULT '[]',
                post_type TEXT NOT NULL DEFAULT 'tweet',
                posted_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        # Migration: add title, cover_url, summary_json to posts
        try:
            await db.execute("ALTER TABLE posts ADD COLUMN title TEXT")
            await db.commit()
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE posts ADD COLUMN cover_url TEXT")
            await db.commit()
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE posts ADD COLUMN summary_json TEXT")
            await db.commit()
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE posts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
            await db.commit()
        except Exception:
            pass
        await db.execute("""
            CREATE TABLE IF NOT EXISTS logger_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                context_type TEXT NOT NULL DEFAULT 'general',
                context_id TEXT,
                selected_text TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                source_comment_id INTEGER REFERENCES logger_comments(id) ON DELETE SET NULL,
                confidence REAL NOT NULL DEFAULT 0.5,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_id INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
                request_snapshot TEXT NOT NULL,
                response_body TEXT,
                status_code INTEGER,
                duration_ms INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.commit()

async def get_all_apis():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM apis ORDER BY created_at DESC") as cur:
            rows = await cur.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["headers"] = json.loads(d["headers"])
                d["body"] = json.loads(d["body"])
                d.setdefault("parallel", 1)
                d["urls"] = json.loads(d["urls"]) if d.get("urls") else None
                result.append(d)
            return result

async def get_api(api_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM apis WHERE id=?", (api_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            r = dict(row)
            r["headers"] = json.loads(r["headers"])
            r["body"] = json.loads(r["body"])
            r.setdefault("parallel", 1)
            r["urls"] = json.loads(r["urls"]) if r.get("urls") else None
            return r

async def create_api(name, method, url, headers, body, parallel=1, urls=None):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO apis (name, method, url, headers, body, parallel, urls) VALUES (?,?,?,?,?,?,?)",
            (name, method, url, json.dumps(headers), json.dumps(body), parallel,
             json.dumps(urls) if urls else None)
        )
        await db.commit()
        return cur.lastrowid

async def update_api(api_id, name, method, url, headers, body, parallel=1, urls=None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE apis SET name=?, method=?, url=?, headers=?, body=?, parallel=?, urls=? WHERE id=?",
            (name, method, url, json.dumps(headers), json.dumps(body), parallel,
             json.dumps(urls) if urls else None, api_id)
        )
        await db.commit()

async def delete_api(api_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM apis WHERE id=?", (api_id,))
        await db.commit()

async def save_run(api_id, request_snapshot, response_body, status_code, duration_ms):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO runs (api_id, request_snapshot, response_body, status_code, duration_ms) VALUES (?,?,?,?,?)",
            (api_id, json.dumps(request_snapshot), response_body, status_code, duration_ms)
        )
        await db.commit()
        return cur.lastrowid

async def get_runs(api_id: int, limit: int = 20):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM runs WHERE api_id=? ORDER BY created_at DESC LIMIT ?",
            (api_id, limit)
        ) as cur:
            rows = await cur.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["request_snapshot"] = json.loads(d["request_snapshot"])
                result.append(d)
            return result


# --- Posts CRUD ---

def _deserialize_post(row):
    d = dict(row)
    d["image_urls"] = json.loads(d["image_urls"]) if d.get("image_urls") else []
    d["local_images"] = json.loads(d["local_images"]) if d.get("local_images") else []
    d["summary_json"] = json.loads(d["summary_json"]) if d.get("summary_json") else None
    d["tags"] = json.loads(d["tags"]) if d.get("tags") else []
    return d


async def create_post(source_url, author_name, author_handle, author_avatar_url,
                      content_markdown, image_urls, post_type="tweet", posted_at=None):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """INSERT OR REPLACE INTO posts
               (source_url, author_name, author_handle, author_avatar_url,
                content_markdown, image_urls, post_type, posted_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (source_url, author_name, author_handle, author_avatar_url,
             content_markdown, json.dumps(image_urls), post_type, posted_at)
        )
        await db.commit()
        return cur.lastrowid


async def get_all_posts(limit=50):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM posts ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
            return [_deserialize_post(r) for r in rows]


async def get_post(post_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM posts WHERE id=?", (post_id,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            return _deserialize_post(row)


async def get_post_by_url(source_url: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM posts WHERE source_url=?", (source_url,)) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            return _deserialize_post(row)


async def delete_post(post_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM posts WHERE id=?", (post_id,))
        await db.commit()


async def update_post_local_images(post_id: int, local_images: list, content_markdown: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE posts SET local_images=?, content_markdown=? WHERE id=?",
            (json.dumps(local_images), content_markdown, post_id)
        )
        await db.commit()


async def update_post_summary(post_id: int, summary_json: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE posts SET summary_json=? WHERE id=?",
            (json.dumps(summary_json), post_id)
        )
        await db.commit()


async def search_posts(query: str, limit: int = 10):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        like = f"%{query}%"
        async with db.execute(
            "SELECT * FROM posts WHERE content_markdown LIKE ? OR title LIKE ? ORDER BY created_at DESC LIMIT ?",
            (like, like, limit)
        ) as cur:
            rows = await cur.fetchall()
            return [_deserialize_post(r) for r in rows]


async def update_post_title(post_id: int, title: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE posts SET title=? WHERE id=?",
            (title, post_id)
        )
        await db.commit()


async def update_post_tags(post_id: int, tags: list):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE posts SET tags=? WHERE id=?",
            (json.dumps(tags), post_id)
        )
        await db.commit()


async def update_post_tags_by_url(source_url: str, tags: list):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "UPDATE posts SET tags=? WHERE source_url=?",
            (json.dumps(tags), source_url)
        )
        await db.commit()
        return cur.rowcount


# --- Settings CRUD ---

async def get_setting(key: str, default=None):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM settings WHERE key=?", (key,)) as cur:
            row = await cur.fetchone()
            if row:
                return json.loads(row[0])
            return default


async def set_setting(key: str, value):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)",
            (key, json.dumps(value))
        )
        await db.commit()


# --- Gallery CRUD ---

async def add_gallery_image(filename: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO gallery_images (filename) VALUES (?)",
            (filename,)
        )
        await db.commit()
        return cur.lastrowid


async def get_gallery_images(limit=50):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM gallery_images ORDER BY liked_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def delete_gallery_image(image_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM gallery_images WHERE id=?", (image_id,))
        await db.commit()


# --- Logger Comments CRUD ---

async def create_logger_comment(content: str, context_type: str, context_id: str = None,
                                 selected_text: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """INSERT INTO logger_comments (content, context_type, context_id, selected_text)
               VALUES (?,?,?,?)""",
            (content, context_type, context_id, selected_text)
        )
        await db.commit()
        return cur.lastrowid


async def get_logger_comments(context_type: str = None, context_id: str = None, limit: int = 100):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if context_type:
            if context_id:
                sql = "SELECT * FROM logger_comments WHERE context_type=? AND context_id=? ORDER BY created_at DESC LIMIT ?"
                params = (context_type, context_id, limit)
            else:
                sql = "SELECT * FROM logger_comments WHERE context_type=? ORDER BY created_at DESC LIMIT ?"
                params = (context_type, limit)
        else:
            sql = "SELECT * FROM logger_comments ORDER BY created_at DESC LIMIT ?"
            params = (limit,)
        async with db.execute(sql, params) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def delete_logger_comment(comment_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM logger_comments WHERE id=?", (comment_id,))
        await db.commit()


# --- User Preferences CRUD ---

async def create_user_preference(category: str, content: str, source_comment_id: int = None,
                                  confidence: float = 0.5):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """INSERT INTO user_preferences (category, content, source_comment_id, confidence)
               VALUES (?,?,?,?)""",
            (category, content, source_comment_id, confidence)
        )
        await db.commit()
        return cur.lastrowid


async def get_user_preferences(category: str = None, limit: int = 100):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if category:
            sql = "SELECT * FROM user_preferences WHERE category=? ORDER BY updated_at DESC LIMIT ?"
            params = (category, limit)
        else:
            sql = "SELECT * FROM user_preferences ORDER BY updated_at DESC LIMIT ?"
            params = (limit,)
        async with db.execute(sql, params) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def get_preferences_by_comment(comment_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM user_preferences WHERE source_comment_id=? ORDER BY created_at",
            (comment_id,)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def delete_user_preference(pref_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM user_preferences WHERE id=?", (pref_id,))
        await db.commit()


async def update_user_preference(pref_id: int, content: str = None, confidence: float = None):
    async with aiosqlite.connect(DB_PATH) as db:
        updates = []
        params = []
        if content is not None:
            updates.append("content=?")
            params.append(content)
        if confidence is not None:
            updates.append("confidence=?")
            params.append(confidence)
        if updates:
            updates.append("updated_at=datetime('now')")
            params.append(pref_id)
            await db.execute(
                f"UPDATE user_preferences SET {', '.join(updates)} WHERE id=?",
                params
            )
            await db.commit()
