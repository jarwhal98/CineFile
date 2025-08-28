import { Card, CardActionArea, CardContent, CardMedia, Stack, Typography } from '@mui/material'
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded'
import { posterUrl } from '../../services/tmdb'

export interface MovieCardProps {
  title: string
  posterPath?: string
  year?: number
  myRating?: number
}

export function MovieCard({ title, posterPath, year, myRating }: MovieCardProps) {
  const poster = posterUrl(posterPath)

  return (
    <Card>
      <CardActionArea>
        {poster && <CardMedia component="img" image={poster} alt={title} />}
        <CardContent>
          <Typography variant="subtitle1" noWrap>{title}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {year && <Typography variant="body2" color="text.secondary">{year}</Typography>}
            {typeof myRating === 'number' && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <HowToRegRoundedIcon sx={{ color: '#FB8C00' }} fontSize="small" />
                <Typography variant="body2" sx={{ color: '#FB8C00', fontWeight: 800 }}>{Number(myRating).toFixed(1)}</Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
