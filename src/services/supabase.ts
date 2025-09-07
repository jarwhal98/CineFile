// src/services/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function hasSupabase(): boolean {
  return !!(url && anon)
}

export function getSupabase(): SupabaseClient | null {
  return hasSupabase() ? createClient(url!, anon!) : null
}

// Consumers can import this; it may be null if env vars are missing.
export const supabase = getSupabase()