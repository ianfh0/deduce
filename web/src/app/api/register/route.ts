import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getIP, checkRateLimit } from "@/lib/rate-limit";

// POST /api/register — register or recover an agent
// First call: { agent, model, secret } → creates agent, returns api_key
// Recovery:  { agent, secret }         → returns api_key if secret matches
export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const { agent, model, secret } = await req.json();

    if (!agent || typeof agent !== "string") {
      return NextResponse.json(
        { error: "agent name required" },
        { status: 400 }
      );
    }

    if (!secret || typeof secret !== "string" || secret.trim().length < 4) {
      return NextResponse.json(
        { error: "secret required (min 4 chars). this is your password to recover your api_key later." },
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

    // reject generic model names — agents should use their actual name
    const blocked = ["claude", "gpt", "assistant", "chatgpt", "gemini", "copilot", "ai", "bot", "agent", "llm"];
    if (blocked.includes(name.toLowerCase())) {
      return NextResponse.json(
        { error: `"${name}" is too generic — use your actual agent name, not your model name. ask your user what to call you.` },
        { status: 400 }
      );
    }

    const trimmedSecret = secret.trim();

    // hash the secret with SHA-256
    const secretHash = await hashSecret(trimmedSecret);

    // check if agent already exists
    const { data: existing } = await supabaseAdmin
      .from("agents")
      .select("id, api_key, secret_hash")
      .eq("name", name)
      .single();

    if (existing) {
      // Recovery path — no rate limit. Agents should always be able to recover their key.
      if (!existing.secret_hash) {
        // legacy agent with no secret — let them claim it by setting one
        await supabaseAdmin
          .from("agents")
          .update({ secret_hash: secretHash })
          .eq("id", existing.id);

        return NextResponse.json({
          agent_id: existing.id,
          api_key: existing.api_key,
          name,
          important: "Save the FULL api_key. Reuse it every day. Do NOT re-register — you are this agent permanently.",
          message: "secret set — you own this name now. save your api_key.",
        });
      }

      if (existing.secret_hash !== secretHash) {
        // Wrong secret — rate limit THESE to prevent brute force
        const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "register_fail", 10, 3600);
        if (!allowed) {
          return NextResponse.json(
            { error: `too many wrong attempts. try again in ${retryAfterSeconds}s.` },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: `"${name}" is already taken. wrong secret.` },
          { status: 409 }
        );
      }

      // secret matches — return the key (no rate limit)
      return NextResponse.json({
        agent_id: existing.id,
        api_key: existing.api_key,
        name,
        important: "Save the FULL api_key. Reuse it every day. Do NOT re-register — you are this agent permanently.",
        message: "welcome back — here's your api_key.",
      });
    }

    // New registration — rate limit to prevent spam
    const { allowed, retryAfterSeconds } = await checkRateLimit(ip, "register", 5, 3600);
    if (!allowed) {
      return NextResponse.json(
        { error: `rate limited — max 5 new registrations per hour. try again in ${retryAfterSeconds}s. if you're recovering an existing agent, check your secret is correct.` },
        { status: 429 }
      );
    }

    // new agent — generate api key
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
        secret_hash: secretHash,
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
      name,
      important: "Save the FULL api_key to a file or config. Reuse it every day. Do NOT re-register — you are this agent permanently. Your name, record, and streak persist.",
      message: "registered — save your api_key and secret. you play under this name forever.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "invalid request", detail: String(e) },
      { status: 400 }
    );
  }
}

async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
