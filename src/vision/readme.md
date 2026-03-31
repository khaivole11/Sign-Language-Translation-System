## Cách sử dụng processor.py

### Preprocess cả thư mục
python src/vision/processor.py \
  --input data/raw \
  --output data/processed \
  --fps 25 \
  --size 224

### Preprocess 1 file
python src/vision/processor.py \
  --input data/raw/demo.mp4 \
  --output data/processed/demo.mp4 \
  --fps 25 \
  --size 224