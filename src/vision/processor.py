# src/vision/processor.py
from __future__ import annotations

import argparse
import math
import os
from pathlib import Path
from typing import Iterable, List, Literal, Optional, Sequence, Tuple

import cv2
import numpy as np
import torch
import torch.nn.functional as F

try:
    from decord import VideoReader, cpu
    _HAS_DECORD = True
except Exception:
    _HAS_DECORD = False


ArrayLike = np.ndarray
TensorOrder = Literal["CTHW", "TCHW"]


VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".mpeg", ".mpg"}


def is_video_file(path: str | Path) -> bool:
    return Path(path).suffix.lower() in VIDEO_EXTENSIONS


def ensure_dir(path: str | Path) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def list_video_files(input_path: str | Path) -> List[Path]:
    input_path = Path(input_path)

    if input_path.is_file():
        if not is_video_file(input_path):
            raise ValueError(f"File không phải video hợp lệ: {input_path}")
        return [input_path]

    if not input_path.exists():
        raise FileNotFoundError(f"Không tìm thấy đường dẫn: {input_path}")

    files = []
    for p in sorted(input_path.rglob("*")):
        if p.is_file() and is_video_file(p):
            files.append(p)

    return files


def get_output_video_path(
    input_file: str | Path,
    input_root: str | Path,
    output_root: str | Path,
    suffix: str = ".mp4",
) -> Path:
    input_file = Path(input_file)
    input_root = Path(input_root)
    output_root = Path(output_root)

    if input_root.is_file():
        out_name = input_file.stem + suffix
        return output_root / out_name

    rel = input_file.relative_to(input_root)
    return (output_root / rel).with_suffix(suffix)


def read_video_frames(video_path: str | Path) -> tuple[np.ndarray, float]:
    """
    Đọc toàn bộ frame từ video.

    Returns:
        frames: np.ndarray, shape [T, H, W, C], dtype uint8
        fps: float
    """
    video_path = str(video_path)

    if _HAS_DECORD:
        vr = VideoReader(video_path, ctx=cpu(0))
        fps = float(vr.get_avg_fps()) if hasattr(vr, "get_avg_fps") else 0.0
        frames = vr.get_batch(range(len(vr))).asnumpy()  # [T,H,W,C], uint8
        if len(frames) == 0:
            raise ValueError(f"Không đọc được frame nào từ video: {video_path}")
        return frames, fps

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Không mở được video: {video_path}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    frames = []

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(frame)

    cap.release()

    if not frames:
        raise ValueError(f"Không đọc được frame nào từ video: {video_path}")

    return np.stack(frames, axis=0), fps


def resample_video_frames(
    frames: np.ndarray,
    src_fps: float,
    target_fps: Optional[float],
) -> tuple[np.ndarray, float]:
    """
    Resample frame theo FPS đích.
    Nếu src_fps không hợp lệ hoặc target_fps=None thì giữ nguyên.
    """
    if target_fps is None or target_fps <= 0:
        return frames, src_fps

    if src_fps is None or src_fps <= 0:
        return frames, target_fps

    if abs(src_fps - target_fps) < 1e-6:
        return frames, src_fps

    num_src = len(frames)
    duration = num_src / src_fps
    num_dst = max(1, int(round(duration * target_fps)))

    indices = np.linspace(0, num_src - 1, num=num_dst)
    indices = np.clip(np.round(indices).astype(np.int64), 0, num_src - 1)

    return frames[indices], float(target_fps)


def resize_frames(
    frames: np.ndarray,
    size: tuple[int, int] = (224, 224),
) -> np.ndarray:
    """
    Resize toàn bộ frames về (H, W) = size
    Input/Output: [T,H,W,C], uint8
    """
    out_h, out_w = size
    resized = [cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_LINEAR) for frame in frames]
    return np.stack(resized, axis=0)


def normalize_frames(frames: np.ndarray) -> np.ndarray:
    """
    Chuẩn hóa uint8 [0,255] -> float32 [-1,1]
    Input: [T,H,W,C]
    Output: [T,H,W,C], float32
    """
    x = frames.astype(np.float32) / 255.0
    x = x * 2.0 - 1.0
    return x


