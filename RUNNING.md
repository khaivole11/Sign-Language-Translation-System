# Cách chạy Sign Language Translation System

## Cấu trúc dự án
- **Backend**: FastAPI server ở port 8000 (trong `src/main.py`)
- **Frontend**: React app ở port 3000 (trong `src/frontend/`)

## Yêu cầu
- Python 3.11+
- Node.js 18+ và npm 10+

## Bước 1: Cấu hình Backend

Tệp cấu hình chính là `configs/config.py` và `src/backend/.env`

Kiểm tra `src/backend/.env` để đặt:
```
API_FEATURE_URL=http://localhost:8001/features  (hoặc URL API của máy chủ)
API_TRANSLATE_URL=http://localhost:8002/translate  (hoặc URL API của máy chủ)
MAX_UPLOAD_MB=50
TIMEOUT_SEC=60
```
Sau đó chạy 2 file mock_tv1.py và mock_tv2.py

## Bước 2: Chạy Backend

**Chạy từ Terminal**
```
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
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
