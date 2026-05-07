### Cài thêm package nếu chưa cài

pip install fastapi uvicorn python-multipart

### Chạy API

uvicorn src.api.features:app --reload --host 0.0.0.0 --port 8001