def preprocess_frames(
    frames: np.ndarray,
    src_fps: float,
    target_fps: Optional[float] = 25.0,
    size: tuple[int, int] = (224, 224),
    normalize: bool = False,
) -> tuple[np.ndarray, float]:
    """
    Pipeline preprocess mức frame:
    - resample fps
    - resize
    - optional normalize [-1,1]
    """
    frames, fps = resample_video_frames(frames, src_fps=src_fps, target_fps=target_fps)
    frames = resize_frames(frames, size=size)
    if normalize:
        frames = normalize_frames(frames)
    return frames, fps


def build_clip_indices(
    num_frames: int,
    window: int = 16,
    stride: int = 8,
) -> list[np.ndarray]:
    """
    Trả về list index cho từng clip.
    Nếu video ngắn hơn window thì pad bằng frame cuối.
    """
    if num_frames <= 0:
        raise ValueError("num_frames phải > 0")
    if window <= 0:
        raise ValueError("window phải > 0")
    if stride <= 0:
        raise ValueError("stride phải > 0")

    if num_frames < window:
        idx = np.arange(num_frames, dtype=np.int64)
        pad = np.full(window - num_frames, num_frames - 1, dtype=np.int64)
        idx = np.concatenate([idx, pad])
        return [idx]

    clips = []
    for start in range(0, num_frames - window + 1, stride):
        clips.append(np.arange(start, start + window, dtype=np.int64))

    if clips[-1][-1] != num_frames - 1:
        clips.append(np.arange(num_frames - window, num_frames, dtype=np.int64))

    return clips


def clip_to_tensor(
    clip_frames: np.ndarray,
    resize: Optional[tuple[int, int]] = None,
    output_order: TensorOrder = "CTHW",
    use_half: bool = False,
    already_normalized: bool = False,
) -> torch.Tensor:
    """
    Convert clip [T,H,W,C] -> tensor cho I3D.

    Args:
        clip_frames: np.ndarray [T,H,W,C]
        resize: nếu truyền vào thì resize bằng torch.interpolate
        output_order:
            - 'CTHW' -> [C,T,H,W]
            - 'TCHW' -> [T,C,H,W]
        use_half: output fp16 nếu True
        already_normalized: nếu False thì scale [0,255] -> [-1,1]

    Returns:
        torch.Tensor
    """
    if clip_frames.ndim != 4 or clip_frames.shape[-1] != 3:
        raise ValueError(
            f"clip_frames phải có shape [T,H,W,C], nhận được {clip_frames.shape}"
        )

    x = torch.from_numpy(clip_frames)

    if already_normalized:
        x = x.float()
    else:
        x = x.float() / 255.0
        x = x * 2.0 - 1.0

    # [T,H,W,C] -> [T,C,H,W]
    x = x.permute(0, 3, 1, 2).contiguous()

    if resize is not None:
        x = F.interpolate(x, size=resize, mode="bilinear", align_corners=False)

    if output_order == "CTHW":
        x = x.permute(1, 0, 2, 3).contiguous()
    elif output_order == "TCHW":
        pass
    else:
        raise ValueError(f"output_order không hợp lệ: {output_order}")

    if use_half:
        x = x.half()

    return x


def video_to_clips(
    video_path: str | Path,
    target_fps: Optional[float] = 25.0,
    size: tuple[int, int] = (224, 224),
    window: int = 16,
    stride: int = 8,
    output_order: TensorOrder = "CTHW",
    use_half: bool = False,
) -> tuple[list[torch.Tensor], dict]:
    """
    Đọc 1 video và trả ra list clip tensor.

    Returns:
        clips: list tensor
        meta: dict chứa fps, num_frames, duration, num_clips
    """
    frames, src_fps = read_video_frames(video_path)
    frames, fps = preprocess_frames(
        frames,
        src_fps=src_fps,
        target_fps=target_fps,
        size=size,
        normalize=False,
    )

    clip_indices = build_clip_indices(len(frames), window=window, stride=stride)

    clips = []
    for ids in clip_indices:
        clip = frames[ids]
        x = clip_to_tensor(
            clip,
            resize=None,  # đã resize từ preprocess_frames rồi
            output_order=output_order,
            use_half=use_half,
            already_normalized=False,
        )
        clips.append(x)

    duration = float(len(frames) / fps) if fps and fps > 0 else 0.0

    meta = {
        "video_path": str(video_path),
        "fps": float(fps) if fps else 0.0,
        "num_frames": int(len(frames)),
        "duration": duration,
        "num_clips": int(len(clips)),
        "window": int(window),
        "stride": int(stride),
        "tensor_order": output_order,
    }
    return clips, meta


