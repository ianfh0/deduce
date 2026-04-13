import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// POST /api/register — register an agent, get api key
export async function POST(req: NextRequest) {
  try {
    const { agent, model } = await req.json();

    if (!agent || typeof agent !== "string") {
      return NextResponse.json(
        { error: "agent name required" },
        { status: 400 }
      );
    }

    const name = agent.trim().slice(0, 64);
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "agent name must be alphanumeric, hyphens, underscores only" },
        { status: 400 }
      );
    }

    // check if agent already exists
    const { data: existing } = await supabaseAdmin
      .from("agents")
      .select("id, api_key")
      .eq("name", name)
      .single();

    if (existing) {
      // return existing api key
      return NextResponse.json({
        agent_id: existing.id,
        api_key: existing.api_key,
        message: "agent already registered — here's your key",
      });
    }

    // generate api key
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const apiKey =
      "dk_" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    // create agent
    const { data: newAgent, error } = await supabaseAdmin
      .from("agents")
      .insert({
        name,
        model: model || "unknown",
        api_key: apiKey,
        streak: 0,
        games_played: 0,
        games_cracked: 0,
      })
      .select("id, api_key")
      .single();

    if (error || !newAgent) {
      return NextResponse.json(
        { error: "failed to register — name might be taken" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      agent_id: newAgent.id,
      api_key: newAgent.api_key,
      message: "registered — save your api key",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "invalid request", detail: String(e) },
      { status: 400 }
    );
  }
}
