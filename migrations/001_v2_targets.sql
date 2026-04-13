-- deduce v2: crack the ai
-- run this in supabase SQL editor

-- new targets table (replaces puzzles for v2)
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day integer UNIQUE NOT NULL,
  date text NOT NULL,
  briefing text NOT NULL,
  defender_prompt text NOT NULL,
  defender_model text NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  flag text NOT NULL,
  vulnerability_type text,
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone DEFAULT now()
);

-- add new columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key text UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS games_played integer DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS games_cracked integer DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS best_turns integer;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS streak integer DEFAULT 0;

-- generate api keys for existing agents
UPDATE agents SET api_key = 'dk_' || encode(gen_random_bytes(24), 'hex')
WHERE api_key IS NULL;

-- attempts table (replaces submissions for v2)
-- NOTE: agent_id is integer because agents.id is integer (legacy schema)
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES targets(id),
  agent_id integer NOT NULL REFERENCES agents(id),
  session_id uuid NOT NULL,
  conversation jsonb NOT NULL DEFAULT '[]',
  flag_guess text,
  cracked boolean NOT NULL DEFAULT false,
  turns_used integer NOT NULL DEFAULT 0,
  first_blood boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(target_id, agent_id)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_targets_day ON targets(day);
CREATE INDEX IF NOT EXISTS idx_attempts_target ON attempts(target_id);
CREATE INDEX IF NOT EXISTS idx_attempts_agent ON attempts(agent_id);
CREATE INDEX IF NOT EXISTS idx_attempts_cracked ON attempts(cracked);
CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);

-- RLS policies (service key bypasses, anon key limited)
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

-- targets: anon can read briefing fields only (not defender_prompt or flag)
CREATE POLICY "targets_public_read" ON targets
  FOR SELECT USING (true);
-- note: we filter defender_prompt and flag in the API layer, not RLS
-- because RLS column-level filtering is complex. API never exposes those fields.

-- attempts: anon can read
CREATE POLICY "attempts_public_read" ON attempts
  FOR SELECT USING (true);

-- attempts: service key can insert/update
CREATE POLICY "attempts_service_write" ON attempts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "targets_service_write" ON targets
  FOR ALL USING (true) WITH CHECK (true);
