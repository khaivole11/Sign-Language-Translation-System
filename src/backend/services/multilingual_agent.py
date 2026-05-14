import hashlib
import html
import json
import re
import unicodedata
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import requests

from src.backend.core.config import (
    DEEPL_API_KEY,
    DEEPL_API_URL,
    GEMINI_ACCESS_TOKEN,
    GEMINI_API_KEY,
    GEMINI_API_MODE,
    GEMINI_LOCATION,
    GEMINI_MODEL_ID,
    GEMINI_PROJECT_ID,
    GOOGLE_TRANSLATE_API_KEY,
    MULTILINGUAL_AGENT_ENABLED,
    MULTILINGUAL_BACK_TRANSLATION_ENABLED,
    MULTILINGUAL_QUALITY_THRESHOLD,
    MULTILINGUAL_TARGET_LANGUAGES,
    OPENAI_API_KEY,
    OPENAI_TRANSLATION_MODEL,
    TIMEOUT_SEC,
)


LANGUAGE_NAMES = {
    "en": "English",
    "de": "German",
    "ja": "Japanese",
    "vi": "Vietnamese",
}

DEEPL_TARGET_CODES = {
    "en": "EN-US",
    "de": "DE",
    "ja": "JA",
    "vi": "VI",
}

GOOGLE_TARGET_CODES = {
    "en": "en",
    "de": "de",
    "ja": "ja",
    "vi": "vi",
}

PHRASEBOOK = {
    "this one": {
        "en": "This one.",
        "de": "Dieses hier.",
        "ja": "\u3053\u308c\u3067\u3059\u3002",
        "vi": "C\u00e1i n\u00e0y.",
    },
    "that one": {
        "en": "That one.",
        "de": "Dieses dort.",
        "ja": "\u3042\u308c\u3067\u3059\u3002",
        "vi": "C\u00e1i \u0111\u00f3.",
    },
    "this": {
        "en": "This.",
        "de": "Das hier.",
        "ja": "\u3053\u308c\u3067\u3059\u3002",
        "vi": "C\u00e1i n\u00e0y.",
    },
    "i am sorry i cannot come today": {
        "en": "I'm sorry, I can't come today.",
        "de": "Es tut mir leid, ich kann heute nicht kommen.",
        "ja": "\u3059\u307f\u307e\u305b\u3093\u3001\u4eca\u65e5\u306f\u884c\u3051\u307e\u305b\u3093\u3002",
        "vi": "T\u00f4i xin l\u1ed7i, h\u00f4m nay t\u00f4i kh\u00f4ng th\u1ec3 \u0111\u1ebfn.",
    },
    "im sorry i cant come today": {
        "en": "I'm sorry, I can't come today.",
        "de": "Es tut mir leid, ich kann heute nicht kommen.",
        "ja": "\u3059\u307f\u307e\u305b\u3093\u3001\u4eca\u65e5\u306f\u884c\u3051\u307e\u305b\u3093\u3002",
        "vi": "T\u00f4i xin l\u1ed7i, h\u00f4m nay t\u00f4i kh\u00f4ng th\u1ec3 \u0111\u1ebfn.",
    },
    "toi xin loi vi khong the den hom nay": {
        "en": "I'm sorry, I can't come today.",
        "de": "Es tut mir leid, ich kann heute nicht kommen.",
        "ja": "\u3059\u307f\u307e\u305b\u3093\u3001\u4eca\u65e5\u306f\u884c\u3051\u307e\u305b\u3093\u3002",
        "vi": "T\u00f4i xin l\u1ed7i v\u00ec kh\u00f4ng th\u1ec3 \u0111\u1ebfn h\u00f4m nay.",
    },
}


class ProviderError(Exception):
    pass


