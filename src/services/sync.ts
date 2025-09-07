// src/services/sync.ts
import { db } from '../store/db'
import { supabase, hasSupabase } from './supabase' // <— if your file is ./supabase.ts, change this import



type EnsureAuthResult = 'ok' | 'sent' | 'disabled' | 'error'
type SyncResult = 'ok' | 'disabled' | 'error'

/**
 * Start/ensure a Supabase session.
 * - If already signed in, returns "ok".
 * - If not, sends a magic link to the provided email and returns "sent".
 * - If env/client missing, returns "disabled".
 */
export async function ensureAuth(email: string): Promise<EnsureAuthResult> {
  try {
    if (!hasSupabase() || !supabase) return 'disabled'

    // already signed in?
    const { data: sessData, error: sessErr } = await supabase.auth.getSession()
    if (sessErr) {
      console.warn('[sync] getSession error:', sessErr)
      // fall through to try sending OTP
    } else if (sessData?.session?.user) {
      return 'ok'
    }

    // send sign-in link
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return 'error'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin, // back to app after clicking the email link
      },
    })
    if (error) {
      console.warn('[sync] signInWithOtp error:', error)
      return 'error'
    }
    return 'sent'
  } catch (e) {
    console.warn('[sync] ensureAuth failed', e)
    return 'error'
  }
}

/**
 * Two-way sync:
 * 1) Push local Dexie → Supabase (upserts)
 * 2) Pull Supabase → Dexie (so other browsers get data after sign-in)
 */
export async function syncNow(): Promise<SyncResult> {
  try {
    if (!hasSupabase() || !supabase) return 'disabled'

    // must be signed in to write/read per RLS
    const { data: sessData, error: sessErr } = await supabase.auth.getSession()
    if (sessErr || !sessData?.session?.user) {
      console.warn('[sync] no session:', sessErr || 'not signed in')
      return 'error'
    }
    const userId = sessData.session.user.id

    // ---- PUSH (Dexie → Supabase)
    const [movies, lists, listItems] = await Promise.all([
      db.movies.toArray(),
      db.lists.toArray(),
      db.listItems.toArray(),
    ])

    // Upsert in batches to avoid payload size issues
    const chunk = <T,>(arr: T[], size = 500) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      )

    // Stamp user_id on the way up; rely on DEFAULT auth.uid() if you added it in SQL, but be explicit here too.
    const moviesPayload = movies.map((m) => ({ ...m, user_id: userId }))
    const listsPayload = lists.map((l) => ({ ...l, user_id: userId }))
    const listItemsPayload = listItems.map((li) => ({ ...li, user_id: userId }))

    for (const part of chunk(moviesPayload)) {
      const { error } = await supabase.from('movies').upsert(part, { onConflict: 'id' })
      if (error) {
        console.warn('[sync] upsert movies error:', error)
        return 'error'
      }
    }
    for (const part of chunk(listsPayload)) {
      // onConflict by primary key "id" (text) as per our schema
      const { error } = await supabase.from('lists').upsert(part, { onConflict: 'id' })
      if (error) {
        console.warn('[sync] upsert lists error:', error)
        return 'error'
      }
    }
    for (const part of chunk(listItemsPayload)) {
      const { error } = await supabase.from('list_items').upsert(part, { onConflict: 'id' })
      if (error) {
        console.warn('[sync] upsert list_items error:', error)
        return 'error'
      }
    }

    // ---- PULL (Supabase → Dexie)
    // Pull only rows owned by this user (RLS)
    const [mRes, lRes, liRes] = await Promise.all([
      supabase.from('movies').select('*'),
      supabase.from('lists').select('*'),
      supabase.from('list_items').select('*'),
    ])

    if (mRes.error || lRes.error || liRes.error) {
      console.warn('[sync] pull errors:', mRes.error, lRes.error, liRes.error)
      return 'error'
    }

    // Put into Dexie (upsert locally)
    await db.transaction('rw', db.movies, db.lists, db.listItems, async () => {
      if (Array.isArray(lRes.data) && lRes.data.length) {
        await db.lists.bulkPut(lRes.data as any)
      }
      if (Array.isArray(mRes.data) && mRes.data.length) {
        await db.movies.bulkPut(mRes.data as any)
      }
      if (Array.isArray(liRes.data) && liRes.data.length) {
        await db.listItems.bulkPut(liRes.data as any)
      }
    })

    console.info('[sync] completed push+pull')
    return 'ok'
  } catch (e) {
    console.warn('[sync] syncNow failed', e)
    return 'error'
  }
}