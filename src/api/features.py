# src/api/features.py
from __future__ import annotations

import asyncio
import base64
import logging
import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse

from functools import partial
from starlette.concurrency import run_in_threadpool

from src.services.feature_ext import (
    append_tsv_row,
    build_feature_metadata,
    extract_i3d_sequence,
    get_device,
    load_i3d_backbone,
)

# =========================
# Config
# =========================
APP_NAME = "I3D Feature API"

MODEL_PATH = os.getenv("I3D_MODEL_PATH", "models/i3d/model.pth.tar")
OUTPUT_ROOT = Path(os.getenv("I3D_OUTPUT_ROOT", "data/how2sign/i3d_features"))
TSV_PATH = Path(os.getenv("I3D_TSV_PATH", "data/how2sign/i3d_features.tsv"))

TARGET_FPS = float(os.getenv("I3D_TARGET_FPS", "25"))
FRAME_SIZE = int(os.getenv("I3D_FRAME_SIZE", "224"))
WINDOW = int(os.getenv("I3D_WINDOW", "16"))
STRIDE = int(os.getenv("I3D_STRIDE", "8"))
BATCH_SIZE_CLIPS = int(os.getenv("I3D_BATCH_SIZE_CLIPS", "8"))

USE_HALF = os.getenv("I3D_USE_HALF", "false").lower() == "true"
SAVE_DTYPE = os.getenv("I3D_SAVE_DTYPE", "fp32")  # fp16 | fp32
TENSOR_ORDER = os.getenv("I3D_TENSOR_ORDER", "CTHW")  # CTHW | TCHW
DEVICE = os.getenv("I3D_DEVICE", "") or None

MAX_UPLOAD_MB = int(os.getenv("I3D_MAX_UPLOAD_MB", "300"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# Số request đồng thời dùng GPU
GPU_CONCURRENCY = int(os.getenv("I3D_GPU_CONCURRENCY", "1"))

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".mpeg", ".mpg"}

# =========================
# Logging
# =========================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(APP_NAME)

# =========================
# Global state
# =========================
model = None
device = None
gpu_semaphore: asyncio.Semaphore | None = None
tsv_lock: asyncio.Lock | None = None


def ensure_dir(path: str | Path) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def validate_video_extension(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension không hợp lệ: {ext}. Hỗ trợ: {sorted(VIDEO_EXTENSIONS)}",
        )


def validate_existing_video_path(video_path: str) -> Path:
    p = Path(video_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file: {video_path}")
    if not p.is_file():
        raise HTTPException(status_code=400, detail=f"Đường dẫn không phải file: {video_path}")
    if p.suffix.lower() not in VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extension của path không hợp lệ: {p.suffix.lower()}",
        )
    return p


async def save_upload_to_temp(upload_file: UploadFile) -> Path:
    validate_video_extension(upload_file.filename or "unknown.mp4")

    suffix = Path(upload_file.filename or "upload.mp4").suffix.lower()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = Path(tmp.name)

    total = 0
    try:
        while True:
            chunk = await upload_file.read(1024 * 1024)  # 1MB/chunk
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"File quá lớn. Giới hạn hiện tại: {MAX_UPLOAD_MB} MB",
                )
            tmp.write(chunk)
        tmp.flush()
        tmp.close()
    except Exception:
        try:
            tmp.close()
        except Exception:
            pass
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise

    return tmp_path


def make_output_npy_path(src_video: Path) -> Path:
    ensure_dir(OUTPUT_ROOT)
    # để tránh trùng tên nếu nhiều request cùng file name
    safe_name = f"{src_video.stem}_{uuid.uuid4().hex[:8]}.npy"
    return OUTPUT_ROOT / safe_name


def build_presigned_like_path(path: Path) -> str:
    # local path placeholder; nếu sau này dùng S3/MinIO thì thay bằng signed URL thật
    return str(path.resolve())


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, device, gpu_semaphore, tsv_lock

    ensure_dir(OUTPUT_ROOT)
    ensure_dir(TSV_PATH.parent)

    device = get_device(DEVICE)
    logger.info("Loading I3D model from: %s", MODEL_PATH)
    logger.info("Using device: %s", device)

    model = load_i3d_backbone(
        weight_path=MODEL_PATH,
        device=device,
        use_half=USE_HALF,
    )
    gpu_semaphore = asyncio.Semaphore(GPU_CONCURRENCY)
    tsv_lock = asyncio.Lock()

    logger.info("API started successfully")
    yield
    logger.info("API shutting down")


