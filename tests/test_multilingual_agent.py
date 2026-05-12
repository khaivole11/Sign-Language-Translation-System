import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from src.backend.services import multilingual_agent


def test_multilingual_agent_uses_offline_phrasebook_without_provider(monkeypatch):
    monkeypatch.setattr(multilingual_agent, "GEMINI_API_KEY", "")
    monkeypatch.setattr(multilingual_agent, "GEMINI_ACCESS_TOKEN", "")
    monkeypatch.setattr(multilingual_agent, "GEMINI_PROJECT_ID", "")
    monkeypatch.setattr(multilingual_agent, "OPENAI_API_KEY", "")
    monkeypatch.setattr(multilingual_agent, "DEEPL_API_KEY", "")
    monkeypatch.setattr(multilingual_agent, "GOOGLE_TRANSLATE_API_KEY", "")

    result = multilingual_agent.run_multilingual_agent(
        "I am sorry I cannot come today",
        source_language="en",
        target_languages=["en", "de", "ja", "vi"],
    )

    translations = {item["language_code"]: item for item in result["translations"]}

    assert result["stub"] is True
    assert translations["en"]["text"] == "I am sorry I cannot come today."
    assert translations["de"]["text"] == "Es tut mir leid, ich kann heute nicht kommen."
    assert translations["ja"]["status"] == "needs_review"
    assert translations["vi"]["quality_score"] > 0


def test_multilingual_agent_translates_short_phrase_with_offline_fallback(monkeypatch):
    monkeypatch.setattr(multilingual_agent, "GEMINI_API_KEY", "")
    monkeypatch.setattr(multilingual_agent, "GEMINI_ACCESS_TOKEN", "")
    monkeypatch.setattr(multilingual_agent, "GEMINI_PROJECT_ID", "")
    monkeypatch.setattr(multilingual_agent, "OPENAI_API_KEY", "")
    monkeypatch.setattr(multilingual_agent, "DEEPL_API_KEY", "")
    monkeypatch.setattr(multilingual_agent, "GOOGLE_TRANSLATE_API_KEY", "")

    result = multilingual_agent.run_multilingual_agent(
        "this one",
        source_language="en",
        target_languages=["en", "de", "ja", "vi"],
    )

    translations = {item["language_code"]: item for item in result["translations"]}

    assert translations["en"]["text"] == "this one."
    assert translations["de"]["text"] == "Dieses hier."
    assert translations["ja"]["text"] == "\u3053\u308c\u3067\u3059\u3002"
    assert translations["vi"]["text"] == "C\u00e1i n\u00e0y."
    assert result["plan"]["task"] == "translate_sign_text_output"
    assert any(tool["name"] == "gemini_vertex" for tool in result["tools"])


def test_gemini_vertex_endpoint_uses_project_location_and_model(monkeypatch):
    monkeypatch.setattr(multilingual_agent, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(multilingual_agent, "GEMINI_ACCESS_TOKEN", "")
    monkeypatch.setattr(multilingual_agent, "GEMINI_API_MODE", "vertex")
    monkeypatch.setattr(multilingual_agent, "GEMINI_PROJECT_ID", "fact-checking-494003")
    monkeypatch.setattr(multilingual_agent, "GEMINI_LOCATION", "us-central1")
    monkeypatch.setattr(multilingual_agent, "GEMINI_MODEL_ID", "gemini-2.5-flash-lite")

    url, params, headers = multilingual_agent._gemini_endpoint()

    assert "us-central1-aiplatform.googleapis.com" in url
    assert "projects/fact-checking-494003/locations/us-central1" in url
    assert "publishers/google/models/gemini-2.5-flash-lite:generateContent" in url
    assert params["key"] == "test-key"
    assert headers["Content-Type"] == "application/json"
