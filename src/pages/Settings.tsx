import { Stack, TextField, Typography, Button } from '@mui/material'
import { useEffect, useState } from 'react'

export default function Settings() {
  const [tmdbKey, setTmdbKey] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('cinefile.tmdbKey')
    if (saved) setTmdbKey(saved)
  }, [])

  return (
    <Stack spacing={2} maxWidth={560}>
      <Typography variant="h5">Settings</Typography>
      <TextField
        label="TMDB API Key"
        value={tmdbKey}
        onChange={(e) => setTmdbKey(e.target.value)}
        helperText="Stored locally in your browser"
        fullWidth
      />
      <Button
        variant="contained"
        onClick={() => localStorage.setItem('cinefile.tmdbKey', tmdbKey)}
        disabled={!tmdbKey}
      >
        Save
      </Button>
    </Stack>
  )
}
