import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'

export default function Settings() {
  const [tmdbKey, setTmdbKey] = useState('')
  const envKey = (import.meta as any)?.env?.VITE_TMDB_API_KEY as string | undefined
  const usingEnv = useMemo(() => !!(envKey && envKey.trim()), [envKey])

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
    </Stack>
  )
}
