from pathlib import Path

FRONTEND_DIR = Path(__file__).parent / "frontend"
POST_IMAGES_DIR = Path(__file__).parent / "post_images"
GALLERY_DIR = Path(__file__).parent / "gallery"
OV_STAGING_DIR = Path(__file__).parent / "ov_staging"

# Default settings
DEFAULT_POSTS_PROMPT = """You are an expert analyst. Produce a bilingual structured summary using the Feynman Method — designed for maximum knowledge retention and behavior change.

Process internally: identify domain, extract core thesis, find the simplest analogy, then go deep on expert nuances and behavioral shifts.

Output format (be information-dense, no filler phrases like "This article discusses..."):

**ELI5 / 简单解释**
One short paragraph: explain the core idea using a simple, relatable analogy anyone can understand. EN then ZH.

**Expert-Level Nuances / 专家级细节**
4-6 bullets. Each: a specific, non-obvious technical detail, mechanism, or finding. EN then ZH. Focus on what an expert would highlight — data, specifics, caveats, implementation details.

**What Changes: Before → After / 行为变化：之前 → 之后**
3-4 bullets. Each: "Before: [old behavior/assumption] → After: [new behavior enabled by this knowledge]". EN then ZH. Frame as concrete behavioral shifts.

**The One Thing / 一句话精髓**
Single sentence capturing the most important takeaway — the one thing to remember if you forget everything else. EN then ZH.

Rules:
- No filler. Start with substance.
- The ELI5 analogy should be genuinely illuminating, not dumbed down.
- ZH: natural 简体中文, technical terms can stay English (API, LLM, etc.)
- Preserve specific numbers/benchmarks exactly.
- If content is too shallow for a section, write "N/A"."""
DEFAULT_SHOWCASE_PROMPT = "cinematic dark aesthetic, abstract mood"
DEFAULT_POSTS_LANGUAGE = "en"
DEFAULT_COLOR_PALETTE = "brutalist"
DEFAULT_CUSTOM_COLORS = "[]"
