import sys
from pathlib import Path
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Giúp module src/ gọi ngang hàng configs/ mà không văng lỗi ModuleNotFound
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.inference import build_dummy_tsv, generate_translation, parse_best_translation
from configs.config import settings
from src.backend.app import app as backend_app

app = FastAPI(title=settings.PROJECT_NAME)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount backend API routes
app.mount("/api", backend_app)

# Định nghĩa khuôn mẫu trả về kết quả JSON để API Interface nhận chuẩn
class InferenceResponse(BaseModel):
    success: bool
    translation: str
    error_message: str = None

@app.post(f"/{settings.API_VERSION}/translate", response_model=InferenceResponse)
async def translate_video_npy(file: UploadFile = File(...)):
    if not file.filename.endswith('.npy'):
        raise HTTPException(status_code=400, detail="Chỉ nhận định dạng file đặc trưng .npy")

    base_target_dir = Path(settings.TEMP_DATA_DIR)
    temp_input_path = base_target_dir / file.filename
    temp_tsv_dir = None
    
    try:
        # 1. Ghi file numpy lên đĩa vật lý (disk)
        with temp_input_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Trình tự Pipeline Xử Lý Ngôn Ngữ
        temp_tsv_dir, _ = build_dummy_tsv(temp_input_path)
        raw_stdout = generate_translation(temp_tsv_dir)
        final_text = parse_best_translation(raw_stdout)
        
        if not final_text:
             return InferenceResponse(success=False, translation="", error_message="Chưa có kết quả dịch hợp lệ được sinh ra.")
             
        return InferenceResponse(success=True, translation=final_text)

    except Exception as e:
         return InferenceResponse(success=False, translation="", error_message=str(e))
        
    finally:
        # Quan trọng vô cùng: Hệ thống tự dọn dẹp dung lượng Model Test
        if temp_input_path.exists():
            temp_input_path.unlink(missing_ok=True)
        if temp_tsv_dir and temp_tsv_dir.exists():
            for p in temp_tsv_dir.glob("*"):
                p.unlink(missing_ok=True)
            temp_tsv_dir.rmdir()

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Sign Language Model API Service is UP!"}