def run_multilingual_agent(
    source_text: str,
    source_language: str = "en",
    source_sign_language: str = "ASL",
    target_languages: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """
    Agent pipeline for multilingual text output.

    Pipeline:
    plan -> search tool/model registry -> generate candidates -> quality check
    -> optional repair/retry -> select final translations.
    """
    source_text = (source_text or "").strip()
    source_language = _normalize_lang_code(source_language) or "en"
    targets = _resolve_target_languages(target_languages)

    result: Dict[str, Any] = {
        "source_language": source_language,
        "source_sign_language": source_sign_language,
        "target_languages": targets,
        "plan": {},
        "tools": [],
        "translations": [],
        "steps": [],
        "warnings": [],
        "stub": False,
    }

    if not MULTILINGUAL_AGENT_ENABLED:
        result["steps"].append(_step("agent_disabled", "skipped", "Multilingual agent is disabled."))
        return result

    result["steps"].append(
        _step(
            "normalize_input",
            "ok" if source_text else "failed",
            f"Received {len(source_text)} characters from sign-to-text output.",
        )
    )
    if not source_text:
        result["warnings"].append("No source text was available for multilingual translation.")
        return result

    plan = _build_plan(source_text, source_language, source_sign_language, targets)
    result["plan"] = plan
    result["steps"].append(
        _step(
            "plan_translation",
            "ok",
            "Built constraints for meaning preservation, target selection, quality gates, and repair policy.",
        )
    )

    tools = _search_tool_registry(targets)
    result["tools"] = [_public_tool(tool) for tool in tools]
    configured_tools = [tool["name"] for tool in tools if tool["configured"]]
    result["steps"].append(
        _step(
            "search_tool_registry",
            "ok" if configured_tools else "fallback_only",
            "Available configured tools: " + (", ".join(configured_tools) if configured_tools else "offline_phrasebook only"),
        )
    )

    candidates_by_lang = _generate_candidates(source_text, source_language, targets, tools, result)
    result["steps"].append(
        _step(
            "generate_candidates",
            "ok",
            f"Generated {sum(len(items) for items in candidates_by_lang.values())} candidate(s).",
        )
    )

    final_translations = []
    for lang in targets:
        candidates = candidates_by_lang.get(lang, [])
        selected, evaluated = _select_with_quality_loop(
            source_text,
            source_language,
            lang,
            candidates,
            tools,
            result,
        )
        final_translations.append(_final_translation(lang, selected, evaluated))

    result["translations"] = final_translations
    result["stub"] = any(item["provider"] == "offline_phrasebook" for item in final_translations)
    result["steps"].append(
        _step(
            "select_final",
            "ok",
            "Selected the highest quality candidate per target language after repair/retry when possible.",
        )
    )
    return result


def _build_plan(
    source_text: str,
    source_language: str,
    source_sign_language: str,
    targets: Sequence[str],
) -> Dict[str, Any]:
    return {
        "task": "translate_sign_text_output",
        "source_sign_language": source_sign_language,
        "source_language": source_language,
        "source_text_length": len(source_text),
        "target_languages": list(targets),
        "constraints": [
            "preserve semantic meaning",
            "preserve names, numbers, dates, and time expressions",
            "use natural target-language wording",
            "avoid copying source text into a different target language",
        ],
        "quality_gates": [
            "non_empty_output",
            "number_preservation",
            "target_language_signal",
            "source_copy_risk",
            "optional_back_translation_or_llm_judge",
        ],
        "repair_policy": {
            "enabled": True,
            "threshold": MULTILINGUAL_QUALITY_THRESHOLD,
            "preferred_repair_models": ["gemini_vertex", "openai"],
        },
    }


def _search_tool_registry(targets: Sequence[str]) -> List[Dict[str, Any]]:
    all_targets = set(targets)
    registry = [
        {
            "name": "source_refiner",
            "kind": "local",
            "roles": ["source_passthrough"],
            "model": "rule_based",
            "configured": True,
            "supports": sorted(all_targets),
            "priority": 0,
        },
        {
            "name": "gemini_vertex",
            "kind": "llm",
            "roles": ["planner", "translator", "evaluator", "repair"],
            "model": GEMINI_MODEL_ID,
            "configured": bool((GEMINI_API_KEY or GEMINI_ACCESS_TOKEN) and (GEMINI_PROJECT_ID or GEMINI_API_MODE == "developer")),
            "supports": sorted(all_targets),
            "priority": 1,
        },
        {
            "name": "openai",
            "kind": "llm",
            "roles": ["translator", "evaluator", "repair"],
            "model": OPENAI_TRANSLATION_MODEL,
            "configured": bool(OPENAI_API_KEY),
            "supports": sorted(all_targets),
            "priority": 2,
        },
        {
            "name": "deepl",
            "kind": "mt_api",
            "roles": ["translator"],
            "model": "deepl_translate",
            "configured": bool(DEEPL_API_KEY),
            "supports": sorted(code for code in all_targets if code in DEEPL_TARGET_CODES),
            "priority": 3,
        },
        {
            "name": "google_translate",
            "kind": "mt_api",
            "roles": ["translator"],
            "model": "cloud_translate_v2",
            "configured": bool(GOOGLE_TRANSLATE_API_KEY),
            "supports": sorted(code for code in all_targets if code in GOOGLE_TARGET_CODES),
            "priority": 4,
        },
        {
            "name": "offline_phrasebook",
            "kind": "local",
            "roles": ["fallback"],
            "model": "local_phrasebook",
            "configured": True,
            "supports": sorted(all_targets),
            "priority": 99,
        },
    ]
    return sorted(registry, key=lambda tool: tool["priority"])


def _generate_candidates(
    source_text: str,
    source_language: str,
    targets: Sequence[str],
    tools: Sequence[Dict[str, Any]],
    result: Dict[str, Any],
) -> Dict[str, List[Dict[str, Any]]]:
    candidates_by_lang: Dict[str, List[Dict[str, Any]]] = {lang: [] for lang in targets}

    for lang in targets:
        if lang == source_language:
            candidates_by_lang[lang].append(
                _candidate(
                    lang,
                    _light_refine_source(source_text),
                    "source_refiner",
                    0.96,
                    "Source language matches target language.",
                )
            )

    translation_targets = [lang for lang in targets if lang != source_language]
    for tool in tools:
        if not tool["configured"] or "translator" not in tool["roles"]:
            continue
        supported_targets = [lang for lang in translation_targets if lang in tool["supports"]]
        if not supported_targets:
            continue

        try:
            if tool["name"] == "gemini_vertex":
                items = _translate_with_gemini(source_text, source_language, supported_targets)
                _merge_candidates(candidates_by_lang, items)
            elif tool["name"] == "openai":
                items = _translate_with_openai(source_text, source_language, supported_targets)
                _merge_candidates(candidates_by_lang, items)
            elif tool["name"] in {"deepl", "google_translate"}:
                translate_fn = _translate_with_deepl if tool["name"] == "deepl" else _translate_with_google
                for lang in supported_targets:
                    candidates_by_lang[lang].append(translate_fn(source_text, source_language, lang))
        except ProviderError as exc:
            result["warnings"].append(f"{tool['name']} failed: {exc}")
            result["steps"].append(_step(tool["name"], "failed", str(exc)))

    for lang in translation_targets:
        if candidates_by_lang[lang]:
            continue
        phrase = PHRASEBOOK.get(_phrasebook_key(source_text), {})
        text = phrase.get(lang)
        if text:
            candidates_by_lang[lang].append(
                _candidate(
                    lang,
                    text,
                    "offline_phrasebook",
                    0.58,
                    "Preview translation from local phrasebook. Configure Gemini/OpenAI/MT provider for production use.",
                    status="needs_review",
                )
            )
        else:
            candidates_by_lang[lang].append(
                _candidate(
                    lang,
                    "",
                    "not_configured",
                    0.0,
                    "No configured translation provider produced this target.",
                    status="unavailable",
                )
            )
            result["warnings"].append(
                "Configure GEMINI_API_KEY, OPENAI_API_KEY, DEEPL_API_KEY, or GOOGLE_TRANSLATE_API_KEY for open-ended translation."
            )

    return candidates_by_lang


def _select_with_quality_loop(
    source_text: str,
    source_language: str,
    target_language: str,
    candidates: Sequence[Dict[str, Any]],
    tools: Sequence[Dict[str, Any]],
    result: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    evaluated = [
        _evaluate_candidate(source_text, source_language, target_language, candidate, tools, result)
        for candidate in candidates
    ]
    selected = _best_candidate(evaluated)

    repair_tool = _find_repair_tool(tools)
    if (
        target_language != source_language
        and selected.get("quality_score", 0.0) < MULTILINGUAL_QUALITY_THRESHOLD
        and repair_tool
        and selected.get("text")
    ):
        try:
            repaired = _repair_candidate(source_text, source_language, target_language, selected, repair_tool)
            repaired_eval = _evaluate_candidate(source_text, source_language, target_language, repaired, tools, result)
            evaluated.append(repaired_eval)
            selected = _best_candidate(evaluated)
            result["steps"].append(
                _step(
                    "repair_or_retry",
                    "ok",
                    f"Repaired {target_language} with {repair_tool['name']} after quality score fell below threshold.",
                )
            )
        except ProviderError as exc:
            result["warnings"].append(f"Repair failed for {target_language}: {exc}")
            result["steps"].append(_step("repair_or_retry", "failed", str(exc)))

    if selected.get("quality_score", 0.0) < MULTILINGUAL_QUALITY_THRESHOLD:
        selected["status"] = "needs_review" if selected.get("text") else "unavailable"

    return selected, evaluated


def _evaluate_candidate(
    source_text: str,
    source_language: str,
    target_language: str,
    candidate: Dict[str, Any],
    tools: Sequence[Dict[str, Any]],
    result: Dict[str, Any],
) -> Dict[str, Any]:
    item = dict(candidate)
    text = (item.get("text") or "").strip()
    score = float(item.get("quality_score") or 0.0)
    notes = list(item.get("notes") or [])
    checks: Dict[str, Any] = {
        "non_empty": bool(text),
        "numbers_preserved": True,
        "target_language_signal": "unknown",
        "source_copy_risk": False,
        "back_translation": None,
        "llm_judge": None,
    }

    if not text:
        notes.append("No translation text was produced.")
        item.update({"quality_score": 0.0, "status": "unavailable", "notes": _dedupe(notes), "quality_report": checks})
        return item

    source_numbers = set(re.findall(r"\d+(?:[.,]\d+)?", source_text))
    missing_numbers = [number for number in source_numbers if number not in text]
    if missing_numbers:
        score -= 0.25
        checks["numbers_preserved"] = False
        notes.append(f"Missing number(s): {', '.join(missing_numbers)}.")

    if target_language != source_language and _phrasebook_key(text) == _phrasebook_key(source_text):
        score -= 0.35
        checks["source_copy_risk"] = True
        notes.append("Output is too similar to the source text for a different target language.")

    language_signal = _target_language_signal(text, target_language)
    checks["target_language_signal"] = language_signal
    if language_signal == "weak":
        score -= 0.12
        notes.append("Target-language signal is weak; review may be needed.")

    evaluator = _find_evaluator_tool(tools)
    if (
        evaluator
        and target_language != source_language
        and MULTILINGUAL_BACK_TRANSLATION_ENABLED
        and item["provider"] not in {"not_configured", "offline_phrasebook"}
    ):
        try:
            back_translation = _back_translate(text, target_language, source_language, evaluator)
            similarity = _token_similarity(source_text, back_translation)
            checks["back_translation"] = {
                "provider": evaluator["name"],
                "text": back_translation,
                "similarity": similarity,
            }
            score = (score * 0.7) + (similarity * 0.3)
            if similarity < 0.52:
                notes.append("Back-translation similarity is low.")
        except ProviderError as exc:
            result["warnings"].append(f"Back-translation failed for {target_language}: {exc}")

    if evaluator and target_language != source_language and item["provider"] not in {"not_configured"}:
        try:
            judge = _judge_with_llm(source_text, source_language, target_language, text, evaluator)
            checks["llm_judge"] = judge
            score = (score * 0.6) + (float(judge.get("semantic_score", 0.0)) * 0.4)
            notes.extend(_normalize_notes(judge.get("notes")))
        except ProviderError as exc:
            result["warnings"].append(f"LLM quality judge failed for {target_language}: {exc}")

    score = round(max(0.0, min(1.0, score)), 2)
    status = "ok" if score >= MULTILINGUAL_QUALITY_THRESHOLD else "needs_review"
    item.update(
        {
            "quality_score": score,
            "status": status,
            "notes": _dedupe(notes),
            "quality_report": checks,
        }
    )
    return item


def _translate_with_gemini(source_text: str, source_language: str, targets: Sequence[str]) -> List[Dict[str, Any]]:
    payload = {
        "source_language": source_language,
        "target_languages": [_language_payload(lang) for lang in targets],
        "source_text": source_text,
        "output_contract": {
            "translations": [
                {
                    "language_code": "target language code",
                    "text": "translated natural-language text",
                    "confidence_score": "number from 0 to 1",
                    "quality_notes": ["short note"],
                }
            ]
        },
    }
    parsed = _gemini_generate_json(
        "You are a multilingual translation agent. Return only valid JSON that follows the requested output_contract.",
        payload,
    )
    items = []
    for raw in parsed.get("translations", []):
        lang = _normalize_lang_code(raw.get("language_code"))
        if lang not in targets:
            continue
        items.append(
            _candidate(
                lang,
                str(raw.get("text") or "").strip(),
                "gemini_vertex",
                _clamp_score(raw.get("confidence_score"), 0.82),
                _normalize_notes(raw.get("quality_notes")),
            )
        )
    if not items:
        raise ProviderError("Gemini response did not include requested translations.")
    return items


def _translate_with_openai(source_text: str, source_language: str, targets: Sequence[str]) -> List[Dict[str, Any]]:
    schema = {
        "name": "multilingual_translation_result",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "translations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "language_code": {"type": "string"},
                            "language_name": {"type": "string"},
                            "text": {"type": "string"},
                            "confidence_score": {"type": "number"},
                            "needs_review": {"type": "boolean"},
                            "quality_notes": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": [
                            "language_code",
                            "language_name",
                            "text",
                            "confidence_score",
                            "needs_review",
                            "quality_notes",
                        ],
                    },
                }
            },
            "required": ["translations"],
        },
    }
    payload = {
        "model": OPENAI_TRANSLATION_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_schema", "json_schema": schema},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a translation agent for sign-language education. "
                    "Translate the provided source sentence into each requested target language. "
                    "Preserve meaning, named entities, numbers, time expressions, and natural tone."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "source_language": source_language,
                        "target_languages": [_language_payload(lang) for lang in targets],
                        "source_text": source_text,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=TIMEOUT_SEC,
        )
    except requests.exceptions.RequestException as exc:
        raise ProviderError(f"OpenAI request failed: {exc}") from exc

    if not response.ok:
        raise ProviderError(f"OpenAI returned HTTP {response.status_code}: {response.text[:180]}")

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("OpenAI response could not be parsed as structured translations.") from exc

    items = []
    for raw in parsed.get("translations", []):
        lang = _normalize_lang_code(raw.get("language_code"))
        if lang not in targets:
            continue
        items.append(
            _candidate(
                lang,
                str(raw.get("text") or "").strip(),
                "openai",
                _clamp_score(raw.get("confidence_score"), 0.82),
                _normalize_notes(raw.get("quality_notes")),
                status="needs_review" if raw.get("needs_review") else "ok",
            )
        )
    return items


