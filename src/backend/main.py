import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Cấu hình path
base_dir = Path(__file__).resolve().parent.parent.parent
if str(base_dir) not in sys.path:
    sys.path.insert(0, str(base_dir))

from configs.config import settings
from src.backend.services.i3d_extractor import load_i3d_backbone
from src.backend.api.translation_router import router as translation_router

@asynccontextmanager
async def lifespan(app: FastAPI):
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
        
    app.state.i3d_model = i3d_model
    yield
    # Cleanup if needed
    app.state.i3d_model = None

app = FastAPI(title="Sign Language Translation API - Monolithic", lifespan=lifespan)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.CORS_ALLOW_ORIGINS.split(",")
        if origin.strip()
    ],
    allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translation_router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Monolithic Sign Language API is UP!"}
