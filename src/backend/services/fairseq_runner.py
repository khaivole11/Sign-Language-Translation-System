import numpy as np
import tempfile
import subprocess
import sys
from pathlib import Path
from configs.config import settings
import sentencepiece as spm

try:
    import truecase
except ImportError:
    truecase = None

def build_dummy_tsv(input_npy: Path) -> tuple[Path, Path]:
    feat = np.load(str(input_npy))
    frames_length = feat.shape[0]

    # Đảm bảo target data dir có tồn tại
    base_data_dir = Path(settings.TEMP_DATA_DIR)
    base_data_dir.mkdir(parents=True, exist_ok=True)
    
    # Sinh folder tạm để các lượt Request song song không bị đè file
    temp_dir = Path(tempfile.mkdtemp(prefix="infer_", dir=base_data_dir))
    tsv_path = temp_dir / "dummy.tsv"
    # Use generic linux path separators to avoid windows TSV escaping weirdness
    rel_path = str(input_npy.resolve()).replace("\\", "/")

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
        "--results-path", str(temp_dir),
        "--task", "sign_to_text",
        "--max-source-positions", "10000",
        "--min-source-positions", "1",
        "--gen-subset", "dummy",
        "--num-workers", "0",
        "--batch-size", "1",
        "--max-tokens", "1000000",
        "--required-batch-size-multiple", "1",
        "--beam", str(settings.BEAM_SIZE),
        "--nbest", "1",
        "--lenpen", "1.0",
        "--max-len-b", "300",
        "--bpe", "sentencepiece",
        "--sentencepiece-model", str(Path(settings.VOCAB_MODEL_PATH).resolve()),
    ]
    
    import os
    env = os.environ.copy()
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    fairseq_dir = base_dir / "fairseq"
    env['PYTHONPATH'] = str(fairseq_dir) + os.pathsep + env.get('PYTHONPATH', '')

    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        if "ZeroDivisionError: division by zero" in result.stderr:
            pass # Ignore timer resolution crash on Windows
        else:
            raise RuntimeError(f"Fairseq lỗi: {result.stderr}")
            
    output_txt = temp_dir / "generate-dummy.txt"
    if output_txt.exists():
        return output_txt.read_text(encoding="utf-8")
        
    return result.stdout

def parse_best_translation(stdout_text: str) -> str:
    best_score_d = float("-inf")
    best_text_d = ""
    best_score_h = float("-inf")
    best_tokens_h = ""

    for line in stdout_text.splitlines():
        if line.startswith("D-"):
            parts = line.split("\t")
            if len(parts) >= 3:
                try:
                    score = float(parts[1])
                except ValueError:
                    score = float("-inf")
                text = parts[2].strip()
                if score > best_score_d:
                    best_score_d = score
                    best_text_d = text
        elif line.startswith("H-"):
            parts = line.split("\t")
            if len(parts) >= 3:
                try:
                    score = float(parts[1])
                except ValueError:
                    score = float("-inf")
                tokens = parts[2].strip()
                if score > best_score_h:
                    best_score_h = score
                    best_tokens_h = tokens

    if best_text_d:
        return best_text_d

    if not best_tokens_h:
        return ""

    vocab_model = Path(settings.VOCAB_MODEL_PATH).resolve()
    sp = spm.SentencePieceProcessor(model_file=str(vocab_model))
    tokens = best_tokens_h.split()
    try:
        token_ids = [int(x) for x in tokens]
        text = sp.decode(token_ids)
    except ValueError:
        text = sp.decode_pieces(tokens)

    if truecase is None:
        return text
        
    try:
        return truecase.get_true_case(text)
    except LookupError:
        return text