import axios from 'axios'

const API_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w342'

export function getTmdbKey() {
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
  // Prefer exact year match if provided, else top result
  if (year) {
    const exact = results.find((r) => typeof r.release_date === 'string' && r.release_date.startsWith(String(year)))
    if (exact) return exact.id
  }
  return results[0]?.id
}