def save_video_frames_as_mp4(
    frames: np.ndarray,
    output_path: str | Path,
    fps: float,
) -> None:
    """
    Lưu frames [T,H,W,C] uint8 thành .mp4
    """
    output_path = Path(output_path)
    ensure_dir(output_path.parent)

    if frames.dtype != np.uint8:
        frames = np.clip(frames, 0, 255).astype(np.uint8)

    h, w = frames.shape[1], frames.shape[2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps if fps > 0 else 25.0, (w, h))

    if not writer.isOpened():
        raise ValueError(f"Không tạo được file output: {output_path}")

    for frame in frames:
        bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        writer.write(bgr)

    writer.release()


def preprocess_video_file(
    input_path: str | Path,
    output_path: str | Path,
    target_fps: Optional[float] = 25.0,
    size: tuple[int, int] = (224, 224),
) -> dict:
    """
    Dùng cho CLI preprocess:
    đọc video -> resample FPS -> resize -> lưu lại mp4
    """
    frames, src_fps = read_video_frames(input_path)
    src_num_frames = len(frames)
    src_duration = float(src_num_frames / src_fps) if src_fps and src_fps > 0 else 0.0

    frames, new_fps = preprocess_frames(
        frames,
        src_fps=src_fps,
        target_fps=target_fps,
        size=size,
        normalize=False,
    )

    save_video_frames_as_mp4(frames, output_path, fps=new_fps)

    new_num_frames = len(frames)
    new_duration = float(new_num_frames / new_fps) if new_fps and new_fps > 0 else 0.0

    return {
        "input_path": str(input_path),
        "output_path": str(output_path),
        "src_fps": float(src_fps) if src_fps else 0.0,
        "dst_fps": float(new_fps) if new_fps else 0.0,
        "src_num_frames": int(src_num_frames),
        "dst_num_frames": int(new_num_frames),
        "src_duration": src_duration,
        "dst_duration": new_duration,
        "size": list(size),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preprocess video for I3D feature extraction")
    parser.add_argument("--input", type=str, required=True, help="Input video file hoặc thư mục video")
    parser.add_argument("--output", type=str, required=True, help="Output file hoặc thư mục")
    parser.add_argument("--fps", type=float, default=25.0, help="Target FPS")
    parser.add_argument("--size", type=int, default=224, help="Resize về size x size")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    size = (args.size, args.size)

    files = list_video_files(input_path)
    if not files:
        raise ValueError(f"Không tìm thấy video nào trong: {input_path}")

    if input_path.is_file():
        if output_path.suffix.lower() not in VIDEO_EXTENSIONS:
            output_path = output_path.with_suffix(".mp4")

        info = preprocess_video_file(
            input_path=input_path,
            output_path=output_path,
            target_fps=args.fps,
            size=size,
        )
        print(info)
        return

    ensure_dir(output_path)

    for video_file in files:
        out_file = get_output_video_path(
            input_file=video_file,
            input_root=input_path,
            output_root=output_path,
            suffix=".mp4",
        )
        ensure_dir(out_file.parent)

        try:
            info = preprocess_video_file(
                input_path=video_file,
                output_path=out_file,
                target_fps=args.fps,
                size=size,
            )
            print(f"[OK] {video_file} -> {out_file}")
            print(info)
        except Exception as e:
            print(f"[ERROR] {video_file}: {e}")


if __name__ == "__main__":
    main()