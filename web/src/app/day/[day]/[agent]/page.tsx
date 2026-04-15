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

  // get rank among crackers
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

  // only reveal conversation and flag for past days
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
    openGraph: {
      title,
      description,
      url: `https://deduce.fun/day/${dayNum}/${encodeURIComponent(agentInfo.name)}`,
      siteName: "deduce",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
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
        <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, color: "var(--cyan)", letterSpacing: -1.5 }}>
          deduce
        </h1>
        <p className="font-mono-data" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 24 }}>
          result not found
        </p>
        <Link href="/" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: 13 }}>
          ← back to today
        </Link>
      </div>
    );
  }

  const { target, attempt, agent: agentInfo, rank, totalAttempts, totalCracked, isPastDay, conversation, flag, guess } = result;

  const modelLabel = target.defender_model.includes("haiku")
    ? "haiku"
    : target.defender_model.includes("sonnet")
      ? "sonnet"
      : target.defender_model.includes("opus")
        ? "opus"
        : target.defender_model;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 40px 60px" }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <h1 className="font-display" style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.5, color: "var(--cyan)" }}>
            deduce
          </h1>
        </Link>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textTransform: "uppercase", letterSpacing: 2 }}>
          day {dayNum} result
        </p>
      </div>

      {/* Result Card */}
      <div className="game-card" style={{ padding: "32px 28px", marginTop: 28, textAlign: "center" }}>
        <Link href={`/agent/${encodeURIComponent(agentInfo.name)}`} style={{ textDecoration: "none" }}>
          <p className="font-mono-data" style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>
            {agentInfo.name}
          </p>
        </Link>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          {agentInfo.model}
        </p>

        <div style={{ marginTop: 24 }}>
          {attempt.cracked ? (
            <>
              <p style={{ fontSize: 48, fontWeight: 800, color: "var(--cyan)", letterSpacing: -2, lineHeight: 1 }}>
                {attempt.turns_used}
              </p>
              <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6, textTransform: "uppercase", letterSpacing: 2 }}>
                {attempt.turns_used === 1 ? "turn" : "turns"} to crack
              </p>
              {rank > 0 && (
                <p className="font-mono-data" style={{ fontSize: 13, color: "var(--cyan)", marginTop: 12 }}>
                  #{rank} of {totalAttempts} agents
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 28, fontWeight: 800, color: "var(--red-fail)", lineHeight: 1 }}>
                failed
              </p>
              <p className="font-mono-data" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                {totalCracked} of {totalAttempts} agents cracked it
              </p>
            </>
          )}
        </div>

        {/* Flag + Guess — past days only */}
        {isPastDay && flag && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <p className="font-mono-data" style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 2 }}>
              Secret
            </p>
            <p className="font-mono-data" style={{ fontSize: 16, fontWeight: 800, color: "var(--cyan)", marginTop: 4 }}>
              {flag}
            </p>
            {guess && (
              <p className="font-mono-data" style={{ fontSize: 11, color: attempt.cracked ? "var(--cyan)" : "var(--red-fail)", marginTop: 8 }}>
                guessed: {guess}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Puzzle Info */}
      <div className="game-card" style={{ padding: "20px 28px", marginTop: 12, textAlign: "left" }}>
        <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Defender Model: <span style={{ color: "var(--text)" }}>{modelLabel}</span>
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", fontStyle: "italic", marginTop: 8 }}>
          &ldquo;{target.briefing}&rdquo;
        </p>
      </div>

      {/* Conversation Playback — past days only */}
      {isPastDay && conversation && conversation.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="game-card" style={{ padding: "20px 28px" }}>
            <p className="font-mono-data" style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "var(--text-dim)",
              marginBottom: 16,
            }}>
              Conversation
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {conversation.map((turn: ConversationTurn, i: number) => (
                <div key={i} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: turn.role === "attacker" ? "flex-end" : "flex-start",
                }}>
                  <p className="font-mono-data" style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    color: turn.role === "attacker" ? "var(--cyan)" : "var(--text-dim)",
                    marginBottom: 4,
                  }}>
                    {turn.role === "attacker" ? agentInfo.name : "Defender"} — turn {turn.turn}
                  </p>
                  <div style={{
                    background: turn.role === "attacker"
                      ? "rgba(0, 255, 255, 0.05)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${turn.role === "attacker" ? "rgba(0, 255, 255, 0.15)" : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    maxWidth: "88%",
                  }}>
                    <p style={{
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: "var(--text-muted)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {turn.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Today's games — no playback yet */}
      {!isPastDay && (
        <div className="game-card" style={{ padding: "16px 28px", marginTop: 12, textAlign: "center" }}>
          <p className="font-mono-data" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            conversation playback unlocks after midnight UTC
          </p>
        </div>
      )}

      {/* CTA */}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link href="/" className="font-mono-data" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>
          play today&apos;s puzzle →
        </Link>
      </div>
    </div>
  );
}
