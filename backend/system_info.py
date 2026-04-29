import platform
import subprocess
import time
import psutil
from config import load_hermes_config, get_model_name, HERMES_AGENT_DIR

_start_time = time.time()


def _get_gpu_name() -> str:
    try:
        if platform.system() == "Darwin":
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType"],
                capture_output=True, text=True, timeout=5,
            )
            for line in result.stdout.splitlines():
                if "Chipset Model" in line or "Chip" in line:
                    return line.split(":")[-1].strip()
            return "Integrated"
        else:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=5,
            )
            return result.stdout.strip() or "N/A"
    except Exception:
        return "N/A"


APP_VERSION = "0.1.1"


def _get_app_version() -> str:
    return APP_VERSION


def _get_hermes_version() -> str:
    """Get Hermes Agent runtime version from pyproject.toml."""
    pyproject = HERMES_AGENT_DIR / "pyproject.toml"
    if not pyproject.exists():
        return "unknown"
    try:
        for line in pyproject.read_text().splitlines():
            if line.strip().startswith("version"):
                return line.split("=")[-1].strip().strip('"').strip("'")
    except Exception:
        pass
    return "unknown"


_static_info = {
    "cpu": platform.processor() or platform.machine(),
    "memory": f"{round(psutil.virtual_memory().total / (1024**3))}GB",
    "disk": f"{round(psutil.disk_usage('/').total / (1024**3))}GB",
    "gpu": _get_gpu_name(),
    "os": f"{platform.system()} {platform.release()}",
    "app_version": _get_app_version(),
    "hermes_version": _get_hermes_version(),
}


def get_system_info() -> dict:
    config = load_hermes_config()
    elapsed = int(time.time() - _start_time)
    hours, remainder = divmod(elapsed, 3600)
    minutes, seconds = divmod(remainder, 60)
    return {
        **_static_info,
        "model": get_model_name(config),
        "runtime": f"{hours:02d}:{minutes:02d}:{seconds:02d}",
    }
