import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="container">
      <h1>找不到這個頁面</h1>
      <p>
        這隻動物可能躲起來了，<Link to="/">回到圖鑑</Link>
      </p>
    </div>
  )
}
