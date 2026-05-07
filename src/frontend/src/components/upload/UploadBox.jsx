import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MAX_UPLOAD_MB, validateVideoFile } from "../../config/appConfig";

export default function UploadBox() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [rejectMessage, setRejectMessage] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFile = (f) => {
    if (!f) return;
    setRejectMessage(null);
    const v = validateVideoFile(f);
    if (!v.ok) {
      setRejectMessage(v.message);
      setFile(null);
      return;
    }
    setFile(f);
    setTimeout(() => navigate("/processing", { state: { file: f, fileName: f.name } }), 500);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      style={{ ...styles.zone, ...(dragging ? styles.zoneDrag : {}) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Decorative blobs */}
      <div style={styles.blobTR} />
      <div style={styles.blobBL} />

      <div style={styles.content}>
        {/* Icon */}
        <div style={styles.iconBg}>
          <VideoIcon />
        </div>

        {/* Text */}
        <div style={styles.texts}>
          <p style={styles.title}>{file ? file.name : "Drag and drop your video"}</p>
          <p style={styles.sub}>
            {rejectMessage ? (
              <span style={{ color: "#b91c1c" }}>{rejectMessage}</span>
            ) : file ? (
              `${(file.size / 1024 / 1024).toFixed(2)} MB — preparing...`
            ) : (
              `MP4, MOV or AVI — max ${MAX_UPLOAD_MB} MB`
            )}
          </p>
        </div>

        {/* Button */}
        <button style={styles.btn} onClick={() => fileInputRef.current?.click()}>
          <div style={styles.btnShadow} />
          <PlusIcon />
          <span style={styles.btnText}>Select File</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}

function VideoIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3d494d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="15" height="18" rx="2" />
      <path d="M17 8l5-3v14l-5-3" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const styles = {
  zone: {
    position: "relative",
    width: "100%",
    maxWidth: 768,
    background: "#eff4f7",
    border: "2px dashed #bcc8ce",
    borderRadius: 12,
    padding: "50px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    transition: "border-color 0.2s, background 0.2s",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  zoneDrag: {
    borderColor: "#00a8cc",
    background: "#e0f5fb",
  },
  blobTR: {
    position: "absolute",
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: "50%",
    background: "rgba(0,168,204,0.1)",
    filter: "blur(32px)",
    pointerEvents: "none",
  },
  blobBL: {
    position: "absolute",
    bottom: -96,
    left: -96,
    width: 256,
    height: 256,
    borderRadius: "50%",
    background: "rgba(191,233,250,0.2)",
    filter: "blur(32px)",
    pointerEvents: "none",
  },
  content: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 32,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "#eaeff1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#171c1f",
    margin: 0,
    textAlign: "center",
    lineHeight: "32px",
    fontFamily: "'Manrope', sans-serif",
  },
  sub: {
    fontSize: 16,
    fontWeight: 400,
    color: "#3d494d",
    margin: 0,
    textAlign: "center",
    lineHeight: "24px",
    fontFamily: "'Manrope', sans-serif",
  },
  btn: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 40px",
    borderRadius: 9999,
    border: "none",
    background: "linear-gradient(134deg, #00677e 0%, #00a8cc 100%)",
    cursor: "pointer",
    boxShadow: "0 10px 15px -3px rgba(0,103,126,0.2), 0 4px 6px -4px rgba(0,103,126,0.2)",
    transition: "transform 0.15s, box-shadow 0.15s",
    fontFamily: "'Manrope', sans-serif",
  },
  btnShadow: {
    position: "absolute",
    inset: 0,
    borderRadius: 9999,
  },
  btnText: {
    fontSize: 18,
    fontWeight: 700,
    color: "white",
    lineHeight: "28px",
  },
};
