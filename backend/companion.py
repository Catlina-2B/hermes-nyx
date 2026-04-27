"""
Companion module: screenshot analysis.
Reads API credentials from ~/.hermes/.env (same as Hermes agent).
"""

import os
import json
from pathlib import Path

# Load ~/.hermes/.env so we use the same API key as Hermes
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

ANALYSIS_PROMPT = """你是小美（Hermes），用户的 AI 桌面伴侣。你可以看到用户的屏幕。

看看用户在干嘛，用 JSON 回复：
{"activity": "简短描述", "should_speak": true/false, "message": "你想说的话", "mood": "neutral|happy|curious|concerned"}

你的风格：
- 说话像朋友一样自然随意，不要像客服或报告
- 比如："哦你在看这个呀～" "代码写得不错嘛！" "摸鱼被我抓到了哈哈"
- 用户专注工作时别打扰（should_speak: false）
- 看到有趣的、用户可能需要帮助的、或者闲着的时候才说话
- message 最多一两句话，用中文，语气轻松"""


def _get_model():
    try:
        from config import load_hermes_config
        raw = load_hermes_config().get("model", {})
        if isinstance(raw, dict):
            return raw.get("default", "gpt-4o")
        return raw or "gpt-4o"
    except Exception:
        return "gpt-4o"


async def analyze_screenshot(image_base64: str, **_kwargs) -> dict:
    if not OpenAI:
        return _err("openai package not installed")

    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not api_key:
        return _err("No OPENAI_API_KEY in ~/.hermes/.env")

    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
    model = _get_model()

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/png;base64,{image_base64}",
                        "detail": "low",
                    }},
                ],
            }],
            max_tokens=300,
        )
        text = resp.choices[0].message.content or ""
    except Exception as e:
        return _err(str(e))

    # Parse JSON from response
    try:
        j = text
        if "{" in j:
            j = j[j.index("{"):j.rindex("}") + 1]
        r = json.loads(j)
        return {
            "activity": r.get("activity", "Unknown"),
            "should_speak": r.get("should_speak", False),
            "message": r.get("message", ""),
            "mood": r.get("mood", "neutral"),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "activity": text[:100] or "Unknown",
            "should_speak": bool(text),
            "message": text[:200],
            "mood": "neutral",
        }


def _err(msg):
    return {"activity": msg, "should_speak": False, "message": "", "mood": "neutral", "error": msg}
