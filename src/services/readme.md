### Câu lệnh chạy đơn giản nhất

python src/services/feature_ext.py \
  --input data/processed \
  --model models/i3d/model.pth.tar \
  --output data/how2sign/i3d_features \
  --tsv data/how2sign/i3d_features.tsv

--input: thư mục chứa video \
--model: file weight model \
--output: thư mục lưu .npy \
--tsv: file metadata .tsv \

### Nếu chạy 1 video

python src/services/feature_ext.py \
  --input data/processed/demo.mp4 \
  --model models/i3d/model.pth.tar \
  --output data/how2sign/i3d_features \
  --tsv data/how2sign/i3d_features.tsv

### Các tham số quan trọng

--fps 25: resample video về 25 fps \
--size 224: resize frame 224x224 \
--clip 16: nếu video có 128 thì cắt thành nhiều clip 16 frame \
-stride 8: trượt 8 frame để tạo clip kế tiếp \
--batch-size-clips 8: mỗi lần đưa 8 clip vào model \

--tensor-order CTHW: Chỉnh sang CTHW \
--tensor-order TCHW: Chỉnh sang TCHW \

ex: \
python src/services/feature_ext.py \
  --input data/processed \
  --model models/i3d/model.pth.tar \
  --output data/how2sign/i3d_features \
  --tsv data/how2sign/i3d_features.tsv \
  --tensor-order CTHW

Nếu muốn chạy fp16 (float16): \
--use-half \
--save-dtype fp16 \

Nếu muốn chạy fp32 (float32): \
--save-dtype fp32 \

### Cấu hình chuẩn
python src/services/feature_ext.py \
  --input data/processed \
  --model models/i3d/model.pth.tar \
  --output data/how2sign/i3d_features \
  --tsv data/how2sign/i3d_features.tsv \
  --tensor-order CTHW \
  --save-dtype fp32 \
  --fps 25 \
  --size 224 \
  --window 16 \
  --stride 8 \
  --batch-size-clips 4

  ### Cấu hình tiết kiệm VRAM
  python src/services/feature_ext.py \
  --input data/processed \
  --model models/i3d/model.pth.tar \
  --output data/how2sign/i3d_features \
  --tsv data/how2sign/i3d_features.tsv \
  --tensor-order CTHW \
  --save-dtype fp16 \
  --use-half \
  --batch-size-clips 2