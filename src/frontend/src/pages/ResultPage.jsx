import { useLocation } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ResultScreen from "../components/result/ResultScreen";

export default function ResultPage() {
  const location = useLocation();
  const result = location.state?.result || null;
  const previewUrl = location.state?.previewUrl || null;

  const videoUrl = location.state?.videoUrl || null;

  return (
    <div style={styles.page}>
      <Header />
      <main style={styles.main}>
        <ResultScreen result={result} previewUrl={previewUrl} videoUrl={videoUrl} />
      </main>
      <Footer />
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5fafd", fontFamily: "'Manrope', sans-serif" },
  main: { flex: 1 },
};
