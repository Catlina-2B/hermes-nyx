import asyncio
import os
import re
import json
from datetime import datetime
from typing import AsyncGenerator
from openai import AsyncOpenAI
from config import HERMES_AGENT_LOG, HERMES_ERRORS_LOG, get_summary_model

LOG_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})"
    r"(?:,\d+)?\s+"
    r"(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s+"
    r"(.*)$"
)


def parse_log_line(line: str) -> dict | None:
    m = LOG_PATTERN.match(line.strip())
    if not m:
        return None
    return {
        "timestamp": m.group(1),
        "level": m.group(2).lower(),
        "session_id": "",
        "message": m.group(3),
    }


async def tail_log(path: str, from_end: bool = True) -> AsyncGenerator[str, None]:
    if not os.path.exists(path):
        while not os.path.exists(path):
            await asyncio.sleep(1)

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        if from_end:
            f.seek(0, 2)
        while True:
            line = f.readline()
            if line:
                yield line.rstrip("\n")
            else:
                await asyncio.sleep(0.3)


class LogMonitor:
    def __init__(self):
        self._summary_model: str = get_summary_model() or ""
        self._summary_client: AsyncOpenAI | None = None
        self._summary_base_url: str | None = None

    def set_summary_model(self, model: str, base_url: str | None = None, api_key: str | None = None) -> None:
        self._summary_model = model
        self._summary_base_url = base_url
        if model:
            self._summary_client = AsyncOpenAI(
                api_key=api_key or os.environ.get("OPENAI_API_KEY", ""),
                base_url=base_url,
            )
        else:
            self._summary_client = None

    async def stream_raw_logs(self) -> AsyncGenerator[dict, None]:
        # Filter out annoying lark errors
        def _should_skip(line: str) -> bool:
            lower_line = line.lower()
            skip_keywords = ["lark connect failed", "lark error", "feishu connect failed", "feishu error"]
            return any(kw in lower_line for kw in skip_keywords)

        # Send last N lines as history first
        log_path = str(HERMES_AGENT_LOG)
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            for line in lines[-50:]:
                line = line.rstrip("\n")
                if _should_skip(line):
                    continue
                parsed = parse_log_line(line)
                if parsed:
                    yield {"type": "raw_log", "line": line, **parsed}
        except FileNotFoundError:
            pass

        # Then tail for new lines
        async for line in tail_log(log_path):
            if _should_skip(line):
                continue
            parsed = parse_log_line(line)
            if parsed:
                yield {"type": "raw_log", "line": line, **parsed}

    async def stream_summaries(self, batch_size: int = 10, interval: float = 5.0) -> AsyncGenerator[dict, None]:
        if not self._summary_client or not self._summary_model:
            yield {"type": "error", "message": "No summary model configured"}
            return

        buffer: list[str] = []
        last_flush = asyncio.get_event_loop().time()

        async for line in tail_log(str(HERMES_AGENT_LOG)):
            buffer.append(line)
            now = asyncio.get_event_loop().time()

            if len(buffer) >= batch_size or (now - last_flush >= interval and buffer):
                batch = buffer[:]
                buffer.clear()
                last_flush = now

                summary = await self._summarize_batch(batch)
                if summary:
                    for item in summary:
                        yield {"type": "summary", **item}

    async def _summarize_batch(self, lines: list[str]) -> list[dict]:
        if not self._summary_client:
            return []

        log_text = "\n".join(lines)
        prompt = f"""Analyze these Hermes agent log lines and extract key operations.
For each distinct operation, output a JSON object with:
- "title": short description (Chinese, max 20 chars)
- "status": one of "success", "running", "error"
- "time": HH:MM format extracted from the log timestamp

Output a JSON array only, no other text.

Log lines:
{log_text}"""

        try:
            response = await self._summary_client.chat.completions.create(
                model=self._summary_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=500,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            return json.loads(content)
        except Exception as e:
            return [{"title": f"摘要失败: {e}", "status": "error", "time": datetime.now().strftime("%H:%M")}]
