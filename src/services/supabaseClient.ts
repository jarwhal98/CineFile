import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined
  const anon = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anon) return null
  if (!client) client = createClient(url, anon, { auth: { persistSession: true, storage: window.localStorage } })
  return client
}
