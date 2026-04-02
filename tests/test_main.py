import sys
from pathlib import Path

from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from src.main import app

client = TestClient(app)

print("-" * 40)

def test_api_health():
    response = client.get("/")
    assert response.status_code == 200
    print(response.status_code)