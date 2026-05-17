import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitTranslationFeedback } from "../../services/api";

const PLACEHOLDER_THUMB =
  "https://images.unsplash.com/photo-1560185007-5f0bb1866cab?w=500&q=80";

function buildExportText(result) {
  const lines = [
    `request_id: ${result?.requestId || ""}`,
    `raw: ${result?.rawText ?? ""}`,
    `refined: ${result?.refinedText ?? ""}`,
    "",
    `time_server_total_sec: ${result?.timeServer?.total?.toFixed?.(4) ?? ""}`,
    `time_client_upload_ms: ${result?.timeClient?.uploadMs ?? ""}`,
    `time_client_roundtrip_ms: ${result?.timeClient?.roundTripMs ?? ""}`,
  ];
  if (result?.warnings?.length) {
    lines.push("", "warnings:");
    result.warnings.forEach((w) => lines.push(`- ${w}`));
  }
  if (result?.multilingual?.translations?.length) {
    lines.push("", "multilingual_translations:");
    result.multilingual.translations.forEach((item) => {
      lines.push(
        `- ${item.languageName || item.languageCode}: ${item.text || "[unavailable]"} ` +
          `(provider=${item.provider || "unknown"}, quality=${Math.round((item.qualityScore || 0) * 100)}%, status=${item.status || "ok"})`
      );
    });
  }
  return lines.join("\n");
}

