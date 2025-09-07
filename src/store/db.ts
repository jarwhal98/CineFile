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


// ==========================================================
// CORRECTED AND SIMPLIFIED SEED FUNCTION
// ==========================================================
export async function seedIfEmpty() {
  try {
    const existingCount = await db.lists.count()
    if (existingCount > 0) {
      console.log('[seeding] SKIPPED: Database is not empty.');
      return;
    }

    console.log('[seeding] STARTING: Database is empty, proceeding with seed.');

    // Step 1: Process the NYT Top 100 list to get movie IDs
    console.log('[seeding] Processing NYT Top 100 list...');
    const nytRaw: Array<{ rank: number; title: string; year?: number }> = (await import('../data/nyt_top100_21st.json')).default as any;
    const nytList = await buildListFromTitles('nyt-top-100-21st', 'New York Times 100 Best Movies of the 21st Century', 'NYTimes', nytRaw, searchMovieId);

    if (!nytList || !nytList.items || nytList.items.length === 0) {
      throw new Error("Seeding failed: Could not build the NYT list from titles.");
    }

    console.log(`[seeding] Found ${nytList.items.length} movies from the NYT list. Fetching full movie details...`);

    // Step 2: Fetch full movie data for all unique movie IDs
    const movieIds = [...new Set(nytList.items.map(item => item.movieId))];
    const moviePromises = movieIds.map(id => fetchMovie(id));
    const movies = await Promise.all(moviePromises);

    console.log(`[seeding] Fetched details for ${movies.length} movies. Saving to database...`);
    
    // Step 3: Save everything in a single transaction
    await db.transaction('rw', db.movies, db.lists, db.listItems, async () => {
      // Save all the full movie objects
      await db.movies.bulkPut(movies);

      // Save the list definition
      await db.lists.put({
        id: nytList.id,
        name: nytList.name,
        source: nytList.source,
        slug: nytList.source || 'Imported',
        itemCount: nytList.items.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        visibility: 'public'
      });

      // Create and save the list items with the required 'id'
      const now = new Date().toISOString();
      const listItems = nytList.items.map((it, idx) => ({
        id: `${nytList.id}:${it.rank ?? idx + 1}`,
        listId: nytList.id,
        movieId: it.movieId,
        rank: it.rank ?? idx + 1,
        addedAt: now
      }));
      await db.listItems.bulkPut(listItems);
    });

    console.log('[seeding] Seed process COMPLETED successfully.');

  } catch (e) {
    console.error('[seeding] CRITICAL FAILURE: The seed process failed with an error.', e);
  }
}