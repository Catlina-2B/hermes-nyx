"""
Companion module: real-time screen analysis with multiple skills.
Reads API credentials from ~/.hermes/.env (same as Hermes agent).
"""

import os
import json
from pathlib import Path
from datetime import datetime

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

ANALYSIS_PROMPT = """你是小美（Hermes），用户的 AI 桌面伴侣。你可以实时看到用户的屏幕。

仔细观察用户屏幕，运用以下技能分析：

## 技能 1：代码审查
- 代码有没有 bug、逻辑错误、类型问题？
- 有没有更好的写法或工具？
- 用户是不是卡住了（反复修改同一处）？

## 技能 2：安全守护
- 是否在访问钓鱼网站？（检查 URL 拼写、可疑的登录页面、仿冒的品牌）
- 密钥/密码是否暴露在屏幕上？
- 是否在执行危险的终端命令？（rm -rf、drop table 等）
- 可疑的软件安装或权限请求？

## 技能 3：待办识别
- 聊天消息中有没有别人（领导、同事、朋友、家人）交代的任务？
- 邮件中有没有需要跟进的事项？
- 日历/会议提醒？
- 任何"记得xxx"、"帮我xxx"、"deadline是xxx"类的内容？

## 技能 4：效率助手
- 用户是否在重复做低效的操作？（可以推荐快捷键或工具）
- 是否在多个窗口间频繁切换同一个信息？（可以建议更好的工作流）

## 技能 5：健康关怀
- 如果已经陪伴了很长时间，适时提醒休息（但不要频繁）

用 JSON 回复：
{
  "activity": "用户在做什么（简短）",
  "should_speak": true/false,
  "message": "你想说的话（不超过50字）",
  "mood": "neutral|happy|curious|concerned",
  "todos": ["需要创建的待办事项1", "待办2"],
  "skill_used": "code_review|security|todo|efficiency|health|chat"
}

规则：
- todos 数组：只在检测到明确的任务/待办时才添加，没有就空数组 []
- should_speak：有实质性发现时才 true，正常工作不打扰
- 安全问题（钓鱼、密钥泄露）必须立即 should_speak: true
- 发现待办时 should_speak: true 并提醒用户
- 说话风格：像坐在旁边的技术很强的朋友，随意但专业
- 用中文，message 简洁有力"""

# Context-aware analysis prompt (when user asks about screen in Spotlight)
CONTEXT_ANALYSIS_PROMPT = """你是小美（Hermes），用户的 AI 桌面伴侣。用户正在看着屏幕问你一个问题。

用户的问题是：{question}

请结合屏幕内容回答用户的问题。直接回答，不要用 JSON 格式，用中文，像朋友一样自然地回答。"""

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


def _get_client():
    if not OpenAI:
        return None
    api_key = os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not api_key:
        return None
    return OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)


async def analyze_screenshot(image_base64: str, **_kwargs) -> dict:
    """Analyze screen with full skill set."""
    client = _get_client()
    if not client:
        return _err("No OPENAI_API_KEY in ~/.hermes/.env")

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

    # Parse JSON
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
            "todos": r.get("todos", []),
            "skill_used": r.get("skill_used", ""),
        }
    except (json.JSONDecodeError, ValueError):
        result = {
            "activity": text[:100] or "Unknown",
            "should_speak": bool(text),
            "message": text[:200],
            "mood": "neutral",
            "todos": [],
            "skill_used": "",
        }

    # Track message
    if result.get("message"):
        _recent_messages.append(result["message"])
        if len(_recent_messages) > _MAX_RECENT:
            _recent_messages.pop(0)

    # Save to history
    _analysis_history.append({
        **result,
        "timestamp": datetime.now().strftime("%H:%M:%S"),
    })
    if len(_analysis_history) > _MAX_HISTORY:
        _analysis_history.pop(0)

    return result


async def analyze_with_question(image_base64: str, question: str) -> str:
    """Answer user's question about what's on screen (for Spotlight)."""
    client = _get_client()
    if not client:
        return "API 未配置，无法分析屏幕"

    model = _get_model()
    prompt = CONTEXT_ANALYSIS_PROMPT.format(question=question)

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
            max_tokens=500,
        )
        return resp.choices[0].message.content or "无法分析"
    except Exception as e:
        return f"分析失败: {str(e)}"


def _err(msg):
    return {"activity": msg, "should_speak": False, "message": "", "mood": "neutral", "todos": [], "error": msg}
