from __future__ import annotations

import requests


class UpstreamServiceError(Exception):
    def __init__(self, status_code: int, message: str, service: str = "upstream"):
        self.status_code = status_code
        self.message = message
        self.service = service
        super().__init__(message)

    @classmethod
    def from_response(cls, res: requests.Response, service: str = "upstream") -> "UpstreamServiceError":
        try:
            data = res.json()
            detail = data.get("detail", data)
            if isinstance(detail, list):
                message = "; ".join(str(x) for x in detail)[:800]
            elif isinstance(detail, dict):
                message = str(detail)[:800]
            else:
                message = str(detail)[:800]
        except Exception:
            message = (res.text or res.reason or "Lỗi không xác định")[:800]
        return cls(res.status_code, message or res.reason or "Upstream error", service)
