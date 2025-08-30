import { useState, useEffect } from 'react'
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'
import ListIcon from '@mui/icons-material/List'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { useLocation, useNavigate, Link } from 'react-router-dom'
// removed duplicate import
import { supabase } from '../services/supabase';
function AuthNav() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return user ? (
    <MenuItem onClick={handleLogout}>
      <ListItemText primary="Sign Out" />
    </MenuItem>
  ) : (
    <MenuItem component={Link} to="/auth">
      <ListItemText primary="Sign In" />
    </MenuItem>
  );
}

export default function TopMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const nav = useNavigate()
  const loc = useLocation()

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)

  const go = (path: string) => {
    handleClose()
    if (loc.pathname !== path) nav(path)
  }
  const goHome = () => {
    handleClose()
    const last = (typeof localStorage !== 'undefined') ? localStorage.getItem('cinefile:lastListId') : null
    const target = last ? `/lists/${last}` : '/lists'
    if (loc.pathname !== target) nav(target)
  }

  return (
    <>
      <IconButton
        aria-label="Open menu"
        title="Menu"
        onClick={handleOpen}
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1300,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
          '&:hover': { background: 'rgba(255,255,255,0.9)' }
        }}
      >
        <MenuRoundedIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          elevation: 0,
          sx: {
            mt: 1,
            minWidth: 220,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <MenuItem onClick={goHome}>
          <ListItemIcon><HomeRoundedIcon /></ListItemIcon>
          <ListItemText primary="Home" />
          <ChevronRightRoundedIcon fontSize="small" />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem selected={loc.pathname.startsWith('/lists')} onClick={() => go('/lists/manage')}>
          <ListItemIcon><ListIcon /></ListItemIcon>
          <ListItemText primary="Lists" />
          <ChevronRightRoundedIcon fontSize="small" />
        </MenuItem>
        <MenuItem selected={loc.pathname.startsWith('/search')} onClick={() => go('/search')}>
          <ListItemIcon><SearchIcon /></ListItemIcon>
          <ListItemText primary="Search" />
          <ChevronRightRoundedIcon fontSize="small" />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem selected={loc.pathname.startsWith('/settings')} onClick={() => go('/settings')}>
          <ListItemIcon><SettingsIcon /></ListItemIcon>
          <ListItemText primary="Settings" />
          <ChevronRightRoundedIcon fontSize="small" />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <AuthNav />
      </Menu>
    </>
  )
}
