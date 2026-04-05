from pydantic import BaseModel


class ApiPayload(BaseModel):
    name: str
    method: str = "POST"
    url: str
    headers: dict = {}
    body: dict = {}
    parallel: int = 1
    urls: list | None = None


class CurlImport(BaseModel):
    curl_command: str


class PostPayload(BaseModel):
    source_url: str
    author_name: str
    author_handle: str
    author_avatar_url: str | None = None
    content_markdown: str
    image_urls: list[str] = []
    post_type: str = "tweet"
    posted_at: str | None = None


class SettingsPayload(BaseModel):
    posts_prompt: str | None = None
    posts_language: str | None = None  # "en", "zh", or "both"
    showcase_prompt: str | None = None
    color_palette: str | None = None
    custom_colors: str | None = None


class TitlePayload(BaseModel):
    title: str


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class SummaryChatPayload(BaseModel):
    messages: list[ChatMessage]


class SaveSummaryPayload(BaseModel):
    summary_text: str


class ShowcaseGenerateRequest(BaseModel):
    base_prompt: str | None = None
