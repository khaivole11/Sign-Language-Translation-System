/**
 * ProgressBar — Workflow Progress Track (3 bước)
 * Props:
 *   currentStep: 1 | 2 | 3
 *   progress: number (0–100), chỉ dùng khi step === 2
 */
export default function ProgressBar({ currentStep = 1, progress = 0 }) {
  const steps = [
    { label: "BƯỚC 1", name: "Nhận diện Video", icon: <CheckIcon /> },
    { label: "BƯỚC 2", name: "Tải & trích xuất", icon: <SyncIcon /> },
    { label: "BƯỚC 3", name: "Dịch & tinh chỉnh", icon: <SparkleIcon /> },
  ];

  // Tỉ lệ fill của track dựa vào step + progress nội bộ
  const trackFill =
    currentStep === 1 ? 0
    : currentStep === 2 ? (progress / 100) * 50 + 0 // 0–50%
    : currentStep === 3 ? 50 + (progress / 100) * 50 // 50–100%
    : 0;

  return (
    <div style={styles.wrapper}>
      {/* Track */}
      <div style={styles.track}>
        <div style={{ ...styles.trackFill, width: `${trackFill}%` }} />
      </div>

      {/* Steps */}
      <div style={styles.stepsRow}>
        {steps.map((s, i) => {
          const stepNum = i + 1;
          const done = currentStep > stepNum;
          const active = currentStep === stepNum;
          return (
            <div key={i} style={styles.stepCol}>
              <div style={{ ...styles.iconWrap, color: done ? "#00677e" : active ? "#00a8cc" : "#bcc8ce" }}>
                {s.icon}
              </div>
              <span style={{ ...styles.stepLabel, color: done || active ? "#00677e" : "#bcc8ce" }}>
                {s.label}
              </span>
              <span style={{ ...styles.stepName, fontWeight: active ? 700 : 500, color: active ? "#171c1f" : "#7a9099" }}>
                {s.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function SyncIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

const styles = {
  wrapper: {
    width: "100%",
    maxWidth: 768,
    margin: "0 auto",
    fontFamily: "'Manrope', sans-serif",
  },
  track: {
    height: 4,
    background: "#dee3e6",
    borderRadius: 9999,
    overflow: "hidden",
    marginBottom: 28,
  },
  trackFill: {
    height: "100%",
    background: "linear-gradient(90deg, #00677e, #00a8cc)",
    borderRadius: 9999,
    transition: "width 0.4s ease",
  },
  stepsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
  },
  stepCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    display: "flex",
    alignItems: "center",
    marginBottom: 2,
    transition: "color 0.3s",
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "color 0.3s",
  },
  stepName: {
    fontSize: 14,
    transition: "all 0.3s",
  },
};
