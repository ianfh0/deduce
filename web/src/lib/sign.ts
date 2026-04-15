import { createHmac } from "crypto";

const SECRET = process.env.PLAYBACK_SECRET || process.env.SUPABASE_SERVICE_KEY || "deduce-playback-default";

/** Sign a session_id so we can issue browser-friendly playback links */
export function signSession(sessionId: string): string {
  return createHmac("sha256", SECRET).update(sessionId).digest("hex").slice(0, 16);
}

/** Verify a token matches the session_id */
export function verifySession(sessionId: string, token: string): boolean {
  return signSession(sessionId) === token;
}
