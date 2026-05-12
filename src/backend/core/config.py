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

MULTILINGUAL_AGENT_ENABLED = os.getenv("MULTILINGUAL_AGENT_ENABLED", "true").lower() not in {
    "0",
    "false",
    "no",
}
MULTILINGUAL_TARGET_LANGUAGES = os.getenv("MULTILINGUAL_TARGET_LANGUAGES", "en,de,ja,vi")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_TRANSLATION_MODEL = os.getenv("OPENAI_TRANSLATION_MODEL", "gpt-4o-mini")
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY", "")
DEEPL_API_URL = os.getenv("DEEPL_API_URL", "https://api-free.deepl.com/v2/translate")
GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_GEMINI_API_KEY")
    or os.getenv("API_KEY", "")
)
GEMINI_PROJECT_ID = (
    os.getenv("GEMINI_PROJECT_ID")
    or os.getenv("GOOGLE_CLOUD_PROJECT")
    or os.getenv("PROJECT_ID", "")
)
GEMINI_LOCATION = os.getenv("GEMINI_LOCATION") or os.getenv("LOCATION", "us-central1")
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID") or os.getenv("MODEL_ID", "gemini-2.5-flash-lite")
GEMINI_API_MODE = os.getenv("GEMINI_API_MODE", "vertex")
GEMINI_ACCESS_TOKEN = os.getenv("GEMINI_ACCESS_TOKEN", "")
MULTILINGUAL_QUALITY_THRESHOLD = float(os.getenv("MULTILINGUAL_QUALITY_THRESHOLD", "0.72"))
MULTILINGUAL_BACK_TRANSLATION_ENABLED = os.getenv(
    "MULTILINGUAL_BACK_TRANSLATION_ENABLED",
    "true",
).lower() not in {"0", "false", "no"}

# Tên field multipart gửi lên TV1 (chỉnh nếu API yêu cầu khác)
FEATURE_FILE_FIELD = os.getenv("FEATURE_FILE_FIELD", "file")
FEATURE_UPLOAD_NAME = os.getenv("FEATURE_UPLOAD_NAME", "video.mp4")


def services_configured() -> bool:
    return bool(API_FEATURE_URL and API_TRANSLATE_URL)
