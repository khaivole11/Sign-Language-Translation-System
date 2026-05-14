from pydantic import BaseModel, Field
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
