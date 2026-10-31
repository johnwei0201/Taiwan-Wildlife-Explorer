import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PagePanel from '../../components/PagePanel/PagePanel.jsx'
import styles from './PrivacyPage.module.css'

const UPDATED_AT = '2026 年 11 月 1 日'
const ISSUES_URL = 'https://github.com/johnwei0201/Taiwan-Wildlife-Explorer/issues'

// 隱私權政策：說明本站保存哪些資料、怎麼使用
//   Google 登入要求公開這一頁（填在 Google Auth Platform 的「品牌」設定）
//   內容要和實際的程式一致：api/auth.py、api/collection.py、backend/ask_log.py
export default function PrivacyPage() {
  useEffect(() => {
    document.title = '隱私權政策｜發現台灣動物趣'
    return () => {
      document.title = '發現台灣動物趣 Taiwan Wildlife Explorer'
    }
  }, [])

  return (
    <div className="container">
      <PagePanel title="隱私權政策">
        <div className={styles.content}>
          <p className={styles.updated}>最後更新：{UPDATED_AT}</p>
          <p>
            「發現台灣動物趣」是個人製作的臺灣動物圖鑑網站，不刊登廣告、不使用網站分析工具，也不會出售或提供你的資料給他人。以下說明本站保存哪些資料，以及用途。
          </p>

          <h2>會員（使用 Google 帳號登入）</h2>
          <ul>
            <li>登入時，Google 會提供你的 Google 帳號編號、名稱、Email 和頭像網址。本站只保存這四項，<strong>不會取得你的 Google 密碼</strong>。</li>
            <li>你在<Link to="/account">會員頁</Link>記錄的「看過的動物」和「收藏」，會和你的帳號一起保存。</li>
            <li>這些資料只用來顯示你的會員資料和清單，不會用在其他地方。</li>
            <li>登入後，瀏覽器會保存一個登入用的 cookie（30 天後失效，登出時立即失效）。這是本站唯一使用的 cookie。</li>
            <li>你可以隨時在會員頁<strong>刪除帳號</strong>，帳號、登入狀態、清單會立即一併刪除。</li>
          </ul>

          <h2>AI 動物通</h2>
          <ul>
            <li>你輸入的問題會送到 Anthropic 公司的 Claude AI 產生回答。</li>
            <li>問題內容會保存下來，用來分析常見問題、改善回答。保存時<strong>不記錄 IP 位址</strong>，只記錄一個每天更換的匿名代號，用來限制提問次數，無法用來追蹤特定的人。</li>
            <li>請不要在問題裡輸入姓名、電話等個人資料。</li>
          </ul>

          <h2>我附近的動物（位置）</h2>
          <ul>
            <li>只有在你按下按鈕並同意瀏覽器的位置權限後，才會使用你的位置。</li>
            <li>位置由你的瀏覽器直接送到 iNaturalist 查詢附近的觀察紀錄，<strong>本站不會收到、也不會保存你的位置</strong>。</li>
          </ul>

          <h2>第三方服務</h2>
          <p>網站會直接從以下服務載入資料，這些服務可能依各自的隱私權政策記錄連線資訊（例如 IP 位址）：</p>
          <ul>
            <li>iNaturalist（物種照片、觀察紀錄）、維基百科（物種簡介）、OpenStreetMap（地圖）</li>
            <li>Google（登入按鈕，只在會員頁載入）</li>
            <li>Vercel（網站主機）、Neon（資料庫，位於新加坡）</li>
          </ul>

          <h2>聯絡</h2>
          <p>
            對本政策或你的資料有任何問題，請到{' '}
            <a href={ISSUES_URL} target="_blank" rel="noreferrer">
              GitHub 專案頁
            </a>{' '}
            留言。
          </p>
        </div>
      </PagePanel>
    </div>
  )
}
