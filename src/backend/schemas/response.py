from pydantic import BaseModel
from typing import List, Optional

class InferenceResponse(BaseModel):
    success: bool
    request_id: str
    raw: str = ""
    refined: str = ""
    time: float = 0.0
    error_message: Optional[str] = None
    warnings: List[str] = []
    stub: bool = False
