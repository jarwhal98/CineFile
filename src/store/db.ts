import Dexie, { Table } from 'dexie'
import { buildListFromTitles, SeedList } from '../data/seed'
import { searchMovieId, fetchMovie } from '../services/tmdb'
import Papa from 'papaparse'

// Interfaces
export interface Movie {
  id: number
  title: string
  year?: number
  posterPath?: string
  backdropPath?: string
  directors?: string[]
  cast?: string[]
  tmdbRating?: number
  seen?: boolean
  myRating?: number
  watchedAt?: string
  runtime?: number
  genres?: string[]
  overview?: string
}

export interface ListItem {
  id: string
  listId: string
  movieId: number
  rank?: number
  addedAt?: string
}

export interface ListDef {
  id: string
  name: string
  slug?: string
  source?: string
  count?: number
  itemCount?: number
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  visibility?: 'private' | 'public'
}

// Dexie DB Class
export class CineFileDB extends Dexie {
  movies!: Table<Movie, number>
  lists!: Table<ListDef, string>
  listItems!: Table<ListItem, string>

  constructor() {
    super('cinefile')
    this.version(2).stores({
      movies: '&id, title, year, seen',
      lists: '&id, name, slug, createdAt, visibility',
      listItems: '&id, listId, movieId, addedAt'
    })
    this.movies = this.table('movies')
    this.lists = this.table('lists')
    this.listItems = this.table('listItems')
  }
}

export const db = new CineFileDB()

// Auto-generated "Your Top" List functions
// ... (These functions are correct and remain unchanged)
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
// SEEDER REWRITTEN FOR TYPE SAFETY
// ==========================================================
export async function seedIfEmpty() {
  try {
    const existingCount = await db.lists.where('id').notEqual('your-top').count();
    if (existingCount > 0) {
      console.log('[seeding] SKIPPED: Database already has content lists.');
      return;
    }

    console.log('[seeding] STARTING: Database is empty, proceeding with seed.');
    
    const allListsToProcess: SeedList[] = [];

    // --- Process NYT List (JSON) ---
    console.log('[seeding] Processing NYT Top 100 list...');
    const nytRawData = (await import('../data/nyt_top100_21st.json')).default as any[];
    const nytList = await buildListFromTitles('nyt-top-100-21st', 'New York Times 100 Best Movies of the 21st Century', 'NYTimes', nytRawData, searchMovieId);
    if (nytList) allListsToProcess.push(nytList);

    // --- Process Rolling Stone List (CSV) ---
    console.log('[seeding] Processing Rolling Stone list...');
    const rsRawData = (await import('../data/rollingstone_40_animated_like_TSPDT100.csv?raw')).default as string;
    const rsParsed = Papa.parse(rsRawData, { header: true }).data as any[];
    const rsEntries = rsParsed.map(r => ({ rank: Number(r.Pos), title: r.Title, year: Number(r.Year) })).filter(r => r.title);
    const rsList = await buildListFromTitles('rollingstone-animated-40', 'Rolling Stone: 40 Animated (like TSPDT100)', 'Rolling Stone', rsEntries, searchMovieId);
    if (rsList) allListsToProcess.push(rsList);
    
    // You can add more list processing blocks here following the patterns above

    if (allListsToProcess.length === 0) {
      console.warn("Seeding process resulted in zero lists. Check data files and TMDB lookup.");
      return;
    }
    
    const allItems = allListsToProcess.flatMap(l => l.items || []);
    const uniqueMovieIds = [...new Set(allItems.map(item => item.movieId))];
    
    console.log(`[seeding] Found ${uniqueMovieIds.length} unique movies. Fetching details...`);

    const moviePromises = uniqueMovieIds.map(id => fetchMovie(id));
    const movies = await Promise.all(moviePromises);

    console.log(`[seeding] Fetched details for ${movies.length} movies. Saving everything...`);

    await db.transaction('rw', db.movies, db.lists, db.listItems, async () => {
        await db.movies.bulkPut(movies);

        for (const list of allListsToProcess) {
            await db.lists.put({
                id: list.id,
                name: list.name,
                source: list.source,
                slug: list.source || 'Imported',
                itemCount: list.items.length,
                count: list.items.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'system',
                visibility: 'public'
            });

            const now = new Date().toISOString();
            const listItems = list.items.map((it, idx) => ({
                id: `${list.id}:${it.rank ?? idx + 1}`,
                listId: list.id,
                movieId: it.movieId,
                rank: it.rank ?? idx + 1,
                addedAt: now
            }));
            await db.listItems.bulkPut(listItems);
        }
    });

    console.log('[seeding] Seed process COMPLETED successfully.');

  } catch (e) {
    console.error('[seeding] CRITICAL FAILURE: The seed process failed with an error.', e);
  }
}