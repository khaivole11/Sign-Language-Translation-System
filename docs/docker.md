# Docker quickstart

Use this flow when sharing the project with another machine.

## 1. Prepare environment

Copy the example file:

```powershell
Copy-Item .env.example .env
```

Fill these values in `.env` if you want Supabase feedback storage:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
SUPABASE_FEEDBACK_TABLE=feedback_samples
SUPABASE_STORAGE_BUCKET=feedback-features
```

Keep API keys only in `.env`. The Docker build ignores real `.env` files so secrets are not baked into the image.

## 2. Prepare Supabase

Run `docs/feedback_supabase.sql` in Supabase SQL Editor.

Create a private Storage bucket named:

```text
feedback-features
```

Feedback text is stored in `public.feedback_samples`.
Feature files are stored under `feedback-features/features/*.npy`.

## 3. Prepare model files

Make sure these files exist on the host:

```text
models/i3d/model.pth.tar
models/fairseq/baseline_6_3_dp03_wd/ckpts/checkpoint_best.pt
models/vocab/cvpr23.train.how2sign.unigram7000_lowercased.model
```

The compose file mounts `./models` read-only into the backend container.

## 4. Start

```powershell
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Backend health:

```text
http://localhost:8000/
```

If the machine has NVIDIA Container Toolkit and you want to expose the GPU:

```powershell
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## 5. Check feedback storage

After submitting feedback, run:

```powershell
Invoke-RestMethod "http://localhost:8000/api/feedback?limit=1" | ConvertTo-Json -Depth 6
```

`"storage_backend": "supabase"` means feedback is being read from Supabase.
`"storage_backend": "local"` means Supabase env is missing and feedback is in `data/feedback`.

## 6. Useful commands

Rebuild cleanly:

```powershell
docker compose build --no-cache
docker compose up
```

View backend logs:

```powershell
docker compose logs -f backend
```

Stop:

```powershell
docker compose down
```
