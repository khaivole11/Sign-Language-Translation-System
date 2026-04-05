import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from src.backend.config.config import (
    API_FEATURE_URL,
    FEATURE_FILE_FIELD,
    FEATURE_UPLOAD_NAME,
    TIMEOUT_SEC,
)
from src.backend.services.errors import UpstreamServiceError


def _extract_features_stub(_file_bytes: bytes) -> dict:
    return {"features": [1, 2, 3], "_stub": True}


def _extract_features_live(file_bytes: bytes) -> dict:
    files = {
        FEATURE_FILE_FIELD: (
            FEATURE_UPLOAD_NAME,
            file_bytes,
            "application/octet-stream",
        )
    }
    try:
        res = requests.post(API_FEATURE_URL, files=files, timeout=TIMEOUT_SEC)
    except requests.exceptions.Timeout as e:
        raise UpstreamServiceError(504, f"TV1 timeout sau {TIMEOUT_SEC}s", "tv1") from e
    except requests.exceptions.RequestException as e:
        raise UpstreamServiceError(502, f"Không kết nối được TV1: {e}", "tv1") from e

    if not res.ok:
        raise UpstreamServiceError.from_response(res, "tv1")

    ct = (res.headers.get("Content-Type") or "").lower()
    if "application/json" in ct:
        try:
            return res.json()
        except ValueError:
            return {"payload": res.text}
    return {"payload": res.text}


def extract_features(file_bytes: bytes) -> dict:
    """
    Gọi TV1 (API_FEATURE_URL) nếu đã cấu hình; ngược lại trả stub để dev UI.
    """
    if API_FEATURE_URL:
        return _extract_features_live(file_bytes)
    return _extract_features_stub(file_bytes)
