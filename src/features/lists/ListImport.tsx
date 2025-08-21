import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Button, Stack } from '@mui/material'
import { db, ListDef, ListItem } from '../../store/db'
import { searchMovieId, fetchMovie } from '../../services/tmdb'

// Expected CSV headers: rank,title,tmdb_id,year
// If tmdb_id is missing, we will try to resolve via TMDB search using title/year.
export default function ListImport() {
  const csvInputRef = useRef<HTMLInputElement>(null)
  const jsInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<string>('')
  const [debug, setDebug] = useState<{lists:any[],movies:any[]}|null>(null)

  function openCsvFile() {
    csvInputRef.current?.click()
  }
  function openJsFile() {
    jsInputRef.current?.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportStatus('Importing...')
    const file = e.target.files?.[0]
    if (!file) return

    const base = file.name.replace(/\.[^/.]+$/, '')
    const listId = base.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const now = new Date().toISOString()
    const list: ListDef = {
      id: listId,
      name: base,
      source: file.name,
      slug: base.split(/[\s:_-]/)[0] || 'Imported',
      createdAt: now,
      updatedAt: now,
      createdBy: 'import',
      visibility: 'public',
      itemCount: 0,
      count: 0
    }

    let parsed: any[] = []
    try {
      parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res: Papa.ParseResult<any>) => resolve(res.data as any[]),
          error: reject
        })
      })
    } catch (err) {
      setImportStatus('CSV parse failed: ' + String(err))
      e.target.value = ''
      return
    }

    const items: ListItem[] = []
    let count = 0
    for (const row of parsed) {
      const rank = row.rank ? Number(row.rank) : undefined
      let tmdbId = row.tmdb_id ? Number(row.tmdb_id) : undefined
      if (!tmdbId && row.title) {
        try {
          tmdbId = await searchMovieId(String(row.title), row.year ? Number(row.year) : undefined)
        } catch (err) {
          setImportStatus('TMDB search failed for ' + row.title + ': ' + String(err))
        }
      }
      if (!tmdbId) {
        setImportStatus('No TMDB id for: ' + row.title)
        continue
      }
      count++
        items.push({ id: `${listId}:${rank ?? count}`, listId, movieId: tmdbId, rank, addedAt: now })
    }

    list.count = count
    list.itemCount = count

    try {
      await db.transaction('rw', db.lists, db.listItems, async () => {
        await db.lists.put(list)
        // remove existing items for this list
        const existing = await db.listItems.where('listId').equals(listId).toArray()
        if (existing.length) await db.listItems.bulkDelete(existing.map((i) => i.id))
          if (items.length) await db.listItems.bulkPut(items)
          await db.lists.update(listId, { itemCount: items.length, count: items.length, updatedAt: new Date().toISOString() })
      })
      // Fetch movie details outside the transaction
      const missing = items.map((i) => i.movieId)
      const have = await db.movies.bulkGet(missing)
      for (let idx = 0; idx < missing.length; idx++) {
        if (!have[idx]) {
          try {
            const data = await fetchMovie(missing[idx])
            await db.movies.put(data)
          } catch (err) {
            setImportStatus('TMDB fetch failed for id ' + missing[idx] + ': ' + String(err))
          }
        }
      }
      setImportStatus('Import complete!')
    } catch (err) {
      setImportStatus('DB write failed: ' + String(err))
    }

  e.target.value = ''
  // Debug: show DB contents
  const lists = await db.lists.toArray()
  const movies = await db.movies.toArray()
  setDebug({ lists, movies })
  }

  async function onJsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    // Try to locate an exported MOVIES array. We'll attempt a safe parse by
    // evaluating the file in a Function sandbox and reading MOVIES.
    let movies: any[] | undefined
    try {
      // Wrap in a function so top-level exports still work.
      // eslint-disable-next-line no-new-func
      const fn = new Function(`${text}; return typeof MOVIES !== 'undefined' ? MOVIES : (typeof exports !== 'undefined' && exports.MOVIES) || undefined;`)
      // eslint-disable-next-line no-eval
      movies = fn() as any[]
    } catch (err) {
      // parsing failed
      movies = undefined
    }

    if (!movies || !Array.isArray(movies)) {
      e.target.value = ''
      return
    }

    // Build a pseudo-CSV parsed rows: rank,title,tmdb_id,year
    const rows = movies.map((m: any, idx: number) => ({ rank: m.rank ?? idx + 1, title: m.title, year: m.year, tmdb_id: m.tmdb_id }))

    // Convert rows to same path as CSV import: reuse logic by building a blob and parsing with Papa
    const csv = Papa.unparse(rows)
    // create a temporary file-like object using Blob
    const blob = new Blob([csv], { type: 'text/csv' })
    const tempFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}.csv`, { type: 'text/csv' })
    // call the same handler path
    const fakeEvent = { target: { files: [tempFile], value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>
    await onFile(fakeEvent)
    e.target.value = ''
  }

  return (
    <>
    <Stack direction="row" spacing={1}>
        <input ref={csvInputRef} type="file" accept=".csv" hidden onChange={onFile} />
        <input ref={jsInputRef} type="file" accept=".js,.json" hidden onChange={onJsFile} />
        <Button variant="contained" onClick={openCsvFile}>
          Import CSV
        </Button>
        <Button variant="outlined" onClick={openJsFile}>
          Import JS
        </Button>
      </Stack>
      {importStatus && (
        <div style={{ color: importStatus.includes('failed') ? 'red' : 'green', fontSize: 14, marginTop: 8 }}>{importStatus}</div>
      )}
      {debug && (
        <pre style={{ maxHeight: 200, overflow: 'auto', background: '#222', color: '#fff', fontSize: 12, marginTop: 8 }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}
    </>
  )
}
