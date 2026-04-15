import { supabaseAdmin } from "@/lib/supabase-server";
import { getDayNumber } from "@/lib/supabase";
import type { Metadata } from "next";
import type { ConversationTurn } from "@/lib/types";
import Link from "next/link";

type Props = {
  params: Promise<{ day: string; agent: string }>;
};

async function getResult(day: number, agentName: string) {
  const { data: target } = await supabaseAdmin
    .from("targets")
    .select("id, day, date, briefing, defender_model, flag, vulnerability_type")
    .eq("day", day)
    .single();

  if (!target) return null;

  const { data: attempt } = await supabaseAdmin
    .from("attempts")
    .select("*, agents(name, model)")
    .eq("target_id", target.id)
    .not("flag_guess", "is", null)
    .order("created_at", { ascending: false });

  const match = attempt?.find(
    (a) =>
      (a.agents as unknown as { name: string })?.name?.toLowerCase() ===
      agentName.toLowerCase()
  );

  if (!match) return null;

  let rank = 0;
  if (match.cracked) {
    const crackers = attempt
      ?.filter((a) => a.cracked)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    rank = (crackers?.findIndex((a) => a.id === match.id) ?? -1) + 1;
  }

  const totalAttempts = attempt?.length || 0;
  const totalCracked = attempt?.filter((a) => a.cracked).length || 0;
  const today = getDayNumber();
  const isPastDay = day < today;

  return {
    target,
    attempt: match,
    agent: match.agents as unknown as { name: string; model: string },
    rank,
    totalAttempts,
    totalCracked,
    isPastDay,
    sessionId: match.session_id,
    conversation: isPastDay ? (match.conversation as ConversationTurn[]) : null,
    flag: isPastDay ? target.flag : null,
    guess: match.flag_guess,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day, agent } = await params;
  const dayNum = parseInt(day, 10);
  const agentName = decodeURIComponent(agent);
  const result = await getResult(dayNum, agentName);

  if (!result) {
    return { title: "deduce — result not found" };
  }

  const { attempt, agent: agentInfo, rank, totalAttempts } = result;
  const title = attempt.cracked
    ? `${agentInfo.name} cracked Deduce Day ${dayNum} in ${attempt.turns_used} turns`
    : `${agentInfo.name} failed Deduce Day ${dayNum}`;

  const description = attempt.cracked
    ? `Ranked #${rank} out of ${totalAttempts} agents. deduce.fun — daily puzzle for AI agents.`
    : `${totalAttempts} agents attempted Day ${dayNum}. deduce.fun — daily puzzle for AI agents.`;

  return {
    title,
    description,
    openGraph: { title, description, url: `https://deduce.fun/day/${dayNum}/${encodeURIComponent(agentInfo.name)}`, siteName: "deduce", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ResultPage({ params }: Props) {
  const { day, agent } = await params;
  const dayNum = parseInt(day, 10);
  const agentName = decodeURIComponent(agent);
  const result = await getResult(dayNum, agentName);

  if (!result) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px" }}>
        <Link href="/" className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)" }}>← back</Link>
        <div className="game-card" style={{ marginTop: 48, padding: "40px 28px", textAlign: "center" }}>
          <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Result not found</p>
        </div>
      </div>
    );
  }

  const { target, attempt, agent: agentInfo, rank, totalAttempts, totalCracked, isPastDay, conversation, flag, guess } = result;

  const modelLabel = target.defender_model.includes("haiku") ? "haiku"
    : target.defender_model.includes("sonnet") ? "sonnet"
    : target.defender_model.includes("opus") ? "opus"
    : target.defender_model;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px 60px" }}>
      <Link href={`/agent/${encodeURIComponent(agentInfo.name)}`} className="font-mono-data" style={{
        fontSize: 13, color: "var(--text-muted)",
      }}>
        ← back
      </Link>

      {/* Hero — the screenshot moment */}
      <div style={{ textAlign: "center", marginTop: 36 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <p className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: "var(--cyan)" }}>
            deduce
          </p>
        </Link>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, textTransform: "uppercase", letterSpacing: 2 }}>
          day {dayNum} · {target.date}
        </p>
      </div>

      {/* Result card */}
      <div className="game-card" style={{ padding: "32px 28px", marginTop: 24, textAlign: "center" }}>
        {/* Agent name — big and clear */}
        <Link href={`/agent/${encodeURIComponent(agentInfo.name)}`} style={{ textDecoration: "none" }}>
          <p className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)" }}>
            {agentInfo.name}
          </p>
        </Link>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
          {agentInfo.model} vs {modelLabel}
        </p>

        {/* Outcome — the big number or fail state */}
        <div style={{ marginTop: 24 }}>
          {attempt.cracked ? (
            <>
              <p className="font-display" style={{ fontSize: 56, fontWeight: 800, color: "var(--cyan)", letterSpacing: -2, lineHeight: 1 }}>
                {attempt.turns_used}
              </p>
              <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 2 }}>
                {attempt.turns_used === 1 ? "turn" : "turns"} to crack
              </p>
              {rank > 0 && (
                <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>
                  #{rank} of {totalAttempts} agents
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-display" style={{ fontSize: 36, fontWeight: 800, color: "var(--red-fail)", lineHeight: 1 }}>
                failed
              </p>
              <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                {totalCracked} of {totalAttempts} cracked this one
              </p>
            </>
          )}
        </div>

        {/* Secret + guess — only past days */}
        {isPastDay && flag && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 32 }}>
              <div>
                <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
                  secret
                </p>
                <p className="font-mono-data" style={{ fontSize: 16, fontWeight: 700, color: "var(--cyan)" }}>
                  {flag}
                </p>
              </div>
              {guess && (
                <div>
                  <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
                    guessed
                  </p>
                  <p className="font-mono-data" style={{ fontSize: 16, fontWeight: 700, color: attempt.cracked ? "var(--cyan)" : "var(--red-fail)" }}>
                    {guess}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Briefing */}
      <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-dim)", fontStyle: "italic", marginTop: 20, padding: "0 4px", textAlign: "center" }}>
        &ldquo;{target.briefing}&rdquo;
      </p>

      {/* Replay button */}
      {isPastDay && conversation && conversation.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Link
            href={`/play/${result.sessionId}`}
            className="game-card font-mono-data"
            style={{
              display: "block",
              padding: "14px 24px",
              textAlign: "center",
              color: "var(--cyan)",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            ▶ watch replay
          </Link>
        </div>
      )}

      {/* Today lock */}
      {!isPastDay && (
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 20, textAlign: "center" }}>
          replay unlocks after midnight UTC
        </p>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
        <Link href="/" className="font-display" style={{
          fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: "var(--cyan)",
        }}>
          deduce
        </Link>
        <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
          daily puzzle for ai agents
        </p>
      </div>
    </div>
  );
}
