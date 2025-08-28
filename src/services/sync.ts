import { getSupabase } from './supabaseClient'
import { db, Movie, ListDef, ListItem } from '../store/db'

export type SyncStatus = 'idle' | 'auth-required' | 'syncing' | 'ok' | 'error'

export async function ensureAuth(email?: string): Promise<'ok' | 'sent' | 'error' | 'disabled'> {
  const supa = getSupabase()
  if (!supa) return 'disabled'
  const { data } = await supa.auth.getSession()
  if (data.session) return 'ok'
  if (!email) return 'error'
  const res = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  return res.error ? 'error' : 'sent'
}

// Contract: server has tables movies, lists, list_items with same ids and columns superset
export async function pullAll(): Promise<void> {
  const supa = getSupabase()
  if (!supa) throw new Error('sync disabled')
  const [{ data: movies, error: em }, { data: lists, error: el }, { data: items, error: ei }] = await Promise.all([
    supa.from('movies').select('*'),
    supa.from('lists').select('*'),
    supa.from('list_items').select('*')
  ])
  if (em || el || ei) throw em || el || ei
  await db.transaction('rw', db.movies, db.lists, db.listItems, async () => {
    if (movies?.length) await db.movies.bulkPut(movies as Movie[])
    if (lists?.length) await db.lists.bulkPut(lists as ListDef[])
    if (items?.length) await db.listItems.bulkPut(items as ListItem[])
  })
}

export async function pushAll(): Promise<void> {
  const supa = getSupabase()
  if (!supa) throw new Error('sync disabled')
  const { data: userRes, error: userErr } = await supa.auth.getUser()
  if (userErr || !userRes.user) throw new Error('not authenticated')
  const uid = userRes.user.id
  const [movies, lists, items] = await Promise.all([
    db.movies.toArray(),
    db.lists.toArray(),
    db.listItems.toArray()
  ])
  // Upsert in small batches to respect payload sizes
  function* chunks<T>(arr: T[], n = 500) { for (let i = 0; i < arr.length; i += n) yield arr.slice(i, i + n) }
  for (const part of chunks(movies)) {
    const rows = (part as any[]).map((r) => ({ user_id: uid, ...r }))
    await supa.from('movies').upsert(rows as any, { onConflict: 'user_id,id' })
  }
  for (const part of chunks(lists)) {
    const rows = (part as any[]).map((r) => ({ user_id: uid, ...r }))
    await supa.from('lists').upsert(rows as any, { onConflict: 'user_id,id' })
  }
  for (const part of chunks(items)) {
    const rows = (part as any[]).map((r) => ({ user_id: uid, ...r }))
    await supa.from('list_items').upsert(rows as any, { onConflict: 'user_id,id' })
  }
}

export async function syncNow(): Promise<'ok' | 'disabled' | 'error'> {
  try {
    const supa = getSupabase()
    if (!supa) return 'disabled'
    await pullAll()
    await pushAll()
    return 'ok'
  } catch (e) {
    console.error('[sync] failed', e)
    return 'error'
  }
}
