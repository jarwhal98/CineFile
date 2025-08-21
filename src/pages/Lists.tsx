import { useLiveQuery } from 'dexie-react-hooks'
import {
  Box,
  Stack,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Card,
  CardActionArea,
  CardContent,
  Menu,
  MenuItem,
  Autocomplete
} from '@mui/material'
import Papa from 'papaparse'
import { db } from '../store/db'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchMovieId, fetchMovie, getTmdbKey } from '../services/tmdb'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function Lists() {
  const navigate = useNavigate()
  const lists = useLiveQuery(() => db.lists.toArray(), []) || []

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)

  const [wiping, setWiping] = useState(false)
  const [clearingLists, setClearingLists] = useState(false)

  // Add List menu
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null)
  const addMenuOpen = Boolean(addAnchor)

  // From CSV dialog state
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvTitle, setCsvTitle] = useState('')
  const [csvSource, setCsvSource] = useState<string>('')
  const [csvStatus, setCsvStatus] = useState<string>('')
  const [csvBusy, setCsvBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sourceOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of lists) {
      const s = (l.slug || l.source || '').toString().trim()
      if (s) set.add(s)
    }
    return Array.from(set).sort()
  }, [lists])

  // From Scratch dialog state
  const [scratchOpen, setScratchOpen] = useState(false)
  const [scratchTitle, setScratchTitle] = useState('')
  const [scratchSource, setScratchSource] = useState<string>('User')
  const [scratchBusy, setScratchBusy] = useState(false)

  async function wipeAll() {
    setWiping(true)
    await db.transaction('rw', db.lists, db.listItems, db.movies, async () => {
      await db.lists.clear()
      await db.listItems.clear()
      await db.movies.clear()
    })
    setWiping(false)
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem('cinefile:seedDone') } catch {}
    window.location.reload()
  }

  async function clearAllListsOnly() {
    setClearingLists(true)
    await db.transaction('rw', db.lists, db.listItems, async () => {
      await db.lists.clear()
      await db.listItems.clear()
    })
    setClearingLists(false)
  }

  // CSV handlers
  function onPickCsv() {
    fileInputRef.current?.click()
  }
  function onCsvInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    if (f) {
      setCsvFile(f)
      if (!csvTitle) setCsvTitle(f.name.replace(/\.[^/.]+$/, ''))
    }
    e.target.value = ''
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setCsvFile(f)
      if (!csvTitle) setCsvTitle(f.name.replace(/\.[^/.]+$/, ''))
    }
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  async function importCsv() {
    if (!csvFile) { setCsvStatus('Please select a CSV file.'); return }
    const name = csvTitle.trim()
    if (!name) { setCsvStatus('Please enter a title.'); return }
    const source = (csvSource || 'Imported').trim()
    setCsvBusy(true)
    setCsvStatus('Parsing CSV...')
    let rows: any[] = []
    try {
      rows = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(csvFile, { header: true, skipEmptyLines: true, complete: (res) => resolve(res.data as any[]), error: reject })
      })
    } catch (e) {
      setCsvStatus('CSV parse failed: ' + String(e))
      setCsvBusy(false)
      return
    }

    setCsvStatus(`Resolving ${rows.length} rows...`)
    const listId = slugify(name)
    const now = new Date().toISOString()
    const items: { id: string; listId: string; movieId: number; rank?: number; addedAt: string }[] = []
    let skipped = 0
    const tmdbKey = getTmdbKey()
    let count = 0
    let needSearch = 0
    let hadTmdbId = 0
    for (const raw of rows) {
      // Normalize headers to lower_snake and trim values
      const norm = Object.fromEntries(Object.entries(raw).map(([k, v]) => [String(k).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'), typeof v === 'string' ? v.trim() : v])) as any
      const title = norm.title || norm.movie || norm.film || norm.name || ''
      const yearRaw = norm.year || norm.date || ''
      const year = typeof yearRaw === 'number' ? yearRaw : (String(yearRaw).match(/\d{4}/)?.[0] ? Number(String(yearRaw).match(/\d{4}/)![0]) : undefined)
      const rankVal = norm.rank ?? norm.position ?? norm.pos ?? norm.no
      const rank = rankVal !== undefined && rankVal !== '' ? Number(rankVal) : undefined
      let tmdbId: number | undefined
      const idCand = norm.tmdb_id ?? norm.tmdbid ?? norm.tmdb ?? undefined
      if (idCand !== undefined && idCand !== '') {
        const n = Number(idCand)
        tmdbId = Number.isFinite(n) && n > 0 ? n : undefined
      }
      if (!tmdbId) {
        if (!title) { skipped++; continue }
        needSearch++
        if (!tmdbKey) { skipped++; continue }
        try {
          tmdbId = await searchMovieId(String(title), year)
        } catch {
          tmdbId = undefined
        }
      }
      else { hadTmdbId++ }
      if (!tmdbId) { skipped++; continue }
      count++
      items.push({ id: `${listId}:${rank ?? count}`, listId, movieId: tmdbId, rank, addedAt: now })
    }

    if (items.length === 0) {
      const reason = !tmdbKey && needSearch > 0 ? 'No TMDB API key set and CSV lacks tmdb_id values.' : 'No rows could be resolved to TMDB ids.'
      setCsvStatus(`Nothing to import. ${reason}`)
      setCsvBusy(false)
      return
    }

    setCsvStatus(`Writing ${items.length} items to database...${skipped ? ` (${skipped} skipped)` : ''}${!tmdbKey && needSearch > 0 ? ' (skipped rows needing TMDB lookups; set your API key in Settings)' : ''}`)
    try {
      await db.transaction('rw', db.lists, db.listItems, async () => {
        await db.lists.put({
          id: listId,
          name,
          source,
          slug: source,
          itemCount: items.length,
          count: items.length,
          createdAt: now,
          updatedAt: now,
          createdBy: 'import',
          visibility: 'public'
        })
        const existing = await db.listItems.where('listId').equals(listId).toArray()
        if (existing.length) await db.listItems.bulkDelete(existing.map(i => i.id))
        if (items.length) await db.listItems.bulkPut(items)
      })
      // fetch missing movie details
      const ids = items.map(i => i.movieId)
      const have = await db.movies.bulkGet(ids)
      for (let i = 0; i < ids.length; i++) {
        if (!have[i]) {
          try {
            const data = await fetchMovie(ids[i])
            await db.movies.put(data)
          } catch {}
        }
      }
      setCsvStatus(`Import complete! Added ${items.length}${skipped ? `, skipped ${skipped}` : ''}.`)
      setTimeout(() => {
        setCsvBusy(false)
        setCsvOpen(false)
        setCsvFile(null)
        setCsvTitle('')
        setCsvSource('')
        setCsvStatus('')
      }, 500)
    } catch (e) {
      setCsvStatus('DB write failed: ' + String(e))
      setCsvBusy(false)
    }
  }

  async function createScratch() {
    const name = scratchTitle.trim()
    if (!name) return
    const id = slugify(name)
    const exists = await db.lists.get(id)
    if (exists) { alert('A list with this id already exists.'); return }
    setScratchBusy(true)
    const now = new Date().toISOString()
    await db.lists.put({
      id,
      name,
      source: scratchSource || 'User',
      slug: scratchSource || 'User',
      itemCount: 0,
      count: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: 'user',
      visibility: 'private'
    })
    setScratchBusy(false)
    setScratchOpen(false)
    setScratchTitle('')
    setScratchSource('User')
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Lists</Typography>
        <Stack direction="row" spacing={1}>
          <Button color="error" variant="outlined" onClick={wipeAll} disabled={wiping}>
            {wiping ? 'Wiping...' : 'Wipe All Data'}
          </Button>
          <Button variant="outlined" onClick={clearAllListsOnly} disabled={clearingLists}>
            {clearingLists ? 'Clearing...' : 'Clear All Lists'}
          </Button>
          <Button variant="contained" onClick={(e) => setAddAnchor(e.currentTarget)}>Add List</Button>
          <Menu anchorEl={addAnchor} open={addMenuOpen} onClose={() => setAddAnchor(null)}>
            <MenuItem onClick={() => { setAddAnchor(null); setCsvOpen(true) }}>From CSV</MenuItem>
            <MenuItem onClick={() => { setAddAnchor(null); setScratchOpen(true) }}>From Scratch</MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* Compact vertical bubbles */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
        {lists.map((l) => (
          <Card key={l.id} sx={{ borderRadius: 3, py: 0.5, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0.45))',
            backdropFilter: 'blur(14px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.04)'
          }}>
            <CardActionArea onClick={() => navigate(`/lists/${l.id}`)}>
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Stack spacing={0.75} direction="row" alignItems="center" justifyContent="space-between">
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap title={l.name}>{l.name}</Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                      {l.slug && <Chip size="small" label={l.slug} variant="outlined" />}
                      <Chip size="small" label={l.visibility ?? 'public'} color={(l.visibility === 'private') ? 'warning' : 'success'} variant="outlined" />
                      <Chip size="small" label={`${l.itemCount ?? l.count ?? 0} films`} />
                      {l.updatedAt && <Typography variant="caption" color="text.secondary">Updated {new Date(l.updatedAt).toLocaleDateString()}</Typography>}
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={(e) => { e.stopPropagation(); setRenaming({ id: l.id, name: l.name }); setNewName(l.name) }}>Rename</Button>
                    <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleting({ id: l.id, name: l.name }) }}>Delete</Button>
                  </Stack>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      {/* From CSV dialog */}
      <Dialog open={csvOpen} onClose={() => !csvBusy && setCsvOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import from CSV</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box
              onDrop={onDrop}
              onDragOver={onDragOver}
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                bgcolor: 'action.hover',
                cursor: 'pointer'
              }}
              onClick={onPickCsv}
            >
              <Typography>{csvFile ? csvFile.name : 'Drag and drop CSV here'}</Typography>
              <Typography variant="caption" color="text.secondary">or click to choose a file</Typography>
            </Box>
            <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={onCsvInput} />
            <TextField label="Title" required value={csvTitle} onChange={(e) => setCsvTitle(e.target.value)} />
            <Autocomplete
              freeSolo
              options={sourceOptions}
              value={csvSource}
              onInputChange={(_, v) => setCsvSource(v)}
              renderInput={(params) => <TextField {...params} label="Source" placeholder="Choose or add a source" />}
            />
            {csvStatus && <Alert severity={csvStatus.includes('failed') ? 'error' : 'info'}>{csvStatus}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvOpen(false)} disabled={csvBusy}>Cancel</Button>
          <Button variant="contained" onClick={importCsv} disabled={csvBusy || !csvTitle.trim()}>Import</Button>
        </DialogActions>
      </Dialog>

      {/* From Scratch dialog */}
      <Dialog open={scratchOpen} onClose={() => !scratchBusy && setScratchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a list</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" required value={scratchTitle} onChange={(e) => setScratchTitle(e.target.value)} />
            <Autocomplete
              freeSolo
              options={sourceOptions}
              value={scratchSource}
              onInputChange={(_, v) => setScratchSource(v)}
              renderInput={(params) => <TextField {...params} label="Source" placeholder="User, NYTimes, TSPDT, ..." />}
            />
            <Alert severity="info">You can add films later from the list view.</Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScratchOpen(false)} disabled={scratchBusy}>Cancel</Button>
          <Button variant="contained" onClick={createScratch} disabled={scratchBusy || !scratchTitle.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renaming} onClose={() => setRenaming(null)}>
        <DialogTitle>Rename list</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="List name" fullWidth value={newName} onChange={(e) => setNewName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button variant="contained" onClick={async () => { if (!renaming) return; const name = newName.trim(); if (!name) { setRenaming(null); return } await db.lists.update(renaming.id, { name, updatedAt: new Date().toISOString() }); setRenaming(null) }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>Delete list</DialogTitle>
        <DialogContent>
          Are you sure you want to delete “{deleting?.name}”? This removes the list and its items (movies are kept).
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => { if (!deleting) return; await db.transaction('rw', db.lists, db.listItems, async () => { await db.listItems.where('listId').equals(deleting.id).delete(); await db.lists.delete(deleting.id) }); setDeleting(null) }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
