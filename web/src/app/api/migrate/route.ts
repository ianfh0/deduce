import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// POST /api/migrate — run schema migration (one-time, secret-protected)
// This exists because we can't run raw SQL via REST API
// and local supabase CLI isn't installed
export async function POST(req: NextRequest) {
  const { secret } = await req.json();

  // simple protection — not meant to be bulletproof, just prevent accidental calls
  if (secret !== process.env.SUPABASE_SERVICE_KEY?.slice(-10)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // We can't run DDL via PostgREST, so we'll create tables by attempting
    // operations and checking what exists. Instead, let's test if tables exist
    // and give clear instructions.

    // Check targets table
    const { error: targetsErr } = await supabaseAdmin
      .from("targets")
      .select("id")
      .limit(1);

    if (targetsErr?.code === "PGRST205") {
      results.push("targets table: MISSING — needs manual creation in Supabase SQL Editor");
    } else {
      results.push("targets table: EXISTS");
    }

    // Check attempts table
    const { error: attemptsErr } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .limit(1);

    if (attemptsErr?.code === "PGRST205") {
      results.push("attempts table: MISSING — needs manual creation in Supabase SQL Editor");
    } else {
      results.push("attempts table: EXISTS");
    }

    // Check agents.api_key column
    const { data: agentTest, error: agentErr } = await supabaseAdmin
      .from("agents")
      .select("api_key")
      .limit(1);

    if (agentErr) {
      results.push(`agents.api_key column: ERROR — ${agentErr.message}`);
    } else {
      results.push("agents.api_key column: EXISTS");
    }

    return NextResponse.json({
      status: results,
      sql_to_run: SQL_MIGRATION,
      instructions:
        "Copy the sql_to_run value and paste it into the Supabase SQL Editor at https://supabase.com/dashboard → your project → SQL Editor → New query",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

const SQL_MIGRATION = `
-- deduce v2: crack the ai
-- paste this into Supabase SQL Editor

-- 1. Create targets table
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day integer UNIQUE NOT NULL,
  date text NOT NULL,
  briefing text NOT NULL,
  defender_prompt text NOT NULL,
  defender_model text NOT NULL DEFAULT 'claude-haiku-4-5-20251001' -- display as "haiku",
  flag text NOT NULL,
  vulnerability_type text,
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create attempts table
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

-- 3. Add new columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key text UNIQUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS games_played integer DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS games_cracked integer DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS best_turns integer;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS streak integer DEFAULT 0;

-- 4. Generate api keys for existing agents that don't have one
UPDATE agents SET api_key = 'dk_' || encode(gen_random_bytes(24), 'hex')
WHERE api_key IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_targets_day ON targets(day);
CREATE INDEX IF NOT EXISTS idx_attempts_target ON attempts(target_id);
CREATE INDEX IF NOT EXISTS idx_attempts_agent ON attempts(agent_id);
CREATE INDEX IF NOT EXISTS idx_attempts_cracked ON attempts(cracked);
CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
`;
