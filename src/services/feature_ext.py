# src/services/feature_ext.py

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import torch
from tqdm.auto import tqdm

# Cho phép chạy trực tiếp:
# python src/services/feature_ext.py ...
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from src.vision.processor import (
    build_clip_indices,
    clip_to_tensor,
    list_video_files,
    preprocess_frames,
    read_video_frames,
)

TensorOrder = Literal["CTHW", "TCHW"]
SaveDType = Literal["fp16", "fp32"]


def ensure_dir(path: str | Path) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def get_device(device_arg: Optional[str] = None) -> str:
    if device_arg:
        return device_arg
    return "cuda" if torch.cuda.is_available() else "cpu"


def clean_state_dict(sd: dict) -> dict:
    out = {}
    for k, v in sd.items():
        if k.startswith("module."):
            k = k[7:]
        out[k] = v
    return out


def remove_logits_keys(sd: dict) -> dict:
    return {k: v for k, v in sd.items() if not k.startswith("logits.")}


def load_i3d_backbone(
    weight_path: str | Path,
    device: str = "cpu",
    use_half: bool = False,
):
    """
    Load I3D backbone đúng theo notebook của bạn:
    - InceptionI3d(400, in_channels=3)
    - bỏ logits.*
    - strict=False
    """
    try:
        from core.pytorch_i3d import InceptionI3d
    except ImportError as e:
        raise ImportError(
            "Không import được pytorch_i3d.InceptionI3d. "
            "Bạn cần clone/cài pytorch-i3d và thêm vào PYTHONPATH."
        ) from e

    model = InceptionI3d(400, in_channels=3)

    ckpt = torch.load(str(weight_path), map_location=device)
    if isinstance(ckpt, dict) and "state_dict" in ckpt:
        sd = ckpt["state_dict"]
    else:
        sd = ckpt

    sd = clean_state_dict(sd)
    sd = remove_logits_keys(sd)

    missing, unexpected = model.load_state_dict(sd, strict=False)

    print("Loaded I3D backbone with strict=False")
    print("Missing keys:", missing)
    print("Unexpected keys:", unexpected)

    model = model.to(device).eval()
    if use_half and device.startswith("cuda"):
        model = model.half()

    return model


def make_output_path(
    video_path: str | Path,
    input_root: str | Path,
    output_root: str | Path,
    suffix: str = ".npy",
) -> Path:
    video_path = Path(video_path)
    input_root = Path(input_root)
    output_root = Path(output_root)

    if input_root.is_file():
        return output_root / f"{video_path.stem}{suffix}"

    rel = video_path.relative_to(input_root)
    return (output_root / rel).with_suffix(suffix)


def tensor_order_to_cthw(order: TensorOrder, clip_tensor: torch.Tensor) -> torch.Tensor:
    """
    Chuẩn hóa clip tensor về [C,T,H,W] để stack thành [B,C,T,H,W]

    Input:
      - CTHW: [C,T,H,W]
      - TCHW: [T,C,H,W]
    Output:
      - [C,T,H,W]
    """
    if order == "CTHW":
        return clip_tensor
    if order == "TCHW":
        return clip_tensor.permute(1, 0, 2, 3).contiguous()
    raise ValueError(f"tensor_order không hợp lệ: {order}")


