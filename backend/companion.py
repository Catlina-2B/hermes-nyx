"""
Companion module: screenshot analysis via vision model.
Receives base64 screenshots, analyzes with vision model,
decides whether to proactively engage the user.
"""

import os
import json
import base64
from pathlib import Path
from typing import Optional

from config import load_hermes_config

# Try to import OpenAI client
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

ANALYSIS_PROMPT = """You are Hermes, an AI desktop companion. You can see the user's screen.

Analyze this screenshot and:
1. Briefly describe what the user is doing (1-2 sentences)
2. Decide if you should proactively say something to the user

Rules for deciding to speak:
- Only speak if you have something genuinely helpful or interesting to say
- Don't speak if the user seems focused on deep work (coding, writing, reading)
- Speak if: they seem stuck, they're doing something you can help with, you notice something interesting, or they've been idle
- Keep your message short (1-2 sentences max), casual and friendly
- Respond in the same language as what's on screen

Respond in JSON format:
{
  "activity": "brief description of what user is doing",
  "should_speak": true/false,
  "message": "what to say (only if should_speak is true)",
  "mood": "neutral|happy|curious|concerned"
}"""


def _get_openai_client() -> Optional["OpenAI"]:
    if not HAS_OPENAI:
        return None
    config = load_hermes_config()
    api_key = config.get("api_key") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    base_url = config.get("base_url")
    return OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)


async def analyze_screenshot(image_base64: str) -> dict:
    """
    Analyze a screenshot using a vision model.
    Returns dict with: activity, should_speak, message, mood
    """
    client = _get_openai_client()
    if not client:
        return {
            "activity": "Unable to analyze (no API key configured)",
            "should_speak": False,
            "message": "",
            "mood": "neutral",
            "error": "No OpenAI API key. Set OPENAI_API_KEY or configure in ~/.hermes/config.yaml",
        }

    config = load_hermes_config()
    model = config.get("vision_model", config.get("model", "gpt-4o"))

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": ANALYSIS_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}",
                                "detail": "low",
                            },
                        },
                    ],
                }
            ],
            max_tokens=300,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        result = json.loads(content)
        return {
            "activity": result.get("activity", "Unknown"),
            "should_speak": result.get("should_speak", False),
            "message": result.get("message", ""),
            "mood": result.get("mood", "neutral"),
        }
    except Exception as e:
        return {
            "activity": f"Analysis failed: {str(e)}",
            "should_speak": False,
            "message": "",
            "mood": "neutral",
            "error": str(e),
        }
