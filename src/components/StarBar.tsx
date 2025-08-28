import { Stack } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import StarHalfIcon from '@mui/icons-material/StarHalf'
import StarBorderIcon from '@mui/icons-material/StarBorder'

export default function StarBar({ value, size = 'small' }: { value?: number; size?: 'inherit' | 'small' | 'medium' | 'large' }) {
  if (typeof value !== 'number' || value <= 0) return null
  const stars: JSX.Element[] = []
  for (let i = 1; i <= 10; i++) {
    if (value >= i) stars.push(<StarIcon key={i} fontSize={size} />)
    else if (value >= i - 0.5) stars.push(<StarHalfIcon key={i} fontSize={size} />)
    else stars.push(<StarBorderIcon key={i} fontSize={size} />)
  }
  return <Stack direction="row" spacing={0.25} alignItems="center">{stars}</Stack>
}