@torch.no_grad()
def extract_i3d_sequence(
    video_path: str | Path,
    model,
    save_path: str | Path | None = None,
    window: int = 16,
    stride: int = 8,
    target_fps: Optional[float] = 25.0,
    resize: tuple[int, int] = (224, 224),
    batch_size_clips: int = 8,
    device: str = "cpu",
    use_half: bool = False,
    tensor_order: TensorOrder = "CTHW",
    save_dtype: SaveDType = "fp32",
) -> tuple[np.ndarray, dict]:
    """
    Extract I3D feature cho 1 video, bám sát notebook của bạn.

    Flow:
    - read_video_frames
    - preprocess_frames (fps/resize)
    - build_clip_indices
    - clip_to_tensor
    - stack batch [B,C,T,H,W]
    - model.extract_features(batch)
    - mean spatial, mean temporal
    - save .npy

    Output:
        features: [N_clips, 1024]
        meta: dict
    """
    if batch_size_clips <= 0:
        raise ValueError("batch_size_clips phải > 0")

    start_time = time.perf_counter()

    frames, src_fps = read_video_frames(video_path)
    frames, fps = preprocess_frames(
        frames=frames,
        src_fps=src_fps,
        target_fps=target_fps,
        size=resize,
        normalize=False,
    )

    num_frames = len(frames)
    duration = float(num_frames / fps) if fps and fps > 0 else 0.0

    clip_indices = build_clip_indices(num_frames, window=window, stride=stride)
    all_features = []

    for i in tqdm(range(0, len(clip_indices), batch_size_clips), desc="Extracting I3D"):
        batch_ids = clip_indices[i:i + batch_size_clips]
        batch_tensors = []

        for ids in batch_ids:
            clip = frames[ids]  # [T,H,W,C]

            x = clip_to_tensor(
                clip_frames=clip,
                resize=None,              # đã resize trước đó rồi
                output_order=tensor_order,
                use_half=use_half,
                already_normalized=False, # processor sẽ scale [-1,1] trong clip_to_tensor
            )

            x = tensor_order_to_cthw(tensor_order, x)  # -> [C,T,H,W]
            batch_tensors.append(x)

        batch = torch.stack(batch_tensors, dim=0).to(device)  # [B,C,T,H,W]

        if use_half and device.startswith("cuda"):
            batch = batch.half()
        else:
            batch = batch.float()

        # giống notebook của bạn
        feat = model.extract_features(batch)   # [B,1024,t',h',w']
        if feat.ndim != 5:
            raise ValueError(
                f"extract_features phải trả tensor 5 chiều, nhận được shape={tuple(feat.shape)}"
            )

        feat = feat.mean(dim=[3, 4])           # [B,1024,t']
        feat = feat.mean(dim=2)                # [B,1024]

        all_features.append(feat.detach().cpu())

    if not all_features:
        raise ValueError(f"Không extract được feature từ video: {video_path}")

    features_t = torch.cat(all_features, dim=0)

    if save_dtype == "fp16":
        features = features_t.numpy().astype(np.float16)
    else:
        features = features_t.numpy().astype(np.float32)

    if save_path is not None:
        save_path = Path(save_path)
        ensure_dir(save_path.parent)
        np.save(str(save_path), features)

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    meta = {
        "video_path": str(video_path),
        "fps": float(fps),
        "num_frames": int(num_frames),
        "duration": float(duration),
        "num_clips": int(len(clip_indices)),
        "feature_shape": tuple(features.shape),
        "dtype": str(features.dtype),
        "extract_ms": float(elapsed_ms),
        "window": int(window),
        "stride": int(stride),
        "resize": tuple(resize),
        "tensor_order": tensor_order,
    }

    return features, meta


def build_feature_metadata(
    sample_id: str,
    signs_file: str | Path,
    duration: float,
    fps: float,
    num_frames: int,
    feature_shape: tuple[int, ...],
    dtype: str,
) -> dict:
    return {
        "id": sample_id,
        "signs_file": str(signs_file),
        "duration": round(float(duration), 6),
        "fps": round(float(fps), 6),
        "num_frames": int(num_frames),
        "feature_shape": "x".join(map(str, feature_shape)),
        "dtype": dtype,
    }


