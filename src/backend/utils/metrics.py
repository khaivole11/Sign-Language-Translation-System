import re
import sacrebleu
from pathlib import Path

def load_blacklist(blacklist_path):
    if not Path(blacklist_path).exists():
        return set()
    with open(blacklist_path, 'r', encoding='utf-8') as f:
        return set(line.strip().lower() for line in f if line.strip())

def clean_text(text):
    # Loại bỏ dấu câu cơ bản và chuyển về lowercase để so khớp blacklist
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return text

def calculate_rbleu(generate_txt_path, blacklist_path):
    """
    Parse file generate.txt của Fairseq và tính rBLEU (Reduced BLEU).
    """
    if not Path(generate_txt_path).exists():
        print(f"Error: File {generate_txt_path} not found.")
        return None

    blacklist = load_blacklist(blacklist_path)
    
    hyps = []
    refs = []
    
    curr_hyp = None
    curr_ref = None
    
    with open(generate_txt_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('H-'):
                parts = line.strip().split('\t')
                if len(parts) >= 3:
                    curr_hyp = parts[2]
            elif line.startswith('T-'):
                parts = line.strip().split('\t')
                if len(parts) >= 2:
                    curr_ref = parts[1]
            
            # Khi có đủ cặp H và T, thực hiện xử lý
            if curr_hyp is not None and curr_ref is not None:
                # 1. Clean và Tokenize
                h_tokens = clean_text(curr_hyp).split()
                r_tokens = clean_text(curr_ref).split()
                
                # 2. Filter blacklist
                h_reduced = " ".join([t for t in h_tokens if t not in blacklist])
                r_reduced = " ".join([t for t in r_tokens if t not in blacklist])
                
                # Chỉ thêm nếu sau khi lọc vẫn còn chữ (tránh câu rỗng gây lỗi sacrebleu)
                if r_reduced.strip():
                    hyps.append(h_reduced)
                    refs.append([r_reduced])
                
                curr_hyp = None
                curr_ref = None

    if not hyps:
        return 0.0

    # Tính toán BLEU bằng sacrebleu
    bleu = sacrebleu.corpus_bleu(hyps, refs)
    return bleu.score

if __name__ == "__main__":
    # Test logic
    import sys
    if len(sys.argv) > 2:
        score = calculate_rbleu(sys.argv[1], sys.argv[2])
        print(f"rBLEU Score: {score}")