def _translate_with_deepl(source_text: str, source_language: str, target_language: str) -> Dict[str, Any]:
    target_code = DEEPL_TARGET_CODES.get(target_language)
    if not target_code:
        raise ProviderError("Unsupported DeepL target language.")

    data = {
        "text": source_text,
        "target_lang": target_code,
    }
    if source_language in DEEPL_TARGET_CODES:
        data["source_lang"] = "EN" if source_language == "en" else DEEPL_TARGET_CODES[source_language]

    try:
        response = requests.post(
            DEEPL_API_URL,
            headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
            data=data,
            timeout=TIMEOUT_SEC,
        )
    except requests.exceptions.RequestException as exc:
        raise ProviderError(f"DeepL request failed: {exc}") from exc

    if not response.ok:
        raise ProviderError(f"DeepL returned HTTP {response.status_code}: {response.text[:160]}")

    try:
        text = response.json()["translations"][0]["text"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("DeepL response did not contain a translation.") from exc

    return _candidate(target_language, html.unescape(text).strip(), "deepl", 0.84, [])


def _translate_with_google(source_text: str, source_language: str, target_language: str) -> Dict[str, Any]:
    target_code = GOOGLE_TARGET_CODES.get(target_language)
    if not target_code:
        raise ProviderError("Unsupported Google target language.")

    try:
        response = requests.post(
            "https://translation.googleapis.com/language/translate/v2",
            params={"key": GOOGLE_TRANSLATE_API_KEY},
            data={
                "q": source_text,
                "target": target_code,
                "source": GOOGLE_TARGET_CODES.get(source_language, source_language),
                "format": "text",
            },
            timeout=TIMEOUT_SEC,
        )
    except requests.exceptions.RequestException as exc:
        raise ProviderError(f"Google Translate request failed: {exc}") from exc

    if not response.ok:
        raise ProviderError(f"Google Translate returned HTTP {response.status_code}: {response.text[:160]}")

    try:
        text = response.json()["data"]["translations"][0]["translatedText"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("Google Translate response did not contain a translation.") from exc

    return _candidate(target_language, html.unescape(text).strip(), "google_translate", 0.8, [])


def _gemini_generate_json(system_instruction: str, user_payload: Dict[str, Any]) -> Dict[str, Any]:
    url, params, headers = _gemini_endpoint()
    body = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": json.dumps(user_payload, ensure_ascii=False)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    try:
        response = requests.post(url, params=params, headers=headers, json=body, timeout=TIMEOUT_SEC)
    except requests.exceptions.RequestException as exc:
        raise ProviderError(f"Gemini request failed: {exc}") from exc

    if not response.ok:
        raise ProviderError(f"Gemini returned HTTP {response.status_code}: {response.text[:220]}")

    try:
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return _parse_json_text(text)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("Gemini response could not be parsed as JSON.") from exc


def _gemini_endpoint() -> Tuple[str, Dict[str, str], Dict[str, str]]:
    headers = {"Content-Type": "application/json"}
    params: Dict[str, str] = {}
    if GEMINI_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {GEMINI_ACCESS_TOKEN}"
    elif GEMINI_API_KEY:
        params["key"] = GEMINI_API_KEY
    else:
        raise ProviderError("Gemini key/token is not configured.")

    if GEMINI_API_MODE == "developer":
        return (
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_ID}:generateContent",
            params,
            headers,
        )

    if not GEMINI_PROJECT_ID:
        raise ProviderError("GEMINI_PROJECT_ID or PROJECT_ID is required for Vertex AI Gemini mode.")

    service_endpoint = "aiplatform.googleapis.com" if GEMINI_LOCATION == "global" else f"{GEMINI_LOCATION}-aiplatform.googleapis.com"
    model_path = (
        f"projects/{GEMINI_PROJECT_ID}/locations/{GEMINI_LOCATION}/"
        f"publishers/google/models/{GEMINI_MODEL_ID}"
    )
    return f"https://{service_endpoint}/v1/{model_path}:generateContent", params, headers


def _back_translate(
    text: str,
    source_language: str,
    target_language: str,
    evaluator: Dict[str, Any],
) -> str:
    if evaluator["name"] == "gemini_vertex":
        items = _translate_with_gemini(text, source_language, [target_language])
    elif evaluator["name"] == "openai":
        items = _translate_with_openai(text, source_language, [target_language])
    else:
        raise ProviderError("No LLM evaluator is configured for back-translation.")
    if not items or not items[0].get("text"):
        raise ProviderError("Back-translation produced no text.")
    return items[0]["text"]


def _judge_with_llm(
    source_text: str,
    source_language: str,
    target_language: str,
    translated_text: str,
    evaluator: Dict[str, Any],
) -> Dict[str, Any]:
    payload = {
        "source_language": source_language,
        "target_language": target_language,
        "source_text": source_text,
        "translated_text": translated_text,
        "output_contract": {
            "semantic_score": "number from 0 to 1",
            "needs_review": "boolean",
            "notes": ["short quality note"],
        },
    }
    if evaluator["name"] == "gemini_vertex":
        return _gemini_generate_json(
            "Judge whether the translation preserves the source meaning. Return only valid JSON.",
            payload,
        )
    if evaluator["name"] == "openai":
        return _openai_generate_json(
            "Judge whether the translation preserves the source meaning. Return only valid JSON.",
            payload,
        )
    raise ProviderError("No LLM evaluator is configured.")


def _repair_candidate(
    source_text: str,
    source_language: str,
    target_language: str,
    selected: Dict[str, Any],
    repair_tool: Dict[str, Any],
) -> Dict[str, Any]:
    payload = {
        "source_language": source_language,
        "target_language": _language_payload(target_language),
        "source_text": source_text,
        "previous_translation": selected.get("text", ""),
        "quality_notes": selected.get("notes", []),
        "instruction": "Repair the translation so it is natural and preserves the original meaning.",
        "output_contract": {"text": "repaired translation", "confidence_score": "number from 0 to 1"},
    }
    if repair_tool["name"] == "gemini_vertex":
        parsed = _gemini_generate_json(
            "You repair translations. Return only valid JSON with text and confidence_score.",
            payload,
        )
        provider = "gemini_vertex_repair"
    elif repair_tool["name"] == "openai":
        parsed = _openai_generate_json(
            "You repair translations. Return only valid JSON with text and confidence_score.",
            payload,
        )
        provider = "openai_repair"
    else:
        raise ProviderError("Unsupported repair provider.")

    return _candidate(
        target_language,
        str(parsed.get("text") or "").strip(),
        provider,
        _clamp_score(parsed.get("confidence_score"), 0.78),
        ["Repaired after quality check."],
    )


def _openai_generate_json(system_instruction: str, user_payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "model": OPENAI_TRANSLATION_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
    }
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=TIMEOUT_SEC,
        )
    except requests.exceptions.RequestException as exc:
        raise ProviderError(f"OpenAI request failed: {exc}") from exc
    if not response.ok:
        raise ProviderError(f"OpenAI returned HTTP {response.status_code}: {response.text[:180]}")
    try:
        content = response.json()["choices"][0]["message"]["content"]
        return _parse_json_text(content)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ProviderError("OpenAI JSON response could not be parsed.") from exc


