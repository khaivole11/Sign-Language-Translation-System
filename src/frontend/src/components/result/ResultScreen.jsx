import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PLACEHOLDER_THUMB =
  "https://images.unsplash.com/photo-1560185007-5f0bb1866cab?w=500&q=80";

function buildExportText(result) {
  const lines = [
    `request_id: ${result?.requestId || ""}`,
    `raw: ${result?.rawText ?? ""}`,
    `refined: ${result?.refinedText ?? ""}`,
    "",
    `time_server_features_sec: ${result?.timeServer?.features?.toFixed?.(4) ?? ""}`,
    `time_server_translate_sec: ${result?.timeServer?.translate?.toFixed?.(4) ?? ""}`,
    `time_client_upload_ms: ${result?.timeClient?.uploadMs ?? ""}`,
    `time_client_roundtrip_ms: ${result?.timeClient?.roundTripMs ?? ""}`,
  ];
  if (result?.warnings?.length) {
    lines.push("", "warnings:");
    result.warnings.forEach((w) => lines.push(`- ${w}`));
  }
  return lines.join("\n");
}

export default function ResultScreen({ result, previewUrl }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const rawText = result?.rawText ?? "";
  const refinedText = result?.refinedText ?? "";
  const duration = result?.duration;
  const language = result?.language || "Sign → Vietnamese";
  const requestId = result?.requestId || "";
  const warnings = result?.warnings || [];
  const stub = result?.stub;
  const ts = result?.timeServer;
  const tc = result?.timeClient;

  const thumbSrc = previewUrl || PLACEHOLDER_THUMB;

  const handleCopy = () => {
    navigator.clipboard.writeText(refinedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Kết quả dịch", text: refinedText });
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([buildExportText(result)], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `translate-${requestId.slice(0, 8) || "result"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.titleWrap}>
        <h1 style={styles.title}>Kết quả dịch</h1>
        <div style={styles.titleUnderline} />
      </div>

      {stub ? (
        <div style={styles.stubBanner}>
          <strong>Chế độ stub:</strong> backend chưa cấu hình đủ{" "}
          <code style={styles.code}>API_FEATURE_URL</code> +{" "}
          <code style={styles.code}>API_TRANSLATE_URL</code> — đang dùng dữ liệu giả lập.
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div style={styles.warnBanner}>
          <strong>Cảnh báo từ API:</strong>
          <ul style={styles.warnList}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={styles.content}>
        <div style={styles.leftCol}>
          <div style={styles.thumbCard}>
            <img src={thumbSrc} alt="Preview khung hình đầu video" style={styles.thumb} />
            <div style={styles.playOverlay}>
              <div style={styles.playBtn}>
                <PlayIcon />
              </div>
            </div>
            <div style={styles.gestureChip}>
              <HandIcon />
              <span style={styles.chipText}>PREVIEW · FRAME ĐẦU</span>
            </div>
          </div>

          <div style={styles.videoInfo}>
            <p style={styles.infoLabel}>Thông tin & thời gian</p>
            <div style={styles.infoCol}>
              <span style={styles.infoItem}>Tổng xử lý máy chủ: {duration ?? "—"}</span>
              <span style={styles.infoItem}>TV1 (features): {ts ? `${ts.features.toFixed(2)}s` : "—"}</span>
              <span style={styles.infoItem}>TV2 (translate): {ts ? `${ts.translate.toFixed(2)}s` : "—"}</span>
              <span style={styles.infoItem}>
                Tải lên (client): {tc != null ? `${tc.uploadMs} ms` : "—"}
              </span>
              <span style={styles.infoItem}>
                Vòng đời request (client): {tc != null ? `${tc.roundTripMs} ms` : "—"}
              </span>
              <span style={styles.infoItem}>Ngôn ngữ: {language}</span>
            </div>
            {requestId ? (
              <p style={styles.requestRow}>
                <span style={styles.reqLabel}>Request ID</span>
                <code style={styles.reqCode}>{requestId}</code>
              </p>
            ) : null}
          </div>
        </div>

        <div style={styles.rightCol}>
          <div style={styles.rawSection}>
            <div style={styles.sectionHeader}>
              <QuoteIcon />
              <span style={styles.sectionLabel}>Văn bản thô (raw)</span>
            </div>
            <div style={styles.rawBox}>
              <p style={styles.rawText}>{rawText || "—"}</p>
            </div>
          </div>

          <div style={styles.refinedSection}>
            <div style={styles.sectionHeader}>
              <SparkleIcon />
              <span style={{ ...styles.sectionLabel, color: "#00a8cc" }}>Văn bản tinh chỉnh (refined)</span>
            </div>
            <div style={styles.refinedBox}>
              <div style={styles.refinedGlow} />
              <p style={styles.refinedText}>{refinedText || "—"}</p>
            </div>
          </div>

          <div style={styles.actions}>
            <div style={styles.leftActions}>
              <button type="button" style={styles.outlineBtn} onClick={handleCopy}>
                <CopyIcon />
                <span>{copied ? "Đã copy!" : "Copy"}</span>
              </button>
              <button type="button" style={styles.outlineBtn} onClick={handleShare}>
                <ShareIcon />
                <span>Share</span>
              </button>
              <button type="button" style={styles.outlineBtn} onClick={handleDownloadTxt}>
                <DownloadIcon />
                <span>Tải .txt</span>
              </button>
            </div>
            <button type="button" style={styles.primaryBtn} onClick={() => navigate("/")}>
              <VideoIcon />
              <span>Dịch video khác</span>
            </button>
          </div>
        </div>
      </div>

      <div style={styles.tipCard}>
        <TipIcon />
        <p style={styles.tipText}>
          <strong>Mẹo:</strong> Dùng Request ID để đối chiếu với log gateway/TV1/TV2 khi báo lỗi.
        </p>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function HandIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v-1a2 2 0 0 0-4 0v-1a2 2 0 0 0-4 0v11l-1.5-2.7a2 2 0 0 0-3.2 2.4l4.5 7.8A4 4 0 0 0 9.3 24H17a4 4 0 0 0 4-4v-5a2 2 0 0 0-3-1.8z" />
    </svg>
  );
}
function QuoteIcon() {
  return (
    <svg width="11" height="9" viewBox="0 0 24 20" fill="#7a9099">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00a8cc" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="14" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="15" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="15" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="15" height="18" rx="2" />
      <path d="M17 8l5-3v14l-5-3" />
    </svg>
  );
}
function TipIcon() {
  return (
    <svg width="15" height="20" viewBox="0 0 24 24" fill="none" stroke="#c07c00" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="20" x2="12" y2="20.01" />
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26A7 7 0 0 1 12 2z" />
    </svg>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
    padding: "80px 24px 60px",
    fontFamily: "'Manrope', sans-serif",
    maxWidth: 1280,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  titleWrap: { textAlign: "center" },
  title: {
    fontSize: 40,
    fontWeight: 800,
    color: "#171c1f",
    margin: "0 0 12px",
    letterSpacing: "-1px",
  },
  titleUnderline: {
    width: 96,
    height: 4,
    background: "linear-gradient(90deg, #00677e, #00a8cc)",
    borderRadius: 9999,
    margin: "0 auto",
  },
  stubBanner: {
    width: "100%",
    maxWidth: 960,
    background: "#fef3c7",
    border: "1px solid #fcd34d",
    borderRadius: 10,
    padding: "14px 18px",
    fontSize: 14,
    color: "#78350f",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  warnBanner: {
    width: "100%",
    maxWidth: 960,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    borderRadius: 10,
    padding: "14px 18px",
    fontSize: 14,
    color: "#9a3412",
    boxSizing: "border-box",
  },
  warnList: { margin: "8px 0 0", paddingLeft: 20 },
  code: { fontSize: 13, background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4 },
  content: {
    display: "grid",
    gridTemplateColumns: "485px 1fr",
    gap: 48,
    width: "100%",
    alignItems: "start",
  },
  leftCol: { display: "flex", flexDirection: "column", gap: 16 },
  thumbCard: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    aspectRatio: "16/9",
  },
  thumb: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  playOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  gestureChip: {
    position: "absolute",
    bottom: 16,
    left: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 9999,
    background: "rgba(0,103,126,0.85)",
    backdropFilter: "blur(4px)",
  },
  chipText: { fontSize: 12, fontWeight: 700, color: "white", letterSpacing: "0.5px" },
  videoInfo: {
    background: "#f5fafd",
    border: "1px solid #e2eaed",
    borderRadius: 10,
    padding: "20px 24px",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#7a9099",
    letterSpacing: "1px",
    textTransform: "uppercase",
    margin: "0 0 10px",
  },
  infoCol: { display: "flex", flexDirection: "column", gap: 6 },
  infoItem: { fontSize: 14, fontWeight: 500, color: "#3d494d" },
  requestRow: { margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 6 },
  reqLabel: { fontSize: 11, fontWeight: 700, color: "#7a9099", letterSpacing: "0.5px" },
  reqCode: {
    fontSize: 12,
    wordBreak: "break-all",
    background: "#fff",
    border: "1px solid #e2eaed",
    padding: "8px 10px",
    borderRadius: 8,
    color: "#171c1f",
  },

  rightCol: {
    background: "#ffffff",
    borderRadius: 12,
    padding: "40px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e2eaed",
    display: "flex",
    flexDirection: "column",
    gap: 28,
    boxSizing: "border-box",
  },
  sectionHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: "#7a9099", letterSpacing: "1px", textTransform: "uppercase" },
  rawBox: {
    background: "#f5fafd",
    border: "1px solid #e2eaed",
    borderLeft: "3px solid #bcc8ce",
    borderRadius: "0 8px 8px 0",
    padding: "20px 24px",
  },
  rawText: { fontSize: 16, color: "#3d494d", margin: 0, lineHeight: "26px" },
  refinedSection: {},
  refinedBox: {
    position: "relative",
    borderRadius: 10,
    border: "1.5px solid #bfe9fa",
    background: "#f0fbff",
    padding: "32px",
    overflow: "hidden",
  },
  refinedGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: "50%",
    background: "rgba(0,168,204,0.08)",
    filter: "blur(32px)",
    pointerEvents: "none",
  },
  refinedText: {
    fontSize: 22,
    fontWeight: 700,
    color: "#171c1f",
    lineHeight: "36px",
    margin: 0,
    position: "relative",
    zIndex: 1,
  },
  actions: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  leftActions: { display: "flex", flexWrap: "wrap", gap: 12 },
  outlineBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 20px",
    borderRadius: 9999,
    border: "1.5px solid #dee3e6",
    background: "white",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    color: "#3d494d",
    fontFamily: "'Manrope', sans-serif",
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 32px",
    borderRadius: 9999,
    border: "none",
    background: "linear-gradient(134deg, #00677e 0%, #00a8cc 100%)",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    color: "white",
    fontFamily: "'Manrope', sans-serif",
    boxShadow: "0 8px 20px rgba(0,103,126,0.25)",
  },

  tipCard: {
    width: "100%",
    maxWidth: 700,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    boxSizing: "border-box",
  },
  tipText: { fontSize: 14, color: "#78350f", lineHeight: "22px", margin: 0 },
};
