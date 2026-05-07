import time
import uuid
import shutil
from pathlib import Path

from configs.config import settings
from src.backend.services.i3d_extractor import extract_i3d_sequence
from src.backend.services.fairseq_runner import build_dummy_tsv, generate_translation, parse_best_translation

def run_translation_pipeline(file_name: str, file_stream, i3d_model) -> dict:
    """
    Quy trình: MP4 -> I3D Feature (.npy) -> Fairseq Inference -> Phản hồi text.
    """
    request_id = str(uuid.uuid4())
    temp_dir = Path(settings.TEMP_DATA_DIR) / request_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    mp4_path = temp_dir / file_name
    npy_path = temp_dir / f"{mp4_path.stem}.npy"
    temp_tsv_dir = None
    
    start_time = time.time()
    
    try:
        # Bước 1: Lưu tạm file MP4 do User Upload
        with mp4_path.open("wb") as buffer:
            shutil.copyfileobj(file_stream, buffer)
            
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
        
        return {
            "success": True,
            "request_id": request_id,
            "raw": "",
            "refined": final_text if final_text else "Cannot translate.",
            "time": elapsed,
            "error_message": None
        }

    except Exception as e:
        safe_err = str(e).encode('ascii', 'ignore').decode('ascii')
        print(f"Error [ID: {request_id}]: {safe_err}")
        return {
            "success": False,
            "request_id": request_id,
            "raw": "",
            "refined": "",
            "time": 0.0,
            "error_message": str(e)
        }
        
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        if temp_tsv_dir and temp_tsv_dir.exists():
            shutil.rmtree(temp_tsv_dir, ignore_errors=True)
