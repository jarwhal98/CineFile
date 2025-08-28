import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { PasscodeGate } from './components/PasscodeGate'
import ListsManage from './pages/Lists'
import Settings from './pages/Settings'
import React, { Suspense, useEffect } from 'react'
import { db } from './store/db'
import ListDetail from './pages/ListDetail'
import MoviePage from './pages/Movie'
import SearchPage from './pages/Search'
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
    <PasscodeGate>
      <AppLayout>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/lists" element={<ListDetail />} />
            <Route path="/lists/manage" element={<ListsManage />} />
            <Route path="/lists/add" element={<AddList />} />
            <Route path="/lists/:id" element={<ListDetail />} />
            <Route path="/movie/:id" element={<MoviePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </PasscodeGate>
  )
}

function RootRedirect() {
  const last = (typeof localStorage !== 'undefined') ? localStorage.getItem('cinefile:lastListId') : null
  return <Navigate to={last ? `/lists/${last}` : '/lists'} replace />
}
