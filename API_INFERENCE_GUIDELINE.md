# Hướng dẫn Xây dựng Hệ thống API Dịch Ngôn ngữ Ký hiệu (End-to-End E2E)

Tài liệu này hướng dẫn chi tiết cách tổ chức dự án chuẩn, cấu trúc thư mục, và toàn bộ mã nguồn để triển khai mô hình Fairseq thành một hệ thống API theo ĐÚNG kiến trúc thiết kế tổng quan (có module `src`, `data`, `models`, `configs`, `tests`).

---

## 1. Kiến trúc Thư mục Hệ thống (Project Structure)

```text
project-root/ 
│ 
├── src/                  # Core source code
│   ├── __init__.py
│   ├── main.py           # Khởi tạo FastAPI Server và cấu hình các Endpoints
│   └── inference.py      # Logic tiền xử lý (.npy -> .tsv) và gọi model Fairseq
│
├── data/                 # Data or data-loading scripts
│   ├── .keep             # Git keep file
│   └── README.md         # Lưu ý: Folder này dùng để xử lý i3d tạm thời
│
├── models/               # Trained models or checkpoints
│   ├── ckpts/
│   │   └── checkpoint_best.pt
│   └── vocab/
│       └── cvpr23.train.how2sign.unigram7000_lowercased.model
│
├── configs/              # Configuration files
│   ├── __init__.py
│   ├── config.py         # Code đọc tham số từ biến môi trường
│   └── .env              # File biến môi trường (LƯU Ý: Không push lên nhánh public)
│
├── tests/                # Tests
│   ├── __init__.py
│   └── test_api.py       # Code unit test
│
├── requirements.txt      # (Hoặc pyproject.toml) Quản lý khai báo thư viện
├── Dockerfile            # Cấu hình container hóa API
├── docker-compose.yml    # Môi trường chạy Deploy E2E Setup
└── README.md             # Hướng dẫn tổng thể
```

---

## 2. Code chi tiết cho cụm Cấu hình - `configs/`

Chìa khóa ở đây là tách biệt các biến môi trường thay đổi liên tục (như base dirs, models paths, flags) ra khỏi mã nguồn lõi.

**📄 `configs/.env`**
```env
# Lưu ý: file này bảo mật, hãy đảm bảo đã đưa vào .gitignore
PROJECT_NAME="SLT Inference API"
API_VERSION="v1"
MODEL_CHECKPOINT_PATH="../models/ckpts/checkpoint_best.pt"
VOCAB_MODEL_PATH="../models/vocab/cvpr23.train.how2sign.unigram7000_lowercased.model"
BEAM_SIZE=5
MAX_TOKENS=1600
TEMP_DATA_DIR="../data"
```

**📄 `configs/config.py`**
Sử dụng pydantic-settings đọc trực tiếp file `.env` thành biến thao tác trung tâm để code bên trong có thể dùng biến này để gọi ra thay vì gọi path bằng Text cứng.
```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "SLT API"
    API_VERSION: str = "v1"
    
    MODEL_CHECKPOINT_PATH: str
    VOCAB_MODEL_PATH: str
    BEAM_SIZE: int = 5
    MAX_TOKENS: int = 1600
    TEMP_DATA_DIR: str = "../data"

    class Config:
        # Đường dẫn cấu hình để hệ thống map chính xác .env 
        env_file = Path(__file__).resolve().parent / ".env"

settings = Settings()
```

---

## 3. Code chi tiết cho Mã nguồn Lõi - `src/`

Khối Controller.

**📄 `src/inference.py`**
Module thực thi Deep Learning: Chuyển đổi file `.npy` vật lý sang cấu trúc logic `.tsv` và giao tiếp với nhân Fairseq theo format subprocess giống logic cũ.

