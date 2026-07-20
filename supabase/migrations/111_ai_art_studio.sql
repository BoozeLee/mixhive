-- 111_ai_art_studio.sql
-- AI Art Studio: generation history table for the /studio/art feature.

CREATE TABLE IF NOT EXISTS ai_art_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  negative_prompt text DEFAULT '',
  style text DEFAULT 'cyber-hive',
  aspect_ratio text DEFAULT '1:1',
  denoising_strength numeric DEFAULT 0.75,
  reference_urls text[] DEFAULT '{}',
  result_url text,
  model text DEFAULT 'stabilityai/stable-diffusion-xl-base-1.0',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_art_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own generations"
  ON ai_art_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own generations"
  ON ai_art_generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own generations"
  ON ai_art_generations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete own generations"
  ON ai_art_generations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_art_generations_user
  ON ai_art_generations (user_id, created_at DESC);
