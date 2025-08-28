import { useEffect, useMemo, useState } from 'react'
import { Box, Card, CardActionArea, CardContent, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import { searchMovieId, fetchMovie, posterUrl, searchMovies } from '../services/tmdb'
import { db } from '../store/db'
import { useNavigate } from 'react-router-dom'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const navigate = useNavigate()

  async function runSearch() {
    const query = q.trim()
    if (!query) { setResults([]); return }
    setBusy(true)
    try {
      // First try: local title or cast/director includes
      const all = await db.movies.toArray()
      const needle = query.toLowerCase()
      const local = all.filter(m => m.title.toLowerCase().includes(needle) || (m.directors||[]).join(',').toLowerCase().includes(needle) || (m.cast||[]).join(',').toLowerCase().includes(needle))
      // TMDB search to expand results
      const tmdb = await searchMovies(query)
      // Merge and dedupe by id
      const map = new Map<number, any>()
      for (const m of local) map.set(m.id, m)
      for (const r of tmdb) {
        if (!map.has(r.id)) map.set(r.id, r)
      }
      const out = Array.from(map.values())
      // Ensure we have DB entries for TMDB-only hits to allow navigation
      const toFetch = out.filter((m: any) => !('overview' in m || 'genres' in m)).slice(0, 5)
      for (const m of toFetch) {
        try {
          const full = await fetchMovie(m.id)
          await db.movies.put(full)
          // Replace shallow with full in results map
          map.set(full.id, full)
        } catch {}
      }
      const finalOut = Array.from(map.values())
      setResults(finalOut)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(runSearch, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <Stack spacing={2}>
      <TextField
        autoFocus
        placeholder="Search by title, director, or cast"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: q ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setQ('')}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ) : null
        }}
      />
      <Stack spacing={1.25}>
        {results.map(r => (
          <Card key={r.id} sx={{ borderRadius: 2 }}>
            <CardActionArea onClick={() => navigate(`/movie/${r.id}`)}>
              <CardContent>
                <Stack direction="row" spacing={1.25}>
                  {r.posterPath && (
                    <img src={posterUrl(r.posterPath)} alt={r.title} style={{ height: 80, borderRadius: 8 }} />
                  )}
                  <Box>
                    <Typography variant="subtitle1">{r.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{r.year} • {(r.directors||[]).join(', ')}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {!busy && q && results.length === 0 && (
          <Typography color="text.secondary">No results</Typography>
        )}
      </Stack>
    </Stack>
  )
}
