import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Portfolio from './pages/Portfolio'
import Album from './pages/Album'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

const BASE = import.meta.env.BASE_URL

export default function App() {
  return (
    <BrowserRouter basename={BASE}>
      <Routes>
        <Route path="/"             element={<Portfolio />} />
        <Route path="/album/:slug"  element={<Album />} />
        <Route path="/admin"        element={<Admin />} />
        <Route path="*"             element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
