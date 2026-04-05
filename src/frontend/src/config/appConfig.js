/** Đồng bộ với MAX_UPLOAD_MB trên gateway (mặc định 50). */
export const MAX_UPLOAD_MB = Number(process.env.REACT_APP_MAX_UPLOAD_MB || 50);

/** API endpoint cho backend */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
export const TRANSLATE_ENDPOINT = `${API_BASE_URL}/api/translate-ui`;

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi"];

export function getFileExtension(name) {
  if (!name || typeof name !== "string") return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function validateVideoFile(file) {
  if (!file) return { ok: false, message: "Chưa chọn file." };
  const ext = getFileExtension(file.name);
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      message: `Chỉ chấp nhận: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.`,
    };
  }
  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `File vượt quá ${MAX_UPLOAD_MB} MB (giới hạn giống máy chủ).`,
    };
  }
  return { ok: true };
}
