import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  Stack,
  TextField
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as watched</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Rating precision={0.5} value={rating} onChange={(_, v) => setRating(v)} />
          <TextField type="date" label="Watched on" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(rating ?? undefined, date || undefined)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
