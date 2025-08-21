import { useMemo, useState } from 'react'
import { Box, Chip, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material'
import DoneIcon from '@mui/icons-material/Done'
import WatchLaterIcon from '@mui/icons-material/WatchLater'
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid'
import { useAggregatedMovies } from '../features/movies/useAggregatedMovies'
import { db } from '../store/db'
import RatingDialog from '../features/movies/RatingDialog'
import { posterUrl } from '../services/tmdb'

export default function Movies() {
  const [selectedLists, setSelectedLists] = useState<string[]>([])
  const [dialog, setDialog] = useState<{ id: number; rating?: number; date?: string } | null>(null)
  const { rows, lists } = useAggregatedMovies(selectedLists)

  const columns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'poster',
        headerName: 'Poster',
        width: 80,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (!params.row) return null
          const p = posterUrl(params.row.posterPath)
          return p ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img src={p} style={{ height: 60, borderRadius: 6 }} />
          ) : null
        }
      },
      { field: 'title', headerName: 'Title', flex: 1, minWidth: 180 },
      { field: 'year', headerName: 'Year', width: 100 },
      {
        field: 'directors',
        headerName: 'Director',
        flex: 1,
        valueGetter: (p: any) => (p.row && p.row.directors ? p.row.directors.join(', ') : '')
      },
      {
        field: 'cast',
        headerName: 'Cast',
        flex: 1.5,
        valueGetter: (p: any) => (p.row && p.row.cast ? p.row.cast.slice(0, 4).join(', ') : '')
      },
      { field: 'tmdbRating', headerName: 'TMDB', width: 100 },
      {
        field: 'score',
        headerName: 'All Lists Rank',
        width: 140,
        valueFormatter: (p: any) => (p.value ? (p.value as number).toFixed(3) : '')
      },
      {
        field: 'lists',
        headerName: 'In Lists',
        flex: 1,
        renderCell: (p: any) => (
          <Stack direction="row" spacing={0.5} sx={{ overflow: 'hidden' }}>
            {(p.row && p.row.lists ? p.row.lists.slice(0, 4) : []).map((l: any) => (
              <Chip key={`${p.id}-${l.listId}`} size="small" label={l.rank ? `${l.listId}:${l.rank}` : l.listId} />
            ))}
          </Stack>
        )
      },
      {
        field: 'seen',
        headerName: 'Seen',
        width: 80,
        sortable: true,
        renderCell: (p: any) => (
          p.row ? (
            <Tooltip title={p.row.seen ? 'Seen' : 'Mark as seen'}>
              <IconButton
                color={p.row.seen ? 'success' : 'default'}
                onClick={() =>
                  setDialog({ id: p.row.id, rating: p.row.myRating, date: p.row.watchedAt })
                }
              >
                {p.row.seen ? <DoneIcon /> : <WatchLaterIcon />}
              </IconButton>
            </Tooltip>
          ) : null
        )
      }
    ],
    []
  )

  async function handleSave(rating?: number, date?: string) {
    if (!dialog) return
    const id = dialog.id
    await db.movies.where('id').equals(id).modify({
      seen: !!(rating || date),
      myRating: rating,
      watchedAt: date
    })
    setDialog(null)
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h5">Movies</Typography>
        <Box sx={{ minWidth: 240 }}>
          <TextField
            label="Filter by Lists"
            select
            SelectProps={{ multiple: true, value: selectedLists, onChange: (e) => setSelectedLists(e.target.value as string[]) }}
            fullWidth
          >
            {lists.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Stack>
      <div style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          initialState={{ sorting: { sortModel: [{ field: 'score', sort: 'asc' }] } }}
        />
      </div>
      <RatingDialog
        open={!!dialog}
        initialRating={dialog?.rating}
        initialDate={dialog?.date}
        onClose={() => setDialog(null)}
        onSave={handleSave}
      />
    </Stack>
  )
}
