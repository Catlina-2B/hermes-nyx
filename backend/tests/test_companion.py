"""Tests for the companion screenshot analysis module."""

import json
import pytest
import asyncio
from unittest.mock import patch, MagicMock

import sys
from pathlib import Path

# Ensure backend dir is in path
sys.path.insert(0, str(Path(__file__).parent.parent))

from companion import analyze_screenshot, ANALYSIS_PROMPT


class TestAnalyzeScreenshot:
    """Tests for analyze_screenshot function."""

    @pytest.mark.asyncio
    async def test_returns_error_when_no_api_key(self):
        """Should return error dict when no OpenAI API key is configured."""
        with patch("companion._get_openai_client", return_value=None):
            result = await analyze_screenshot("fake_base64_data")

        assert result["should_speak"] is False
        assert "error" in result
        assert "API key" in result["error"]

    @pytest.mark.asyncio
    async def test_returns_analysis_on_success(self):
        """Should return parsed analysis from vision model."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "activity": "User is writing code in VS Code",
                        "should_speak": True,
                        "message": "Looks like you're debugging — need help?",
                        "mood": "curious",
                    })
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        with patch("companion._get_openai_client", return_value=mock_client):
            result = await analyze_screenshot("fake_base64_data")

        assert result["activity"] == "User is writing code in VS Code"
        assert result["should_speak"] is True
        assert result["message"] == "Looks like you're debugging — need help?"
        assert result["mood"] == "curious"

    @pytest.mark.asyncio
    async def test_sends_correct_prompt_and_image(self):
        """Should send the analysis prompt with the base64 image."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content=json.dumps({
                        "activity": "idle",
                        "should_speak": False,
                        "message": "",
                        "mood": "neutral",
                    })
                )
            )
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        with patch("companion._get_openai_client", return_value=mock_client):
            await analyze_screenshot("ABCD1234")

        call_args = mock_client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        content = messages[0]["content"]

        # First item is text prompt
        assert content[0]["type"] == "text"
        assert content[0]["text"] == ANALYSIS_PROMPT

        # Second item is image
        assert content[1]["type"] == "image_url"
        assert "ABCD1234" in content[1]["image_url"]["url"]

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self):
        """Should return error dict when API call fails."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API timeout")

        with patch("companion._get_openai_client", return_value=mock_client):
            result = await analyze_screenshot("fake_base64")

        assert result["should_speak"] is False
        assert "error" in result
        assert "API timeout" in result["error"]

    @pytest.mark.asyncio
    async def test_handles_malformed_json_response(self):
        """Should handle non-JSON response from model."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content="not valid json"))
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        with patch("companion._get_openai_client", return_value=mock_client):
            result = await analyze_screenshot("fake_base64")

        assert result["should_speak"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_defaults_missing_fields(self):
        """Should provide defaults for missing fields in response."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content=json.dumps({})))
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        with patch("companion._get_openai_client", return_value=mock_client):
            result = await analyze_screenshot("fake_base64")

        assert result["activity"] == "Unknown"
        assert result["should_speak"] is False
        assert result["message"] == ""
        assert result["mood"] == "neutral"
