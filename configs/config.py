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

    class Config:
        env_file = Path(__file__).resolve().parent / ".env"

settings = Settings()