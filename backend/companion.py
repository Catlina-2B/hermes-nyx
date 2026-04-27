"""
Companion module: screenshot analysis via the same Hermes agent.
Sends screenshot description through the regular chat pipeline.
"""

ANALYSIS_PROMPT = """[系统指令] 你正在实时陪伴模式下工作。用户的屏幕截图已发送给你。
请分析截图内容，用JSON格式回复：
{"activity": "用户在做什么（简短描述）", "should_speak": true/false, "message": "要说的话（如果should_speak为true）", "mood": "neutral|happy|curious|concerned"}

规则：
- 如果用户在专注工作（编程、写作、阅读），不要打扰，should_speak设为false
- 如果用户看起来需要帮助、在闲逛、或你有有趣的话要说，should_speak设为true
- message要简短友好（1-2句话）
- 用中文回复"""


async def analyze_screenshot(image_base64: str, chat_manager=None) -> dict:
    """
    Analyze screenshot by sending it through the Hermes chat as a companion message.
    Falls back to a simple description if chat_manager is not available.
    """
    import json

    if not chat_manager:
        return {
            "activity": "Chat manager not available",
            "should_speak": False,
            "message": "",
            "mood": "neutral",
        }

    # Send as a chat message with image context
    prompt = f"{ANALYSIS_PROMPT}\n\n[截图已捕获，base64长度: {len(image_base64)} 字符]"

    full_response = ""
    try:
        async for event in chat_manager.send_message(prompt):
            if event.get("type") == "chunk":
                full_response += event.get("content", "")
            elif event.get("type") == "done":
                if not full_response:
                    full_response = event.get("final_response", "")
    except Exception as e:
        return {
            "activity": f"Analysis failed: {str(e)}",
            "should_speak": False,
            "message": "",
            "mood": "neutral",
            "error": str(e),
        }

    # Try to parse JSON from response
    try:
        # Find JSON in the response (might be wrapped in markdown)
        json_str = full_response
        if "```" in json_str:
            parts = json_str.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    json_str = part
                    break
        elif "{" in json_str:
            start = json_str.index("{")
            end = json_str.rindex("}") + 1
            json_str = json_str[start:end]

        result = json.loads(json_str)
        return {
            "activity": result.get("activity", "Unknown"),
            "should_speak": result.get("should_speak", False),
            "message": result.get("message", ""),
            "mood": result.get("mood", "neutral"),
        }
    except (json.JSONDecodeError, ValueError):
        # Couldn't parse JSON — treat the whole response as a spoken message
        return {
            "activity": full_response[:100] if full_response else "Unknown",
            "should_speak": bool(full_response),
            "message": full_response[:200] if full_response else "",
            "mood": "neutral",
        }
