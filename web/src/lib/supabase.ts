import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function getDayNumber(): number {
  return Math.floor(Date.now() / 86400000) - 20550;
}

export function getDateForDay(day: number): string {
  const ms = (day + 20550) * 86400000;
  const d = new Date(ms);
  return d.toISOString().split("T")[0];
}
