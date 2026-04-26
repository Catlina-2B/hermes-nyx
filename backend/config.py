import os
import yaml
from pathlib import Path

HERMES_HOME = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))
HERMES_AGENT_DIR = HERMES_HOME / "hermes-agent"
HERMES_CONFIG_PATH = HERMES_HOME / "config.yaml"
HERMES_LOGS_DIR = HERMES_HOME / "logs"
HERMES_AGENT_LOG = HERMES_LOGS_DIR / "agent.log"
HERMES_ERRORS_LOG = HERMES_LOGS_DIR / "errors.log"
DATA_DIR = Path(__file__).parent / "data"


def load_hermes_config() -> dict:
    """Load and return the Hermes config.yaml as a dict."""
    if not HERMES_CONFIG_PATH.exists():
        return {}
    with open(HERMES_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def get_model_name(config: dict | None = None) -> str:
    if config is None:
        config = load_hermes_config()
    return config.get("model", {}).get("default", "unknown")


def get_personality(config: dict | None = None) -> str:
    if config is None:
        config = load_hermes_config()
    personalities = config.get("agent", {}).get("personalities", {})
    return personalities.get("helpful", "AI Assistant")


def get_summary_model(config: dict | None = None) -> str:
    if config is None:
        config = load_hermes_config()
    return config.get("compression", {}).get("summary_model", "")
