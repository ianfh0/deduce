import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase-server";

/**
 * IP-based rate limiting backed by a supabase `rate_events` table.
 * Lightweight — one row per event, cleaned up on check.
 *
 * Table SQL (run in Supabase SQL Editor):
 *   CREATE TABLE IF NOT EXISTS rate_events (
 *     id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *     ip text NOT NULL,
 *     action text NOT NULL,
 *     created_at timestamp with time zone DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_rate_events_lookup ON rate_events(ip, action, created_at);
 */

export function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check if an IP has exceeded the rate limit for a given action.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  if (ip === "unknown") {
    // can't rate limit without an IP — allow but log
    return { allowed: true };
  }

  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // count recent events
  const { count } = await supabaseAdmin
    .from("rate_events")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("action", action)
    .gte("created_at", windowStart);

  if ((count || 0) >= maxRequests) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  // record this event
  await supabaseAdmin.from("rate_events").insert({ ip, action });

  // opportunistic cleanup — delete events older than 2x the window
  const cleanupBefore = new Date(Date.now() - windowSeconds * 2000).toISOString();
  await supabaseAdmin
    .from("rate_events")
    .delete()
    .eq("action", action)
    .lt("created_at", cleanupBefore);

  return { allowed: true };
}
