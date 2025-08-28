import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import App from './App'
import { seedIfEmpty, recomputeUserTopList } from './store/db'
import { ErrorBoundary } from './components/ErrorBoundary'

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#FAFAF8',
      paper: '#FFFFFF'
    },
    primary: { main: '#1976d2' },
    secondary: { main: '#e91e63' },
    text: {
      primary: '#222',
      secondary: '#444'
    }
  },
  shape: { borderRadius: 12 }
})

// Kick off seeding in the background; UI mounts immediately
seedIfEmpty()
// Also compute the user's top list once at startup
recomputeUserTopList().catch(() => {})

// In development, ensure any previously registered service worker is unregistered
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister())
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)
