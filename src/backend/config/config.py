import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
env_file = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_file)

API_FEATURE_URL = os.getenv("API_FEATURE_URL", "")
API_TRANSLATE_URL = os.getenv("API_TRANSLATE_URL", "")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", 50))
TIMEOUT_SEC = int(os.getenv("TIMEOUT_SEC", 60))

# Tên field multipart gửi lên TV1 (chỉnh nếu API yêu cầu khác)
FEATURE_FILE_FIELD = os.getenv("FEATURE_FILE_FIELD", "file")
FEATURE_UPLOAD_NAME = os.getenv("FEATURE_UPLOAD_NAME", "video.mp4")


def services_configured() -> bool:
    return bool(API_FEATURE_URL and API_TRANSLATE_URL)