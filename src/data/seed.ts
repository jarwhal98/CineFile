// Seed data to preload lists and movies on first run.
// You can paste your lists here (or share them with me to add).

export interface SeedMovie {
  id: number // TMDB id
  title: string
  year?: number
  posterPath?: string
  backdropPath?: string
  directors?: string[]
  cast?: string[]
}

export interface SeedListItem { movieId: number; rank?: number }

export interface SeedList { id: string; name: string; source?: string; items: SeedListItem[] }

export interface SeedData { movies: SeedMovie[]; lists: SeedList[] }

// Helper to build list items from title/year arrays once TMDB ids are looked up at runtime.
export async function buildListFromTitles(
  id: string,
  name: string,
  source: string | undefined,
  entries: Array<{ rank?: number; title: string; year?: number }>,
  search: (title: string, year?: number) => Promise<number | undefined>
): Promise<SeedList> {
  const items: SeedListItem[] = []
  for (const e of entries) {
    const tmdbId = await search(e.title, e.year)
    if (!tmdbId) continue
    items.push({ movieId: tmdbId, rank: e.rank })
  }
  return { id, name, source, items }
}

const seed: SeedData = { movies: [], lists: [] }

export default seed
