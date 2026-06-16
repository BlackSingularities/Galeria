import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Portfolio from './pages/Portfolio'
import Album from './pages/Album'
import Admin from './pages/Admin'

const BASE = import.meta.env.BASE_URL

export default function App() {
  return (
    <BrowserRouter basename={BASE}>
      <Routes>
        <Route path="/"             element={<Portfolio />} />
        <Route path="/album/:slug"  element={<Album />} />
        <Route path="/admin"        element={<Admin />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
