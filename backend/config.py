import os
import yaml
from pathlib import Path

HERMES_HOME = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))
HERMES_AGENT_DIR = HERMES_HOME / "hermes-agent"
HERMES_CONFIG_PATH = HERMES_HOME / "config.yaml"
HERMES_LOGS_DIR = HERMES_HOME / "logs"
HERMES_AGENT_LOG = HERMES_LOGS_DIR / "agent.log"
HERMES_ERRORS_LOG = HERMES_LOGS_DIR / "errors.log"
DATA_DIR = HERMES_HOME / "webui-data"


def load_hermes_config() -> dict:
    """Load and return the Hermes config.yaml as a dict."""
    if not HERMES_CONFIG_PATH.exists():
        return {}
    with open(HERMES_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_hermes_config(config: dict) -> None:
    """Persist Hermes config.yaml."""
    HERMES_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HERMES_CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, allow_unicode=True, sort_keys=False)


def get_model_name(config: dict | None = None) -> str:
    if config is None:
        config = load_hermes_config()
    return config.get("model", {}).get("default", "unknown")


def get_model_options(config: dict | None = None) -> list[str]:
    """Return selectable chat models from config/env plus the active model."""
    if config is None:
        config = load_hermes_config()

    model_cfg = config.get("model", {})
    candidates: list[str] = []

    env_options = os.environ.get("HERMES_MODEL_OPTIONS", "")
    candidates.extend(m.strip() for m in env_options.split(",") if m.strip())

    for key in ("options", "available", "models", "list"):
        raw = model_cfg.get(key)
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, str):
                    candidates.append(item)
                elif isinstance(item, dict):
                    value = item.get("id") or item.get("name") or item.get("model")
                    if value:
                        candidates.append(str(value))

    candidates.extend([
        model_cfg.get("default", ""),
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.3-codex",
        "gpt-5.2",
    ])

    seen: set[str] = set()
    result: list[str] = []
    for model in candidates:
        if model and model not in seen:
            seen.add(model)
            result.append(model)
    return result


def set_model_name(model: str) -> dict:
    config = load_hermes_config()
    model_cfg = config.setdefault("model", {})
    model_cfg["default"] = model
    save_hermes_config(config)
    return config


def get_personality(config: dict | None = None) -> str:
    if config is None:
        config = load_hermes_config()
    personalities = config.get("agent", {}).get("personalities", {})
    return personalities.get("helpful", "AI Assistant")


def get_summary_model(config: dict | None = None) -> str:
    if config is None:
        config = load_hermes_config()
    return config.get("compression", {}).get("summary_model", "")
