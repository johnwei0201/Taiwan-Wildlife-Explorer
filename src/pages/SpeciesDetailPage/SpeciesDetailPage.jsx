import { Link, useParams } from 'react-router-dom'

// 物種詳細頁（之後會讀取 public/data/species/{id}.json，並即時抓最新觀察紀錄）
export default function SpeciesDetailPage() {
  const { id } = useParams()

  return (
    <div className="container">
      <Link to="/">← 回到圖鑑</Link>
      <h1>物種詳細頁</h1>
      <p>物種編號：{id}</p>
      <p>（施工中：照片、分類、出沒地圖、最近觀察紀錄）</p>
    </div>
  )
}
