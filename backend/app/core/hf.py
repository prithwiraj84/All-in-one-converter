"""Fetch recent Hugging Face Space logs for the admin panel.

The HF logs API streams Server-Sent Events. We read the backlog (and a short
live tail), then stop — returning a bounded snapshot. Needs HF_TOKEN +
HF_USERNAME + HF_SPACE.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime

import httpx

from app.config import settings

logger = logging.getLogger("aio.hf")


def configured() -> bool:
    return bool(settings.hf_token and settings.hf_username and settings.hf_space)


def _parse_ts(value) -> float:
    if isinstance(value, (int, float)):
        return float(value) / (1000 if value > 1e12 else 1)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return time.time()


async def space_logs(kind: str = "run", max_lines: int = 250) -> dict:
    if not configured():
        return {"configured": False, "logs": []}
    kind = "build" if kind == "build" else "run"
    url = f"https://huggingface.co/api/spaces/{settings.hf_username}/{settings.hf_space}/logs/{kind}"
    headers = {"Authorization": f"Bearer {settings.hf_token}"}
    # Read times out when the stream goes idle (backlog delivered) → we stop.
    timeout = httpx.Timeout(connect=10.0, read=5.0, write=10.0, pool=10.0)

    out: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("GET", url, headers=headers) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread())[:200].decode("utf-8", "ignore")
                    return {"configured": True, "error": f"HF API {resp.status_code}: {body}", "logs": []}
                async for raw in resp.aiter_lines():
                    line = raw.strip()
                    if not line or line.startswith(("event:", "id:", "retry:", ":")):
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if not line:
                        continue

                    ts = time.time()
                    msg = line
                    try:
                        obj = json.loads(line)
                        if isinstance(obj, dict):
                            msg = obj.get("data") or obj.get("message") or obj.get("line") or line
                            if "timestamp" in obj or "ts" in obj:
                                ts = _parse_ts(obj.get("timestamp") or obj.get("ts"))
                    except (json.JSONDecodeError, ValueError):
                        pass

                    low = str(msg).lower()
                    level = "ERROR" if ("error" in low or "traceback" in low) else "WARNING" if "warn" in low else "LOG"
                    out.append({"ts": ts, "level": level, "source": f"hf-{kind}", "message": str(msg).rstrip()[:2000]})
                    if len(out) >= max_lines:
                        break
    except httpx.TimeoutException:
        pass  # idle stream → return what we collected
    except Exception:  # noqa: BLE001
        logger.warning("hf space_logs(%s) failed", kind, exc_info=True)
        return {"configured": True, "error": "Could not reach the HF logs API.", "logs": out[-max_lines:]}

    return {"configured": True, "logs": out[-max_lines:]}
