import re
import subprocess

_zsh_env: dict[str, str] = {}


def load_zsh_env() -> dict[str, str]:
    """Source ~/.zshrc and return the resulting environment as a dict."""
    try:
        result = subprocess.run(
            ["zsh", "-c", "source ~/.zshrc 2>/dev/null; env"],
            capture_output=True, text=True, timeout=10,
        )
        env = {}
        for line in result.stdout.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                env[k] = v
        return env
    except Exception:
        return {}


def set_env(env: dict[str, str]) -> None:
    """Store the loaded environment for use by substitute_env_vars."""
    global _zsh_env
    _zsh_env = env


def substitute_env_vars(text: str) -> str:
    """Replace $VAR_NAME or ${VAR_NAME} with values from zsh environment."""
    def replacer(match):
        var = match.group(1) or match.group(2)
        return _zsh_env.get(var, match.group(0))
    return re.sub(r'\$\{(\w+)\}|\$(\w+)', replacer, text)


def resolve(obj):
    """Recursively substitute env vars in strings within dicts/lists."""
    if isinstance(obj, str):
        return substitute_env_vars(obj)
    if isinstance(obj, dict):
        return {k: resolve(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [resolve(v) for v in obj]
    return obj
