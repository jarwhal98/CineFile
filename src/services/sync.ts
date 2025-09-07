import { db } from '../store/db'
import { supabase } from './supabase'

type EnsureAuthResult = 'ok' | 'sent' | 'disabled' | 'error'
type SyncResult = 'ok' | 'disabled' | 'error'

export async function ensureAuth(email: string): Promise<EnsureAuthResult> {
  try {
    if (!supabase) return 'disabled'
    const { data: sessData, error: sessErr } = await supabase.auth.getSession()
    if (sessErr) {
      console.warn('[sync] getSession error:', sessErr)
    } else if (sessData?.session?.user) {
      return 'ok'
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return 'error'
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
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

export async function syncNow(): Promise<SyncResult> {
  try {
    if (!supabase) return 'disabled'
    const { data: sessData, error: sessErr } = await supabase.auth.getSession()
    if (sessErr || !sessData?.session?.user) {
      console.warn('[sync] no session:', sessErr || 'not signed in')
      return 'error'
    }
    const userId = sessData.session.user.id

    const [localMovies, localLists, localListItems] = await Promise.all([
      db.movies.toArray(),
      db.lists.toArray(),
      db.listItems.toArray(),
    ])

    // ====================================================================
    // ===== THE FINAL FIX IS HERE ========================================
    // Converting ALL keys to lowercase to match the database reality
    // ====================================================================
    const listsPayload = localLists.map((l: any) => ({
      id: l.id, name: l.name, slug: l.slug, source: l.source, visibility: l.visibility,
      itemcount: l.itemCount, createdby: l.createdBy, createdat: l.createdAt,
      updatedat: l.updatedAt, deletedat: l.deletedAt, user_id: userId
    }));
    
    const moviesPayload = localMovies.map((m: any) => ({
        id: m.id, title: m.title, year: m.year, posterpath: m.posterPath, backdroppath: m.backdropPath,
        directors: m.directors, cast: m.cast, tmdbrating: m.tmdbRating, seen: m.seen,
        myrating: m.myRating, watchedat: m.watchedAt, runtime: m.runtime,
        genres: m.genres, overview: m.overview, user_id: userId
    }));

    const listItemsPayload = localListItems.map((li: any) => ({
        id: li.id, listid: li.listId, movieid: li.movieId, rank: li.rank, user_id: userId
    }));
    
    const chunk = <T,>(arr: T[], size = 500) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      )

    for (const part of chunk(listsPayload)) {
      const { error } = await supabase.from('lists').upsert(part, { onConflict: 'id' })
      if (error) { console.warn('[sync] upsert lists error:', error); return 'error' }
    }
    for (const part of chunk(moviesPayload)) {
      const { error } = await supabase.from('movies').upsert(part, { onConflict: 'id' })
      if (error) { console.warn('[sync] upsert movies error:', error); return 'error' }
    }
    for (const part of chunk(listItemsPayload)) {
      const { error } = await supabase.from('list_items').upsert(part, { onConflict: 'id' })
      if (error) { console.warn('[sync] upsert list_items error:', error); return 'error' }
    }

    const [mRes, lRes, liRes] = await Promise.all([
      supabase.from('movies').select('*'),
      supabase.from('lists').select('*'),
      supabase.from('list_items').select('*'),
    ])

    if (mRes.error || lRes.error || liRes.error) {
      console.warn('[sync] pull errors:', mRes.error, lRes.error, liRes.error)
      return 'error'
    }
    
    // Transform incoming data from Supabase back to the app's camelCase format
    const pulledLists = (lRes.data || []).map((l: any) => ({
        id: l.id, name: l.name, slug: l.slug, source: l.source, visibility: l.visibility,
        itemCount: l.itemcount, createdBy: l.createdby, createdAt: l.createdat,
        updatedAt: l.updatedat, deletedAt: l.deletedat, count: l.itemcount
    }));
    const pulledMovies = (mRes.data || []).map((m: any) => ({
        id: m.id, title: m.title, year: m.year, posterPath: m.posterpath, backdropPath: m.backdroppath,
        directors: m.directors, cast: m.cast, tmdbRating: m.tmdbrating, seen: m.seen,
        myRating: m.myrating, watchedAt: m.watchedat, runtime: m.runtime,
        genres: m.genres, overview: m.overview
    }));
    const pulledListItems = (liRes.data || []).map((li: any) => ({
        id: li.id, listId: li.listid, movieId: li.movieid, rank: li.rank, addedAt: li.addedat
    }));

    await db.transaction('rw', db.movies, db.lists, db.listItems, async () => {
      await db.lists.clear();
      await db.movies.clear();
      await db.listItems.clear();
      await db.lists.bulkPut(pulledLists as any)
      await db.movies.bulkPut(pulledMovies as any)
      await db.listItems.bulkPut(pulledListItems as any)
    })

    console.info('[sync] completed push+pull')
    return 'ok'
  } catch (e) {
    console.warn('[sync] syncNow failed', e)
    return 'error'
  }
}