from typing import Any, Dict, List, Optional
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from src.backend.core.config import API_TRANSLATE_URL, TIMEOUT_SEC
from src.backend.services.errors import UpstreamServiceError


def _normalize_warnings(data: Any) -> List[str]:
    if data is None:
        return []
    if isinstance(data, str) and data.strip():
        return [data.strip()]
    if isinstance(data, list):
        return [str(x) for x in data if x is not None and str(x).strip()]
    return []


def _map_translate_response(data: Any) -> Dict[str, Any]:
    if not isinstance(data, dict):
        text = str(data) if data is not None else ""
        return {"raw": text, "refined": text, "warnings": []}

    raw = (
        data.get("raw")
        or data.get("raw_text")
        or data.get("text_raw")
        or data.get("output_raw")
        or data.get("text")
        or ""
    )
    refined = (
        data.get("refined")
        or data.get("translated")
        or data.get("output")
        or data.get("translation")
        or raw
    )
    warnings = _normalize_warnings(data.get("warnings"))
    w = data.get("warning")
    if isinstance(w, str) and w.strip():
        warnings = [*warnings, w.strip()]
    return {
        "raw": str(raw) if raw is not None else "",
        "refined": str(refined) if refined is not None else "",
        "warnings": warnings,
    }


def _translate_stub(_features: dict) -> dict:
    return {
        "raw": "toi xin loi",
        "refined": "Tôi xin lỗi vì không thể đến hôm nay",
        "warnings": [],
        "_stub": True,
    }


def _translate_live(features: dict) -> dict:
    try:
        res = requests.post(API_TRANSLATE_URL, json=features, timeout=TIMEOUT_SEC)
    except requests.exceptions.Timeout as e:
        raise UpstreamServiceError(504, f"TV2 timeout sau {TIMEOUT_SEC}s", "tv2") from e
    except requests.exceptions.RequestException as e:
        raise UpstreamServiceError(502, f"Không kết nối được TV2: {e}", "tv2") from e

    if not res.ok:
        raise UpstreamServiceError.from_response(res, "tv2")

    try:
        body = res.json()
    except ValueError:
        body = {"raw": res.text, "refined": res.text}
    return _map_translate_response(body)


def translate(features: dict) -> dict:
    """
    Gọi TV2 (API_TRANSLATE_URL) với JSON từ bước features; chưa cấu hình thì stub.
    """
    if API_TRANSLATE_URL:
        return _translate_live(features)
    return _translate_stub(features)
