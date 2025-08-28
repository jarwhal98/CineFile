import { Alert, Button, Stack, TextField, Typography, Divider, FormControlLabel, Checkbox, LinearProgress } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, recomputeUserTopList } from '../store/db'
import { ensureAuth, syncNow } from '../services/sync'

export default function Settings() {
  const [tmdbKey, setTmdbKey] = useState('')
  const envKey = (import.meta as any)?.env?.VITE_TMDB_API_KEY as string | undefined
  const usingEnv = useMemo(() => !!(envKey && envKey.trim()), [envKey])
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null)
  const [clearFirst, setClearFirst] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [email, setEmail] = useState('')
  const supaEnabled = useMemo(() => {
    const env = (import.meta as any)?.env as any
    return !!(env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_ANON_KEY)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('cinefile.tmdbKey')
    if (saved) setTmdbKey(saved)
  }, [])

  return (
    <Stack spacing={2} maxWidth={560}>
      <Typography variant="h5">Settings</Typography>
      {usingEnv && (
        <Alert severity="info">
          TMDB key is provided via environment (VITE_TMDB_API_KEY). You don’t need to enter it here.
        </Alert>
      )}
      <TextField
        label="TMDB API Key"
        value={tmdbKey}
        onChange={(e) => setTmdbKey(e.target.value)}
        helperText={usingEnv ? 'An environment key is active; this field is optional. Local copy is stored in your browser.' : 'Stored locally in your browser'}
        fullWidth
        disabled={usingEnv}
      />
      <Button
        variant="contained"
        onClick={() => localStorage.setItem('cinefile.tmdbKey', tmdbKey)}
        disabled={!tmdbKey || usingEnv}
      >
        Save
      </Button>
      {!usingEnv && (
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => {
            localStorage.removeItem('cinefile.tmdbKey')
            setTmdbKey('')
          }}
        >
          Clear saved key
        </Button>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6">Sync</Typography>
      {!supaEnabled ? (
        <Alert severity="info">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable multi-device sync.</Alert>
      ) : (
        <Stack spacing={1}>
          <TextField label="Email for sign-in link" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={async () => {
              const res = await ensureAuth(email)
              if (res === 'sent') alert('Check your email for the sign-in link.')
              if (res === 'ok') alert('Already signed in.')
              if (res === 'disabled') alert('Sync is disabled (missing env).')
              if (res === 'error') alert('Could not start sign-in. Ensure your email is valid.')
            }}>Send sign-in link</Button>
            <Button variant="contained" onClick={async () => {
              setBusy('export')
              const r = await syncNow()
              setBusy(null)
              if (r === 'ok') setMessage('Sync completed')
              else if (r === 'disabled') alert('Sync is disabled (missing env).')
              else alert('Sync failed. See console for details.')
            }}>Sync now</Button>
          </Stack>
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="h6">Backup & Restore</Typography>
      <Typography variant="body2" color="text.secondary">
        Export your CineFile data (lists, items, movies) to a JSON file, or import a backup. Imports will upsert by id; you can optionally clear existing data first.
      </Typography>
      {busy && <LinearProgress />}
      {message && (
        <Alert severity="success" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      <Stack direction="row" spacing={1}>
        <Button
          disabled={busy !== null}
          variant="outlined"
          onClick={async () => {
            try {
              setBusy('export')
              setMessage(null)
              const [movies, lists, listItems] = await Promise.all([
                db.movies.toArray(),
                db.lists.toArray(),
                db.listItems.toArray()
              ])
              const payload = {
                schema: 'cinefile.v2',
                exportedAt: new Date().toISOString(),
                movies,
                lists,
                listItems
              }
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
              const ts = new Date()
              const pad = (n: number) => String(n).padStart(2, '0')
              const fname = `cinefile-backup-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = fname
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
              setMessage('Backup exported')
            } catch (e) {
              console.error('Export failed', e)
              alert('Export failed. See console for details.')
            } finally {
              setBusy(null)
            }
          }}
        >
          Export JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              setBusy('import')
              setMessage(null)
              const text = await file.text()
              const data = JSON.parse(text)
              const movies = Array.isArray(data.movies) ? data.movies : []
              const lists = Array.isArray(data.lists) ? data.lists : []
              const listItems = Array.isArray(data.listItems) ? data.listItems : []
              await db.transaction('rw', db.movies, db.lists, db.listItems, async () => {
                if (clearFirst) {
                  await Promise.all([
                    db.listItems.clear(),
                    db.lists.clear(),
                    db.movies.clear()
                  ])
                }
                if (lists.length) await db.lists.bulkPut(lists as any)
                if (movies.length) await db.movies.bulkPut(movies as any)
                if (listItems.length) await db.listItems.bulkPut(listItems as any)
              })
              // Refresh computed data
              try { await recomputeUserTopList() } catch {}
              setMessage('Import completed')
            } catch (e) {
              console.error('Import failed', e)
              alert('Import failed. Ensure the file is a CineFile backup JSON. See console for details.')
            } finally {
              setBusy(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }
          }}
        />
        <Button
          disabled={busy !== null}
          variant="contained"
          color="primary"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </Button>
      </Stack>
      <FormControlLabel
        control={<Checkbox checked={clearFirst} onChange={(e) => setClearFirst(e.target.checked)} />}
        label="Clear existing data before import (dangerous)"
      />
    </Stack>
  )
}