export default function ResultScreen({ result, previewUrl, videoUrl }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState(() => result?.refinedText ?? "");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackState, setFeedbackState] = useState("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const rawText = result?.rawText ?? "";
  const refinedText = result?.refinedText ?? "";
  const duration = result?.duration;
  const language = result?.language || "Sign → English";
  const requestId = result?.requestId || "";
  const originalFileName = result?.originalFileName || "";
  const feedbackReady = Boolean(result?.feedbackReady);
  const warnings = result?.warnings || [];
  const stub = result?.stub;
  const tc = result?.timeClient;
  const multilingual = result?.multilingual || null;
  const multilingualTranslations = multilingual?.translations || [];
  const agentSteps = multilingual?.steps || [];
  const agentTools = multilingual?.tools || [];

  const thumbSrc = previewUrl || PLACEHOLDER_THUMB;

  useEffect(() => {
    setFeedbackLabel(refinedText);
  }, [refinedText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(refinedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Translation Result", text: refinedText });
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

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    const label = feedbackLabel.trim();
    if (!requestId) {
      setFeedbackState("error");
      setFeedbackMessage("Missing request id for this translation.");
      return;
    }
    if (!label) {
      setFeedbackState("error");
      setFeedbackMessage("Please enter the corrected translation before submitting.");
      return;
    }

    setFeedbackState("saving");
    setFeedbackMessage("");
    try {
      const saved = await submitTranslationFeedback({
        request_id: requestId,
        original_filename: originalFileName,
        raw_translation: rawText,
        refined_translation: refinedText,
        user_label: label,
        rating: feedbackRating || null,
        comment: feedbackComment.trim(),
        metadata: {
          language,
          feedback_ready: feedbackReady,
          multilingual_targets: multilingual?.targetLanguages || [],
        },
      });
      const warningText = saved?.warnings?.length ? ` ${saved.warnings.join(" ")}` : "";
      setFeedbackState("saved");
      setFeedbackMessage(`Saved for review.${warningText}`);
    } catch (error) {
      setFeedbackState("error");
      setFeedbackMessage(error.message || "Could not save feedback.");
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.titleWrap}>
        <h1 style={styles.title}>Translation Result</h1>
        <div style={styles.titleUnderline} />
      </div>

      {stub ? (
        <div style={styles.stubBanner}>
          <strong>Stub Mode:</strong> backend configuration is incomplete.{" "}
          <code style={styles.code}>API_FEATURE_URL</code> +{" "}
          <code style={styles.code}>API_TRANSLATE_URL</code> — using mock data.
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div style={styles.warnBanner}>
          <strong>API Warnings:</strong>
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
            {videoUrl ? (
              <video src={videoUrl} controls style={styles.thumb} autoPlay loop muted={false} />
            ) : (
              <>
                <img src={thumbSrc} alt="Video Frame Preview" style={styles.thumb} />
                <div style={styles.playOverlay}>
                  <div style={styles.playBtn}>
                    <PlayIcon />
                  </div>
                </div>
              </>
            )}
            {!videoUrl && (
              <div style={styles.gestureChip}>
                <HandIcon />
                <span style={styles.chipText}>PREVIEW · FIRST FRAME</span>
              </div>
            )}
          </div>

          <div style={styles.videoInfo}>
            <p style={styles.infoLabel}>Info & Execution Time</p>
            <div style={styles.infoCol}>
              <span style={styles.infoItem}>Total Server Processing: {duration ?? "—"}</span>
              <span style={styles.infoItem}>
                Client Upload: {tc != null ? `${tc.uploadMs} ms` : "—"}
              </span>
              <span style={styles.infoItem}>
                Client Roundtrip: {tc != null ? `${tc.roundTripMs} ms` : "—"}
              </span>
              <span style={styles.infoItem}>Language: {language}</span>
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
              <span style={styles.sectionLabel}>Raw Output</span>
            </div>
            <div style={styles.rawBox}>
              <p style={styles.rawText}>{rawText || "—"}</p>
            </div>
          </div>

          <div style={styles.refinedSection}>
            <div style={styles.sectionHeader}>
              <SparkleIcon />
              <span style={{ ...styles.sectionLabel, color: "#00a8cc" }}>Refined Translation</span>
            </div>
            <div style={styles.refinedBox}>
              <div style={styles.refinedGlow} />
              <p style={styles.refinedText}>{refinedText || "—"}</p>
            </div>
          </div>

          <form style={styles.feedbackSection} onSubmit={handleFeedbackSubmit}>
            <div style={styles.sectionHeader}>
              <FeedbackIcon />
              <span style={{ ...styles.sectionLabel, color: "#125e6d" }}>Feedback</span>
              {feedbackReady ? <span style={styles.feedbackReady}>NPY ready</span> : null}
            </div>
            <p style={styles.feedbackPrompt}>
              Is this translation good enough? You can improve the training label for your video below.
            </p>
            <textarea
              value={feedbackLabel}
              onChange={(event) => setFeedbackLabel(event.target.value)}
              placeholder="Enter the corrected translation for this video"
              style={styles.feedbackTextarea}
              rows={4}
            />
            <div style={styles.feedbackMetaRow}>
              <div style={styles.ratingGroup} aria-label="Translation quality rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackRating(value)}
                    style={{
                      ...styles.ratingBtn,
                      ...(feedbackRating === value ? styles.ratingBtnActive : {}),
                    }}
                    aria-pressed={feedbackRating === value}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                placeholder="Optional note"
                style={styles.feedbackInput}
              />
            </div>
            <div style={styles.feedbackActions}>
              <button
                type="submit"
                style={{
                  ...styles.feedbackSubmit,
                  ...(feedbackState === "saving" ? styles.feedbackSubmitDisabled : {}),
                }}
                disabled={feedbackState === "saving"}
              >
                <SaveIcon />
                <span>{feedbackState === "saving" ? "Saving..." : "Send feedback"}</span>
              </button>
              {feedbackMessage ? (
                <span
                  style={{
                    ...styles.feedbackStatus,
                    ...(feedbackState === "error" ? styles.feedbackStatusError : styles.feedbackStatusSaved),
                  }}
                >
                  {feedbackMessage}
                </span>
              ) : null}
            </div>
          </form>

          {multilingualTranslations.length > 0 ? (
            <div style={styles.agentSection}>
              <div style={styles.sectionHeader}>
                <GlobeIcon />
                <span style={{ ...styles.sectionLabel, color: "#125e6d" }}>Multilingual Agent</span>
                {multilingual?.stub ? <span style={styles.agentMode}>Preview</span> : null}
              </div>

              <div style={styles.translationList}>
                {multilingualTranslations.map((item) => (
                  <div key={item.languageCode || item.languageName} style={styles.translationRow}>
                    <div style={styles.translationMain}>
                      <div style={styles.translationHeader}>
                        <span style={styles.languageName}>{item.languageName}</span>
                        <span style={styles.languageCode}>{(item.languageCode || "").toUpperCase()}</span>
                        <span style={{ ...styles.statusPill, ...getStatusStyle(item.status) }}>
                          {formatStatus(item.status)}
                        </span>
                      </div>
                      <p style={item.text ? styles.translationText : styles.translationEmpty}>
                        {item.text || "Translation provider is not configured for this target."}
                      </p>
                      {item.notes?.length ? (
                        <p style={styles.translationNote}>{item.notes.join(" ")}</p>
                      ) : null}
                    </div>

                    <div style={styles.qualityCol}>
                      <span style={styles.qualityLabel}>Quality</span>
                      <span style={styles.qualityValue}>{formatQuality(item.qualityScore)}</span>
                      <div style={styles.scoreTrack}>
                        <span
                          style={{
                            ...styles.scoreFill,
                            width: `${Math.max(0, Math.min(100, Math.round((item.qualityScore || 0) * 100)))}%`,
                          }}
                        />
                      </div>
                      <span style={styles.providerLabel}>{item.provider || "unknown"}</span>
                      {item.candidateCount ? (
                        <span style={styles.providerLabel}>{item.candidateCount} candidate(s)</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {agentTools.length > 0 ? (
                <div style={styles.agentTools}>
                  {agentTools.map((tool) => (
                    <span
                      key={tool.name}
                      style={{
                        ...styles.agentTool,
                        ...(tool.configured ? styles.agentToolReady : styles.agentToolOff),
                      }}
                    >
                      {tool.name.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              ) : null}

              {agentSteps.length > 0 ? (
                <div style={styles.agentSteps}>
                  {agentSteps.map((step, index) => (
                    <span key={`${step.name}-${index}`} style={styles.agentStep}>
                      <span style={{ ...styles.stepDot, ...getStatusDotStyle(step.status) }} />
                      {step.name.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={styles.actions}>
            <div style={styles.leftActions}>
              <button type="button" style={styles.outlineBtn} onClick={handleCopy}>
                <CopyIcon />
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
              <button type="button" style={styles.outlineBtn} onClick={handleShare}>
                <ShareIcon />
                <span>Share</span>
              </button>
              <button type="button" style={styles.outlineBtn} onClick={handleDownloadTxt}>
                <DownloadIcon />
                <span>Download .txt</span>
              </button>
            </div>
            <button type="button" style={styles.primaryBtn} onClick={() => navigate("/")}>
              <VideoIcon />
              <span>Translate Another</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function formatQuality(score) {
  return `${Math.round((score || 0) * 100)}%`;
}

function formatStatus(status) {
  if (status === "needs_review") return "Needs review";
  if (status === "unavailable") return "Unavailable";
  return "OK";
}

function getStatusStyle(status) {
  if (status === "unavailable") {
    return { background: "#f3f4f6", color: "#4b5563", borderColor: "#d1d5db" };
  }
  if (status === "needs_review") {
    return { background: "#fff7ed", color: "#9a3412", borderColor: "#fdba74" };
  }
  return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
}

function getStatusDotStyle(status) {
  if (status === "failed" || status === "needs_configuration") return { background: "#f97316" };
  if (status === "partial") return { background: "#f59e0b" };
  if (status === "skipped") return { background: "#9ca3af" };
  return { background: "#10b981" };
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#125e6d" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20" />
      <path d="M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
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
function FeedbackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#125e6d" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
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
    letterSpacing: 0,
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
  chipText: { fontSize: 12, fontWeight: 700, color: "white", letterSpacing: 0 },
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
    letterSpacing: 0,
    textTransform: "uppercase",
    margin: "0 0 10px",
  },
  infoCol: { display: "flex", flexDirection: "column", gap: 6 },
  infoItem: { fontSize: 14, fontWeight: 500, color: "#3d494d" },
  requestRow: { margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 6 },
  reqLabel: { fontSize: 11, fontWeight: 700, color: "#7a9099", letterSpacing: 0 },
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
  sectionLabel: { fontSize: 12, fontWeight: 700, color: "#7a9099", letterSpacing: 0, textTransform: "uppercase" },
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
  feedbackSection: {
    borderTop: "1px solid #e2eaed",
    paddingTop: 24,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  feedbackReady: {
    fontSize: 11,
    fontWeight: 800,
    color: "#047857",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: 9999,
    padding: "3px 9px",
  },
  feedbackPrompt: {
    fontSize: 14,
    color: "#52636b",
    lineHeight: "22px",
    margin: 0,
  },
  feedbackTextarea: {
    width: "100%",
    minHeight: 112,
    resize: "vertical",
    boxSizing: "border-box",
    border: "1.5px solid #d8e2e8",
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: 15,
    lineHeight: "24px",
    color: "#171c1f",
    fontFamily: "'Manrope', sans-serif",
    background: "#ffffff",
  },
  feedbackMetaRow: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    alignItems: "center",
  },
  ratingGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  ratingBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1.5px solid #d8e2e8",
    background: "#ffffff",
    color: "#52636b",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "'Manrope', sans-serif",
  },
  ratingBtnActive: {
    background: "#00677e",
    borderColor: "#00677e",
    color: "#ffffff",
  },
  feedbackInput: {
    minWidth: 0,
    border: "1.5px solid #d8e2e8",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: "#171c1f",
    fontFamily: "'Manrope', sans-serif",
  },
  feedbackActions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  feedbackSubmit: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    borderRadius: 9999,
    border: "none",
    background: "#00677e",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "'Manrope', sans-serif",
  },
  feedbackSubmitDisabled: {
    opacity: 0.7,
    cursor: "wait",
  },
  feedbackStatus: {
    minWidth: 0,
    fontSize: 13,
    lineHeight: "20px",
    overflowWrap: "anywhere",
  },
  feedbackStatusSaved: {
    color: "#047857",
  },
  feedbackStatusError: {
    color: "#b91c1c",
  },
  agentSection: {
    borderTop: "1px solid #e2eaed",
    paddingTop: 24,
  },
  agentMode: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b4e00",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 9999,
    padding: "3px 9px",
  },
  translationList: {
    display: "flex",
    flexDirection: "column",
    borderTop: "1px solid #e2eaed",
  },
  translationRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 116px",
    gap: 18,
    padding: "18px 0",
    borderBottom: "1px solid #e2eaed",
    alignItems: "start",
  },
  translationMain: { minWidth: 0 },
  translationHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  languageName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#171c1f",
  },
  languageCode: {
    fontSize: 11,
    fontWeight: 800,
    color: "#607077",
    background: "#eef7fa",
    borderRadius: 9999,
    padding: "3px 8px",
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid",
    borderRadius: 9999,
    padding: "3px 8px",
  },
  translationText: {
    fontSize: 16,
    color: "#1f2933",
    lineHeight: "26px",
    margin: 0,
    overflowWrap: "anywhere",
  },
  translationEmpty: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: "24px",
    margin: 0,
    fontStyle: "italic",
  },
  translationNote: {
    fontSize: 12,
    color: "#7a5000",
    lineHeight: "19px",
    margin: "8px 0 0",
  },
  qualityCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 5,
    minWidth: 0,
  },
  qualityLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#7a9099",
    textTransform: "uppercase",
  },
  qualityValue: {
    fontSize: 18,
    fontWeight: 800,
    color: "#125e6d",
  },
  scoreTrack: {
    width: "100%",
    height: 6,
    borderRadius: 9999,
    background: "#e5edf0",
    overflow: "hidden",
  },
  scoreFill: {
    display: "block",
    height: "100%",
    borderRadius: 9999,
    background: "#00a8cc",
  },
  providerLabel: {
    maxWidth: "100%",
    fontSize: 11,
    color: "#607077",
    overflowWrap: "anywhere",
    textAlign: "right",
  },
  agentTools: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  agentTool: {
    border: "1px solid",
    borderRadius: 9999,
    padding: "6px 10px",
    fontSize: 12,
    textTransform: "capitalize",
  },
  agentToolReady: {
    background: "#ecfdf5",
    borderColor: "#a7f3d0",
    color: "#047857",
  },
  agentToolOff: {
    background: "#f8fafc",
    borderColor: "#d8e2e8",
    color: "#64748b",
  },
  agentSteps: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  agentStep: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#52636b",
    background: "#f5fafd",
    border: "1px solid #e2eaed",
    borderRadius: 9999,
    padding: "6px 10px",
    textTransform: "capitalize",
  },
  stepDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flex: "0 0 auto",
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
