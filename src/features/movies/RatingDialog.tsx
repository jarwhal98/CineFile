import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  Stack,
  TextField,
  Typography
} from '@mui/material'

export interface RatingDialogProps {
  open: boolean
  initialRating?: number
  initialDate?: string
  onClose: () => void
  onSave: (rating?: number, date?: string) => void
}

export default function RatingDialog({ open, initialRating, initialDate, onClose, onSave }: RatingDialogProps) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null)
  const [date, setDate] = useState(initialDate ?? '')
  const [hover, setHover] = useState<number | null>(null)

  // Reset state each time the dialog opens or initial values change
  useEffect(() => {
    if (open) {
      setRating(initialRating ?? null)
      setDate(initialDate ?? '')
      setHover(null)
    }
  }, [open, initialRating, initialDate])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as watched</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Rating
              max={10}
              precision={0.5}
              value={rating}
              onChange={(_, v) => setRating(v)}
              onChangeActive={(_, v) => setHover(v === -1 ? null : v)}
            />
            <Typography variant="body2" sx={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {hover ?? rating ? `${hover ?? rating} / 10` : ''}
            </Typography>
          </Stack>
          <TextField type="date" label="Watched on" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="inherit" disabled={rating == null && initialRating == null} onClick={() => onSave(undefined, date || undefined)}>
          Clear rating
        </Button>
        <Button variant="contained" onClick={() => onSave(rating ?? undefined, date || undefined)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
