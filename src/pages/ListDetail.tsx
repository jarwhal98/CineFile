import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  LinearProgress,
  CircularProgress,
  Menu,
  MenuItem,
  Stack,
  Typography
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import VisibilityIcon from '@mui/icons-material/Visibility'
import StarIcon from '@mui/icons-material/Star'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { useNavigate as useRRNavigate } from 'react-router-dom'
import RatingDialog from '../features/movies/RatingDialog'
import { db } from '../store/db'
import { posterUrl, fetchMovie, getTmdbKey } from '../services/tmdb'
import { useAggregatedMovies } from '../features/movies/useAggregatedMovies'

export default function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const rrnav = useRRNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(anchorEl)
  const [sort, setSort] = useState<{ key: 'rank' | 'title' | 'year' | 'director'; dir: 'asc' | 'desc' }>({
    key: 'rank',
    dir: 'asc'
  })
  const [posterBg, setPosterBg] = useState<boolean>(() => {
    const s = localStorage.getItem('cinefile.posterBg')
    return s ? s === '1' : true
  })
  const [rate, setRate] = useState<{ id: number; rating?: number; date?: string } | null>(null)
  const list = useLiveQuery(() => (id ? db.lists.get(id) : undefined), [id])
  const items = useLiveQuery(() => (id ? db.listItems.where('listId').equals(id).toArray() : []), [id]) || []
  const movies = useLiveQuery(() => db.movies.toArray(), []) || []
  const allLists = useLiveQuery(() => db.lists.toArray(), []) || []
  const moviesById = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies])

  const withMovies = useMemo(() => {
    return items
      .map((it) => ({ it, movie: moviesById.get(it.movieId) }))
      .filter((x) => x.movie)
      .sort((a, b) => (a.it.rank ?? 9999) - (b.it.rank ?? 9999))
  }, [items, moviesById])

  const isAll = !id || id === 'all'
  const { rows: aggregatedRows } = useAggregatedMovies([])

  const watched = isAll
    ? aggregatedRows.filter((m) => m.seen).length
    : withMovies.filter((x) => x.movie?.seen).length
  const count = isAll ? aggregatedRows.length : list?.count || withMovies.length
  const pct = count > 0 ? Math.round((watched / count) * 100) : 0

  const titleText = isAll ? 'All Lists' : list?.name || id
  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleCloseMenu = () => setAnchorEl(null)

  // Background enrichment: fetch runtime/genres for a few missing entries
  const inflightRef = useRef<Set<number>>(new Set())
  const toEnrich = useMemo(() => {
    const pool = isAll ? aggregatedRows : withMovies.map((x) => x.movie)
    return pool
      .filter((m: any) => m && (!m.runtime || !(m.genres && m.genres.length)))
      .slice(0, 5) as any[]
  }, [isAll, aggregatedRows, withMovies])
  useEffect(() => {
    const key = getTmdbKey()
    if (!key) return
    ;(async () => {
      for (const m of toEnrich) {
        if (!m?.id || inflightRef.current.has(m.id)) continue
        inflightRef.current.add(m.id)
        try {
          const fresh = await fetchMovie(m.id)
          await db.movies.update(m.id, {
            runtime: fresh.runtime ?? m.runtime,
            genres: fresh.genres ?? m.genres,
            overview: fresh.overview ?? m.overview,
            backdropPath: fresh.backdropPath ?? m.backdropPath
          })
        } catch {
          // ignore
        } finally {
          inflightRef.current.delete(m.id)
        }
      }
    })()
  }, [toEnrich])

  return (
    <Stack spacing={2}>
      <Stack
        spacing={1}
        sx={{
          position: 'sticky',
          top: 8,
          zIndex: 2,
          background: 'rgba(250,250,248,0.85)',
          backdropFilter: 'blur(8px)',
          borderRadius: 2,
          px: 1,
          pt: 1,
          pb: 1
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Button
            onClick={handleOpenMenu}
            endIcon={<ArrowDropDownIcon sx={{ transition: 'transform 200ms', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
            sx={{
              width: 'fit-content',
              textTransform: 'none',
              p: 0,
              '&:hover': { background: 'transparent' }
            }}
          >
            <Typography variant="h4" sx={{ color: 'text.primary', fontFamily: 'Times New Roman, Georgia, serif' }}>
              {titleText}
            </Typography>
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress variant="determinate" value={pct} size={44} thickness={5} />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography variant="caption" component="div" color="text.secondary">
                  {pct}%
                </Typography>
              </Box>
            </Box>
          </Box>
        </Stack>
        {!isAll && list?.source && <Chip label={list.source} size="small" />}
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleCloseMenu}
          PaperProps={{
            sx: {
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)'
            }
          }}
        >
          <MenuItem
            selected={isAll}
            onClick={() => {
              handleCloseMenu()
              navigate('/lists')
            }}
          >
            All Lists
          </MenuItem>
          <Divider />
          {allLists.map((l) => (
            <MenuItem
              key={l.id}
              selected={!isAll && id === l.id}
              onClick={() => {
                handleCloseMenu()
                navigate(`/lists/${l.id}`)
              }}
            >
              {l.name}
            </MenuItem>
          ))}
          <Divider />
          <MenuItem
            onClick={() => {
              handleCloseMenu()
              navigate('/lists/add')
            }}
          >
            Add new list…
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              const nv = !posterBg
              setPosterBg(nv)
              localStorage.setItem('cinefile.posterBg', nv ? '1' : '0')
            }}
          >
            {posterBg ? '✓ ' : ''}Poster background
          </MenuItem>
        </Menu>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>
            {watched} of {count} watched
          </Typography>
        </Box>
  {/* Sort bubble row */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {(
            [
              { k: 'rank', label: 'List Ranking' },
              { k: 'title', label: 'Title' },
              { k: 'year', label: 'Year' },
              { k: 'director', label: 'Director' }
            ] as const
          ).map((o) => {
            const active = sort.key === o.k
            const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : ''
            return (
              <Chip
                key={o.k}
                clickable
                label={`${o.label} ${arrow}`.trim()}
                onClick={() =>
                  setSort((s) => ({ key: o.k as any, dir: s.key === o.k && s.dir === 'asc' ? 'desc' : 'asc' }))
                }
                sx={{
                  bgcolor: active ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                  color: '#111',
                  borderRadius: 1,
                  px: 1,
                  height: 24,
                  '& .MuiChip-label': { py: 0 },
                  fontWeight: active ? 700 : 500
                }}
              />
            )
          })}
  </Stack>
  <Divider />
      </Stack>
      
      <Stack spacing={2}>
        {(() => {
          const base = isAll
            ? [...aggregatedRows].sort((a, b) => (a.score ?? 1) - (b.score ?? 1) || a.title.localeCompare(b.title))
            : withMovies.map(({ it, movie }) => ({ rank: it.rank, movie }))

          let rows: { rank?: number; movie: any }[]
          if (isAll) {
            rows = (base as any[]).map((movie, idx) => ({ rank: idx + 1, movie }))
          } else {
            rows = base as any
          }

          // Sorting
          rows = [...rows]
          if (sort.key === 'rank') {
            rows.sort((a, b) => (a.rank || 0) - (b.rank || 0))
            if (sort.dir === 'desc') rows.reverse()
          } else {
            rows.sort((a, b) => {
              const am = a.movie
              const bm = b.movie
              let cmp = 0
              if (sort.key === 'title') cmp = String(am?.title || '').localeCompare(String(bm?.title || ''))
              if (sort.key === 'year') cmp = (am?.year || 0) - (bm?.year || 0)
              if (sort.key === 'director')
                cmp = String((am?.directors || [])[0] || '').localeCompare(String((bm?.directors || [])[0] || ''))
              return sort.dir === 'asc' ? cmp : -cmp
            })
          }

          return rows.map(({ rank, movie }) => {
          const poster = posterUrl(movie?.posterPath)
          const genres = (movie?.genres || []).join(', ')
          return (
            <Card
              key={`k-${movie?.id}-${rank}`}
      sx={{
    borderRadius: 1,
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        p: 0,
        
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0,0,0,0.06)',
                position: 'relative',
                overflow: 'hidden',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.06)',
                  clipPath: 'circle(0px at var(--x, 50%) var(--y, 50%))',
                  opacity: 0,
                  transition: 'clip-path 380ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease-out',
                  pointerEvents: 'none'
                },
                '&:hover::after': {
                  clipPath: 'circle(140px at var(--x, 50%) var(--y, 50%))',
                  opacity: 1
                }
              }}
              onMouseMove={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                ;(e.currentTarget as HTMLElement).style.setProperty('--x', `${x}px`)
                ;(e.currentTarget as HTMLElement).style.setProperty('--y', `${y}px`)
              }}
            >
              <CardActionArea
                sx={{ p: 0, position: 'relative' }}
                onClick={() => rrnav(`/movie/${movie?.id}` as any, { state: { fromListId: isAll ? null : id } })}
              >
                {posterBg && poster && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `url(${poster})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      opacity: 0.12,
                      filter: 'blur(10px) saturate(80%)',
                      transform: 'scale(1.1)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ p: 1.25, position: 'relative', zIndex: 1 }}>
                  {poster && (
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        image={poster}
                        alt={movie?.title}
                        sx={{ width: 84, height: 126, borderRadius: 1, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', objectFit: 'cover' }}
                      />
                      {typeof rank === 'number' && (
                        <Box sx={{ position: 'absolute', top: 6, left: 6, borderRadius: 999, px: 0.9, py: 0.2, bgcolor: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)', fontWeight: 800, fontSize: 14, color: '#111', lineHeight: 1 }}>
                          {rank}
                        </Box>
                      )}
                    </Box>
                  )}
                  <CardContent sx={{ flex: 1, p: 0, pl: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 20, mb: 0.25 }} noWrap>
                      {movie?.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15, mb: 0.25 }} noWrap>
                      {movie?.year} • {(movie?.directors || []).join(', ')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14, mb: 0.25 }} noWrap>
                      {movie?.runtime ? `${movie.runtime} min` : ''}{movie?.runtime && genres ? ' • ' : ''}{genres}
                    </Typography>
                    {movie?.cast && movie.cast.length > 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14, mb: 0.25 }} noWrap>
                        {(movie.cast || []).slice(0, 3).join(', ')}
                      </Typography>
                    )}
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                        {/* Ratings visuals: red eye • public rating • your rating */}
                        <Box aria-label="ratings" sx={{ display: 'flex', alignItems: 'center', color: '#E53935' }}>
                          <VisibilityRoundedIcon fontSize="small" />
                        </Box>
                        {typeof movie?.tmdbRating === 'number' && (
                          <Box title="Public rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarRoundedIcon sx={{ color: '#FFC107' }} fontSize="small" />
                            <Typography variant="body2" sx={{ color: '#222', fontWeight: 600 }}>
                              {Number(movie.tmdbRating).toFixed(1)}
                            </Typography>
                          </Box>
                        )}
                        {typeof movie?.myRating === 'number' && (
                          <Box title="Your rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <HowToRegRoundedIcon sx={{ color: '#FB8C00' }} fontSize="small" />
                            <Typography variant="body2" sx={{ color: '#222', fontWeight: 700 }}>
                              {Number(movie.myRating).toFixed(1)}
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ flex: 1 }} />
                        {movie?.seen ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleRoundedIcon sx={{ color: '#34C759' }} fontSize="small" />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>Watched</Typography>
                          </Box>
                        ) : (
                          <Button size="small" startIcon={<VisibilityIcon />} onClick={(e) => {
                            e.stopPropagation()
                            db.movies.update(movie.id, { seen: true })
                          }}>
                            Mark seen
                          </Button>
                        )}
                        <Button size="small" startIcon={<StarIcon />} onClick={(e) => {
                          e.stopPropagation()
                          setRate({ id: movie.id, rating: movie.myRating, date: movie.watchedAt })
                        }}>
                          Rate
                        </Button>
                      </Stack>
                  </CardContent>
                </Stack>
              </CardActionArea>
            </Card>
          )
          })
        })()}
      </Stack>
        <RatingDialog
          open={!!rate}
          initialRating={rate?.rating}
          initialDate={rate?.date}
          onClose={() => setRate(null)}
          onSave={async (rating, date) => {
            if (!rate) return
            await db.movies.update(rate.id, { seen: true, myRating: rating, watchedAt: date })
            setRate(null)
          }}
        />
    </Stack>
  )
}
