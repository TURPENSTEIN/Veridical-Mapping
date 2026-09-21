/*
# Create cognitive training schema for Veridical Mapping Trainer

1. New Tables
- `sessions`: Records each training session (calibration, mode_a, mode_b)
  - id, mode, started_at, completed_at, total_trials, correct_trials, avg_reaction_time_ms, difficulty_level, axis_errors (jsonb)
- `trials`: Records individual trial results within a session
  - id, session_id (FK), trial_number, axis_name, stimulus_a (jsonb), stimulus_b (jsonb), user_response, correct, reaction_time_ms, error_margin, created_at

2. Security
- Enable RLS on both tables.
- Single-tenant (no auth): allow anon + authenticated full CRUD since data is intentionally public/shared.
- Session deletion cascades to child trials.

3. Notes
- No user_id column — this is a single-tenant cognitive training tool with no sign-in.
- axis_errors stores per-axis error rates as JSONB for flexible per-axis analytics.
- stimulus_a/stimulus_b store the full normalized parameter vectors as JSONB.
*/

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('calibration', 'mode_a', 'mode_b')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  total_trials int NOT NULL DEFAULT 0,
  correct_trials int NOT NULL DEFAULT 0,
  avg_reaction_time_ms numeric,
  difficulty_level numeric NOT NULL DEFAULT 0.5,
  axis_errors jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sessions" ON sessions;
CREATE POLICY "anon_select_sessions" ON sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;
CREATE POLICY "anon_update_sessions" ON sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sessions" ON sessions;
CREATE POLICY "anon_delete_sessions" ON sessions FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  trial_number int NOT NULL,
  axis_name text,
  stimulus_a jsonb NOT NULL DEFAULT '{}'::jsonb,
  stimulus_b jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_response text,
  correct boolean,
  reaction_time_ms int,
  error_margin numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trials" ON trials;
CREATE POLICY "anon_select_trials" ON trials FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trials" ON trials;
CREATE POLICY "anon_insert_trials" ON trials FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trials" ON trials;
CREATE POLICY "anon_update_trials" ON trials FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trials" ON trials;
CREATE POLICY "anon_delete_trials" ON trials FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_trials_session_id ON trials(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(mode);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