app = FastAPI(title=APP_NAME, lifespan=lifespan)


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", uuid.uuid4().hex)
    request.state.request_id = request_id

    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "request_id=%s method=%s path=%s failed latency_ms=%.2f error=%s",
            request_id,
            request.method,
            request.url.path,
            latency_ms,
            str(e),
        )
        raise

    latency_ms = (time.perf_counter() - start) * 1000
    response.headers["x-request-id"] = request_id
    response.headers["x-latency-ms"] = f"{latency_ms:.2f}"

    logger.info(
        "request_id=%s method=%s path=%s status=%s latency_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
    )
    return response


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_path": MODEL_PATH,
        "device": device,
        "output_root": str(OUTPUT_ROOT),
        "tsv_path": str(TSV_PATH),
    }


@app.post("/features")
async def extract_features_api(
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    video_path: Optional[str] = Form(default=None),
    return_bytes: bool = Query(default=False, description="Nếu true, trả thêm feature bytes base64"),
    return_presigned_path: bool = Query(default=False, description="Nếu true, trả thêm đường dẫn kiểu presigned"),
):
    """
    Nhận:
      - file upload HOẶC
      - video_path từ local path

    Trả:
      {
        request_id,
        npy_path,
        presigned_path?,
        feature_bytes_b64?,
        fps,
        num_frames,
        duration,
        feature_shape,
        dtype,
        extract_ms
      }
    """
    request_id = request.state.request_id

    if file is None and not video_path:
        raise HTTPException(status_code=400, detail="Cần truyền file hoặc video_path")

    if file is not None and video_path:
        raise HTTPException(status_code=400, detail="Chỉ truyền 1 trong 2: file hoặc video_path")

    temp_file_path: Optional[Path] = None
    src_path: Optional[Path] = None

    try:
        if file is not None:
            temp_file_path = await save_upload_to_temp(file)
            src_path = temp_file_path
            source_name = file.filename or temp_file_path.name
        else:
            src_path = validate_existing_video_path(video_path)
            source_name = src_path.name

        save_path = make_output_npy_path(src_path)

        async with gpu_semaphore:
            start_extract = time.perf_counter()

            extract_fn = partial(
                extract_i3d_sequence,
                video_path=src_path,
                model=model,
                save_path=save_path,
                window=WINDOW,
                stride=STRIDE,
                target_fps=TARGET_FPS,
                resize=(FRAME_SIZE, FRAME_SIZE),
                batch_size_clips=BATCH_SIZE_CLIPS,
                device=device,
                use_half=USE_HALF,
                tensor_order=TENSOR_ORDER,
                save_dtype=SAVE_DTYPE,
            )

            features, meta = await run_in_threadpool(extract_fn)

            elapsed_ms = (time.perf_counter() - start_extract) * 1000.0

        row = build_feature_metadata(
            sample_id=Path(source_name).stem,
            signs_file=save_path,
            duration=meta["duration"],
            fps=meta["fps"],
            num_frames=meta["num_frames"],
            feature_shape=features.shape,
            dtype=str(features.dtype),
        )

        async with tsv_lock:
            append_fn = partial(append_tsv_row, TSV_PATH, row)
            await run_in_threadpool(append_fn)

        response = {
            "request_id": request_id,
            "input_name": source_name,
            "npy_path": str(save_path),
            "fps": meta["fps"],
            "num_frames": meta["num_frames"],
            "duration": meta["duration"],
            "num_clips": meta["num_clips"],
            "feature_shape": list(features.shape),
            "dtype": str(features.dtype),
            "extract_ms": round(elapsed_ms, 3),
        }

        if return_presigned_path:
            response["presigned_path"] = build_presigned_like_path(save_path)

        if return_bytes:
            feature_bytes = features.tobytes()
            response["feature_bytes_b64"] = base64.b64encode(feature_bytes).decode("utf-8")

        logger.info(
            "request_id=%s source=%s saved=%s fps=%s num_frames=%s duration=%.3f",
            request_id,
            source_name,
            save_path,
            meta["fps"],
            meta["num_frames"],
            meta["duration"],
        )

        logger.info("Received video_path: %s", video_path)
        logger.info("Received file: %s", file)

        return JSONResponse(content=response)

    finally:
        if temp_file_path and temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)