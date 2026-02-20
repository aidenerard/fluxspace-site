-- FluxSpace: add viewer asset path columns to runs table
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
--
-- These columns store the Storage object keys for viewer assets.
-- The API can also compute them deterministically from runId,
-- so these serve as an audit trail / override mechanism.

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS viewer_surface_path text;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS viewer_heatmap_path text;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS viewer_manifest_path text;

-- Ensure error_message exists (should from 002)
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS error_message text;

-- Create the runs-viewer storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('runs-viewer', 'runs-viewer', false)
ON CONFLICT (id) DO NOTHING;

-- Service-role writes bypass RLS. Users read their own viewer objects.
CREATE POLICY "Users read own viewer objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'runs-viewer'
    AND (storage.foldername(name))[1] = 'runs'
  );
