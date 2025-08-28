import { PropsWithChildren } from 'react'
import { Box, CssBaseline } from '@mui/material'
import { useLocation } from 'react-router-dom'
import TopMenu from './TopMenu'

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation()
  // location kept to highlight future nav if needed

  return (
    <Box sx={{ display: 'flex', background: '#FAFAF8', minHeight: '100vh' }}>
      <CssBaseline />
      <TopMenu />
      <Box component="main" sx={{ flexGrow: 1, p: 3, pb: 3, width: '100%', height: '100vh', overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  )
}
