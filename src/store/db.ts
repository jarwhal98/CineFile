import Dexie, { Table } from 'dexie'

export interface Movie {
  id: number // TMDB id
  title: string
  year?: number
  posterPath?: string
  backdropPath?: string
  directors?: string[]
  cast?: string[]
  tmdbRating?: number
  seen?: boolean
  myRating?: number // 0.5 increments up to 10
  watchedAt?: string // ISO date
  runtime?: number
  genres?: string[]
  overview?: string
}

export interface ListItem {
  id: string // listId:rank or stable uuid
  listId: string
  movieId: number
  rank?: number
  // new audit and snapshot fields
  titleSnapshot?: string
  yearSnapshot?: number
  directorSnapshot?: string
  posterPathSnapshot?: string
  addedAt?: string // ISO date
  addedBy?: string // user id/name
}

export interface ListDef {
  id: string // slug
  name: string // display title
  slug?: string // publication/source tag (grouping), reusable across lists
  source?: string // e.g., CSV filename or publication label
  count?: number // deprecated in favor of itemCount
  // unified model fields
  itemCount?: number
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  visibility?: 'private' | 'public'
  deletedAt?: string | null
}

export class CineFileDB extends Dexie {
  movies!: Table<Movie, number>
  lists!: Table<ListDef, string>
  listItems!: Table<ListItem, string>

  constructor() {
    super('cinefile')
    // v1: initial schema
    this.version(1).stores({
      movies: '&id, title, year, seen',
      lists: '&id, name',
      listItems: '&id, listId, movieId, rank'
    })
    // v2: add list metadata (slug, itemCount, audit, visibility), listItems audit fields and snapshots
    this.version(2)
      .stores({
        movies: '&id, title, year, seen',
        lists: '&id, name, slug, createdAt, visibility',
        listItems: '&id, listId, movieId, addedAt'
      })
      .upgrade(async (tx) => {
        const lists = tx.table('lists') as Table<any, string>
        await lists.toCollection().modify((l: any) => {
          l.slug = l.slug || (l.source ? String(l.source).split(/[\s:]/)[0] : 'Imported')
          l.itemCount = typeof l.itemCount === 'number' ? l.itemCount : (typeof l.count === 'number' ? l.count : 0)
          l.createdAt = l.createdAt || new Date().toISOString()
          l.updatedAt = l.updatedAt || l.createdAt
          l.visibility = l.visibility || 'public'
        })
      })
    this.movies = this.table('movies')
    this.lists = this.table('lists')
    this.listItems = this.table('listItems')
  }
}

export const db = new CineFileDB()

// Auto-generated list: "Your Top X List" based on user ratings (ties -> higher tmdbRating)
let userTopTimer: any = null
export async function recomputeUserTopList() {
  const listId = 'your-top'
  const now = new Date().toISOString()
  // Gather rated movies only
  const rated = await db.movies.filter((m) => typeof m.myRating === 'number' && (m.myRating as number) > 0).toArray()
  // Sort: myRating desc, tmdbRating desc, title asc
  rated.sort((a, b) => (b.myRating! - a.myRating!) || ((b.tmdbRating ?? 0) - (a.tmdbRating ?? 0)) || String(a.title).localeCompare(String(b.title)))
  const items = rated.map((m, idx) => ({ id: `${listId}:${idx + 1}`, listId, movieId: m.id, rank: idx + 1, addedAt: now }))
  const name = `Your Top ${rated.length} List`
  await db.transaction('rw', db.lists, db.listItems, async () => {
    const exists = await db.lists.get(listId)
    if (!exists) {
      await db.lists.put({ id: listId, name, source: 'User', slug: 'User', itemCount: items.length, count: items.length, createdAt: now, updatedAt: now, createdBy: 'system', visibility: 'private' })
    } else {
      await db.lists.update(listId, { name, itemCount: items.length, count: items.length, updatedAt: now, visibility: exists.visibility || 'private' })
    }
    const existing = await db.listItems.where('listId').equals(listId).toArray()
    if (existing.length) await db.listItems.bulkDelete(existing.map((i) => i.id))
    if (items.length) await db.listItems.bulkPut(items)
  })
}

