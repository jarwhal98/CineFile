import { useEffect, useMemo, useState } from 'react'
import { Box, Card, CardActionArea, CardContent, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import { searchMovieId, fetchMovie, posterUrl } from '../services/tmdb'
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
      let out = local
      // If none found locally, try TMDB search for an id, then fetch and cache
      if (out.length === 0) {
        const id = await searchMovieId(query)
        if (id) {
          const data = await fetchMovie(id)
          await db.movies.put(data)
          out = [data]
        }
      }
      setResults(out)
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
