import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "../common/ProgressBar";
import { translateVideo } from "../../services/api";
import { captureVideoPreviewDataUrl } from "../../utils/videoPreview";

const MESSAGES_UPLOAD = [
  "Uploading video to server...",
  "Sending data securely...",
];

const MESSAGES_SERVER = [
  "Extracting features (I3D)...",
  "Translating to text (Fairseq)...",
  "Refining translation...",
];

export default function ProcessingScreen({ file, fileName }) {
  const [barStep, setBarStep] = useState(2);
  const [barProgress, setBarProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [serverPhase, setServerPhase] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const pulseRef = useRef(null);

  useEffect(() => {
    if (!file) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;
    setError(null);
    setBarStep(2);
    setBarProgress(0);
    setServerPhase(false);

    const clearPulse = () => {
      if (pulseRef.current) {
        clearInterval(pulseRef.current);
        pulseRef.current = null;
      }
    };

    (async () => {
      const previewUrl = await captureVideoPreviewDataUrl(file);
      const videoUrl = URL.createObjectURL(file);
      if (cancelled) return;

      try {
        const result = await translateVideo(file, {
          onUploadProgress: (pct) => {
            if (cancelled) return;
            setServerPhase(false);
            setBarStep(2);
            setBarProgress(pct);
          },
          onProcessingStart: () => {
            if (cancelled) return;
            setServerPhase(true);
            setBarStep(3);
            setBarProgress(48);
            clearPulse();
            let p = 48;
            pulseRef.current = setInterval(() => {
              p = Math.min(p + 1, 92);
              setBarProgress(p);
            }, 450);
          },
        });

        clearPulse();
        if (cancelled) return;
        setBarProgress(100);
        navigate("/result", { state: { result, previewUrl, videoUrl } });
      } catch (e) {
        clearPulse();
        if (!cancelled) {
          setError(e.message || "Failed to upload video to server.");
        }
      }
    })();

    return () => {
      cancelled = true;
      clearPulse();
    };
  }, [file, navigate]);

  useEffect(() => {
    setMsgIdx(0);
  }, [serverPhase]);

  useEffect(() => {
    const pool = serverPhase ? MESSAGES_SERVER : MESSAGES_UPLOAD;
    const msgInterval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % pool.length);
    }, 2800);
    return () => clearInterval(msgInterval);
  }, [serverPhase]);

  const messages = serverPhase ? MESSAGES_SERVER : MESSAGES_UPLOAD;
  const line = messages[msgIdx % messages.length];

  return (
    <div style={styles.wrapper}>
      <div style={styles.trackSection}>
        <ProgressBar currentStep={barStep} progress={barProgress} />
      </div>

      <div style={styles.titleSection}>
        <h1 style={styles.title}>Processing Video</h1>
        <p style={styles.subtitle}>
          {error ? (
            <>
              <span style={{ color: "#b91c1c" }}>{error}</span>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                style={styles.retryBtn}
              >
                Go back home
              </button>
            </>
          ) : (
            <>“{fileName ? `${fileName} — ` : ""}{line}”</>
          )}
        </p>
      </div>

      <div style={styles.playerWrap}>
        <div style={styles.playerBg}>
          <div style={styles.blurOverlay} />
        </div>

        <div style={styles.spinnerWrap}>
          <SpinnerRing progress={barProgress} />
        </div>

        <div style={styles.pill}>
          <div style={styles.pillDot} />
          <span style={styles.pillText}>
            {serverPhase ? "PROCESSING" : "UPLOADING"} · {barProgress}%
          </span>
        </div>

        <div style={styles.gestureChip}>
          <EyeIcon />
          <span style={styles.chipText}>
            {serverPhase ? "I3D / FAIRSEQ" : "UPLOAD"}
          </span>
        </div>
      </div>

      <div style={styles.infoCard}>
        <div style={styles.infoHeader}>
          <AiIcon />
          <span style={styles.infoTitle}>Monolithic Processing Pipeline</span>
        </div>
        <p style={styles.infoDesc}>
          After uploading to the server, the system automatically extracts video features and translates them to English. You can verify the <strong>request id</strong> in the results screen for debugging.
        </p>
        <div style={styles.dots}>
          <span style={styles.dot} />
          <span style={styles.dot} />
          <span style={styles.dot} />
        </div>
      </div>
    </div>
  );
}

function SpinnerRing({ progress }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#dee3e6" strokeWidth="6" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="#00a8cc"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
        style={{ transition: "stroke-dashoffset 0.3s ease" }}
      />
      <text x="48" y="53" textAnchor="middle" fontSize="18" fill="#00677e">
        ✦
      </text>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="13" viewBox="0 0 24 16" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round">
      <path d="M1 8S5 1 12 1s11 7 11 7-4 7-11 7S1 8 1 8z" />
      <circle cx="12" cy="8" r="3" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="19" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
    </svg>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 48,
    padding: "80px 24px",
    fontFamily: "'Manrope', sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  trackSection: { width: "100%", maxWidth: 768 },
  titleSection: { textAlign: "center" },
  title: {
    fontSize: 40,
    fontWeight: 800,
    color: "#171c1f",
    margin: "0 0 12px",
    letterSpacing: "-1px",
  },
  subtitle: {
    fontSize: 18,
    color: "#3d494d",
    margin: 0,
    fontStyle: "italic",
    transition: "opacity 0.3s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  retryBtn: {
    fontFamily: "'Manrope', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: "#00677e",
    background: "white",
    border: "1.5px solid #00677e",
    borderRadius: 9999,
    padding: "10px 24px",
    cursor: "pointer",
  },
  playerWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 896,
    height: 504,
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dee3e6",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
  },
  playerBg: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, #d0e8f0 0%, #e8f4f8 50%, #c8dfe8 100%)",
  },
  blurOverlay: {
    position: "absolute",
    inset: 0,
    backdropFilter: "blur(12px)",
    background: "rgba(255,255,255,0.25)",
  },
  spinnerWrap: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
  },
  pill: {
    position: "absolute",
    bottom: 100,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 24px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(8px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    whiteSpace: "nowrap",
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#00a8cc",
  },
  pillText: {
    fontSize: 13,
    fontWeight: 700,
    color: "#171c1f",
    letterSpacing: "0.5px",
  },
  gestureChip: {
    position: "absolute",
    bottom: 24,
    left: 24,
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    borderRadius: 9999,
    background: "rgba(255,255,255,0.8)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(0,168,204,0.2)",
  },
  chipText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#00677e",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  infoCard: {
    width: "100%",
    maxWidth: 576,
    background: "#ffffff",
    borderRadius: 12,
    padding: "32px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    border: "1px solid #e2eaed",
    textAlign: "center",
    boxSizing: "border-box",
  },
  infoHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#171c1f",
  },
  infoDesc: {
    fontSize: 15,
    color: "#3d494d",
    lineHeight: "26px",
    margin: 0,
  },
  dots: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  dot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#bcc8ce",
  },
};