export function scheduleUserTopListSync(delay = 250) {
  if (userTopTimer) clearTimeout(userTopTimer)
  userTopTimer = setTimeout(() => { recomputeUserTopList().catch((e) => console.warn('[cinefile] Top list sync failed', e)) }, delay) as any
}

// Trigger sync when movies change (rating updates, etc.)
db.movies.hook('creating', () => scheduleUserTopListSync())
db.movies.hook('updating', () => scheduleUserTopListSync())
db.movies.hook('deleting', () => scheduleUserTopListSync())

// Simple first-run seeding (idempotent): if there are no lists, load from seed data
export async function seedIfEmpty() {
  try {
  const [{ default: baseSeed, buildListFromTitles }, { searchMovieId }, PapaMod] = await Promise.all([
      import('../data/seed'),
      import('../services/tmdb'),
      import('papaparse')
    ])
    const Papa: any = (PapaMod as any).default ?? PapaMod

    // Cleanup: remove any stray list with id or name 'movies'
    try {
      await db.transaction('rw', db.lists, db.listItems, async () => {
        const all = await db.lists.toArray()
        const bad = all.filter((l) => l.id === 'movies' || (l.name || '').trim().toLowerCase() === 'movies')
        for (const l of bad) {
          await db.listItems.where('listId').equals(l.id).delete()
          await db.lists.delete(l.id)
        }
        if (bad.length > 0) console.info('[cinefile] Removed stray list(s):', bad.map((b) => b.id).join(', '))
      })
    } catch (e) {
      console.warn('[cinefile] Cleanup failed while removing stray list "movies"', e)
    }

  const insertList = async (lst: any) => {
      if (!lst) return
      await db.transaction('rw', db.lists, db.listItems, async () => {
        const now = new Date().toISOString()
        await db.lists.put({
          id: lst.id,
          name: lst.name,
          source: lst.source,
          slug: lst.source || 'Imported',
          itemCount: lst.items?.length || 0,
          count: lst.items?.length || 0,
          createdAt: now,
          updatedAt: now,
          createdBy: 'system',
          visibility: 'public'
        })
        if (lst.items?.length) {
          const items = lst.items.map((it: any, idx: number) => ({
            id: `${lst.id}:${it.rank ?? idx + 1}`,
            listId: lst.id,
            movieId: it.movieId,
            rank: it.rank ?? idx + 1,
            addedAt: now
          }))
          await db.listItems.bulkPut(items)
        }
      })
    }

    const ensureList = async (id: string, builder: () => Promise<any | undefined>) => {
      const existing = await db.lists.get(id)
      if (!existing) {
        const lst = await builder()
        if (lst) await insertList(lst)
        return
      }
      // Backfill items if list exists but has no items
      const currentItems = await db.listItems.where('listId').equals(id).count()
      if (currentItems === 0) {
        const lst = await builder()
        if (lst && lst.items?.length) {
          await db.transaction('rw', db.lists, db.listItems, async () => {
            const items = lst.items.map((it: any, idx: number) => ({
              id: `${id}:${it.rank ?? idx + 1}`,
              listId: id,
              movieId: it.movieId,
              rank: it.rank ?? idx + 1
            }))
            await db.listItems.bulkPut(items)
            await db.lists.update(id, { count: items.length, itemCount: items.length, updatedAt: new Date().toISOString() })
          })
        }
      }
    }

    // Gate seeding to true first-run only: if already seeded or there are any lists, skip
    const seededFlag = (typeof localStorage !== 'undefined') && localStorage.getItem('cinefile:seedDone') === '1'
    const existingCount = await db.lists.count()
    if (seededFlag || existingCount > 0) {
      console.info('[cinefile] Seed skipped (seeded flag or existing lists)')
      return
    }

    // First-run seed
    if (baseSeed.movies?.length) {
      await db.movies.bulkPut(baseSeed.movies as any)
    }

    // NYT Top 100 (21st)
    await ensureList('nyt-top-100-21st', async () => {
      const nytRaw: Array<{ rank: number; title: string; year?: number }> = (await import('../data/nyt_top100_21st.json')).default as any
      return buildListFromTitles('nyt-top-100-21st', 'New York Times 100 Best Movies of the 21st Century', 'NYTimes', nytRaw, searchMovieId)
    })

    // Rolling Stone Animated 40 
    await ensureList('rollingstone-animated-40', async () => {
      const rsCsv = (await import('../data/rollingstone_40_animated_like_TSPDT100.csv?raw')).default as string
      const rsParsed = Papa.parse(rsCsv, { header: true })
      const rsEntries = (rsParsed.data as any[])
        .map((row) => ({
          rank: Number(row.Pos || row['2024'] || row['Rank']) || undefined,
          title: (row.Title || '').toString().trim().replace(/^"|"$/g, ''),
          year: Number(row.Year) || undefined
        }))
        .filter((r) => r.title)
      return buildListFromTitles('rollingstone-animated-40', 'Rolling Stone: 40 Animated (like TSPDT100)', 'Rolling Stone', rsEntries, searchMovieId)
    })

    // TSPDT 100 Greatest Films
    await ensureList('tspdt-100-greatest', async () => {
      try {
        const csv = (await import('../data/TSPDT100.csv?raw')).default as string
        const parsed = Papa.parse(csv, { header: true })
        const entries = (parsed.data as any[])
          .map((row) => ({ rank: Number(row.Pos || row['2024']) || undefined, title: (row.Title || '').toString().trim(), year: Number(row.Year) || undefined }))
          .filter((r) => r.title)
        return buildListFromTitles('tspdt-100-greatest', 'TSPDT 100 Greatest Films', 'TSPDT', entries, searchMovieId)
      } catch {
        console.warn('[cinefile] TSPDT100 seed not found, skipping')
        return undefined
      }
    })

    // TSPDT 21st Century’s Most Acclaimed Films
    await ensureList('tspdt-21st-most-acclaimed', async () => {
      try {
        const csv = (await import('../data/TSPDT21st.csv?raw')).default as string
        const parsed = Papa.parse(csv, { header: true })
        const entries = (parsed.data as any[])
          .map((row) => ({ rank: Number(row.Pos || row['2024']) || undefined, title: (row.Title || '').toString().trim(), year: Number(row.Year) || undefined }))
          .filter((r) => r.title)
        return buildListFromTitles('tspdt-21st-most-acclaimed', 'TSPDT 21st Century’s Most Acclaimed Films', 'TSPDT', entries, searchMovieId)
      } catch {
        console.warn('[cinefile] TSPDT 21st seed not found, skipping')
        return undefined
      }
    })

    // Variety 100 Best Horror (optional if CSV present)
    await ensureList('variety-100-best-horror', async () => {
      try {
        const varietyMap = import.meta.glob('../data/variety_100_best_horror.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
        const varietyCsv = varietyMap['../data/variety_100_best_horror.csv']
        if (!varietyCsv) return undefined
        const parsed = Papa.parse(varietyCsv, { header: true })
        const entries = (parsed.data as any[])
          .map((row) => ({ rank: Number(row.Pos || row.Rank || row['#']) || undefined, title: (row.Title || '').toString().trim(), year: Number(row.Year) || undefined }))
          .filter((r) => r.title)
        return buildListFromTitles('variety-100-best-horror', 'Variety 100 Best Horror Movies of All Time', 'Variety', entries, searchMovieId)
      } catch {
        console.info('[cinefile] Variety list data not present, skipping auto-seed')
        return undefined
      }
    })

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cinefile:seedDone', '1')
    }
    console.info('[cinefile] Seed completed')
  } catch (e) {
    console.warn('[cinefile] Seed failed', e)
  }
}
