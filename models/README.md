# Model Weights Downloader Guide (Sign Language Translation Models)

This directory contains the model weights and files required for running the inference pipeline:
- **I3D Feature Extractor** (spatial-temporal video feature extraction)
- **Fairseq S2T Transformer** (sequence-to-sequence translation)
- **SentencePiece Vocab** (decoding vocabulary model)

Because these model checkpoint files are large, they are stored and managed using **DVC (Data Version Control)** integrated with **DagsHub Storage** to keep the Git repository lightweight.

---

## How to Retrieve Model Weights Locally

When cloning this repository for the first time, this directory will only contain this instructions file. Follow the steps below to configure your environment and download the actual weight files:

### 1. Install DVC
Make sure you have DVC installed along with its S3/HTTPS storage support extension:
```bash
pip install "dvc[s3]"
```

### 2. Configure DagsHub DVC Remote and Credentials
Run the following commands in the root directory of the project to set up the remote storage and authenticate with DagsHub:
```bash
# Add/verify DagsHub as the default remote (already initialized in project config)
dvc remote add -d origin https://dagshub.com/khaivole11/slt.dvc --force

# Configure authentication credentials
dvc remote modify origin auth basic
dvc remote modify origin user khaivole11
dvc remote modify origin password 3c1734a1e299517442e8a44a9da68cba4e278a91
```

### 3. Pull the Weights
After setting up the credentials, download the correct model checkpoints matching the current version of the code:
```bash
dvc pull
```
This will place the weights in this folder automatically and reconstruct the correct folder structure.

---

*Note for developers:* When adding or updating models, run `dvc add models` to track the changes, push them using `dvc push`, and commit the updated `models.dvc` file to Git.
