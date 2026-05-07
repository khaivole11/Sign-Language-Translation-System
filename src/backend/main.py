import sys
from pathlib import Path
import shutil
import uuid
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Cấu hình path
base_dir = Path(__file__).resolve().parent.parent.parent
if str(base_dir) not in sys.path:
    sys.path.insert(0, str(base_dir))

from src.backend.inference import build_dummy_tsv, generate_translation, parse_best_translation
from src.backend.services.i3d_extractor import load_i3d_backbone, extract_i3d_sequence
from configs.config import settings

app = FastAPI(title="Sign Language Translation API - Monolithic")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load I3D Backbone Model (Chỉ load 1 lần khi khởi động API)
print("Initializing I3D Backbone Model...")
i3d_model_path = base_dir / "models" / "i3d" / "model.pth.tar"
i3d_model = None

try:
    if i3d_model_path.exists():
        i3d_model = load_i3d_backbone(i3d_model_path, device="cpu", use_half=False)
        print("I3D Backbone Loaded Successfully!")
    else:
        print(f"Warning: Cannot find I3D model at {i3d_model_path}")
except Exception as e:
    print(f"Error loading I3D: {e}")

# Khuôn mẫu trả về chuẩn theo form FE React (ProcessingPage / ResultPage)
class InferenceResponse(BaseModel):
    success: bool
    request_id: str
    raw: str = ""
    refined: str = ""
    time: float = 0.0
    error_message: str = None
    warnings: list = []
    stub: bool = False

@app.post("/api/translate", response_model=InferenceResponse)
async def translate_video_endpoint(file: UploadFile = File(...)):
    """
    Endpoint chuẩn nhận trực tiếp MP4 từ React.
    Quy trình: MP4 -> I3D Feature (.npy) -> Fairseq Inference -> Phản hồi text.
    """
    if not i3d_model:
        raise HTTPException(status_code=500, detail="Hệ thống thiếu I3D Feature Extractor Model.")

    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ video MP4, MOV, AVI.")

    request_id = str(uuid.uuid4())
    temp_dir = Path(settings.TEMP_DATA_DIR) / request_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    mp4_path = temp_dir / file.filename
    npy_path = temp_dir / f"{mp4_path.stem}.npy"
    temp_tsv_dir = None
    
    start_time = time.time()
    
    try:
        # Bước 1: Lưu tạm file MP4 do User Upload
        with mp4_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Bước 2: Extract Feature I3D
        print(f"[ID: {request_id}] Extracting I3D features from MP4...")
        extract_i3d_sequence(
            video_path=mp4_path,
            model=i3d_model,
            save_path=npy_path,
            target_fps=25.0,
            resize=(224, 224),
            device="cpu", # Nếu có card rời, cân nhắc đổi thành cuda
            use_half=False
        )
        
        if not npy_path.exists():
            raise Exception("Extracting features failed, no NPY found.")

        # Bước 3: Đưa vào Fairseq để dịch Inference
        print(f"[ID: {request_id}] Translating to text...")
        temp_tsv_dir, _ = build_dummy_tsv(npy_path)
        raw_stdout = generate_translation(temp_tsv_dir)
        final_text = parse_best_translation(raw_stdout)
        
        elapsed = time.time() - start_time
        print(f"Translation complete: '{final_text}' ({elapsed:.2f}s)")
        
        return InferenceResponse(
            success=True,
            request_id=request_id,
            raw="", # Fairseq không trả raw/refined tách biệt trừ phi xích thêm LLM
            refined=final_text if final_text else "Cannot translate.",
            time=elapsed
        )

    except Exception as e:
        safe_err = str(e).encode('ascii', 'ignore').decode('ascii')
        print(f"Error [ID: {request_id}]: {safe_err}")
        return InferenceResponse(
            success=False, 
            request_id=request_id,
            error_message=str(e)
        )
        
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        if temp_tsv_dir and temp_tsv_dir.exists():
            shutil.rmtree(temp_tsv_dir, ignore_errors=True)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Monolithic Sign Language API is UP!"}