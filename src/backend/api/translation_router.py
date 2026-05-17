from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Request
from src.backend.schemas.response import (
    FeedbackCreateRequest,
    FeedbackListResponse,
    FeedbackResponse,
    InferenceResponse,
    MultilingualAgentRequest,
    MultilingualAgentResponse,
)
from src.backend.services.feedback_store import FeedbackStoreError, feedback_store
from src.backend.services.translation_pipeline import run_translation_pipeline
from src.backend.services.multilingual_agent import run_multilingual_agent

router = APIRouter()

@router.post("/api/translate", response_model=InferenceResponse)
async def translate_video_endpoint(
    request: Request,
    file: UploadFile = File(...),
    include_multilingual: bool = Query(True),
):
    """
    Endpoint chuẩn nhận trực tiếp MP4 từ React.
    Quy trình: MP4 -> I3D Feature (.npy) -> Fairseq Inference -> Phản hồi text.
    """
    i3d_model = request.app.state.i3d_model
    if not i3d_model:
        raise HTTPException(status_code=500, detail="Hệ thống thiếu I3D Feature Extractor Model.")

    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ video MP4, MOV, AVI.")

    result_dict = run_translation_pipeline(
        file.filename,
        file.file,
        i3d_model,
        include_multilingual=include_multilingual,
    )
    return InferenceResponse(**result_dict)


@router.post("/api/multilingual-agent", response_model=MultilingualAgentResponse)
async def multilingual_agent_endpoint(payload: MultilingualAgentRequest):
    """
    Run only the multilingual AI agent after sign-to-text output is ready.
    """
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text is required.")

    return MultilingualAgentResponse(
        **run_multilingual_agent(
            payload.source_text,
            source_language=payload.source_language,
            source_sign_language=payload.source_sign_language,
            target_languages=payload.target_languages or None,
        )
    )


@router.post("/api/feedback", response_model=FeedbackResponse)
async def submit_translation_feedback(payload: FeedbackCreateRequest):
    """
    Save user-corrected translation text as a continual-learning label.
    The related .npy feature file is resolved by request_id.
    """
    if not payload.user_label.strip():
        raise HTTPException(status_code=400, detail="user_label is required.")

    try:
        return FeedbackResponse(**feedback_store.save(payload))
    except FeedbackStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/feedback", response_model=FeedbackListResponse)
async def list_translation_feedback(
    review_status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
):
    """
    List captured feedback rows for review/export tooling.
    """
    try:
        items = feedback_store.list(review_status=review_status, limit=limit)
        backend = feedback_store.backend_name
    except FeedbackStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return FeedbackListResponse(
        storage_backend=backend,
        count=len(items),
        items=items,
    )
