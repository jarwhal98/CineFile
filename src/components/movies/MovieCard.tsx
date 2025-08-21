import { Card, CardActionArea, CardContent, CardMedia, Stack, Typography } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import StarHalfIcon from '@mui/icons-material/StarHalf'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { posterUrl } from '../../services/tmdb'

export interface MovieCardProps {
  title: string
  posterPath?: string
  year?: number
  myRating?: number
}

export function MovieCard({ title, posterPath, year, myRating }: MovieCardProps) {
  const poster = posterUrl(posterPath)
  function renderStars(r?: number) {
    if (!r) return null
    const stars = [] as JSX.Element[]
    for (let i = 1; i <= 5; i++) {
      if (r >= i) stars.push(<StarIcon key={i} fontSize="small" />)
      else if (r >= i - 0.5) stars.push(<StarHalfIcon key={i} fontSize="small" />)
      else stars.push(<StarBorderIcon key={i} fontSize="small" />)
    }
    return <Stack direction="row" spacing={0.5}>{stars}</Stack>
  }

  return (
    <Card>
      <CardActionArea>
        {poster && <CardMedia component="img" image={poster} alt={title} />}
        <CardContent>
          <Typography variant="subtitle1" noWrap>{title}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {year && <Typography variant="body2" color="text.secondary">{year}</Typography>}
            {renderStars(myRating)}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
