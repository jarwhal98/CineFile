export interface SeedMovie {
  id: number; title: string; year?: number; posterPath?: string; backdropPath?: string; directors?: string[]; cast?: string[];
}
export interface SeedListItem { movieId: number; rank?: number }
export interface SeedList { id: string; name: string; source?: string; items: SeedListItem[] }
export interface SeedData { movies: SeedMovie[]; lists: SeedList[] }

export async function buildListFromTitles(
  id: string,
  name: string,
  source: string | undefined,
  entries: Array<{ rank?: number; title: string; year?: number }>,
  search: (title: string, year?: number) => Promise<number | undefined>
): Promise<SeedList | undefined> {
  const items: SeedListItem[] = []
  for (const e of entries) {
    const tmdbId = await search(e.title, e.year)
    if (tmdbId) {
      items.push({ movieId: tmdbId, rank: e.rank })
    }
  }
  if (items.length === 0) return undefined;
  return { id, name, source, items }
}

const seed: SeedData = { movies: [], lists: [] }
export default seed