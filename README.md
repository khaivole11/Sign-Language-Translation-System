# Sign Language Translation System

## Overview
This project aims to build an **end-to-end Sign Language Translation (SLT) system** that converts sign language videos into natural language text.

The system processes input videos through multiple stages including:
- Video preprocessing
- Feature extraction (I3D)
- Sequence-to-text translation (Transformer/Fairseq)
- Post-processing with language models (Agentic refinement)

---

## System Architecture

The pipeline is designed as a modular architecture:

```
Video Input
↓
Video Preprocessing
↓
Feature Extraction (I3D)
↓
Translation Model (Transformer / Fairseq)
↓
Detokenization (SentencePiece)
↓
AI Agent Refinement
↓
Final Natural Language Output
```
## Project Structure

```
project-root/
├── app.py                # File khởi chạy giao diện chính (Streamlit/FastAPI entry point)
├── requirements.txt      # Danh sách các thư viện cần cài đặt (torch, fairseq, opencv...)
├── README.md             # Tài liệu hướng dẫn dự án
│
├── src/                  # Mã nguồn chính của ứng dụng
│   ├── api/              # Định nghĩa các Endpoints nếu dùng FastAPI/NodeJS
│   │   └── routes.py     # Điều hướng luồng xử lý từ Request
│   │
│   ├── pipeline/         # Điều phối toàn bộ flow
│   │   └── slt_pipeline.py
│   │
│   ├── services/         # Logic nghiệp vụ chính
│   │   ├── video_service.py # Xử lý video
│   │   ├── feature_ext.py# Trích xuất đặc trưng không gian-thời gian (I3D)
│   │   ├── translator.py # Chạy inference mô hình Fairseq (Transformer)
│   │   ├── detokenizer.py# Giải mã token sang text (SentencePiece)
│   │   ├── postprocess_vi.py # Xử lý text sau khi giải mã
│   │   └── agentic_ref.py# AI Agent tối ưu câu văn (Gemini/LangChain)
│   │
│   ├── vision/           # Logic xử lý thị giác chuyên sâu
│   │   ├── processor.py  # Cắt, resize, lấy FPS
│   │   ├── transforms.py # Normalize (chuẩn hóa 0-1), Tensor conversion
│   │   └── visualizer.py # Vẽ landmarks để debug xem I3D "nhìn" gì
│   │ 
│   ├── core/             # Các lớp định nghĩa mô hình (Model Architectures)
│   │   ├── i3d_model.py  # Cấu trúc mạng I3D
│   │   └── s2t_transformer.py # Cấu trúc mạng Fairseq S2T
│   │
│   └── utils/            # Các hàm tiện ích
│       ├── logger.py     # Ghi log quá trình xử lý để debug
│       └── helpers.py    # Các hàm xử lý file, chuẩn hóa định dạng tensor
│
├── data/                
│   ├── raw/              # Video gốc người dùng tải lên (tạm thời)
│   ├── processed/        # Các file .npy (features) sau khi trích xuất
│   └── samples/          # Video mẫu để test nhanh
│
├── models/               # Lưu trữ trọng số (Weights/Checkpoints)
│   ├── i3d/              # Trọng số của mô hình I3D (.pt)
│   ├── fairseq/          # File checkpoint.best... (.pt)
│   └── sentencepiece/    # File .model và .vocab của SentencePiece
│
├── config/               # Chứa các file cấu hình (.yaml hoặc .json)
│   ├── model_config.yaml # Tham số cho I3D, Transformer (layers, heads...)
│   ├── pipeline_config.yaml # Tham số cho pipeline
│   └── agent_config.py   # System prompt cho AI Agent
│
├── tests/                # Chứa các file unit test cho từng module
└── assets/               # Hình ảnh, logo dùng cho giao diện Web/README
```