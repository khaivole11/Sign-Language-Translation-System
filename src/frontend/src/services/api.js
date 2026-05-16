const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

function normalizeMultilingualAgent(data) {
  if (!data || typeof data !== "object") return null;

  return {
    sourceLanguage: data.source_language || "en",
    sourceSignLanguage: data.source_sign_language || "ASL",
    targetLanguages: Array.isArray(data.target_languages) ? data.target_languages : [],
    translations: Array.isArray(data.translations)
      ? data.translations.map((item) => ({
          selectedCandidateId: item.selected_candidate_id || "",
          languageCode: item.language_code || "",
          languageName: item.language_name || item.language_code || "",
          text: item.text || "",
          provider: item.provider || "",
          qualityScore: Number(item.quality_score) || 0,
          status: item.status || "ok",
          notes: Array.isArray(item.notes) ? item.notes : [],
          candidateCount: Number(item.candidate_count) || 0,
          qualityReport: item.quality_report || {},
          candidates: Array.isArray(item.candidates) ? item.candidates : [],
        }))
      : [],
    steps: Array.isArray(data.steps)
      ? data.steps.map((step) => ({
          name: step.name || "",
          status: step.status || "",
          detail: step.detail || "",
        }))
      : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    plan: data.plan || {},
    tools: Array.isArray(data.tools) ? data.tools : [],
    stub: Boolean(data.stub),
  };
}

function friendlyHttpMessage(status, detail) {
  if (status === 429) {
    return "Too many requests — the server is busy. Try again later.";
  }
  if (status === 503) {
    return detail || "AI service is temporarily unavailable. Try again later.";
  }
  if (status === 400) {
    return detail || "Invalid request.";
  }
  if (status >= 500) {
    return detail || "Internal server error. Try again later.";
  }
  return detail || `HTTP Error ${status}`;
}

/**
 * Gửi video lên gateway → TV1/TV2.
 * @param {File} file
 * @param {{ onUploadProgress?: (n: number) => void, onProcessingStart?: () => void }} callbacks
 */
export async function translateVideo(file, callbacks = {}) {
  const { onUploadProgress, onProcessingStart } = callbacks;
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const t0 = performance.now();
    let uploadEndedAt = null;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onUploadProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.upload.addEventListener("load", () => {
      uploadEndedAt = performance.now();
      onProcessingStart?.();
    });

    xhr.onload = () => {
      const tEnd = performance.now();
      const uploadMs = uploadEndedAt != null ? uploadEndedAt - t0 : Math.max(0, tEnd - t0);

      if (xhr.status >= 200 && xhr.status < 300) {
        let res;
        try {
          res = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error("Response is not valid JSON."));
          return;
        }

        const serverTotal = Number(res.time) || 0;

        resolve({
          rawText: res.raw ?? "",
          refinedText: res.refined ?? "",
          requestId: res.request_id ?? "",
          feedbackReady: Boolean(res.feedback_ready),
          warnings: Array.isArray(res.warnings) ? res.warnings : [],
          stub: Boolean(res.stub),
          multilingual: normalizeMultilingualAgent(res.multilingual),
          duration: `${serverTotal.toFixed(2)}s`,
          timeServer: { total: serverTotal },
          timeClient: {
            uploadMs: Math.round(uploadMs),
            roundTripMs: Math.round(tEnd - t0),
          },
          language: "Sign → English",
          gestures: [],
        });
        return;
      }

      let detail = "";
      try {
        const err = JSON.parse(xhr.responseText);
        if (err.detail != null) {
          detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
        }
      } catch {
        /* ignore */
      }
      reject(new Error(friendlyHttpMessage(xhr.status, detail)));
    };

    xhr.onerror = () => reject(new Error("Network error — check backend and CORS."));

    xhr.open("POST", `${BASE_URL}/api/translate?include_multilingual=false`);
    xhr.send(formData);
  });
}

export async function runMultilingualAgent(sourceText, options = {}) {
  const {
    sourceLanguage = "en",
    sourceSignLanguage = "ASL",
    targetLanguages = ["en", "de", "ja", "vi"],
  } = options;

  const res = await fetch(`${BASE_URL}/api/multilingual-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_text: sourceText,
      source_language: sourceLanguage,
      source_sign_language: sourceSignLanguage,
      target_languages: targetLanguages,
    }),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = body?.detail;
    throw new Error(friendlyHttpMessage(res.status, typeof detail === "string" ? detail : ""));
  }

  return normalizeMultilingualAgent(body);
}

export async function submitTranslationFeedback(payload) {
  const res = await fetch(`${BASE_URL}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = body?.detail;
    throw new Error(friendlyHttpMessage(res.status, typeof detail === "string" ? detail : ""));
  }

  return body;
}
