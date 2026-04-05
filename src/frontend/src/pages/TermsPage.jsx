import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";

const terms = [
  {
    num: "01",
    icon: <ShieldIcon />,
    title: "Acceptance of Terms",
    content: "By accessing or using the Ethereal Interpreter services, you confirm your agreement to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the services. This interface is designed to facilitate communication through sign language interpretation technology, and your use implies consent to our digital processing methods.",
  },
  {
    num: "02",
    icon: <UserIcon />,
    title: "User Responsibilities",
    content: "Users are responsible for ensuring clear visual input for accurate gesture recognition. You agree not to:",
    list: [
      "Use the service for any unlawful or deceptive purposes.",
      "Attempt to reverse-engineer the translation algorithms.",
      "Circumvent any technical safety measures enforced by the platform.",
    ],
  },
  {
    num: "03",
    icon: <CopyIcon />,
    title: "Intellectual Property",
    content: "The \"Ethereal Interpreter\" brand, logos, software, and proprietary translation models are the exclusive property of our organization. Users are granted a limited, non-exclusive, non-transferable license to use the service for personal or professional communication purposes as intended by the interface. No weightless assets or code may be replicated without prior written consent.",
  },
  {
    num: "04",
    icon: <AlertIcon />,
    title: "Limitation of Quality",
    content: "While we strive for fluid and perfect interpretation, the service is provided \"as is.\" Ethereal Interpreter shall not be liable for any indirect, incidental, or consequential damages resulting from translation inaccuracies. This is especially critical in medical, legal, or high-stakes environments where human interpreters are recommended as a secondary verification.",
  },
  {
    num: "05",
    icon: <XIcon />,
    title: "Termination",
    content: "We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the fluid workspace will cease immediately.",
  },
];

export default function TermsPage() {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

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
          <h1 style={styles.title}>
            Terms of <span style={styles.accent}>Service</span>
          </h1>
          <p style={styles.subtitle}>
            Please read these terms carefully before using our fluid translation ecosystem.
            By using Ethereal Interpreter, you agree to these conditions.
          </p>
        </div>

        {/* Sections */}
        <div style={styles.sections}>
          {terms.map((t) => (
            <div key={t.num} style={styles.section}>
              <span style={styles.sectionNum}>{t.num}</span>
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionIcon}>{t.icon}</span>
                  <h3 style={styles.sectionTitle}>{t.title}</h3>
                </div>
                <p style={styles.sectionBody}>{t.content}</p>
                {t.list && (
                  <ul style={styles.list}>
                    {t.list.map((item, i) => (
                      <li key={i} style={styles.listItem}>
                        <CircleIcon />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Acceptance CTA */}
        <div style={styles.cta}>
          <div style={styles.ctaInner}>
            <h3 style={styles.ctaTitle}>Acknowledge & Continue</h3>
            <p style={styles.ctaDesc}>
              By clicking below, you acknowledge that you have read and understood the terms above.
            </p>
            <div style={styles.ctaButtons}>
              <button
                style={styles.acceptBtn}
                onClick={() => { setAccepted(true); navigate("/"); }}
              >
                I Accept These Terms
              </button>
              <button style={styles.declineBtn} onClick={() => navigate(-1)}>
                Decline
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* Icons */
function ShieldIcon() { return <svg width="16" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function UserIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function CopyIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>; }
function AlertIcon() { return <svg width="18" height="19" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/></svg>; }
function XIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>; }
function CircleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00a8cc" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>; }
function ArrowIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }

const styles = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5fafd", fontFamily: "'Manrope', sans-serif" },
  main: { flex: 1, maxWidth: 1280, margin: "0 auto", width: "100%", padding: "40px 24px 80px", boxSizing: "border-box" },
  backRow: { marginBottom: 40 },
  backBtn: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#00677e", textDecoration: "none", padding: "8px 16px", borderRadius: 9999, border: "1.5px solid #bfe9fa", background: "white" },
  hero: { textAlign: "center", marginBottom: 64 },
  title: { fontSize: 56, fontWeight: 800, color: "#171c1f", margin: "0 0 16px", letterSpacing: "-1px" },
  accent: { color: "#00a8cc" },
  subtitle: { fontSize: 16, color: "#7a9099", lineHeight: "26px", maxWidth: 600, margin: "0 auto" },
  sections: { display: "flex", flexDirection: "column", gap: 32, maxWidth: 900, margin: "0 auto 64px" },
  section: { position: "relative", display: "flex", gap: 0 },
  sectionNum: { position: "absolute", left: -56, top: -8, fontSize: 80, fontWeight: 800, color: "#e2eaed", lineHeight: 1, userSelect: "none" },
  sectionCard: { flex: 1, background: "white", border: "1px solid #e2eaed", borderRadius: 12, padding: "36px 40px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  sectionHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionIcon: { display: "flex" },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "#171c1f", margin: 0 },
  sectionBody: { fontSize: 15, color: "#3d494d", lineHeight: "26px", margin: 0 },
  list: { listStyle: "none", padding: 0, margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 12 },
  listItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#3d494d" },
  cta: {
    maxWidth: 650, margin: "0 auto", width: "100%",
    background: "white",
    border: "2px solid #00677e",
    borderRadius: 16,
    padding: 4,
    boxSizing: "border-box",
  },
  ctaInner: { background: "white", borderRadius: 12, padding: "40px", textAlign: "center" },
  ctaTitle: { fontSize: 22, fontWeight: 700, color: "#171c1f", margin: "0 0 12px" },
  ctaDesc: { fontSize: 15, color: "#7a9099", lineHeight: "24px", margin: "0 0 28px" },
  ctaButtons: { display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" },
  acceptBtn: {
    padding: "16px 40px", borderRadius: 9999, border: "none",
    background: "linear-gradient(134deg, #00677e, #00a8cc)",
    color: "white", fontSize: 16, fontWeight: 700,
    cursor: "pointer", fontFamily: "'Manrope', sans-serif",
    boxShadow: "0 8px 20px rgba(0,103,126,0.25)",
  },
  declineBtn: {
    padding: "16px 40px", borderRadius: 9999,
    border: "1.5px solid #dee3e6", background: "white",
    color: "#3d494d", fontSize: 16, fontWeight: 600,
    cursor: "pointer", fontFamily: "'Manrope', sans-serif",
  },
};
