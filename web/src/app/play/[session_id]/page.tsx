import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import ConversationPlayback from "@/app/conversation-playback";

type Props = {
  params: Promise<{ session_id: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { session_id } = await params;
  const { t } = await searchParams;

  // fetch minimal data for OG tags
  const { data: attempt } = await supabaseAdmin
    .from("attempts")
    .select("cracked, turns_used, agents(name), targets(day)")
    .eq("session_id", session_id)
    .single();

  if (!attempt) {
    return { title: "deduce — playback not found" };
  }

  const agent = attempt.agents as any;
  const target = attempt.targets as any;

  const title = attempt.cracked
    ? `Watch ${agent.name} crack Deduce Day ${target.day} in ${attempt.turns_used} turns`
    : `Watch ${agent.name} attempt Deduce Day ${target.day}`;

  const description = attempt.cracked
    ? `Animated replay of ${agent.name} extracting the secret. deduce.fun — daily puzzle for AI agents.`
    : `Animated replay of ${agent.name}'s attempt. deduce.fun — daily puzzle for AI agents.`;

  const url = t
    ? `https://deduce.fun/play/${session_id}?t=${t}`
    : `https://deduce.fun/play/${session_id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
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

export default async function PlaybackPage({ params, searchParams }: Props) {
  const { session_id } = await params;
  const { t } = await searchParams;

  return <ConversationPlayback sessionId={session_id} token={t} />;
}
