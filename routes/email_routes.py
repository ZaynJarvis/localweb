"""Email triage viewer + feedback endpoints.

Reads ~/.emails/ workspace produced by ~/code/c/agent-email/run.sh.
Feedback written here is consumed by the next pm2 run to tune signal/noise.
"""
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

EMAIL_DIR = Path.home() / ".emails"
INSIGHTS_MD = EMAIL_DIR / "insights.md"
USEFUL_LOG = EMAIL_DIR / "useful.log"
RAW_LOG = EMAIL_DIR / "raw.log"
STATS_JSON = EMAIL_DIR / "stats.json"
FEEDBACK_LOG = EMAIL_DIR / "feedback.jsonl"
SIGNAL_SENDERS = EMAIL_DIR / "signal_senders.txt"
NOISE_SENDERS = EMAIL_DIR / "noise_senders.txt"
STATE_JSON = EMAIL_DIR / "state.json"
RUN_SH = Path.home() / "code" / "c" / "agent-email" / "run.sh"

router = APIRouter()


def _read_jsonl(path: Path, limit: int = 500):
    if not path.exists():
        return []
    lines = path.read_text(errors="replace").splitlines()
    out = []
    for line in lines[-limit:]:
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def _read_lines(path: Path):
    if not path.exists():
        return []
    return [l.strip() for l in path.read_text().splitlines() if l.strip()]


@router.get("/api/email/overview")
async def overview():
    stats = _read_json(STATS_JSON, {})
    state = _read_json(STATE_JSON, {})
    useful = _read_jsonl(USEFUL_LOG, 50)
    raw = _read_jsonl(RAW_LOG, 100)
    return {
        "stats": stats,
        "state": state,
        "useful_recent": list(reversed(useful)),
        "raw_recent_count": len(raw),
        "signal_senders": _read_lines(SIGNAL_SENDERS),
        "noise_senders": _read_lines(NOISE_SENDERS),
    }


@router.get("/api/email/insights")
async def insights():
    if not INSIGHTS_MD.exists():
        return {"markdown": "", "mtime": None}
    return {
        "markdown": INSIGHTS_MD.read_text(errors="replace"),
        "mtime": datetime.fromtimestamp(
            INSIGHTS_MD.stat().st_mtime, tz=timezone.utc
        ).isoformat(),
    }


class FeedbackBody(BaseModel):
    kind: str  # "mark_signal" | "mark_noise" | "mark_useful" | "mark_useless" | "note"
    target: str  # sender name or message id
    note: str | None = None


@router.post("/api/email/feedback")
async def feedback(body: FeedbackBody):
    if body.kind not in {"mark_signal", "mark_noise", "mark_useful", "mark_useless", "note"}:
        raise HTTPException(400, "bad kind")
    EMAIL_DIR.mkdir(exist_ok=True)
    rec = {
        "at": datetime.now(timezone.utc).isoformat(),
        "kind": body.kind,
        "target": body.target,
        "note": body.note,
    }
    with FEEDBACK_LOG.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # Maintain learned sender lists (deduped, case-insensitive)
    def _add_line(path: Path, value: str):
        existing = {l.lower() for l in _read_lines(path)}
        if value.lower() in existing:
            return
        with path.open("a") as f:
            f.write(value + "\n")

    def _remove_line(path: Path, value: str):
        lines = [l for l in _read_lines(path) if l.lower() != value.lower()]
        path.write_text("\n".join(lines) + ("\n" if lines else ""))

    if body.kind == "mark_signal":
        _add_line(SIGNAL_SENDERS, body.target)
        _remove_line(NOISE_SENDERS, body.target)
    elif body.kind == "mark_noise":
        _add_line(NOISE_SENDERS, body.target)
        _remove_line(SIGNAL_SENDERS, body.target)

    return {"ok": True, "recorded": rec}


@router.post("/api/email/run")
async def trigger_run():
    if not RUN_SH.exists():
        raise HTTPException(500, f"run.sh not found at {RUN_SH}")
    try:
        proc = await _run_async(str(RUN_SH))
        return {"ok": proc["code"] == 0, "exit_code": proc["code"], "stderr_tail": proc["stderr"][-2000:]}
    except Exception as e:
        raise HTTPException(500, f"run failed: {e}")


async def _run_async(cmd: str):
    import asyncio
    proc = await asyncio.create_subprocess_exec(
        "bash", cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return {
        "code": proc.returncode,
        "stdout": (stdout or b"").decode(errors="replace"),
        "stderr": (stderr or b"").decode(errors="replace"),
    }
