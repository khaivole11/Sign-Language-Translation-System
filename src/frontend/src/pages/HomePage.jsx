import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import UploadBox from "../components/upload/UploadBox";

const imgPerson = "https://www.figma.com/api/mcp/asset/87c9c2f2-03b9-4bdb-b5da-6b783c00cd9f";

export default function HomePage() {
  return (
    <div style={styles.page}>
      <Header />

      <main style={styles.main}>
        {/* Hero */}
        <section style={styles.heroSection}>
          <h1 style={styles.heroTitle}>
            Dịch Ngôn Ngữ Ký Hiệu<br />
            <span style={styles.accent}>Bằng AI</span>
          </h1>
          <div style={styles.steps}>
            <Step icon={<UploadIcon />} label="Upload" />
            <Slash />
            <Step icon={<AnalyzeIcon />} label="Analyze" />
            <Slash />
            <Step icon={<AIIcon />} label="AI Refine" />
          </div>
        </section>

        {/* Upload box */}
        <section style={styles.uploadSection}>
          <UploadBox />
        </section>

        {/* Technology section */}
        <section style={styles.techSection}>
          <div style={styles.techLeft}>
            <div style={styles.badge}><span style={styles.badgeText}>Technology</span></div>
            <h2 style={styles.techTitle}>
              Công nghệ nhận diện cử chỉ{" "}
              <span style={styles.accent}>thế hệ mới</span>
            </h2>
            <p style={styles.techDesc}>
              Hệ thống của chúng tôi sử dụng mạng nơ-ron tích chập 3D để phân tích
              từng khung hình, nhận diện chính xác các sắc thái biểu cảm và tốc độ
              của đôi tay.
            </p>
          </div>

          <div style={styles.techRight}>
            <div style={styles.imgCard}>
              <img src={imgPerson} alt="Sign language" style={styles.techImg} />
            </div>
            <div style={styles.chip}>
              <div style={styles.chipDot}><LiveIcon /></div>
              <div>
                <p style={styles.chipLabel}>Live Recognition</p>
                <p style={styles.chipValue}>98.4% Accuracy</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Step({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon}
      <span style={styles.stepLabel}>{label}</span>
    </div>
  );
}
function Slash() {
  return <span style={{ color: "#bcc8ce", fontSize: 16 }}>/</span>;
}
function UploadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d494d" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function AnalyzeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d494d" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function AIIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d494d" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function LiveIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="white" stroke="none"/></svg>;
}

const styles = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5fafd", fontFamily: "'Manrope', sans-serif" },
  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 64, padding: "128px 24px 80px" },
  heroSection: { display: "flex", flexDirection: "column", alignItems: "center", gap: 24, maxWidth: 896, width: "100%" },
  heroTitle: { fontSize: 72, fontWeight: 800, color: "#171c1f", textAlign: "center", lineHeight: "80px", letterSpacing: "-1.8px", margin: 0 },
  accent: { color: "#00a8cc" },
  steps: { display: "flex", alignItems: "center", gap: 16 },
  stepLabel: { fontSize: 16, fontWeight: 500, color: "#3d494d" },
  uploadSection: { width: "100%", maxWidth: 768, display: "flex", justifyContent: "center" },
  techSection: {
    display: "grid", gridTemplateColumns: "7fr 5fr", gap: 48,
    width: "100%", maxWidth: 1152, alignItems: "start",
  },
  techLeft: { display: "flex", flexDirection: "column", gap: 31, paddingBottom: 40 },
  badge: { alignSelf: "flex-start", background: "#bfe9fa", borderRadius: 9999, padding: "4px 16px" },
  badgeText: { fontSize: 14, fontWeight: 700, color: "#416a78", letterSpacing: "1.4px", textTransform: "uppercase" },
  techTitle: { fontSize: 36, fontWeight: 700, color: "#171c1f", lineHeight: "45px", margin: 0 },
  techDesc: { fontSize: 20, fontWeight: 400, color: "#3d494d", lineHeight: "32.5px", margin: 0 },
  techRight: { position: "relative" },
  imgCard: { background: "#dee3e6", borderRadius: 12, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", height: 320 },
  techImg: { width: "100%", height: "141.25%", objectFit: "cover", marginTop: "-20.63%", mixBlendMode: "multiply", opacity: 0.9, display: "block" },
  chip: {
    position: "absolute", bottom: -24, left: -24,
    display: "flex", alignItems: "center", gap: 16,
    padding: 17, borderRadius: 12,
    backdropFilter: "blur(10px)",
    background: "rgba(245,250,253,0.7)",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
  },
  chipDot: { width: 40, height: 40, borderRadius: "50%", background: "#00a8cc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipLabel: { fontSize: 12, fontWeight: 700, color: "#00677e", letterSpacing: "1.2px", textTransform: "uppercase", margin: 0, lineHeight: "16px" },
  chipValue: { fontSize: 16, fontWeight: 700, color: "#171c1f", margin: 0 },
};
