-- ============================================================
-- FluxSpace Scan Pipeline – Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. TABLES ───────────────────────────────────────────────────

-- Scans table – one row per uploaded run folder / zip
CREATE TABLE IF NOT EXISTS scans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'uploaded'
                CHECK (status IN ('uploaded','processing','done','failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Scan artifacts – pointers to files in Supabase Storage
CREATE TABLE IF NOT EXISTS scan_artifacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id     uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  kind        text NOT NULL
                CHECK (kind IN (
                  'mesh_ply',
                  'trajectory_csv',
                  'mag_world_csv',
                  'volume_npz',
                  'screenshot_png',
                  'outputs_zip',
                  'extrinsics_json'
                )),
  storage_path text NOT NULL,  -- path inside the runs-outputs bucket
  size_bytes  bigint,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indices for common queries
CREATE INDEX IF NOT EXISTS idx_scans_user      ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_project   ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_scan  ON scan_artifacts(scan_id);

-- Auto-update updated_at on scans
CREATE OR REPLACE FUNCTION update_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scans_updated_at ON scans;
CREATE TRIGGER trg_scans_updated_at
  BEFORE UPDATE ON scans
  FOR EACH ROW
  EXECUTE FUNCTION update_scans_updated_at();


-- 2. ROW LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_artifacts ENABLE ROW LEVEL SECURITY;

-- Scans: users can only see/modify their own rows
CREATE POLICY "Users can view own scans"
  ON scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans"
  ON scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans"
  ON scans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans"
  ON scans FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (backend worker) bypasses RLS automatically.

-- Scan artifacts: access if user owns the parent scan
CREATE POLICY "Users can view own scan artifacts"
  ON scan_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scans WHERE scans.id = scan_artifacts.scan_id
        AND scans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own scan artifacts"
  ON scan_artifacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scans WHERE scans.id = scan_artifacts.scan_id
        AND scans.user_id = auth.uid()
    )
  );


-- 3. STORAGE BUCKETS ─────────────────────────────────────────
-- Run these in the SQL editor OR create via Dashboard → Storage

INSERT INTO storage.buckets (id, name, public)
VALUES ('runs-uploads', 'runs-uploads', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('runs-outputs', 'runs-outputs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload/download their own files
-- Paths follow pattern: <user_id>/<scan_id>/...

-- runs-uploads: user can upload & read own files
CREATE POLICY "Users upload own runs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'runs-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own uploads"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'runs-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- runs-outputs: user can read own outputs (backend writes via service role)
CREATE POLICY "Users read own outputs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'runs-outputs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can write to runs-outputs (no policy needed – service role bypasses RLS)
