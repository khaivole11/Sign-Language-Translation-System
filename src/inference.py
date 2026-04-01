import numpy as np
import tempfile
import subprocess
import sys
from pathlib import Path
from configs.config import settings

def build_dummy_tsv(input_npy: Path) -> tuple[Path, Path]:
    feat = np.load(str(input_npy))
    frames_length = feat.shape[0]

    # Đảm bảo target data dir có tồn tại
    base_data_dir = Path(settings.TEMP_DATA_DIR)
    base_data_dir.mkdir(parents=True, exist_ok=True)
    
    # Sinh folder tạm để các lượt Request song song không bị đè file
    temp_dir = Path(tempfile.mkdtemp(prefix="infer_", dir=base_data_dir))
    tsv_path = temp_dir / "dummy.tsv"
    rel_path = str(input_npy.resolve())

    with tsv_path.open("w", encoding="utf-8") as f:
        f.write("id\tsigns_file\tsigns_offset\tsigns_length\tsigns_type\ttranslation\n")
        f.write(f"dummy_id\t{rel_path}\t0\t{frames_length}\ti3d\t_\n")

    return temp_dir, tsv_path

def generate_translation(temp_dir: Path) -> str:
    # Build subprocess args
    cmd = [
        sys.executable, "-m", "fairseq_cli.generate",
        str(temp_dir),
        "--path", str(Path(settings.MODEL_CHECKPOINT_PATH).resolve()),
        "--task", "sign_to_text",
        "--max-source-positions", "2000",
        "--min-source-positions", "1",
        "--gen-subset", "dummy",
        "--max-tokens", str(settings.MAX_TOKENS),
        "--beam", str(settings.BEAM_SIZE),
        "--bpe", "sentencepiece",
        "--sentencepiece-model", str(Path(settings.VOCAB_MODEL_PATH).resolve()),
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Fairseq lỗi: {result.stderr}")
        
    return result.stdout

def parse_best_translation(stdout_text: str) -> str:
    best_score = float("-inf")
    best_text = ""
    for line in stdout_text.splitlines():
        if not line.startswith("D-"):
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        try:
            score = float(parts[1])
        except ValueError:
            score = float("-inf")
            
        text = parts[2].strip()
        if score > best_score:
            best_score = score
            best_text = text

    return best_text