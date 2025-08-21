import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Button, Chip, Divider, IconButton, Stack, Typography } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { db } from '../store/db'
import { posterUrl } from '../services/tmdb'
import RatingDialog from '../features/movies/RatingDialog'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchMovie } from '../services/tmdb'

export default function MoviePage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const loc = useLocation() as any
  const movieId = id ? Number(id) : undefined
  const movie = useLiveQuery(() => (movieId ? db.movies.get(movieId) : undefined), [movieId])
  const lists = useLiveQuery(async () => {
    if (!movieId) return [] as { listId: string; rank?: number; name: string; source?: string }[]
    const items = await db.listItems.where('movieId').equals(movieId).toArray()
    const allLists = await db.lists.toArray()
    return items.map((it) => ({ listId: it.listId, rank: it.rank, name: allLists.find((l) => l.id === it.listId)?.name || it.listId, source: allLists.find((l) => l.id === it.listId)?.source }))
  }, [movieId])
  const [rate, setRate] = useState<{ rating?: number; date?: string } | null>(null)

  const currentRank = useMemo(() => {
    const fromListId: string | null | undefined = loc?.state?.fromListId
    if (!lists || lists.length === 0) return undefined
    if (fromListId) return lists.find((l) => l.listId === fromListId)?.rank
    // else prefer lowest rank across lists
    return lists
      .filter((l) => typeof l.rank === 'number')
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))[0]?.rank
  }, [lists, loc])

  // Backfill details if missing (overview/backdrop)
  useEffect(() => {
    (async () => {
    if (!movie || (!movie.overview && !movie.backdropPath)) {
        try {
          const fresh = await fetchMovie(movieId!)
          await db.movies.update(movieId!, {
            overview: fresh.overview ?? movie?.overview,
            backdropPath: fresh.backdropPath ?? movie?.backdropPath,
            runtime: fresh.runtime ?? movie?.runtime,
            genres: fresh.genres ?? movie?.genres
          })
        } catch { /* no-op */ }
      }
    })()
  }, [movieId, movie])

  if (!movie) return <Box sx={{ p: 3 }}><Typography>Loading…</Typography></Box>

  const poster = posterUrl(movie.posterPath)
  const backdrop = posterUrl(movie.backdropPath) || poster

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={() => nav(-1)} sx={{ background: 'rgba(255,255,255,0.8)', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
          <ArrowBackIosNewIcon />
        </IconButton>
        {/* Top button removed; Rate moved into hero card */}
      </Box>
    <Box
        sx={{
          position: 'relative',
      borderRadius: 2,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
        }}
      >
        {backdrop && (
          <>
            <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url(${backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.22, filter: 'blur(18px) saturate(95%)', transform: 'scale(1.1)' }} />
            {/* Darkening gradient overlay */}
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.18) 100%)' }} />
          </>
        )}
        {/* Glass Rate pill in top-right */}
        <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          <Button
            onClick={() => setRate({ rating: movie.myRating, date: movie.watchedAt })}
            startIcon={<StarRoundedIcon />}
            sx={{
              textTransform: 'none',
              borderRadius: 999,
              px: 1.5,
              py: 0.5,
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 10px 24px rgba(0,0,0,0.12)'
            }}
          >
            Rate
          </Button>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ position: 'relative', zIndex: 1, p: 2.5 }}>
          {poster && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={poster} style={{ width: 160, height: 240, borderRadius: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.25)', objectFit: 'cover' }} />
          )}
          <Stack spacing={1} sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Typography variant="h4" sx={{ fontFamily: 'Times New Roman, Georgia, serif', color: '#111' }}>{movie.title}</Typography>
              {typeof currentRank === 'number' && (
                <Chip label={`#${currentRank}`} size="small" sx={{ bgcolor: '#FAD4D8', color: '#8B2731', fontWeight: 700, borderRadius: 1.5 }} />
              )}
            </Stack>
            <Typography variant="body1" color="text.secondary">
              {movie.year} • {movie.runtime ? `${movie.runtime} min` : ''}{movie.runtime ? ' • ' : ''}{(movie.directors || []).join(', ')}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
              {/* Toggle seen by tapping eye */}
              <IconButton
                size="small"
                onClick={() => db.movies.update(movie.id, { seen: !movie.seen })}
                sx={{ color: '#E53935' }}
                aria-label={movie.seen ? 'Mark as not watched' : 'Mark as watched'}
              >
                {movie.seen ? <VisibilityRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" sx={{ opacity: 0.35 }} />}
              </IconButton>
              {typeof movie.tmdbRating === 'number' && (
                <Box title="Public rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarRoundedIcon sx={{ color: '#FFC107' }} fontSize="small" />
                  <Typography variant="body2" sx={{ color: '#222', fontWeight: 600 }}>{Number(movie.tmdbRating).toFixed(1)}</Typography>
                </Box>
              )}
              {typeof movie.myRating === 'number' && (
                <Box title="Your rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <HowToRegRoundedIcon sx={{ color: '#FB8C00' }} fontSize="small" />
                  <Typography variant="body2" sx={{ color: '#222', fontWeight: 700 }}>{Number(movie.myRating).toFixed(1)}</Typography>
                </Box>
              )}
              {movie.seen && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                  <CheckCircleRoundedIcon sx={{ color: '#34C759' }} fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Watched</Typography>
                </Box>
              )}
            </Stack>
            {movie.genres && movie.genres.length > 0 && (
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                {movie.genres.map((g) => (
                  <Chip key={g} label={g} size="small" sx={{ height: 24, borderRadius: 16, px: 0.75, bgcolor: 'rgba(0,0,0,0.06)' }} />
                ))}
              </Stack>
            )}
            {movie.genres && movie.genres.length > 0 && (
              <Chip label={movie.genres[0]} size="small" sx={{ width: 'fit-content', mt: 0.5, borderRadius: 999, px: 1, height: 26, bgcolor: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(6px)' }} />
            )}
            {movie.overview && (
              <Typography variant="body1" sx={{ mt: 1 }}>{movie.overview}</Typography>
            )}
          </Stack>
        </Stack>
      </Box>
      {/* Overview */}
      {movie.overview && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>Overview</Typography>
          <Typography variant="body1" color="text.secondary">{movie.overview}</Typography>
        </Box>
      )}
      {/* Cast */}
      {movie.cast && movie.cast.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>Cast</Typography>
          <Typography variant="body1" color="text.secondary">{(movie.cast || []).join(', ')}</Typography>
        </Box>
      )}
      {/* Featured In */}
      {lists && lists.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>Featured In</Typography>
          <Stack spacing={1}>
            {lists.map((l) => (
              <Stack key={l.listId} direction="row" alignItems="center" spacing={2} sx={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 3, px: 1.5, py: 1 }}>
                <Chip label={`#${l.rank ?? '—'}`} size="small" sx={{ bgcolor: 'rgba(255,0,0,0.08)' }} />
                <Typography sx={{ flex: 1 }}>{l.name}</Typography>
                {l.source && <Chip label={l.source} size="small" />}
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
      <RatingDialog
        open={!!rate}
        initialRating={rate?.rating}
        initialDate={rate?.date}
        onClose={() => setRate(null)}
        onSave={async (rating, date) => {
          if (!movie) return
          await db.movies.update(movie.id, { seen: true, myRating: rating, watchedAt: date })
          setRate(null)
        }}
      />
    </Box>
  )
}