def _candidate(
    language_code: str,
    text: str,
    provider: str,
    quality_score: float,
    notes: Any,
    status: str = "ok",
) -> Dict[str, Any]:
    candidate_id = _candidate_id(language_code, provider, text)
    return {
        "candidate_id": candidate_id,
        "language_code": language_code,
        "language_name": LANGUAGE_NAMES.get(language_code, language_code),
        "text": text,
        "provider": provider,
        "quality_score": round(float(quality_score), 2),
        "status": status,
        "notes": _normalize_notes(notes),
    }


def _final_translation(
    lang: str,
    selected: Dict[str, Any],
    candidates: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "language_code": lang,
        "language_name": LANGUAGE_NAMES.get(lang, lang),
        "text": selected.get("text", ""),
        "provider": selected.get("provider", ""),
        "quality_score": selected.get("quality_score", 0.0),
        "status": selected.get("status", "ok"),
        "notes": selected.get("notes", []),
        "selected_candidate_id": selected.get("candidate_id", ""),
        "candidate_count": len(candidates),
        "quality_report": selected.get("quality_report", {}),
        "candidates": [_candidate_summary(item) for item in candidates],
    }


def _candidate_summary(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "candidate_id": item.get("candidate_id", ""),
        "provider": item.get("provider", ""),
        "quality_score": item.get("quality_score", 0.0),
        "status": item.get("status", "ok"),
        "notes": item.get("notes", []),
    }


