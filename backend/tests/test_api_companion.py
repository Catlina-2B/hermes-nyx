"""Tests for the companion API endpoints.

These tests mock the analyze_screenshot function and test
the FastAPI endpoints in isolation.
"""

import json
import pytest
import pytest_asyncio
from unittest.mock import patch, AsyncMock, MagicMock

import sys
from pathlib import Path

backend_dir = str(Path(__file__).parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Mock all hermes-agent dependencies before importing main
# These modules live in ~/.hermes/hermes-agent and may not be available in test
for mod_name in [
    "hermes_state", "tools", "tools.todo_tool",
    "plugins", "plugins.vrm_digital_human",
]:
    if mod_name not in sys.modules:
        m = MagicMock()
        if mod_name == "plugins.vrm_digital_human":
            m.VRM_DIGITAL_HUMAN_PROMPT = "mock prompt"
        sys.modules[mod_name] = m

from httpx import AsyncClient, ASGITransport
from main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestCompanionStatus:
    @pytest.mark.asyncio
    async def test_get_status(self, client):
        """Should return companion status."""
        resp = await client.get("/api/companion/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "enabled" in data
        assert "interval_minutes" in data

    @pytest.mark.asyncio
    async def test_toggle(self, client):
        """Should toggle companion mode."""
        resp = await client.post("/api/companion/toggle")
        assert resp.status_code == 200
        assert "enabled" in resp.json()


class TestCompanionInterval:
    @pytest.mark.asyncio
    async def test_set_interval(self, client):
        """Should set interval minutes."""
        resp = await client.post("/api/companion/interval?minutes=10")
        assert resp.status_code == 200
        assert resp.json()["interval_minutes"] == 10

    @pytest.mark.asyncio
    async def test_clamp_min(self, client):
        """Should clamp to minimum 1."""
        resp = await client.post("/api/companion/interval?minutes=0")
        assert resp.json()["interval_minutes"] == 1

    @pytest.mark.asyncio
    async def test_clamp_max(self, client):
        """Should clamp to maximum 30."""
        resp = await client.post("/api/companion/interval?minutes=60")
        assert resp.json()["interval_minutes"] == 30


class TestCompanionAnalyze:
    @pytest.mark.asyncio
    async def test_analyze_returns_result(self, client):
        """Should call analyze and return result."""
        mock_result = {
            "activity": "Browsing",
            "should_speak": False,
            "message": "",
            "mood": "neutral",
        }
        with patch("main.analyze_screenshot", new_callable=AsyncMock, return_value=mock_result):
            resp = await client.post("/api/companion/analyze", json={"image": "abc"})
        assert resp.status_code == 200
        assert resp.json()["activity"] == "Browsing"

    @pytest.mark.asyncio
    async def test_analyze_missing_image(self, client):
        """Should 422 when image is missing."""
        resp = await client.post("/api/companion/analyze", json={})
        assert resp.status_code == 422
