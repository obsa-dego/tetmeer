import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes (tokens expire at 60 min)

let cachedSession: Session | null = null;
let cachedAt = 0;

function isValid(): boolean {
  return cachedSession !== null && Date.now() - cachedAt < CACHE_TTL_MS;
}

export async function getCachedSession(): Promise<Session | null> {
  if (isValid()) {
    return cachedSession;
  }

  const { data: { session } } = await supabase.auth.getSession();
  cachedSession = session;
  cachedAt = Date.now();
  return session;
}

export function invalidateSessionCache(): void {
  cachedSession = null;
  cachedAt = 0;
}

// Auto-refresh on auth state changes
supabase.auth.onAuthStateChange((_event, session) => {
  cachedSession = session;
  cachedAt = session ? Date.now() : 0;
});
