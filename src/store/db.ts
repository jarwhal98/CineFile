import Dexie, { Table } from 'dexie'
import { buildListFromTitles, default as baseSeed } from '../data/seed'
import { searchMovieId, fetchMovie } from '../services/tmdb'
import Papa from 'papaparse'

// Interfaces
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
  addedAt?: string // ISO date
}

export interface ListDef {
  id: string // slug
  name: string // display title
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
// SEEDER THAT PROCESSES ALL LISTS
// ==========================================================
export async function seedIfEmpty() {
  try {
    const existingCount = await db.lists.where('id').notEqual('your-top').count();
    if (existingCount > 0) {
      console.log('[seeding] SKIPPED: Database already has content lists.');
      return;
    }

    console.log('[seeding] STARTING: Database is empty, proceeding with seed.');

    const allListsToProcess = [];

    // Define all lists and their data sources
    const listSources = [
      {
        id: 'nyt-top-100-21st',
        name: 'New York Times 100 Best Movies of the 21st Century',
        source: 'NYTimes',
        importer: () => import('../data/nyt_top100_21st.json').then(m => m.default as any[]),
        parser: (entries: any[]) => entries
      },
      {
        id: 'rollingstone-animated-40',
        name: 'Rolling Stone: 40 Animated (like TSPDT100)',
        source: 'Rolling Stone',
        importer: () => import('../data/rollingstone_40_animated_like_TSPDT100.csv?raw').then(m => m.default as string),
        parser: (csv: string) => (Papa.parse(csv, { header: true }).data as any[]).map(r => ({ rank: Number(r.Pos), title: r.Title, year: Number(r.Year) }))
      },
      // ... Add other list sources here in the same pattern
    ];
    
    // Process all list sources
    for (const source of listSources) {
        console.log(`[seeding] Processing ${source.name}...`);
        const rawData = await source.importer();
        const entries = source.parser(rawData);
        const listData = await buildListFromTitles(source.id, source.name, source.source, entries, searchMovieId);
        if (listData) {
            allListsToProcess.push(listData);
        }
    }
    
    if (allListsToProcess.length === 0) {
        throw new Error("Seeding failed: Could not build any lists from titles.");
    }
    
    // Gather all unique movie IDs from all lists
    const allItems = allListsToProcess.flatMap(l => l.items || []);
    const uniqueMovieIds = [...new Set(allItems.map(item => item.movieId))];
    
    console.log(`[seeding] Found ${uniqueMovieIds.length} unique movies across all lists. Fetching details...`);

    // Fetch details for all unique movies in one batch
    const moviePromises = uniqueMovieIds.map(id => fetchMovie(id));
    const movies = await Promise.all(moviePromises);

    console.log(`[seeding] Fetched details for ${movies.length} movies. Saving everything to database...`);

    // Save everything in a single transaction
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