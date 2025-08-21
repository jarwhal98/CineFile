import { Card, CardContent, Grid, Typography } from '@mui/material'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../store/db'

export default function Dashboard() {
  const watched =
    useLiveQuery(() => db.movies.filter((m) => m.seen === true).count(), []) || 0
  const avgRating =
    useLiveQuery(async () => {
      const rated = await db.movies.filter((m) => (m.myRating ?? -1) >= 0).toArray()
      if (!rated.length) return null
      const sum = rated.reduce((a, b) => a + (b.myRating || 0), 0)
      return sum / rated.length
    }, []) || null

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6} lg={3}>
        <Card>
          <CardContent>
            <Typography variant="h6">Watched</Typography>
            <Typography variant="h3">{watched}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6} lg={3}>
        <Card>
          <CardContent>
            <Typography variant="h6">Avg Rating</Typography>
            <Typography variant="h3">{avgRating ? avgRating.toFixed(2) : '—'}</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
