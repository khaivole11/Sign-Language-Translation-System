# Sign Language Translation System

## Project Structure

- **Backend**: FastAPI server running on port 8000 (`src/main.py`)
- **Frontend**: React application running on port 3000 (`src/frontend/`)
- **models/**: Contains I3D feature extractor and Fairseq models.
- **configs/**: Environment configurations and variables.

---

## 1. Environment setup

### Prerequisites
- Python 3.10
- Node.js 18+ and npm 10+

### Installation Steps

1. **Install backend dependencies:**
   ```powershell
   python -m pip install -r requirements.txt
   python -m pip install -r src/backend/requirements.txt
   ```

2. **Install Fairseq model (Editable mode):**
   ```powershell
   pip install --editable ./fairseq
   ```

3. **Install frontend dependencies:**
   ```powershell
   cd src/frontend
   npm install
   ```

4. **Model Setup:**
   The model weight checkpoints (I3D and Fairseq S2T) are managed using DVC. Refer to the [Model Weights Downloader Guide (models/README.md)](models/README.md) for detailed instructions on how to configure credentials and pull them automatically.


### Configuration

**Backend Config (`configs/.env`):**
Use forward slashes (`/`) to avoid escape character issues in Windows paths.
```env
PROJECT_NAME="SLT Inference API"
API_VERSION="v1"
MODEL_CHECKPOINT_PATH="models/fairseq/baseline_6_3_dp03_wd/ckpts/checkpoint_best.pt"
VOCAB_MODEL_PATH="models/vocab/cvpr23.train.how2sign.unigram7000_lowercased.model"
BEAM_SIZE=5
MAX_TOKENS=1600
TEMP_DATA_DIR="data"
```

**API & Multilingual Config (`src/backend/.env`):**
Configure your LLM providers (Gemini, OpenAI, DeepL) and Supabase database.
```env
API_FEATURE_URL=http://localhost:8001/features
API_TRANSLATE_URL=http://localhost:8002/translate
MAX_UPLOAD_MB=50
TIMEOUT_SEC=60

# Multilingual agent options
MULTILINGUAL_AGENT_ENABLED=true
MULTILINGUAL_TARGET_LANGUAGES=en,de,ja,vi

# LLM Providers
GEMINI_API_KEY=
GEMINI_PROJECT_ID=
GEMINI_MODEL_ID=gemini-2.5-flash-lite
GEMINI_API_MODE=vertex

OPENAI_API_KEY=
OPENAI_TRANSLATION_MODEL=gpt-4o-mini
DEEPL_API_KEY=
DEEPL_API_URL=https://api-free.deepl.com/v2/translate

# Supabase Feedback Logging
FEEDBACK_STORAGE_MODE=auto
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_FEEDBACK_TABLE=feedback_samples
```

**Database Initialization (Optional):**
To enable human-in-the-loop feedback, run the provided SQL table creation script in your Supabase SQL editor:
```sql
create table if not exists public.feedback_samples (
  id uuid primary key,
  request_id text not null,
  original_filename text,
  npy_path text not null,
  raw_translation text,
  refined_translation text,
  user_label text not null,
  rating integer check (rating is null or rating between 1 and 5),
  comment text,
  model_version text,
  review_status text not null default 'pending',
  used_for_training boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.feedback_samples (request_id);
```

---

## 2. How to train the model (External Repositories)

> **Important Note:** The training pipelines are **not** included in this inference repository. Training is handled in separate external repositories. This current repository is strictly designed for **inference and deployment**.

### 2.1. Training the I3D Feature Extractor
We further fine-tuned the pretrained I3D model on the How2Sign dataset for domain adaptation in continuous sign language translation.  
The complete training notebook is available on Kaggle:

🔗 https://www.kaggle.com/code/minhkhoathi/finetune-i3d-with-how2sign

### 2.2. Training the Fairseq Sequence-to-Sequence Model
Training the translation module is handled in the external repository: [WMT2023 Sign Language Translation Baseline (Merterm/wmt2023_slt)](https://github.com/Merterm/wmt2023_slt).

If you need to replicate the Fairseq training process, follow these general steps:

**Step 1: Environment Preparation (External Repo)**
In the external training project, ensure your Python environment is activated and you have at least one GPU available. Define the following variables in its `.env` file:
```env
DATA_DIR=path/to/i3d/features/folders
CONFIG_DIR=path/to/fairseq/config/directory
NUM_GPUS=1
```

**Step 2: Training Execution**
The external repository uses a task-runner and YAML configs. Select your config (e.g., `baseline_6_3_dp03_wd_2`) and run:
```bash
export EXPERIMENT=baseline_6_3_dp03_wd_2
task train_slt
```

**Step 3: Exporting the Model for Inference**
Once training and evaluation (`task generate`) are complete in the external repository, locate the best checkpoint file (e.g., `checkpoint_best.pt`) and the vocabulary model. **Copy these files into the `models/` folder of THIS inference repository** and update your `.env` paths to deploy them.

---

## 3. How to run inference

### Option A: Using Docker (Recommended)
You can easily spin up the entire system (both Backend API and Frontend UI) using Docker Compose. This ensures all dependencies and environments are securely isolated.

1. Ensure Docker and Docker Compose are installed on your machine.
2. From the root of the project, run:
   ```bash
   docker-compose up --build
   ```
- **Backend API:** `http://localhost:8000`
- **Frontend UI:** `http://localhost:3000`

### Option B: Running Locally

**Step 1: Start the Backend**
Open a terminal and start the Uvicorn server:
```powershell
python -m uvicorn src.backend.main:app --reload --host 0.0.0.0 --port 8000
```
- **Health Check:** `http://localhost:8000/`
- **Swagger API Docs:** `http://localhost:8000/docs`

**Step 2: Start the Frontend**
Open a new terminal and run the React application:
```powershell
cd src/frontend
npm start
```
The UI will open at `http://localhost:3000`. 
**Inference Flow:** The frontend uploads video via `POST /api/translate`, receives the source text, and then calls `POST /api/multilingual-agent` to generate translations in other target languages.

---

## 4. Basic logging or experiment tracking

> *(Note: Experiment tracking applies to the external training repository, not this inference API).*

The external training project utilizes **Weights & Biases (WandB)** for seamless, cloud-based experiment tracking during the training phase.

**To enable logging during training:**
1. Update the `.env` file in the **external training repository** with your specific WandB credentials:
   ```env
   WANDB_ENTITY=your_team_or_user_name
   WANDB_PROJECT=your_project_name
   ```
2. When you execute `task train_slt` in that repository, the training process will automatically authenticate and begin syncing data.
3. You can monitor training loss, learning rates, validation scores (such as BLEU/rBLEU), and hardware utilization (GPU usage/memory) in real-time directly on your WandB web dashboard.
