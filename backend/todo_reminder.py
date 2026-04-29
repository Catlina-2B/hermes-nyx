"""Extract deadline from todo content using LLM."""

import os
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

# Load ~/.hermes/.env for API key
_env_path = Path.home() / ".hermes" / ".env"
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


def _get_client():
    if not OpenAI:
        return None
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not api_key:
        return None
    return OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)


def _get_model():
    try:
        from config import load_hermes_config
        raw = load_hermes_config().get("model", {})
        if isinstance(raw, dict):
            return raw.get("default", "gpt-4o")
        return raw or "gpt-4o"
    except Exception:
        return "gpt-4o"


def _extract_deadline_sync(content: str) -> str | None:
    """Synchronous deadline extraction (runs in thread pool)."""
    client = _get_client()
    if not client:
        return None

    now = datetime.now()
    tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    prompt = f"""当前时间: {now.strftime("%Y-%m-%d %H:%M %A")}

分析以下待办事项内容，提取其中的截止时间或事件发生时间。

规则:
- 如果内容中有明确的时间（如"3点"、"下午5点"、"15:00"、"明天上午10点"），提取并转为完整的 ISO 8601 格式
- "3点"默认指下午15:00（除非上下文明确是凌晨）
- "明天"指 {tomorrow}
- 如果没有任何时间相关信息，返回 null
- 只返回 JSON，不要其他文字

待办内容: {content}

返回格式: {{"deadline": "2026-04-29T15:00:00" 或 null}}"""

    try:
        response = client.chat.completions.create(
            model=_get_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100,
        )
        text = response.choices[0].message.content.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        return data.get("deadline")
    except Exception as e:
        print(f"[todo-reminder] Failed to extract deadline: {e}")
        return None


async def extract_deadline(content: str) -> str | None:
    """Extract deadline from todo content. Runs sync OpenAI call in thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _extract_deadline_sync, content)
