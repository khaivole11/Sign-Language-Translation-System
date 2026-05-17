-- Supabase schema for user feedback used by continual-learning review/export.
-- Keep SUPABASE_FEEDBACK_TABLE=feedback_samples unless you rename this table.

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

create index if not exists feedback_samples_request_id_idx
  on public.feedback_samples (request_id);

create index if not exists feedback_samples_review_status_idx
  on public.feedback_samples (review_status, created_at desc);

create index if not exists feedback_samples_training_idx
  on public.feedback_samples (used_for_training, review_status, created_at desc);

-- Create a private Storage bucket named feedback-features in the Supabase dashboard,
-- or keep this insert if your project allows direct storage schema writes.
insert into storage.buckets (id, name, public)
values ('feedback-features', 'feedback-features', false)
on conflict (id) do nothing;
