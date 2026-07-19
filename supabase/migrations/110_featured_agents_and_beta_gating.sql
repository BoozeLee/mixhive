-- 110_featured_agents_and_beta_gating.sql
-- Adds featured flag to agent marketplace + beta invite code system.

-- ─────────────────────────────────────────────
-- 1. Featured agents
-- ─────────────────────────────────────────────
ALTER TABLE lua_agent_packages
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_lua_agent_packages_featured
  ON lua_agent_packages (featured DESC, avg_rating DESC)
  WHERE featured = true AND status = 'published';

-- Update list_agent_packages RPC to include featured and sort by it first.
-- Drop and recreate because PostgreSQL doesn't support ALTER FUNCTION for body changes.
DROP FUNCTION IF EXISTS list_agent_packages(text, text, boolean, numeric, int, int);

CREATE OR REPLACE FUNCTION list_agent_packages(
  p_category text DEFAULT NULL,
  p_discipline text DEFAULT NULL,
  p_free_only boolean DEFAULT false,
  p_min_rating numeric DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  tagline text,
  category text,
  discipline_focus text[],
  complexity text,
  price numeric,
  license text,
  capabilities text[],
  tools_used text[],
  install_count int,
  avg_rating numeric,
  rating_count int,
  official boolean,
  verified boolean,
  featured boolean,
  creator_profile_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id, p.name, p.tagline, p.category, p.discipline_focus,
    p.complexity, p.price, p.license, p.capabilities, p.tools_used,
    p.install_count, p.avg_rating, p.rating_count,
    p.official, p.verified, p.featured, p.creator_profile_id
  FROM lua_agent_packages p
  WHERE p.status = 'published'
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_discipline IS NULL OR p_discipline = ANY(p.discipline_focus))
    AND (NOT p_free_only OR p.price = 0)
    AND (p_min_rating IS NULL OR p.avg_rating >= p_min_rating)
  ORDER BY p.featured DESC, p.official DESC, p.avg_rating DESC, p.install_count DESC
  LIMIT greatest(1, least(p_limit, 50))
  OFFSET greatest(0, p_offset);
$$;

-- Mark all published starter-tier agents as featured (official = true implies starter).
UPDATE lua_agent_packages SET featured = true WHERE official = true AND status = 'published';

-- ─────────────────────────────────────────────
-- 2. Beta invite codes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beta_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  email text,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);

ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;

-- Anyone can validate a code (read-only); only admin can insert.
CREATE POLICY "Public can read beta invites for validation"
  ON beta_invites FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can redeem their own code"
  ON beta_invites FOR UPDATE
  USING (auth.uid() = redeemed_by OR redeemed_by IS NULL)
  WITH CHECK (auth.uid() = redeemed_by);

-- RPC to redeem a code atomically.
CREATE OR REPLACE FUNCTION redeem_beta_invite(p_code text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE beta_invites
  SET redeemed_by = auth.uid(), redeemed_at = now()
  WHERE code = p_code
    AND redeemed_by IS NULL
    AND (email IS NULL OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