```python
import numpy as np
import tempfile
import subprocess
import sys
from pathlib import Path
from configs.config import settings

def build_dummy_tsv(input_npy: Path) -> tuple[Path, Path]:
    feat = np.load(str(input_npy))
    frames_length = feat.shape[0]

    # Đảm bảo target data dir có tồn tại
    base_data_dir = Path(settings.TEMP_DATA_DIR)
    base_data_dir.mkdir(parents=True, exist_ok=True)
    
    # Sinh folder tạm để các lượt Request song song không bị đè file
    temp_dir = Path(tempfile.mkdtemp(prefix="infer_", dir=base_data_dir))
    tsv_path = temp_dir / "dummy.tsv"
    rel_path = str(input_npy.resolve())

    with tsv_path.open("w", encoding="utf-8") as f:
        f.write("id\tsigns_file\tsigns_offset\tsigns_length\tsigns_type\ttranslation\n")
        f.write(f"dummy_id\t{rel_path}\t0\t{frames_length}\ti3d\t_\n")

    return temp_dir, tsv_path

def generate_translation(temp_dir: Path) -> str:
    # Build subprocess args
    cmd = [
        sys.executable, "-m", "fairseq_cli.generate",
        str(temp_dir),
        "--path", str(Path(settings.MODEL_CHECKPOINT_PATH).resolve()),
        "--task", "sign_to_text",
        "--gen-subset", "dummy",
        "--max-tokens", str(settings.MAX_TOKENS),
        "--beam", str(settings.BEAM_SIZE),
        "--bpe", "sentencepiece",
        "--sentencepiece-model", str(Path(settings.VOCAB_MODEL_PATH).resolve()),
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Fairseq lỗi: {result.stderr}")
        
    return result.stdout

def parse_best_translation(stdout_text: str) -> str:
    best_score = float("-inf")
    best_text = ""
    for line in stdout_text.splitlines():
        if not line.startswith("D-"):
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        try:
            score = float(parts[1])
        except ValueError:
            score = float("-inf")
            
        text = parts[2].strip()
        if score > best_score:
            best_score = score
            best_text = text

    return best_text
```

**📄 `src/main.py`**
Khởi tạo cổng giao tiếp FastAPI, định nghĩa API Endpoint duy nhất và luồng thực thi tổng (`Controller`).

```python
import sys
from pathlib import Path
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel

# Giúp module src/ gọi ngang hàng configs/ mà không văng lỗi ModuleNotFound
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.inference import build_dummy_tsv, generate_translation, parse_best_translation
from configs.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

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
```

---

## 4. Testing - `tests/`

**📄 `tests/test_api.py`**
Hỗ trợ kiểm tra Server còn sống hay không, chạy tool này sau bước Setup ở phần 6.
```python
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_api_health():
    response = client.get("/")
    assert response.status_code == 200
```

---

## 5. Cấu hình Môi trường Triển Khai (`root/`)

**📄 `requirements.txt`**
Cố định phiên bản để khi clone lại trên cloud hay máy chủ dự án mới Docker ko bị lỗi fail C++ building.
```text
fastapi>=0.100.0
uvicorn[standard]>=0.23.0
python-multipart>=0.0.6
pydantic>=2.0.0
pydantic-settings>=2.0.0
numpy
sentencepiece
torch
truecase
pytest
```

**📄 `Dockerfile`**
```dockerfile
FROM python:3.9-slim

RUN apt-get update && apt-get install -y build-essential git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cài Fairseq bằng git link thẳng tới pip
RUN git clone https://github.com/pytorch/fairseq.git && \
    cd fairseq && \
    pip install --no-cache-dir --editable ./

COPY ./configs /app/configs
COPY ./src /app/src
COPY ./data /app/data

ENV PYTHONPATH=/app
EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**📄 `docker-compose.yml`**
Mount file trọng số vào hệ thống ảo container thay vì chép hẳn vô image ảo tốn dung lượng ổ đĩa vô ích.

```yaml
version: '3.8'

services:
  translation_api:
    build: .
    container_name: slt_inference_api
    ports:
      - "8000:8000"
    volumes:
      - ./models:/app/models
      - ./data:/app/data
      - ./configs/.env:/app/configs/.env
    environment:
      - CUDA_VISIBLE_DEVICES=0  # Kích hoạt Device 0 (Nếu cần GPU Nvidia)
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
```

## 6. Hướng Dẫn Vận Hành Quy Trình Mới (Start Pipeline)

1. Cấu trúc lại toàn bộ các thư mục source đúng chuẩn ở Phần 1 (Xoá hết file python lạc lõng ở ngoài gốc dự án).
2. Tải mô hình Pre-Trained `.pt` nhét vào `project-root/models/ckpts/` và file thư viện dịch từ vựng `.model` ném vào `project-root/models/vocab/`.
3. Khởi động Docker WebServer tự động:
```bash
docker-compose up -d --build
```
4. Cuối cùng, trực tiếp vào UI Swagger Auto-Gen qua Link `http://localhost:8000/docs`. Upload thử file `I3D .npy` và nhận câu lệnh chữ (text output) đã dịch.
