# Cách chạy Sign Language Translation System

## Cấu trúc dự án
- **Backend**: FastAPI server ở port 8000 (trong `src/main.py`)
- **Frontend**: React app ở port 3000 (trong `src/frontend/`)

## Yêu cầu
- Python 3.10+
- Node.js 18+ và npm 10+

## Bước 1: Cấu hình Backend

Tệp cấu hình chính là `configs/config.py` và `src/backend/.env`

Kiểm tra `src/backend/.env` để đặt:
```
API_FEATURE_URL=http://localhost:8001/features  (hoặc URL API của máy chủ)
API_TRANSLATE_URL=http://localhost:8002/translate  (hoặc URL API của máy chủ)
MAX_UPLOAD_MB=50
TIMEOUT_SEC=60

# Multilingual agent options
MULTILINGUAL_AGENT_ENABLED=true
MULTILINGUAL_TARGET_LANGUAGES=en,de,ja,vi

# Optional real translation providers. Configure at least one for production output.
GEMINI_API_KEY=
GEMINI_PROJECT_ID=fact-checking-494003
GEMINI_LOCATION=us-central1
GEMINI_MODEL_ID=gemini-2.5-flash-lite
GEMINI_API_MODE=vertex

OPENAI_API_KEY=
OPENAI_TRANSLATION_MODEL=gpt-4o-mini
DEEPL_API_KEY=
DEEPL_API_URL=https://api-free.deepl.com/v2/translate
GOOGLE_TRANSLATE_API_KEY=

MULTILINGUAL_QUALITY_THRESHOLD=0.72
MULTILINGUAL_BACK_TRANSLATION_ENABLED=true
```
Sau đó chạy 2 file mock_tv1.py và mock_tv2.py

## Bước 2: Chạy Backend

**Chạy từ Terminal**
```
python -m uvicorn src.backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend sẽ chạy tại `http://localhost:8000`

## Bước 3: Chạy Frontend

**Chạy từ Terminal**
```
cd /src/frontend
npm start
```

Frontend sẽ mở tại `http://localhost:3000`


## API Endpoints

- `GET http://localhost:8000/` - Health check
- `POST http://localhost:8000/api/translate-ui` - Upload video và dịch (từ Frontend)
- `Swagger UI: http://localhost:8000/docs` - API documentation
- Frontend processing flow: `/api/translate?include_multilingual=false` first, then `/api/multilingual-agent` after source text is ready.

## Troubleshooting

### Backend error: ModuleNotFoundError
Cài đặt dependencies:
```powershell
python -m pip install -r requirements.txt
python -m pip install -r src/backend/requirements.txt
```

### Frontend error: npm packages missing
```powershell
cd src/frontend
npm install
```

### Thêm các model xử lý
Thêm folder i3d và fairseq vào folder models

### Chỉnh sửa nội dung file configs/.env
```powershell
PROJECT_NAME="SLT Inference API"
API_VERSION="v1"
# Dùng forward slash để tránh bị escape \f, \b trong đường dẫn Windows
MODEL_CHECKPOINT_PATH="D:/Sign-Language-Translation-System/models/fairseq/baseline_6_3_dp03_wd/ckpts/checkpoint_best.pt"
VOCAB_MODEL_PATH="D:/Sign-Language-Translation-System/models/vocab/cvpr23.train.how2sign.unigram7000_lowercased.model"
BEAM_SIZE=5
MAX_TOKENS=1600
TEMP_DATA_DIR="D:/Sign-Language-Translation-System/data"
```

### Install model fairseq
```powershell
 install --editable ./fairseq
```
