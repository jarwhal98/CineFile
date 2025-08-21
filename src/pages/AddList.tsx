import { Stack, Typography } from '@mui/material'
import ListImport from '../features/lists/ListImport'

export default function AddList() {
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Add new list</Typography>
      <Typography variant="body2" color="text.secondary">
        Import a CSV or JavaScript file containing your list. CSV headers: rank,title,tmdb_id,year. Or upload a .js file that exports MOVIES.
      </Typography>
      <ListImport />
    </Stack>
  )
}
