import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Box, Button, Card, CardActionArea, CardContent, CardMedia, Chip, Divider, IconButton, Menu, MenuItem, Stack, Typography, Dialog, DialogTitle, DialogContent, TextField } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import StarIcon from '@mui/icons-material/Star'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useNavigate, useParams } from 'react-router-dom'
import RatingDialog from '../features/movies/RatingDialog'
import { db } from '../store/db'
import { posterUrl, fetchMovie, getTmdbKey, searchMovies } from '../services/tmdb'
import { useAggregatedMovies } from '../features/movies/useAggregatedMovies'
// Star bar removed in favor of numeric user rating next to user-check icon

export default function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(anchorEl)
  const [sort, setSort] = useState<{ key: 'rank' | 'title' | 'year' | 'director'; dir: 'asc' | 'desc' }>({ key: 'rank', dir: 'asc' })
  // Removed poster background overlays; keep UI clean and glassy
  const [rate, setRate] = useState<{ id: number; rating?: number; date?: string } | null>(null)
  const [replace, setReplace] = useState<{ movieId: number; title: string } | null>(null)
  const [repQuery, setRepQuery] = useState('')
  const [repBusy, setRepBusy] = useState(false)
  const [repErr, setRepErr] = useState<string | null>(null)
  const [repResults, setRepResults] = useState<Array<{ id: number; title: string; year?: number; posterPath?: string }>>([])
  const [itemMenu, setItemMenu] = useState<{ anchorEl: HTMLElement; movieId: number; title: string } | null>(null)

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
  // Remember last used concrete list id for root redirect
  useEffect(() => {
    if (id && id !== 'all') {
      try { localStorage.setItem('cinefile:lastListId', id) } catch {}
    }
  }, [id])
  const { rows: aggregatedRows } = useAggregatedMovies([])

  const watched = isAll ? aggregatedRows.filter((m) => m.seen).length : withMovies.filter((x) => x.movie?.seen).length
  const count = isAll ? aggregatedRows.length : list?.count || withMovies.length
  const pct = count > 0 ? Math.round((watched / count) * 100) : 0

  // Progress card defines the pinned header height; add a bit more room for chips
  const squareSize = useMemo(() => 100, [])

  const titleText = isAll ? 'All Lists' : list?.name || id
  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleCloseMenu = () => setAnchorEl(null)

  const inflightRef = useRef<Set<number>>(new Set())
  const toEnrich = useMemo(() => {
    const pool = isAll ? aggregatedRows : withMovies.map((x) => x.movie)
    return pool.filter((m: any) => m && (!m.runtime || !(m.genres && m.genres.length))).slice(0, 5) as any[]
  }, [isAll, aggregatedRows, withMovies])
  useEffect(() => {
    const key = getTmdbKey(); if (!key) return
    ;(async () => {
      for (const m of toEnrich) {
        if (!m?.id || inflightRef.current.has(m.id)) continue
        inflightRef.current.add(m.id)
        try {
          const fresh = await fetchMovie(m.id)
          await db.movies.update(m.id, { runtime: fresh.runtime ?? m.runtime, genres: fresh.genres ?? m.genres, overview: fresh.overview ?? m.overview, backdropPath: fresh.backdropPath ?? m.backdropPath })
        } catch { /* ignore */ } finally { inflightRef.current.delete(m.id) }
      }
    })()
  }, [toEnrich])

  return (
    <Stack spacing={2} sx={{ pb: 10 }}>
  <Stack direction="row" spacing={1} sx={{ position: 'sticky', top: 8, zIndex: 2, background: 'rgba(250,250,248,0.85)', backdropFilter: 'blur(8px)', borderRadius: 2, px: 1, pt: 1, pb: 1.25, alignItems: 'stretch' }}>
        {/* Left: title at top, chips at bottom, space defined by progress card height */}
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0, height: squareSize, display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Button onClick={handleOpenMenu} endIcon={<ArrowDropDownIcon sx={{ transition: 'transform 200ms', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />} sx={{ width: 'fit-content', textTransform: 'none', p: 0, '&:hover': { background: 'transparent' } }}>
              <Typography variant="h4" sx={{ color: 'text.primary', fontFamily: 'Times New Roman, Georgia, serif' }}>{titleText}</Typography>
            </Button>
          </Box>
          <Stack direction="row" spacing={1}>
            {([
              { k: 'rank', label: 'List Ranking' },
              { k: 'title', label: 'Title' },
              { k: 'year', label: 'Year' },
              { k: 'director', label: 'Director' }
            ] as const).map((o) => {
              const active = sort.key === o.k; const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : ''
              return (
                <Chip key={o.k} clickable label={`${o.label} ${arrow}`.trim()} onClick={() => setSort((s) => ({ key: o.k as any, dir: s.key === o.k && s.dir === 'asc' ? 'desc' : 'asc' }))} sx={{ bgcolor: active ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)', color: '#111', borderRadius: 1, px: 1, height: 24, '& .MuiChip-label': { py: 0 }, fontWeight: active ? 700 : 500 }} />
              )
            })}
          </Stack>
          <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleCloseMenu} PaperProps={{ sx: { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' } }}>
            <MenuItem selected={isAll} onClick={() => { handleCloseMenu(); navigate('/lists') }}>All Lists</MenuItem>
            <Divider />
            {allLists.map((l) => (<MenuItem key={l.id} selected={!isAll && id === l.id} onClick={() => { handleCloseMenu(); navigate(`/lists/${l.id}`) }}>{l.name}</MenuItem>))}
            <Divider />
            <MenuItem onClick={() => { handleCloseMenu(); navigate('/lists/add') }}>Add new list…</MenuItem>
            <MenuItem onClick={() => { handleCloseMenu(); navigate('/lists/manage') }}>Manage lists…</MenuItem>
            <Divider />
          </Menu>
        </Stack>
  {/* Right progress square outside, aligned to top of title and above divider */}
  <Box sx={{ width: squareSize, height: squareSize, flex: '0 0 auto', alignSelf: 'flex-start' }}>
          <ProgressSquare title={titleText} pct={pct} size={squareSize} watched={watched} total={count} />
        </Box>
      </Stack>
  {/* Divider sits below the pinned header row */}
  <Divider sx={{ mt: 0.25 }} />

      <Stack spacing={2}>
        {(() => {
          const base = isAll ? [...aggregatedRows].sort((a, b) => (a.score ?? 1) - (b.score ?? 1) || a.title.localeCompare(b.title)) : withMovies.map(({ it, movie }) => ({ rank: it.rank, movie }))
          let rows: { rank?: number; movie: any }[]
          rows = isAll ? (base as any[]).map((movie, idx) => ({ rank: idx + 1, movie })) : (base as any)
          rows = [...rows]
          if (sort.key === 'rank') {
            rows.sort((a, b) => (a.rank || 0) - (b.rank || 0)); if (sort.dir === 'desc') rows.reverse()
          } else {
            rows.sort((a, b) => {
              const am = a.movie; const bm = b.movie
              let cmp = 0
              if (sort.key === 'title') cmp = String(am?.title || '').localeCompare(String(bm?.title || ''))
              if (sort.key === 'year') cmp = (am?.year || 0) - (bm?.year || 0)
              if (sort.key === 'director') cmp = String((am?.directors || [])[0] || '').localeCompare(String((bm?.directors || [])[0] || ''))
              return sort.dir === 'asc' ? cmp : -cmp
            })
          }

          return rows.map(({ rank, movie }) => {
            const poster = posterUrl(movie?.posterPath)
            const genres = (movie?.genres || []).join(', ')
            return (
              <Card key={`k-${movie?.id}-${rank}`} sx={{ borderRadius: 1, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', p: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.06)', ...(movie?.seen ? { border: '1px solid rgba(52,199,89,0.35)', boxShadow: '0 0 0 2px rgba(52,199,89,0.18) inset, 0 10px 30px rgba(0,0,0,0.08)' } : {}), position: 'relative', overflow: 'hidden', '&::after': { content: '""', position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)', clipPath: 'circle(0px at var(--x, 50%) var(--y, 50%))', opacity: 0, transition: 'clip-path 380ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease-out', pointerEvents: 'none' }, '&:hover::after': { clipPath: 'circle(140px at var(--x, 50%) var(--y, 50%))', opacity: 1 } }} onMouseMove={(e) => { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; (e.currentTarget as HTMLElement).style.setProperty('--x', `${x}px`); (e.currentTarget as HTMLElement).style.setProperty('--y', `${y}px`) }}>
                <CardActionArea sx={{ p: 0, position: 'relative' }} onClick={() => navigate(`/movie/${movie?.id}` as any, { state: { fromListId: isAll ? null : id } })}>
                  {movie?.seen && (<Box aria-label="Seen" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.25, borderRadius: 999, color: '#fff', fontWeight: 800, fontSize: 12, background: 'linear-gradient(135deg, rgba(52,199,89,0.98), rgba(52,199,89,0.78))', boxShadow: '0 6px 16px rgba(52,199,89,0.35), inset 0 0 0 1px rgba(255,255,255,0.25)' }}><CheckCircleRoundedIcon sx={{ fontSize: 16 }} />Seen</Box>)}
                  {/* Background poster overlay removed for a cleaner glass look */}
                  <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ px: 1.25, pt: 1.25, pb: 0.5, position: 'relative', zIndex: 1 }}>
                    {poster && (
                      <Box sx={{ position: 'relative', ml: -1.25, mt: -1.25, mb: -0.5 }}>
                        <CardMedia component="img" image={poster} alt={movie?.title} sx={{ width: 96, height: 144, borderRadius: 0, display: 'block', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', objectFit: 'cover', ...(movie?.seen ? { filter: 'grayscale(70%) saturate(80%) brightness(0.95)' } : {}) }} />
                        {typeof rank === 'number' && (<Box sx={{ position: 'absolute', top: 6, left: 6, borderRadius: 999, px: 1, py: 0.35, color: '#111', fontWeight: 800, fontSize: 14, lineHeight: 1, background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 100%)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 12px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.06)', backdropFilter: 'blur(10px) saturate(140%)' }}>{rank}</Box>)}
                      </Box>
                    )}
                    <CardContent sx={{ flex: 1, p: 0, pl: 1.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 20, mb: 0.2 }} noWrap>{movie?.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15, mb: 0.2 }} noWrap>{movie?.year} • {(movie?.directors || []).join(', ')}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14, mb: 0.2 }} noWrap>{movie?.runtime ? `${movie.runtime} min` : ''}{movie?.runtime && genres ? ' • ' : ''}{genres}</Typography>
                      {movie?.cast && movie.cast.length > 0 && (<Typography variant="body2" color="text.secondary" sx={{ fontSize: 14, mb: 0.2 }} noWrap>{(movie.cast || []).slice(0, 3).join(', ')}</Typography>)}
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.25 }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); db.movies.update(movie.id, { seen: !movie.seen }) }} sx={{ color: movie?.seen ? '#E53935' : 'rgba(229,57,53,0.45)' }} aria-label={movie?.seen ? 'Mark as not watched' : 'Mark as watched'}>
                          <VisibilityRoundedIcon fontSize="small" />
                        </IconButton>
                        {typeof movie?.tmdbRating === 'number' && (<Box title="Public rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><StarRoundedIcon sx={{ color: '#FFC107' }} fontSize="small" /><Typography variant="body2" sx={{ color: '#222', fontWeight: 600 }}>{Number(movie.tmdbRating).toFixed(1)}</Typography></Box>)}
                        {typeof movie?.myRating === 'number' && (
                          <Box title="Your rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <HowToRegRoundedIcon sx={{ color: '#FB8C00' }} fontSize="small" />
                            <Typography variant="body2" sx={{ color: '#FB8C00', fontWeight: 800 }}>{Number(movie.myRating).toFixed(1)}</Typography>
                          </Box>
                        )}
                        <Box sx={{ flex: 1 }} />
                        <Button size="small" startIcon={<StarIcon />} onClick={(e) => { e.stopPropagation(); setRate({ id: movie.id, rating: movie.myRating, date: movie.watchedAt }) }}>Rate</Button>
                        {!isAll && list?.visibility === 'public' && (
                          <IconButton
                            size="small"
                            sx={{ ml: 0.5, color: 'rgba(0,0,0,0.5)' }}
                            aria-label="More actions"
                            onClick={(e) => { e.stopPropagation(); setItemMenu({ anchorEl: e.currentTarget, movieId: movie.id, title: movie.title || '' }) }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </CardContent>
                  </Stack>
                </CardActionArea>
              </Card>
            )
          })
        })()}
      </Stack>

      <RatingDialog open={!!rate} initialRating={rate?.rating} initialDate={rate?.date} onClose={() => setRate(null)} onSave={async (rating, date) => { if (!rate) return; await db.movies.update(rate.id, { seen: true, myRating: rating, watchedAt: date }); setRate(null) }} />

      {/* Per-item actions menu (unobtrusive) */}
      <Menu
        anchorEl={itemMenu?.anchorEl || null}
        open={Boolean(itemMenu)}
        onClose={() => setItemMenu(null)}
        PaperProps={{ sx: { background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' } }}
      >
        {!isAll && list?.visibility === 'public' && (
          <MenuItem onClick={() => {
            if (!itemMenu) return
            setReplace({ movieId: itemMenu.movieId, title: itemMenu.title })
            setRepQuery(itemMenu.title)
            setRepResults([])
            setRepErr(null)
            setItemMenu(null)
          }}>Replace…</MenuItem>
        )}
      </Menu>

      {/* Replace Movie dialog for correcting public list matches */}
      <Dialog open={!!replace} onClose={() => !repBusy && setReplace(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Replace movie in this list</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Search TMDB"
              placeholder="Type a movie title"
              value={repQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepQuery(e.target.value)}
              fullWidth
            />
            <Button onClick={async () => {
              setRepBusy(true); setRepErr(null)
              try {
                const res = await searchMovies(repQuery)
                setRepResults(res)
              } catch (e) {
                setRepErr('Search failed. Check your TMDB key in Settings.')
              } finally { setRepBusy(false) }
            }} disabled={repBusy || !repQuery.trim()} variant="outlined">Search</Button>
            {repErr && <Typography color="error" variant="body2">{repErr}</Typography>}
            <Stack spacing={1}>
              {repResults.map((r) => (
                <Card key={r.id}>
                  <CardActionArea onClick={async () => {
                    if (!replace || !id) return
                    setRepBusy(true); setRepErr(null)
                    try {
                      const li = await db.listItems.where('listId').equals(id).and((li) => li.movieId === replace.movieId).first()
                      if (!li) { setRepErr('Original list item not found.'); setRepBusy(false); return }
                      const dup = await db.listItems.where('listId').equals(id).and((li) => li.movieId === r.id).first()
                      if (dup) { setRepErr('That movie is already in this list. Remove the duplicate first.'); setRepBusy(false); return }
                      await db.listItems.update(li.id, { movieId: r.id })
                      const has = await db.movies.get(r.id)
                      if (!has) {
                        try { const data = await fetchMovie(r.id); await db.movies.put(data) } catch {}
                      }
                      setReplace(null)
                    } finally { setRepBusy(false) }
                  }}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {r.posterPath && <img src={posterUrl(r.posterPath)} alt="poster" style={{ height: 60, borderRadius: 6 }} />}
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{r.title}</Typography>
                        {r.year && <Typography variant="body2" color="text.secondary">({r.year})</Typography>}
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  )
}

function ProgressSquare({ title, pct, size, watched, total }: { title: string; pct: number; size: number; watched?: number; total?: number }) {
  const stroke = Math.max(6, Math.round(size * 0.08))
  // Add a bit of inner padding so the ring doesn't touch the glass edges
  const pad = Math.max(6, Math.round(size * 0.06))
  const inner = size - stroke - pad * 2
  const r = inner / 2
  const c = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, pct / 100)) * c
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
  <Box sx={{ position: 'absolute', inset: 0, borderRadius: 3, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px) saturate(140%)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 12px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)' }} />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#62A9F5" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`} />
          <text x="50%" y="48%" dominantBaseline="middle" textAnchor="middle" fontSize={Math.max(10, Math.round(size * 0.2))} fontWeight="800" fill="#62A9F5">{pct}%</text>
          {typeof watched === 'number' && typeof total === 'number' && (<text x="50%" y="64%" dominantBaseline="middle" textAnchor="middle" fontSize={Math.max(8, Math.round(size * 0.12))} fontWeight="700" fill="rgba(0,0,0,0.6)">{watched} of {total}</text>)}
        </svg>
      </Box>
    </Box>
  )
}
      
