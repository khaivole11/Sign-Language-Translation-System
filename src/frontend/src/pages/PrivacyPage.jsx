import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";

const styles = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5fafd", fontFamily: "'Manrope', sans-serif" },
  main: { flex: 1, maxWidth: 1280, margin: "0 auto", width: "100%", padding: "40px 24px 80px", boxSizing: "border-box" },
  backRow: { marginBottom: 40 },
  backBtn: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#00677e", textDecoration: "none", padding: "8px 16px", borderRadius: 9999, border: "1.5px solid #bfe9fa", background: "white" },
  hero: { textAlign: "center", marginBottom: 32 },
  legalLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", color: "#00a8cc", textTransform: "uppercase" },
  title: { fontSize: 56, fontWeight: 800, color: "#171c1f", margin: "12px 0 16px", letterSpacing: "-1px" },
  subtitle: { fontSize: 16, color: "#7a9099", lineHeight: "26px" },
  progressLine: { height: 4, background: "#dee3e6", borderRadius: 9999, marginBottom: 60, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #00677e, #00a8cc)", borderRadius: 9999 },
  sections: { display: "flex", flexDirection: "column", gap: 64, maxWidth: 896, margin: "0 auto" },
  sectionRow: { display: "grid", gridTemplateColumns: "245px 1fr", gap: 32, alignItems: "start" },
  sectionLabel: { display: "flex", alignItems: "center", gap: 12, paddingTop: 2 },
  labelIcon: { display: "flex" },
  labelText: { fontSize: 16, fontWeight: 700, color: "#3d494d" },
  sectionContent: { fontSize: 15, color: "#3d494d", lineHeight: "26px" },
  card: { background: "white", border: "1px solid #e2eaed", borderRadius: 10, padding: "28px 32px", marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 700, color: "#171c1f", margin: "0 0 12px" },
  cardDesc: { margin: 0, fontSize: 15, lineHeight: "24px", color: "#3d494d" },
  storageItem: { display: "flex", alignItems: "flex-start", gap: 20, background: "white", border: "1px solid #e2eaed", borderRadius: 10, padding: "20px 24px" },
  storageIcon: { width: 40, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  storageTitle: { fontSize: 16, fontWeight: 700, color: "#171c1f", margin: "0 0 6px" },
  storageDesc: { margin: 0, fontSize: 14, color: "#3d494d", lineHeight: "22px" },
  rightsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  rightCard: { background: "white", border: "1px solid #e2eaed", borderRadius: 10, padding: "28px 28px" },
  rightTitle: { fontSize: 16, fontWeight: 700, color: "#171c1f", margin: "0 0 8px" },
  rightDesc: { margin: 0, fontSize: 14, color: "#3d494d", lineHeight: "22px" },
};

const sections = [
  {
    id: "intro",
    icon: <InfoIcon />,
    heading: "Introduction",
    content: (
      <p>
        Welcome to Ethereal Interpreter. This Privacy Policy describes how we handle the visual
        and auditory data processed during your sign language translation sessions. Our goal is to
        provide a weightless, secure bridge between communities without compromising your personal
        digital footprint.
      </p>
    ),
  },
  {
    id: "collection",
    icon: <VideoIcon />,
    heading: "Data Collection",
    content: (
      <>
        <Card title="Video & Audio Streams">
          To facilitate real-time translation, we access your device camera and microphone. This
          stream is processed locally where possible or transmitted via secure, encrypted channels
          to our inference engines.
        </Card>
        <Card title="Gesture Metadata">
          We collect anonymized coordinate data of hand positions and facial movements to improve
          our spatial recognition accuracy across various lighting conditions and skin tones.
        </Card>
      </>
    ),
  },
  {
    id: "ai",
    icon: <AiIcon />,
    heading: "AI Analysis",
    content: (
      <p>
        Our AI models analyze video frames in real-time. We use <strong>Ephemeral Processing</strong>,
        meaning your raw video frames are discarded immediately after the translation is generated.
        We do not store raw footage of your private conversations unless you explicitly opt into our
        "Community Growth" program to help train the model.
      </p>
    ),
  },
  {
    id: "storage",
    icon: <StorageIcon />,
    heading: "Data Storage",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <StorageItem icon={<ShieldIcon />} title="Encrypted Vesting">
          Any stored account information is encrypted using AES-256 standards.
        </StorageItem>
        <StorageItem icon={<GlobeIcon />} title="Regional Sovereignty">
          Data is stored in servers operated within your primary region in accordance with
          applicable privacy laws.
        </StorageItem>
      </div>
    ),
  },
  {
    id: "rights",
    icon: <UserIcon />,
    heading: "User Rights",
    content: (
      <div style={styles.rightsGrid}>
        {[
          { title: "Right to Access", desc: "Request a copy of all data we have associated with your profile." },
          { title: "Right to Erasure", desc: "Request the permanent deletion of your account and historical logs." },
          { title: "Data Portability", desc: "Export your dictionary and saved translations in a machine-readable format." },
          { title: "Opt-Out", desc: "Withdraw consent for AI training data contribution at any time." },
        ].map((r) => (
          <div key={r.title} style={styles.rightCard}>
            <p style={styles.rightTitle}>{r.title}</p>
            <p style={styles.rightDesc}>{r.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div style={styles.page}>
      <Header showBack />

      <main style={styles.main}>
        {/* Back button */}
        <div style={styles.backRow}>
          <Link to="/" style={styles.backBtn}>
            <ArrowIcon /> Trang chủ
          </Link>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          <span style={styles.legalLabel}>LEGAL DOCUMENTATION</span>
          <h1 style={styles.title}>Privacy Policy</h1>
          <p style={styles.subtitle}>
            Last updated: October 24, 2024. Your privacy is as important as your
            communication.
          </p>
        </div>

        {/* Progress line */}
        <div style={styles.progressLine}>
          <div style={{ ...styles.progressFill, width: "33%" }} />
        </div>

        {/* Sections */}
        <div style={styles.sections}>
          {sections.map((s) => (
            <div key={s.id} style={styles.sectionRow}>
              {/* Left label */}
              <div style={styles.sectionLabel}>
                <span style={styles.labelIcon}>{s.icon}</span>
                <span style={styles.labelText}>{s.heading}</span>
              </div>
              {/* Right content */}
              <div style={styles.sectionContent}>{s.content}</div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={styles.card}>
      <p style={styles.cardTitle}>{title}</p>
      <p style={styles.cardDesc}>{children}</p>
    </div>
  );
}

function StorageItem({ icon, title, children }) {
  return (
    <div style={styles.storageItem}>
      <div style={styles.storageIcon}>{icon}</div>
      <div>
        <p style={styles.storageTitle}>{title}</p>
        <p style={styles.storageDesc}>{children}</p>
      </div>
    </div>
  );
}

/* Icons */
function InfoIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/></svg>; }
function VideoIcon() { return <svg width="20" height="16" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="15" height="18" rx="2"/><path d="M17 8l5-3v14l-5-3"/></svg>; }
function AiIcon() { return <svg width="19" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3"/><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3"/></svg>; }
function StorageIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>; }
function UserIcon() { return <svg width="18" height="19" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function ShieldIcon() { return <svg width="16" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function GlobeIcon() { return <svg width="22" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>; }
function ArrowIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }
