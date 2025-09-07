// src/services/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read env **when called**, not at module load
function getEnv() {
  // Vite injects import.meta.env; we also allow a window.ENV fallback just in case
  const env = ((import.meta as any)?.env ?? (globalThis as any)?.ENV ?? {}) as Record<string, string | undefined>;
  const url  = env.VITE_SUPABASE_URL?.trim();
  const anon = env.VITE_SUPABASE_ANON_KEY?.trim();
  return { url, anon };
}

let _client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  const { url, anon } = getEnv();
  return !!(url && anon);
}

// Lazily create (and memoize) the client
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const { url, anon } = getEnv();
  console.log('[supabaseClient] url present?', !!url, 'key present?', !!anon);
  if (url && anon) _client = createClient(url, anon);
  return _client;
}