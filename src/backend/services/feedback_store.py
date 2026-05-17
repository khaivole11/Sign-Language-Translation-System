import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests

from configs.config import settings
from src.backend.schemas.response import FeedbackCreateRequest


class FeedbackStoreError(RuntimeError):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _feedback_root() -> Path:
    if settings.FEEDBACK_DATA_DIR:
        return Path(settings.FEEDBACK_DATA_DIR)
    return Path(settings.TEMP_DATA_DIR) / "feedback"


def _feature_root() -> Path:
    if settings.FEEDBACK_FEATURE_DIR:
        return Path(settings.FEEDBACK_FEATURE_DIR)
    return _feedback_root() / "features"


def feature_path_for_request(request_id: str) -> Path:
    return _feature_root() / f"{request_id}.npy"


def persist_feature_artifact(request_id: str, npy_path: Path) -> Optional[Path]:
    if not npy_path.exists():
        return None

    destination = feature_path_for_request(request_id)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if npy_path.resolve() != destination.resolve():
        shutil.copy2(npy_path, destination)
    return destination


class FeedbackStore:
    def __init__(self) -> None:
        self.root = _feedback_root()
        self.records_path = self.root / "records.jsonl"

    @property
    def backend_name(self) -> str:
        return "supabase" if self._use_supabase() else "local"

    def save(self, payload: FeedbackCreateRequest) -> Dict:
        record = self._build_record(payload)
        if self._use_supabase():
            return self._save_supabase(record)
        return self._save_local(record)

    def list(self, review_status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        if self._use_supabase():
            return self._list_supabase(review_status=review_status, limit=limit)
        return self._list_local(review_status=review_status, limit=limit)

    def _use_supabase(self) -> bool:
        mode = settings.FEEDBACK_STORAGE_MODE.lower().strip()
        configured = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)
        if mode == "supabase":
            if not configured:
                raise FeedbackStoreError(
                    "Supabase feedback storage is selected but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing."
                )
            return True
        if mode == "local":
            return False
        return configured

    def _build_record(self, payload: FeedbackCreateRequest) -> Dict:
        feedback_id = str(uuid.uuid4())
        feature_path = feature_path_for_request(payload.request_id)
        warnings = []
        if not feature_path.exists():
            warnings.append(
                "Feature artifact was not found for this request_id. The label was saved, but training export will need the .npy file."
            )

        return {
            "id": feedback_id,
            "request_id": payload.request_id,
            "original_filename": payload.original_filename,
            "npy_path": str(feature_path),
            "raw_translation": payload.raw_translation,
            "refined_translation": payload.refined_translation,
            "user_label": payload.user_label.strip(),
            "rating": payload.rating,
            "comment": payload.comment.strip(),
            "model_version": payload.model_version,
            "review_status": "pending",
            "used_for_training": False,
            "metadata": payload.metadata,
            "created_at": _now_iso(),
            "warnings": warnings,
        }

    def _save_local(self, record: Dict) -> Dict:
        self.root.mkdir(parents=True, exist_ok=True)
        with self.records_path.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(record, ensure_ascii=False) + "\n")

        return {
            "success": True,
            "id": record["id"],
            "request_id": record["request_id"],
            "storage_backend": "local",
            "review_status": record["review_status"],
            "npy_path": record["npy_path"],
            "message": "Feedback saved locally.",
            "warnings": record["warnings"],
        }

    def _list_local(self, review_status: Optional[str], limit: int) -> List[Dict]:
        if not self.records_path.exists():
            return []

        items: List[Dict] = []
        with self.records_path.open("r", encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if review_status and item.get("review_status") != review_status:
                    continue
                items.append(item)

        return list(reversed(items))[:limit]

    def _headers(self, prefer: Optional[str] = None) -> Dict[str, str]:
        key = settings.SUPABASE_SERVICE_ROLE_KEY
        headers = {
            "apikey": key,
        }
        if not key.startswith(("sb_secret_", "sb_publishable_")):
            headers["Authorization"] = f"Bearer {key}"
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def _save_supabase(self, record: Dict) -> Dict:
        storage_path = self._upload_feature(record)
        insert_record = {**record, "npy_path": storage_path or record["npy_path"]}
        insert_record.pop("warnings", None)

        base_url = settings.SUPABASE_URL.rstrip("/")
        table = settings.SUPABASE_FEEDBACK_TABLE
        response = requests.post(
            f"{base_url}/rest/v1/{table}",
            headers={
                **self._headers(prefer="return=representation"),
                "Content-Type": "application/json",
            },
            json=insert_record,
            timeout=20,
        )
        if response.status_code >= 400:
            raise FeedbackStoreError(f"Could not insert feedback row into Supabase: {response.text}")

        return {
            "success": True,
            "id": record["id"],
            "request_id": record["request_id"],
            "storage_backend": "supabase",
            "review_status": record["review_status"],
            "npy_path": insert_record["npy_path"],
            "message": "Feedback saved to Supabase.",
            "warnings": record["warnings"],
        }

    def _upload_feature(self, record: Dict) -> str:
        local_feature = Path(record["npy_path"])
        if not local_feature.exists():
            return ""

        base_url = settings.SUPABASE_URL.rstrip("/")
        bucket = settings.SUPABASE_STORAGE_BUCKET
        storage_path = f"features/{record['request_id']}.npy"

        with local_feature.open("rb") as fp:
            response = requests.post(
                f"{base_url}/storage/v1/object/{bucket}/{storage_path}",
                headers={
                    **self._headers(),
                    "Content-Type": "application/octet-stream",
                    "x-upsert": "true",
                },
                data=fp,
                timeout=60,
            )
        if response.status_code >= 400:
            raise FeedbackStoreError(f"Could not upload feature artifact to Supabase Storage: {response.text}")
        return f"{bucket}/{storage_path}"

    def _list_supabase(self, review_status: Optional[str], limit: int) -> List[Dict]:
        base_url = settings.SUPABASE_URL.rstrip("/")
        table = settings.SUPABASE_FEEDBACK_TABLE
        params = {
            "select": "*",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        if review_status:
            params["review_status"] = f"eq.{review_status}"

        response = requests.get(
            f"{base_url}/rest/v1/{table}",
            headers=self._headers(),
            params=params,
            timeout=20,
        )
        if response.status_code >= 400:
            raise FeedbackStoreError(f"Could not fetch feedback rows from Supabase: {response.text}")
        return response.json()


feedback_store = FeedbackStore()
