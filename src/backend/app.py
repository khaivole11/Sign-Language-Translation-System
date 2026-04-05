import uuid
import sys
from pathlib import Path

import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Fix import path để module src/ gọi ngang hàng configs/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.backend.config.config import MAX_UPLOAD_MB, services_configured
from src.backend.services.feature_ext import extract_features
from src.backend.services.translator import translate
from src.backend.services.errors import UpstreamServiceError
from src.backend.utils.timer import Timer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _http_for_upstream(e: UpstreamServiceError) -> HTTPException:
    code = e.status_code
    msg = e.message
    if code == 429:
        return HTTPException(
            status_code=429,
            detail="Hệ thống đang quá tải. Vui lòng thử lại sau vài giây.",
        )
    if code in (502, 503, 504):
        return HTTPException(
            status_code=503,
            detail=f"Dịch vụ AI tạm bận hoặc không phản hồi ({e.service}). {msg}",
        )
    if code == 400:
        return HTTPException(status_code=400, detail=msg)
    if code == 401 or code == 403:
        return HTTPException(status_code=502, detail=f"Từ chối truy cập TV ({e.service}). Kiểm tra API key / quyền.")
    return HTTPException(status_code=502, detail=f"Lỗi từ {e.service}: {msg}")


@app.post("/translate-ui")
async def translate_ui(file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())

    try:
        file_bytes = await file.read()

        if len(file_bytes) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"File quá lớn (tối đa {MAX_UPLOAD_MB} MB).",
            )

        timer = Timer()

        timer.start("features")
        features = extract_features(file_bytes)
        timer.stop("features")

        timer.start("translate")
        result = translate(features)
        timer.stop("translate")

        warnings = list(result.get("warnings") or [])
        stub = bool(result.get("_stub")) or not services_configured()

        payload = {
            "request_id": request_id,
            "raw": result.get("raw", ""),
            "refined": result.get("refined", ""),
            "time": timer.get(),
            "warnings": warnings,
            "stub": stub,
        }
        return payload

    except HTTPException:
        raise
    except UpstreamServiceError as e:
        raise _http_for_upstream(e) from e
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
