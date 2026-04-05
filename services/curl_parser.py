import json
import re
import shlex
from urllib.parse import urlparse

from fastapi import HTTPException


def parse_curl(curl_command: str) -> dict:
    """Parse a curl command string and return an ApiPayload-compatible dict."""
    cmd = curl_command.strip()
    # Normalize line continuations
    cmd = re.sub(r'\\\s*\n\s*', ' ', cmd)
    try:
        tokens = shlex.split(cmd)
    except ValueError as e:
        raise HTTPException(400, f"Failed to parse curl command: {e}")

    url = ""
    method = None
    headers: dict = {}
    body = None

    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t == "curl":
            i += 1
            continue
        if t in ("-X", "--request") and i + 1 < len(tokens):
            i += 1
            method = tokens[i].upper()
        elif t in ("-H", "--header") and i + 1 < len(tokens):
            i += 1
            k, _, v = tokens[i].partition(":")
            if k.strip():
                headers[k.strip()] = v.strip()
        elif t in ("-d", "--data", "--data-raw", "--data-binary") and i + 1 < len(tokens):
            i += 1
            raw = tokens[i]
            if not raw.startswith("@"):
                try:
                    body = json.loads(raw)
                except Exception:
                    body = {}
        elif t == "--json" and i + 1 < len(tokens):
            i += 1
            try:
                body = json.loads(tokens[i])
            except Exception:
                body = {}
        elif t in ("-L", "--location", "-s", "-i", "-v", "--compressed",
                   "-k", "--insecure", "-G", "--get", "--no-keepalive"):
            pass  # ignore flags
        elif not t.startswith("-") and not url:
            url = t.strip("'\"")
        i += 1

    if not method:
        method = "POST" if body is not None else "GET"
    if body is None or not isinstance(body, dict):
        body = {}

    try:
        hostname = urlparse(url).hostname or url
        name = hostname.split(".")[0].capitalize() if hostname else "Imported API"
    except Exception:
        name = "Imported API"

    return {"name": name, "method": method, "url": url, "headers": headers, "body": body, "parallel": 1}
