import { useLocation } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ProcessingScreen from "../components/processing/ProcessingScreen";

export default function ProcessingPage() {
  const location = useLocation();
  const file = location.state?.file ?? null;
  const fileName = location.state?.fileName || file?.name || "video.mp4";

  return (
    <div style={styles.page}>
      <Header />
      <main style={styles.main}>
        <ProcessingScreen file={file} fileName={fileName} />
      </main>
      <Footer />
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5fafd", fontFamily: "'Manrope', sans-serif" },
  main: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
};
