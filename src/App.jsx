import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout.jsx'
import HomePage from './pages/HomePage/HomePage.jsx'
import SpeciesDetailPage from './pages/SpeciesDetailPage/SpeciesDetailPage.jsx'
import NearbyPage from './pages/NearbyPage/NearbyPage.jsx'
import TaxonPage from './pages/TaxonPage/TaxonPage.jsx'
import AskPage from './pages/AskPage/AskPage.jsx'
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
        {/* AI 動物通：根據本站資料回答動物問題（RAG） */}
        <Route path="/ask" element={<AskPage />} />
        {/* 分類頁：rank 是 class／order／family／genus，name 是學名 */}
        <Route path="/taxon/:rank/:name" element={<TaxonPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
