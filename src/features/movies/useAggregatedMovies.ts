import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ListItem, Movie } from '../../store/db'
import { fetchMovie } from '../../services/tmdb'

export interface AggregatedMovieRow extends Movie {
  lists: { listId: string; rank?: number }[]
  score?: number // lower is better, average normalized rank across lists where present
}

export function useAggregatedMovies(selectedListIds: string[]) {
  const listIdSet = useMemo(() => new Set(selectedListIds), [selectedListIds])

  const lists = useLiveQuery(async () => db.lists.toArray(), [], [])

  const rows = useLiveQuery(async () => {
    const items = await db.listItems.toArray()
    const filtered = items.filter((i) => listIdSet.size === 0 || listIdSet.has(i.listId))
    const grouped = new Map<number, { movie: Movie | undefined; items: ListItem[] }>()
    for (const it of filtered) {
      const g = grouped.get(it.movieId) || { movie: undefined, items: [] }
      g.items.push(it)
      grouped.set(it.movieId, g)
    }

    const moviesById = new Map<number, Movie>()
    const movieIds = Array.from(grouped.keys())
    const movies = await db.movies.bulkGet(movieIds)
    movieIds.forEach((id, idx) => {
      const m = movies[idx]
      if (m) moviesById.set(id, m)
    })

    const rows: AggregatedMovieRow[] = []
    for (const [movieId, g] of grouped.entries()) {
      const movie = moviesById.get(movieId)
      const listsForMovie = g.items.map((it) => ({ listId: it.listId, rank: it.rank }))

      // score: average of normalized rank across lists where present
      let score: number | undefined
      if (listsForMovie.length > 0 && lists && lists.length > 0) {
        const parts: number[] = []
        for (const l of listsForMovie) {
          const list = lists.find((x) => x.id === l.listId)
          if (!list || !l.rank || !list.count) continue
          parts.push(l.rank / list.count)
        }
        if (parts.length > 0) score = parts.reduce((a, b) => a + b, 0) / parts.length
      }

      rows.push({ ...(movie || { id: movieId, title: `#${movieId}` }), lists: listsForMovie, score })
    }
    return rows
  }, [listIdSet, lists])

  // background sync: fetch missing movie details
  useEffect(() => {
    if (!rows) return
    const missing = rows.filter((r) => !r.posterPath || !r.directors || !r.cast).map((r) => r.id)
    if (missing.length === 0) return
    ;(async () => {
      for (const id of missing) {
        try {
          const data = await fetchMovie(id)
          await db.movies.put({ ...data, id })
        } catch {
          // ignore
        }
      }
    })()
  }, [rows])

  return { rows: rows || [], lists: lists || [] }
}
