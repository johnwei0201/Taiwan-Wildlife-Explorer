import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout.jsx'
import HomePage from './pages/HomePage/HomePage.jsx'
import SpeciesDetailPage from './pages/SpeciesDetailPage/SpeciesDetailPage.jsx'
import NearbyPage from './pages/NearbyPage/NearbyPage.jsx'
import NotFoundPage from './pages/NotFoundPage/NotFoundPage.jsx'

// 路由表：網址 → 對應的頁面
export default function App() {
  return (
    <Routes>
      {/* 所有頁面共用同一個 Layout（頁首、頁尾） */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/species/:id" element={<SpeciesDetailPage />} />
        <Route path="/nearby" element={<NearbyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
