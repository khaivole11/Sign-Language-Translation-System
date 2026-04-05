/**
 * Lấy 1 frame đầu (seek nhẹ) làm data URL JPEG để preview.
 */
export function captureVideoPreviewDataUrl(file, seekSec = 0.1) {
  if (!file || !file.type || !file.type.startsWith("video/")) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    };

    const fail = () => {
      cleanup();
      resolve(null);
    };

    video.onerror = fail;

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(seekSec, (video.duration || 1) * 0.01 || seekSec);
      } catch {
        fail();
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          fail();
          return;
        }
        const canvas = document.createElement("canvas");
        const maxW = 640;
        const scale = w > maxW ? maxW / w : 1;
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        cleanup();
        resolve(dataUrl);
      } catch {
        fail();
      }
    };
  });
}
