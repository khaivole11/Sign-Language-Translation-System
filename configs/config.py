from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "SLT API"
    API_VERSION: str = "v1"
    
    MODEL_CHECKPOINT_PATH: str
    VOCAB_MODEL_PATH: str
    BEAM_SIZE: int = 5
    MAX_TOKENS: int = 1600
    TEMP_DATA_DIR: str = "data"

    # Feedback / continual-learning capture.
    FEEDBACK_STORAGE_MODE: str = "auto"  # auto, local, or supabase
    FEEDBACK_DATA_DIR: str = ""
    FEEDBACK_FEATURE_DIR: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_FEEDBACK_TABLE: str = "feedback_samples"
    SUPABASE_STORAGE_BUCKET: str = "feedback-features"
    CORS_ALLOW_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )
    CORS_ALLOW_ORIGIN_REGEX: str = (
        r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|"
        r"10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|"
        r"172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$"
    )

    class Config:
        env_file = (
            Path(__file__).resolve().parent / ".env",
            Path(__file__).resolve().parent.parent / "src" / "backend" / ".env",
        )
        extra = "ignore"

settings = Settings()
