from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Request
from src.backend.schemas.response import InferenceResponse, MultilingualAgentRequest, MultilingualAgentResponse
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
