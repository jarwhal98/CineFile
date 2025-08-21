import { useLiveQuery } from 'dexie-react-hooks'
import { Box, Stack, Typography, Button } from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { db } from '../store/db'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ListImport from '../features/lists/ListImport'

const columns: GridColDef[] = [
  { field: 'name', headerName: 'List', flex: 1 },
  { field: 'source', headerName: 'Source', flex: 1 },
  { field: 'count', headerName: 'Movies', type: 'number', width: 120 }
]

export default function Lists() {
  const navigate = useNavigate()
  const lists = useLiveQuery(() => db.lists.toArray(), []) || []

  const [wiping, setWiping] = useState(false)

  async function wipeAll() {
    setWiping(true)
    await db.transaction('rw', db.lists, db.listItems, db.movies, async () => {
      await db.lists.clear()
      await db.listItems.clear()
      await db.movies.clear()
    })
    setWiping(false)
    window.location.reload()
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h5">Lists</Typography>
        <Button color="error" variant="outlined" onClick={wipeAll} disabled={wiping}>
          {wiping ? 'Wiping...' : 'Wipe All Data'}
        </Button>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Lists</Typography>
        <Box>
          <ListImport />
        </Box>
      </Stack>
      <div style={{ height: 500, width: '100%' }}>
        <DataGrid
          rows={lists}
          columns={columns}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          onRowDoubleClick={(p) => navigate(`/lists/${p.id}`)}
        />
      </div>
    </Stack>
  )
}
