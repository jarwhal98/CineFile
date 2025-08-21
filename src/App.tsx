import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Movies from './pages/Movies'
import Settings from './pages/Settings'
import React, { Suspense, useEffect } from 'react'
import { db } from './store/db'
import ListDetail from './pages/ListDetail'
import MoviePage from './pages/Movie'
const AddList = React.lazy(() => import('./pages/AddList'))

export default function App() {
  useEffect(() => {
    // Warm up DB to surface errors early
    db.open().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('DB open failed', e)
    })
  }, [])
  return (
    <AppLayout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lists" element={<ListDetail />} />
          <Route path="/lists/add" element={<AddList />} />
          <Route path="/lists/:id" element={<ListDetail />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movie/:id" element={<MoviePage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </AppLayout>
  )
}
