import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material'
import ListIcon from '@mui/icons-material/List'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [value, setValue] = useState(0)

  useEffect(() => {
  if (location.pathname.startsWith('/lists')) setValue(0)
    else if (location.pathname.startsWith('/search')) setValue(1)
    else if (location.pathname.startsWith('/settings')) setValue(2)
  }, [location.pathname])

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        borderRadius: 6,
        p: 0.5,
  background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
  border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
      }}
    >
      <BottomNavigation
        showLabels
        sx={{ background: 'transparent' }}
        value={value}
        onChange={(_, newValue) => {
          setValue(newValue)
          if (newValue === 0) navigate('/lists/manage')
          if (newValue === 1) navigate('/search')
          if (newValue === 2) navigate('/settings')
        }}
      >
        <BottomNavigationAction label="Lists" icon={<ListIcon />} />
        <BottomNavigationAction label="Search" icon={<SearchIcon />} />
        <BottomNavigationAction label="Settings" icon={<SettingsIcon />} />
      </BottomNavigation>
    </Paper>
  )
}
