import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const configuredCode = (import.meta as any)?.env?.VITE_FAMILY_CODE as string | undefined
  const enabled = useMemo(() => !!(configuredCode && configuredCode.trim()), [configuredCode])
  const [entered, setEntered] = useState('')
  const [ok, setOk] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return
    const saved = sessionStorage.getItem('cinefile:pass')
    if (saved && configuredCode && saved === configuredCode) setOk(true)
  }, [enabled, configuredCode])

  if (!enabled || ok) return <>{children}</>

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper elevation={8} sx={{ p: 3, maxWidth: 420, width: '100%', backdropFilter: 'blur(8px)', background: 'rgba(255,255,255,0.6)' }}>
        <Stack spacing={2}>
          <Typography variant="h6">Enter Passcode</Typography>
          <Typography variant="body2" color="text.secondary">
            This site is limited to family only. Enter the passcode to continue.
          </Typography>
          <TextField
            type="password"
            label="Passcode"
            value={entered}
            onChange={(e) => setEntered(e.target.value)}
            autoFocus
          />
          <Button
            variant="contained"
            onClick={() => {
              if (!configuredCode) return
              if (entered === configuredCode) {
                sessionStorage.setItem('cinefile:pass', configuredCode)
                setOk(true)
              } else {
                alert('Incorrect passcode')
              }
            }}
          >
            Continue
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
