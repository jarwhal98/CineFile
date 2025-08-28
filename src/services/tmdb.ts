import axios from 'axios'

const API_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w342'

export function getTmdbKey() {
  // Prefer a build-time env key if provided; fallback to localStorage
  const envKey = (import.meta as any)?.env?.VITE_TMDB_API_KEY as string | undefined
  if (envKey && envKey.trim()) return envKey.trim()
  return localStorage.getItem('cinefile.tmdbKey') || ''
}

export function posterUrl(posterPath?: string) {
  return posterPath ? `${IMG_BASE}${posterPath}` : undefined
}

export async function fetchMovie(tmdbId: number) {
  const key = getTmdbKey()
  const { data } = await axios.get(`${API_BASE}/movie/${tmdbId}`, {
    params: { api_key: key, append_to_response: 'credits,release_dates' }
  })
  const directors = (data.credits.crew || [])
    .filter((p: any) => p.job === 'Director')
    .map((p: any) => p.name)
  const cast = (data.credits.cast || []).slice(0, 5).map((p: any) => p.name)
  const genres = (data.genres || []).map((g: any) => g.name)
  const runtime = typeof data.runtime === 'number' ? data.runtime : undefined
  return {
    id: data.id,
    title: data.title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : undefined,
    posterPath: data.poster_path || undefined,
    backdropPath: data.backdrop_path || undefined,
    directors,
    cast,
    tmdbRating: typeof data.vote_average === 'number' ? Math.round(data.vote_average * 10) / 10 : undefined,
    runtime,
    genres,
    overview: data.overview || undefined
  }
}

export async function searchMovieId(title: string, year?: number): Promise<number | undefined> {
  const key = getTmdbKey()
  if (!key) return undefined
  const { data } = await axios.get(`${API_BASE}/search/movie`, {
    params: { api_key: key, query: title, year }
  })
  const results: any[] = data?.results || []
  if (!results.length) return undefined
  // Normalize helper
  const norm = (s: string) => s
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const want = norm(title)
  // Candidate scoring: prefer exact normalized title; then year match; then highest vote_count
  let best: any | undefined
  let bestScore = -1
  for (const r of results) {
    const rTitle = typeof r.title === 'string' ? r.title : ''
    const rNorm = norm(rTitle)
    const rYear = r.release_date ? Number(String(r.release_date).slice(0, 4)) : undefined
    let score = 0
    if (rNorm === want) score += 10
    if (year && rYear === year) score += 5
    // Penalize obvious session/doc variants when main feature exists
    if (/session|extended|making of|behind the|in the edges|concert|live/i.test(rTitle)) score -= 4
    // Weight by popularity when tie
    const pop = typeof r.vote_count === 'number' ? r.vote_count : 0
    score += Math.min(3, Math.floor(Math.log10(pop + 1)))
    if (score > bestScore) { best = r; bestScore = score }
  }
  return best?.id || results[0]?.id
}

export async function searchMovies(query: string, year?: number): Promise<Array<{ id: number; title: string; year?: number; posterPath?: string; tmdbRating?: number }>> {
  const key = getTmdbKey()
  if (!key || !query.trim()) return []
  const { data } = await axios.get(`${API_BASE}/search/movie`, {
    params: { api_key: key, query, year }
  })
  const results: any[] = data?.results || []
  return results.slice(0, 20).map((r) => ({
    id: r.id,
    title: r.title,
    year: r.release_date ? Number(String(r.release_date).slice(0, 4)) : undefined,
    posterPath: r.poster_path || undefined,
    tmdbRating: typeof r.vote_average === 'number' ? Math.round(r.vote_average * 10) / 10 : undefined
  }))
}
