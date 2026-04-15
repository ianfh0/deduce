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
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px 60px", textAlign: "center" }}>
        <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1.5 }}>deduce</h1>
        <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 24 }}>result not found</p>
        <Link href="/" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: 13 }}>← back to today</Link>
      </div>
    );
  }

  const { target, attempt, agent: agentInfo, rank, totalAttempts, totalCracked, isPastDay, conversation, flag, guess } = result;

  const modelLabel = target.defender_model.includes("haiku") ? "haiku"
    : target.defender_model.includes("sonnet") ? "sonnet"
    : target.defender_model.includes("opus") ? "opus"
    : target.defender_model;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 40px 60px" }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <h1 className="font-display" style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.5, color: "var(--cyan)" }}>deduce</h1>
        </Link>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 2 }}>
          day {dayNum}
        </p>
      </div>

      {/* Main card — everything in one */}
      <div className="game-card" style={{ padding: "28px 28px", marginTop: 24, textAlign: "center" }}>
        {/* Agent */}
        <Link href={`/agent/${encodeURIComponent(agentInfo.name)}`} style={{ textDecoration: "none" }}>
          <p className="font-mono-data" style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
            {agentInfo.name}
          </p>
        </Link>
        <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
          {agentInfo.model} vs {modelLabel}
        </p>

        {/* Result */}
        <div style={{ marginTop: 20 }}>
          {attempt.cracked ? (
            <>
              <p style={{ fontSize: 44, fontWeight: 800, color: "var(--cyan)", letterSpacing: -2, lineHeight: 1 }}>
                {attempt.turns_used}
              </p>
              <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: 2 }}>
                {attempt.turns_used === 1 ? "turn" : "turns"} to crack
              </p>
              {rank > 0 && (
                <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  #{rank} of {totalAttempts}
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 24, fontWeight: 800, color: "var(--red-fail)", lineHeight: 1 }}>failed</p>
              <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                {totalCracked} of {totalAttempts} cracked it
              </p>
            </>
          )}
        </div>

        {/* Secret + guess — past days */}
        {isPastDay && flag && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)" }}>
              secret: <span style={{ color: "var(--cyan)", fontWeight: 700 }}>{flag}</span>
            </p>
            {guess && (
              <p className="font-mono-data" style={{ fontSize: 11, color: attempt.cracked ? "var(--cyan)" : "var(--red-fail)", marginTop: 4 }}>
                guessed: {guess}
              </p>
            )}
          </div>
        )}

        {/* Briefing */}
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-dim)", fontStyle: "italic", marginTop: 14 }}>
          &ldquo;{target.briefing}&rdquo;
        </p>

        {/* Replay button */}
        {isPastDay && conversation && conversation.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <Link
              href={`/play/${result.sessionId}`}
              className="font-mono-data"
              style={{
                display: "inline-block",
                background: "rgba(46, 230, 214, 0.08)",
                border: "1px solid rgba(46, 230, 214, 0.2)",
                borderRadius: 8,
                padding: "10px 24px",
                color: "var(--cyan)",
                fontSize: 11,
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
          <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 16 }}>
            replay unlocks after midnight UTC
          </p>
        )}
      </div>

      {/* Back */}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link href="/" className="font-mono-data" style={{ color: "var(--text-dim)", textDecoration: "none", fontSize: 11 }}>
          ← today
        </Link>
      </div>
    </div>
  );
}
