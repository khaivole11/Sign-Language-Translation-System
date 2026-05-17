import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ProgressBar from "../common/ProgressBar";
import { runMultilingualAgent, translateVideo } from "../../services/api";
import { captureVideoPreviewDataUrl } from "../../utils/videoPreview";

const MESSAGES = {
  upload: ["Uploading video to server...", "Sending video data securely..."],
  video: ["Extracting I3D features...", "Translating signs into text...", "Refining source sentence..."],
  agent: ["Planning multilingual translation...", "Searching translation tools and models...", "Generating language candidates...", "Checking translation quality..."],
};

const AGENT_STEPS = [
  { key: "plan", label: "Plan", detail: "Define targets, constraints, and quality gates." },
  { key: "tools", label: "Find tools", detail: "Check Gemini, OpenAI, DeepL, Google Translate, and fallback." },
  { key: "translate", label: "Translate", detail: "Create candidates for each target language." },
  { key: "quality", label: "Quality check", detail: "Check meaning, numbers, language signal, and review risk." },
  { key: "select", label: "Select", detail: "Pick the best candidate for the result screen." },
];

export default function ProcessingScreen({ file, fileName }) {
  const [barStep, setBarStep] = useState(2);
  const [barProgress, setBarProgress] = useState(0);
  const [phase, setPhase] = useState("upload");
  const [msgIdx, setMsgIdx] = useState(0);
  const [agentStepIdx, setAgentStepIdx] = useState(0);
  const [sourceText, setSourceText] = useState("");
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
    setPhase("upload");
    setAgentStepIdx(0);
    setSourceText("");

    const clearPulse = () => {
      if (pulseRef.current) {
        clearInterval(pulseRef.current);
        pulseRef.current = null;
      }
    };

    const startPulse = ({ from, to, intervalMs, onTick }) => {
      clearPulse();
      let p = from;
      setBarProgress(p);
      pulseRef.current = setInterval(() => {
        p = Math.min(p + 1, to);
        setBarProgress(p);
        onTick?.(p);
      }, intervalMs);
    };

    (async () => {
      const previewUrl = await captureVideoPreviewDataUrl(file);
      const videoUrl = URL.createObjectURL(file);
      if (cancelled) return;

      try {
        const result = await translateVideo(file, {
          onUploadProgress: (pct) => {
            if (cancelled) return;
            setPhase("upload");
            setBarStep(2);
            setBarProgress(pct);
          },
          onProcessingStart: () => {
            if (cancelled) return;
            setPhase("video");
            setBarStep(3);
            startPulse({ from: 8, to: 92, intervalMs: 430 });
          },
        });

        clearPulse();
        if (cancelled) return;

        const translatedText = result.refinedText || result.rawText || "";
        setSourceText(translatedText);
        setPhase("agent");
        setBarStep(4);
        setAgentStepIdx(0);
        startPulse({
          from: 6,
          to: 94,
          intervalMs: 520,
          onTick: (p) => {
            const idx = Math.min(AGENT_STEPS.length - 1, Math.floor((p / 100) * AGENT_STEPS.length));
            setAgentStepIdx(idx);
          },
        });

        let multilingual = null;
        let warnings = [...(result.warnings || [])];
        try {
          multilingual = await runMultilingualAgent(translatedText);
          warnings = [...warnings, ...(multilingual?.warnings || [])];
        } catch (agentError) {
          warnings.push(agentError.message || "AI agent failed after sign-to-text translation.");
        }

        clearPulse();
        if (cancelled) return;

        setAgentStepIdx(AGENT_STEPS.length);
        setBarProgress(100);
        navigate("/result", {
          state: {
            result: { ...result, warnings, multilingual, originalFileName: fileName },
            previewUrl,
            videoUrl,
          },
        });
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
  }, [file, fileName, navigate]);

  useEffect(() => {
    setMsgIdx(0);
  }, [phase]);

  useEffect(() => {
    const pool = MESSAGES[phase] || MESSAGES.upload;
    const msgInterval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % pool.length);
    }, 2600);
    return () => clearInterval(msgInterval);
  }, [phase]);

  const messages = MESSAGES[phase] || MESSAGES.upload;
  const line = messages[msgIdx % messages.length];
  const phaseLabel = phase === "agent" ? "AI AGENT" : phase === "video" ? "SIGN-TO-TEXT" : "UPLOADING";

  return (
    <div style={styles.wrapper}>
      <div style={styles.trackSection}>
        <ProgressBar currentStep={barStep} progress={barProgress} />
      </div>

      <div style={styles.titleSection}>
        <h1 style={styles.title}>{phase === "agent" ? "Running AI Agent" : "Processing Video"}</h1>
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
            <>{fileName ? `${fileName} - ` : ""}{line}</>
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
            {phaseLabel} - {barProgress}%
          </span>
        </div>

        <div style={styles.gestureChip}>
          {phase === "agent" ? <AgentIcon /> : <EyeIcon />}
          <span style={styles.chipText}>
            {phase === "agent" ? "PLAN / TOOLS / QUALITY" : phase === "video" ? "I3D / FAIRSEQ" : "UPLOAD"}
          </span>
        </div>
      </div>

      <div style={styles.infoCard}>
        <div style={styles.infoHeader}>
          <AiIcon />
          <span style={styles.infoTitle}>
            {phase === "agent" ? "AI Agent Translation Pipeline" : "Sign Language Processing Pipeline"}
          </span>
        </div>
        {phase === "agent" ? (
          <>
            {sourceText ? <p style={styles.sourceText}>{sourceText}</p> : null}
            <AgentProgressList activeIndex={agentStepIdx} />
          </>
        ) : (
          <p style={styles.infoDesc}>
            The system uploads the video, extracts motion features, and translates the sign-language sequence into source text before the AI agent starts multilingual translation.
          </p>
        )}
      </div>
    </div>
  );
}

