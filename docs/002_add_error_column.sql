-- FluxSpace: Add `error` column to public.runs
-- The Python worker writes processing errors to `runs.error`.
-- The web app uses `error_message` for trigger-level errors.
-- Both columns coexist: `error_message` (set by web app) and
-- `error` (set by worker). Run in Supabase SQL Editor.

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS error text;

COMMENT ON COLUMN public.runs.error IS
  'Processing error written by the Python worker (fluxspace-core)';
COMMENT ON COLUMN public.runs.error_message IS
  'Trigger/upload error written by the Next.js web application';