def _merge_candidates(candidates_by_lang: Dict[str, List[Dict[str, Any]]], items: Sequence[Dict[str, Any]]) -> None:
    for item in items:
        lang = item["language_code"]
        existing_ids = {candidate["candidate_id"] for candidate in candidates_by_lang.setdefault(lang, [])}
        if item["candidate_id"] not in existing_ids:
            candidates_by_lang[lang].append(item)


def _best_candidate(candidates: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    if not candidates:
        return _candidate("", "", "not_configured", 0.0, ["No candidates were generated."], status="unavailable")
    return sorted(candidates, key=lambda item: item.get("quality_score", 0.0), reverse=True)[0]


def _find_evaluator_tool(tools: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return _find_tool_by_role(tools, "evaluator")


def _find_repair_tool(tools: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return _find_tool_by_role(tools, "repair")


def _find_tool_by_role(tools: Sequence[Dict[str, Any]], role: str) -> Optional[Dict[str, Any]]:
    for tool in tools:
        if tool["configured"] and role in tool["roles"]:
            return tool
    return None


def _public_tool(tool: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": tool["name"],
        "kind": tool["kind"],
        "roles": tool["roles"],
        "model": tool["model"],
        "configured": tool["configured"],
        "supports": tool["supports"],
        "priority": tool["priority"],
    }


def _target_language_signal(text: str, language_code: str) -> str:
    if language_code == "ja":
        return "strong" if re.search(r"[\u3040-\u30ff\u3400-\u9fff]", text) else "weak"
    if language_code in {"en", "de", "vi"}:
        return "strong" if re.search(r"[A-Za-z]", _strip_accents(text)) else "weak"
    return "unknown"


def _token_similarity(source_text: str, back_translation: str) -> float:
    left = set(_phrasebook_key(source_text).split())
    right = set(_phrasebook_key(back_translation).split())
    if not left or not right:
        return 0.0
    return round(len(left & right) / len(left | right), 2)


def _parse_json_text(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def _resolve_target_languages(target_languages: Optional[Sequence[str]]) -> List[str]:
    raw_targets = target_languages or MULTILINGUAL_TARGET_LANGUAGES.split(",")
    targets: List[str] = []
    for lang in raw_targets:
        code = _normalize_lang_code(lang)
        if code and code in LANGUAGE_NAMES and code not in targets:
            targets.append(code)
    return targets or ["en", "de", "ja", "vi"]


def _normalize_lang_code(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace("_", "-").split("-")[0]


def _language_payload(lang: str) -> Dict[str, str]:
    return {"code": lang, "name": LANGUAGE_NAMES.get(lang, lang)}


def _step(name: str, status: str, detail: str) -> Dict[str, str]:
    return {"name": name, "status": status, "detail": detail}


def _light_refine_source(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if cleaned and cleaned[-1] not in ".!?。":
        cleaned += "."
    return cleaned


def _phrasebook_key(text: str) -> str:
    ascii_text = _strip_accents(text.lower())
    ascii_text = re.sub(r"[^a-z0-9\s]", "", ascii_text)
    return re.sub(r"\s+", " ", ascii_text).strip()


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_notes(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()]


def _dedupe(items: Sequence[str]) -> List[str]:
    seen = set()
    result = []
    for item in items:
        if item and item not in seen:
            result.append(item)
            seen.add(item)
    return result


def _clamp_score(value: Any, default: float) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        score = default
    return max(0.0, min(1.0, score))


def _candidate_id(language_code: str, provider: str, text: str) -> str:
    digest = hashlib.sha1(f"{language_code}:{provider}:{text}".encode("utf-8")).hexdigest()[:10]
    return f"{provider}:{language_code}:{digest}"
