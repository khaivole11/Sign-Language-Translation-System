const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

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
          warnings: Array.isArray(res.warnings) ? res.warnings : [],
          stub: Boolean(res.stub),
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

    xhr.open("POST", `${BASE_URL}/api/translate`);
    xhr.send(formData);
  });
}
