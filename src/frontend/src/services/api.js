const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

function friendlyHttpMessage(status, detail) {
  if (status === 429) {
    return "Quá nhiều yêu cầu — máy chủ đang bận. Thử lại sau vài giây.";
  }
  if (status === 503) {
    return detail || "Dịch vụ AI tạm không phản hồi. Thử lại sau.";
  }
  if (status === 400) {
    return detail || "Yêu cầu không hợp lệ.";
  }
  if (status >= 500) {
    return detail || "Lỗi máy chủ. Thử lại sau.";
  }
  return detail || `Lỗi HTTP ${status}`;
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
          reject(new Error("Phản hồi không phải JSON hợp lệ."));
          return;
        }

        const t = res.time || {};
        const feat = Number(t.features) || 0;
        const trans = Number(t.translate) || 0;
        const serverTotal = feat + trans;

        resolve({
          rawText: res.raw ?? "",
          refinedText: res.refined ?? "",
          requestId: res.request_id ?? "",
          warnings: Array.isArray(res.warnings) ? res.warnings : [],
          stub: Boolean(res.stub),
          duration: `${serverTotal.toFixed(2)}s`,
          timeServer: { features: feat, translate: trans, total: serverTotal },
          timeClient: {
            uploadMs: Math.round(uploadMs),
            roundTripMs: Math.round(tEnd - t0),
          },
          language: "Sign → Vietnamese",
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

    xhr.onerror = () => reject(new Error("Lỗi mạng — kiểm tra backend đã chạy và CORS."));

    xhr.open("POST", `${BASE_URL}/api/translate-ui`);
    xhr.send(formData);
  });
}
