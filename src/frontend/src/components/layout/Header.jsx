import { Link } from "react-router-dom";

export default function Header({ showBack = false }) {
  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        {/* Logo */}
        <Link to="/" style={styles.logo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00677e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          <div style={styles.logoBorder}>
            <span style={styles.logoText}>Ethereal Interpreter</span>
          </div>
        </Link>

        {/* Center title (optional for sub-pages) */}
        {showBack && (
          <div style={styles.centerTitle}>
            <span style={styles.centerTitleText}>Ethereal Interpreter</span>
          </div>
        )}

        {/* User icon */}
        <button style={styles.userBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3d494d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>
      <div style={styles.divider} />
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "#f5fafd",
    width: "100%",
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "0 32px",
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
  },
  logoBorder: {
    borderLeft: "1px solid #bcc8ce",
    paddingLeft: 17,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: "#00677e",
    fontFamily: "'Manrope', sans-serif",
    letterSpacing: "-0.3px",
  },
  centerTitle: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
  },
  centerTitleText: {
    fontSize: 20,
    fontWeight: 700,
    color: "#171c1f",
    fontFamily: "'Manrope', sans-serif",
  },
  userBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1.5px solid #bcc8ce",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    background: "#e2eaed",
  },
};