function AgentProgressList({ activeIndex }) {
  return (
    <div style={styles.agentList}>
      {AGENT_STEPS.map((step, index) => {
        const done = activeIndex > index;
        const active = activeIndex === index;
        return (
          <div key={step.key} style={{ ...styles.agentRow, ...(active ? styles.agentRowActive : {}) }}>
            <span style={{ ...styles.agentDot, ...(done ? styles.agentDotDone : active ? styles.agentDotActive : {}) }} />
            <div style={styles.agentCopy}>
              <span style={styles.agentLabel}>{step.label}</span>
              <span style={styles.agentDetail}>{step.detail}</span>
            </div>
          </div>
        );
      })}
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
        AI
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

function AgentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
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
    gap: 40,
    padding: "72px 24px",
    fontFamily: "'Manrope', sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  trackSection: { width: "100%", maxWidth: 820 },
  titleSection: { textAlign: "center" },
  title: {
    fontSize: 40,
    fontWeight: 800,
    color: "#171c1f",
    margin: "0 0 12px",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 18,
    color: "#3d494d",
    margin: 0,
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
    letterSpacing: 0,
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
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  infoCard: {
    width: "100%",
    maxWidth: 680,
    background: "#ffffff",
    borderRadius: 12,
    padding: "28px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    border: "1px solid #e2eaed",
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
    fontSize: 15,
    fontWeight: 800,
    color: "#171c1f",
  },
  infoDesc: {
    fontSize: 14,
    color: "#3d494d",
    lineHeight: "23px",
    margin: 0,
    textAlign: "center",
  },
  sourceText: {
    margin: "0 0 16px",
    padding: "12px 14px",
    borderRadius: 8,
    background: "#f5fafd",
    border: "1px solid #e2eaed",
    color: "#171c1f",
    fontSize: 14,
    lineHeight: "22px",
    overflowWrap: "anywhere",
  },
  agentList: {
    display: "grid",
    gap: 10,
  },
  agentRow: {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    gap: 10,
    alignItems: "start",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e2eaed",
    background: "#ffffff",
  },
  agentRowActive: {
    borderColor: "#bfe9fa",
    background: "#f0fbff",
  },
  agentDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#bcc8ce",
    marginTop: 5,
  },
  agentDotActive: { background: "#00a8cc" },
  agentDotDone: { background: "#10b981" },
  agentCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  agentLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: "#171c1f",
  },
  agentDetail: {
    fontSize: 12,
    color: "#607077",
    lineHeight: "18px",
  },
};
