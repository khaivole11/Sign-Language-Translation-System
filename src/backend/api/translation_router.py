from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from src.backend.schemas.response import InferenceResponse
from src.backend.services.translation_pipeline import run_translation_pipeline

router = APIRouter()

@router.post("/api/translate", response_model=InferenceResponse)
async def translate_video_endpoint(request: Request, file: UploadFile = File(...)):
    """
    Endpoint chuẩn nhận trực tiếp MP4 từ React.
    Quy trình: MP4 -> I3D Feature (.npy) -> Fairseq Inference -> Phản hồi text.
    """
    i3d_model = request.app.state.i3d_model
    if not i3d_model:
        raise HTTPException(status_code=500, detail="Hệ thống thiếu I3D Feature Extractor Model.")

    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ video MP4, MOV, AVI.")

    result_dict = run_translation_pipeline(file.filename, file.file, i3d_model)
    return InferenceResponse(**result_dict)
