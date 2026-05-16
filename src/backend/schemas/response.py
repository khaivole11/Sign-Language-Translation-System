from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional

class AgentStep(BaseModel):
    name: str
    status: str
    detail: str = ""

class MultilingualTranslation(BaseModel):
    candidate_id: str = ""
    language_code: str
    language_name: str
    text: str = ""
    provider: str = ""
    quality_score: float = 0.0
    status: str = "ok"
    notes: List[str] = Field(default_factory=list)
    selected_candidate_id: str = ""
    candidate_count: int = 0
    quality_report: Dict[str, Any] = Field(default_factory=dict)
    candidates: List[Dict[str, Any]] = Field(default_factory=list)

class MultilingualAgentResponse(BaseModel):
    source_language: str = "en"
    source_sign_language: str = "ASL"
    target_languages: List[str] = Field(default_factory=list)
    plan: Dict[str, Any] = Field(default_factory=dict)
    tools: List[Dict[str, Any]] = Field(default_factory=list)
    translations: List[MultilingualTranslation] = Field(default_factory=list)
    steps: List[AgentStep] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    stub: bool = False

class MultilingualAgentRequest(BaseModel):
    source_text: str
    source_language: str = "en"
    source_sign_language: str = "ASL"
    target_languages: List[str] = Field(default_factory=list)

class InferenceResponse(BaseModel):
    success: bool
    request_id: str
    raw: str = ""
    refined: str = ""
    time: float = 0.0
    error_message: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    stub: bool = False
    multilingual: Optional[MultilingualAgentResponse] = None
    feedback_ready: bool = False

class FeedbackCreateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    request_id: str = Field(..., min_length=8, max_length=128)
    original_filename: str = Field(default="", max_length=512)
    raw_translation: str = Field(default="", max_length=8000)
    refined_translation: str = Field(default="", max_length=8000)
    user_label: str = Field(..., min_length=1, max_length=8000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: str = Field(default="", max_length=4000)
    model_version: str = Field(default="", max_length=256)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class FeedbackResponse(BaseModel):
    success: bool
    id: str
    request_id: str
    storage_backend: str
    review_status: str = "pending"
    npy_path: str = ""
    message: str = "Feedback saved."
    warnings: List[str] = Field(default_factory=list)

class FeedbackListResponse(BaseModel):
    success: bool = True
    storage_backend: str
    count: int
    items: List[Dict[str, Any]] = Field(default_factory=list)
