import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.divider} />
      <div style={styles.inner}>
        <span style={styles.copy}>© 2024 Ethereal Interpreter. All rights reserved.</span>
        <div style={styles.links}>
          <Link to="/privacy" style={styles.link}>Privacy Policy</Link>
          <Link to="/terms" style={styles.link}>Terms of Service</Link>
          <Link to="/contact" style={styles.link}>Contact</Link>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    width: "100%",
    marginTop: "auto",
  },
  divider: {
    height: 1,
    background: "#e2eaed",
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "48px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: {
    fontSize: 14,
    color: "#7a9099",
    fontFamily: "'Manrope', sans-serif",
  },
  links: {
    display: "flex",
    gap: 32,
  },
  link: {
    fontSize: 14,
    color: "#7a9099",
    textDecoration: "none",
    fontFamily: "'Manrope', sans-serif",
    transition: "color 0.15s",
  },
};
