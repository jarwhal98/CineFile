import { Component, ReactNode } from 'react'
import { Alert, AlertTitle, Box } from '@mui/material'

type Props = { children: ReactNode }
type State = { hasError: boolean; error?: any }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    // eslint-disable-next-line no-console
    console.error('Runtime error caught by ErrorBoundary', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            <AlertTitle>Something went wrong</AlertTitle>
            {String(this.state.error)}
          </Alert>
        </Box>
      )
    }
    return this.props.children
  }
}
