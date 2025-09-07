import Dexie, { Table } from 'dexie'
import { buildListFromTitles, SeedList } from '../data/seed'
import { searchMovieId, fetchMovie } from '../services/tmdb'
import Papa from 'papaparse'

// Defines the data structure used *inside* your application (camelCase)
export interface Movie {
  id: number; title: string; year?: number; posterPath?: string; backdropPath?: string; directors?: string[]; cast?: string[]; tmdbRating?: number; seen?: boolean; myRating?: number; watchedAt?: string; runtime?: number; genres?: string[]; overview?: string;
}
export interface ListItem {
  id: string; listId: string; movieId: number; rank?: number; addedAt?: string;
}
export interface ListDef {
  id:string; name: string; slug?: string; source?: string; itemCount?: number; createdBy?: string; createdAt?: string; updatedAt?: string; visibility?: 'private' | 'public';
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
        await db.lists.put({ id: listId, name, source: 'User', slug: 'User', itemCount: items.length, createdAt: now, updatedAt: now, createdBy: 'system', visibility: 'private' })
      } else {
        await db.lists.update(listId, { name, itemCount: items.length, updatedAt: now, visibility: exists.visibility || 'private' })
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

// Seeder that processes all lists
export async function seedIfEmpty() {
  try {
    const existingCount = await db.lists.where('id').notEqual('your-top').count();
    if (existingCount > 0) {
      console.log('[seeding] SKIPPED: Database already has content lists.');
      return;
    }
    console.log('[seeding] STARTING: Database is empty, proceeding with seed.');
    const allListsToProcess: SeedList[] = [];
    const listSources = [
        { id: 'nyt-top-100-21st', name: 'New York Times 100 Best Movies of the 21st Century', source: 'NYTimes', type: 'json', importer: () => import('../data/nyt_top100_21st.json') },
        { id: 'rollingstone-animated-40', name: 'Rolling Stone: 40 Animated (like TSPDT100)', source: 'Rolling Stone', type: 'csv', importer: () => import('../data/rollingstone_40_animated_like_TSPDT100.csv?raw') },
        { id: 'tspdt-100-greatest', name: 'TSPDT 100 Greatest Films', source: 'TSPDT', type: 'csv', importer: () => import('../data/TSPDT100.csv?raw') },
        { id: 'tspdt-21st-most-acclaimed', name: 'TSPDT 21st Century’s Most Acclaimed Films', source: 'TSPDT', type: 'csv', importer: () => import('../data/TSPDT21st.csv?raw') },
        { id: 'variety-100-best-horror', name: 'Variety 100 Best Horror Movies of All Time', source: 'Variety', type: 'csv', importer: () => import('../data/variety_100_best_horror.csv?raw') }
    ];
    for (const source of listSources) {
        try {
            const rawModule = await source.importer();
            const rawData = rawModule.default;
            let entries: any[];
            if (source.type === 'csv') {
                entries = (Papa.parse(rawData as string, { header: true }).data as any[]).map(r => ({ rank: Number(r.Pos || r.Rank || r['#']), title: r.Title, year: Number(r.Year) })).filter(r => r.title);
            } else {
                entries = rawData as any[];
            }
            const listData = await buildListFromTitles(source.id, source.name, source.source, entries, searchMovieId);
            if (listData) allListsToProcess.push(listData);
        } catch (e) {
            console.warn(`[seeding] Failed to process list ${source.name}, skipping. Error:`, e);
        }
    }
    if (allListsToProcess.length === 0) {
      console.warn("Seeding process resulted in zero lists.");
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
                id: list.id, name: list.name, source: list.source, slug: list.source || 'Imported',
                itemCount: list.items.length, createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(), createdBy: 'system', visibility: 'public'
            });
            const now = new Date().toISOString();
            const listItems = list.items.map((it, idx) => ({
                id: `${list.id}:${it.rank ?? idx + 1}`, listId: list.id, movieId: it.movieId,
                rank: it.rank ?? idx + 1, addedAt: now
            }));
            await db.listItems.bulkPut(listItems);
        }
    });
    console.log('[seeding] Seed process COMPLETED successfully.');
  } catch (e) {
    console.error('[seeding] CRITICAL FAILURE: The seed process failed with an error.', e);
  }
}