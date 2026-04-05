"""Run once to seed the two example APIs from the brief."""
import asyncio
import db

APIS = [
    {
        "name": "Doubao Image Gen",
        "method": "POST",
        "url": "https://ark.cn-beijing.volces.com/api/v3/images/generations",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer $ARK_API_KEY",
        },
        "body": {
            "model": "doubao-seedream-5-0-260128",
            "prompt": "A futuristic city at night",
            "sequential_image_generation": "disabled",
            "response_format": "url",
            "size": "2K",
            "stream": False,
            "watermark": True,
        },
    },
    {
        "name": "OpenClaw Text Gen",
        "method": "POST",
        "url": "http://127.0.0.1:18789/v1/responses",
        "headers": {
            "Authorization": "Bearer xxx",
            "Content-Type": "application/json",
            "x-openclaw-session-key": "claw-1",
        },
        "body": {
            "model": "openclaw",
            "input": "hello",
        },
    },
    {
        "name": "Ark Chat Completions",
        "method": "POST",
        "url": "https://ark-cn-beijing.bytedance.net/api/v3/chat/completions",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer $ARK_API_KEY",
        },
        "body": {
            "model": "ep-xxxxxxxx",
            "messages": [{"role": "user", "content": "hello"}],
        },
    },
    {
        "name": "Libra Experiments",
        "method": "GET",
        "url": "https://libra-sg.tiktok-row.net/datatester/experiment/api/v3/app/-1/experiment?page=1&page_size=30&status=1,3,4&user=zhiheng.liu",
        "headers": {},
        "body": {},
    },
    {
        "name": "Web Crawl",
        "method": "POST",
        "url": "https://search.bytedance.net/gpt/openapi/online/v2/crawl",
        "headers": {"Content-Type": "application/json"},
        "body": {
            "url": "https://example.com",
            "query": "summarize this page",
        },
    },
]

async def main():
    await db.init_db()
    for api in APIS:
        await db.create_api(api["name"], api["method"], api["url"], api["headers"], api["body"])
    print("Seeded", len(APIS), "APIs")

asyncio.run(main())
