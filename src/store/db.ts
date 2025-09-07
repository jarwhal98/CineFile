import Dexie, { Table } from 'dexie'

// Interfaces remain the same...
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
    this.version(1).stores({
      movies: '&id, title, year, seen',
      lists: '&id, name',
      listItems: '&id, listId, movieId, rank'
    })
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

// ... recomputeUserTopList and scheduleUserTopListSync functions remain the same ...
let userTopTimer: any = null
export async function recomputeUserTopList() {
  const listId = 'your-top'
  const now = new Date().toISOString()
  const rated = await db.movies.filter((m) => typeof m.myRating === 'number' && (m.myRating as number) > 0).toArray()
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

db.movies.hook('creating', () => scheduleUserTopListSync())
db.movies.hook('updating', () => scheduleUserTopListSync())
db.movies.hook('deleting', () => scheduleUserTopListSync())

// ==========================================================
// MODIFIED SEED FUNCTION WITH DETAILED LOGGING
// ==========================================================
export async function seedIfEmpty() {
  console.log('[seeding] Running seedIfEmpty() check...');
  try {
    const seededFlag = (typeof localStorage !== 'undefined') && localStorage.getItem('cinefile:seedDone') === '1'
    const existingCount = await db.lists.count()
    console.log(`[seeding] Flag check: seededFlag = ${seededFlag}, existingCount = ${existingCount}`);

    if (seededFlag || existingCount > 0) {
      console.log('[seeding] SKIPPED: Seeding conditions not met.');
      return
    }
    
    console.log('[seeding] STARTING: Conditions met, proceeding with seed.');

    const [{ default: baseSeed, buildListFromTitles }, { searchMovieId }, PapaMod] = await Promise.all([
      import('../data/seed'),
      import('../services/tmdb'),
      import('papaparse')
    ])
    const Papa: any = (PapaMod as any).default ?? PapaMod

    // First-run seed
    if (baseSeed.movies?.length) {
      console.log(`[seeding] Found ${baseSeed.movies.length} pre-compiled movies in seed file. Inserting...`);
      await db.movies.bulkPut(baseSeed.movies as any)
      console.log('[seeding] Pre-compiled movies inserted.');
    } else {
      console.log('[seeding] No pre-compiled movies found in seed file.');
    }

    // NYT Top 100 (21st)
    console.log('[seeding] Processing NYT Top 100 list...');
    const nytRaw: Array<{ rank: number; title: string; year?: number }> = (await import('../data/nyt_top100_21st.json')).default as any
    const nytList = await buildListFromTitles('nyt-top-100-21st', 'New York Times 100 Best Movies of the 21st Century', 'NYTimes', nytRaw, searchMovieId)
    if (nytList) {
        await db.lists.put(nytList as any);
        if(nytList.items) await db.listItems.bulkPut(nytList.items as any);
        console.log('[seeding] NYT Top 100 list processed.');
    } else {
        console.warn('[seeding] NYT Top 100 list returned null from builder.');
    }
    
    // ... Additional list processing would go here with similar logging ...

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cinefile:seedDone', '1')
      console.log('[seeding] Set "seedDone" flag in localStorage.');
    }
    console.log('[seeding] Seed process COMPLETED.');

  } catch (e) {
    console.error('[seeding] CRITICAL FAILURE: The seed process failed with an error.', e);
  }
}