def append_tsv_row(tsv_path: str | Path, row: dict) -> None:
    tsv_path = Path(tsv_path)
    ensure_dir(tsv_path.parent)

    fieldnames = [
        "id",
        "signs_file",
        "duration",
        "fps",
        "num_frames",
        "feature_shape",
        "dtype",
    ]

    write_header = not tsv_path.exists() or tsv_path.stat().st_size == 0

    with open(tsv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t")
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def process_one_video(
    video_path: str | Path,
    input_root: str | Path,
    output_root: str | Path,
    model,
    tsv_path: str | Path | None = None,
    window: int = 16,
    stride: int = 8,
    target_fps: Optional[float] = 25.0,
    resize: tuple[int, int] = (224, 224),
    batch_size_clips: int = 8,
    device: str = "cpu",
    use_half: bool = False,
    tensor_order: TensorOrder = "CTHW",
    save_dtype: SaveDType = "fp32",
) -> tuple[Path, dict]:
    save_path = make_output_path(
        video_path=video_path,
        input_root=input_root,
        output_root=output_root,
        suffix=".npy",
    )
    ensure_dir(save_path.parent)

    features, meta = extract_i3d_sequence(
        video_path=video_path,
        model=model,
        save_path=save_path,
        window=window,
        stride=stride,
        target_fps=target_fps,
        resize=resize,
        batch_size_clips=batch_size_clips,
        device=device,
        use_half=use_half,
        tensor_order=tensor_order,
        save_dtype=save_dtype,
    )

    row = build_feature_metadata(
        sample_id=Path(video_path).stem,
        signs_file=save_path,
        duration=meta["duration"],
        fps=meta["fps"],
        num_frames=meta["num_frames"],
        feature_shape=features.shape,
        dtype=str(features.dtype),
    )

    if tsv_path is not None:
        append_tsv_row(tsv_path, row)

    return save_path, row


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract I3D features (.npy) and metadata (.tsv)")
    parser.add_argument("--input", type=str, required=True, help="Input video file hoặc thư mục")
    parser.add_argument("--model", type=str, required=True, help="Path model I3D, ví dụ model.pth.tar")
    parser.add_argument("--output", type=str, required=True, help="Thư mục lưu .npy")
    parser.add_argument("--tsv", type=str, required=True, help="File .tsv metadata")

    parser.add_argument("--fps", type=float, default=25.0, help="Target FPS")
    parser.add_argument("--size", type=int, default=224, help="Resize thành size x size")
    parser.add_argument("--window", type=int, default=16, help="Số frame mỗi clip")
    parser.add_argument("--stride", type=int, default=8, help="Stride giữa các clip")
    parser.add_argument("--batch-size-clips", type=int, default=8, help="Số clip mỗi batch")

    parser.add_argument(
        "--tensor-order",
        type=str,
        default="CTHW",
        choices=["CTHW", "TCHW"],
        help="Shape clip trước khi chuẩn hóa vào batch I3D",
    )
    parser.add_argument(
        "--save-dtype",
        type=str,
        default="fp32",
        choices=["fp16", "fp32"],
        help="dtype khi lưu .npy",
    )
    parser.add_argument(
        "--use-half",
        action="store_true",
        help="Dùng fp16 khi inference model trên GPU",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help='Ví dụ: "cpu", "cuda", "cuda:0"',
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_path = Path(args.input)
    output_root = Path(args.output)
    tsv_path = Path(args.tsv)

    ensure_dir(output_root)
    ensure_dir(tsv_path.parent)

    device = get_device(args.device)
    resize = (args.size, args.size)

    print(f"Using device: {device}")
    print(f"Model path: {args.model}")

    model = load_i3d_backbone(
        weight_path=args.model,
        device=device,
        use_half=args.use_half,
    )

    video_files = list_video_files(input_path)
    if not video_files:
        raise ValueError(f"Không tìm thấy video nào trong: {input_path}")

    print(f"Found {len(video_files)} video(s)")

    success = 0
    failed = 0

    for video_file in video_files:
        try:
            save_path, row = process_one_video(
                video_path=video_file,
                input_root=input_path,
                output_root=output_root,
                model=model,
                tsv_path=tsv_path,
                window=args.window,
                stride=args.stride,
                target_fps=args.fps,
                resize=resize,
                batch_size_clips=args.batch_size_clips,
                device=device,
                use_half=args.use_half,
                tensor_order=args.tensor_order,
                save_dtype=args.save_dtype,
            )
            success += 1
            print(
                f"[OK] {video_file.name} -> {save_path} | "
                f"shape={row['feature_shape']} dtype={row['dtype']}"
            )
        except Exception as e:
            failed += 1
            print(f"[ERROR] {video_file}: {e}")

    print("-" * 80)
    print(f"Done. Success={success}, Failed={failed}")
    print(f"TSV: {tsv_path}")
    print(f"Output root: {output_root}")


if __name__ == "__main__":
    main()