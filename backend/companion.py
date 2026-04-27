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

仔细观察截图，分析用户在做什么，重点关注：
1. 用户的操作有没有问题？代码有没有 bug？配置有没有错？
2. 有没有更好的方案或工具可以推荐？
3. 用户是不是卡住了、在反复尝试同一个东西？
4. 有没有安全隐患（比如密钥暴露、危险命令）？

用 JSON 回复：
{"activity": "简短描述用户在做什么", "should_speak": true/false, "message": "你想说的话", "mood": "neutral|happy|curious|concerned"}

什么时候 should_speak = true：
- 发现代码有 bug 或逻辑问题 → 提醒用户
- 有明显更好的方案 → 建议用户
- 用户看起来卡住了 → 提供思路
- 发现安全风险 → 立即提醒
- 看到有趣的内容可以闲聊几句

什么时候 should_speak = false：
- 用户在正常、顺利地工作
- 没有发现问题也没有更好的建议
- 不确定的时候宁可不打扰

你的风格：
- 像一个坐在旁边的技术很强的朋友，随意但专业
- 发现问题时直接说重点，比如："这里的 useEffect 依赖数组少了 xxx 哦"
- 建议时简洁有用，比如："这个用 Promise.all 并行跑会快很多"
- 闲聊时自然轻松，比如："摸鱼被我抓到了哈哈"
- 用中文，message 字段不超过 30 个字"""


# Track recent messages to avoid repetition
_recent_messages: list[str] = []
_MAX_RECENT = 5

# Full analysis history for WebUI display
_analysis_history: list[dict] = []
_MAX_HISTORY = 50


def get_analysis_history() -> list[dict]:
    return list(_analysis_history)


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

    # Build prompt with recent history to avoid repetition
    prompt = ANALYSIS_PROMPT
    if _recent_messages:
        history = "\n".join(f"- {m}" for m in _recent_messages[-_MAX_RECENT:])
        prompt += f"\n\n你最近已经说过这些话了，不要重复类似的内容：\n{history}"

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
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
        result = {
            "activity": r.get("activity", "Unknown"),
            "should_speak": r.get("should_speak", False),
            "message": r.get("message", ""),
            "mood": r.get("mood", "neutral"),
        }
    except (json.JSONDecodeError, ValueError):
        result = {
            "activity": text[:100] or "Unknown",
            "should_speak": bool(text),
            "message": text[:200],
            "mood": "neutral",
        }

    # Track message to avoid repeating
    if result.get("message"):
        _recent_messages.append(result["message"])
        if len(_recent_messages) > _MAX_RECENT:
            _recent_messages.pop(0)

    # Save to history for WebUI
    from datetime import datetime
    _analysis_history.append({
        **result,
        "timestamp": datetime.now().strftime("%H:%M:%S"),
    })
    if len(_analysis_history) > _MAX_HISTORY:
        _analysis_history.pop(0)

    return result


def _err(msg):
    return {"activity": msg, "should_speak": False, "message": "", "mood": "neutral", "error": msg}
