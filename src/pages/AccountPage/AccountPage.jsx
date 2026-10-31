import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PagePanel from '../../components/PagePanel/PagePanel.jsx'
import SpeciesGrid from '../../components/SpeciesGrid/SpeciesGrid.jsx'
import GoogleSignInButton from '../../components/GoogleSignInButton/GoogleSignInButton.jsx'
import { AccountError } from '../../api/account.js'
import { useAccount } from '../../hooks/useAccount.jsx'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { detectInAppBrowser, lineExternalUrl } from '../../utils/inAppBrowser.js'
import styles from './AccountPage.module.css'

const TABS = [
  { list: 'seen', label: '看過的動物', empty: '還沒有記錄。打開物種介紹頁，就會自動記錄在這裡。' },
  { list: 'favorite', label: '收藏', empty: '還沒有收藏。在物種介紹頁按「收藏」，就會出現在這裡。' },
]

// 會員：沒登入時顯示說明和 Google 登入按鈕；登入後顯示各類群的完成度、看過的動物、收藏
export default function AccountPage() {
  const { status, user, clientId } = useAccount()

  useEffect(() => {
    document.title = '會員｜發現台灣動物趣'
    return () => {
      document.title = '發現台灣動物趣 Taiwan Wildlife Explorer'
    }
  }, [])

  return (
    <div className="container">
      {status === 'loading' && <PagePanel title="會員"><p className={styles.muted}>載入中…</p></PagePanel>}
      {status === 'error' && <PagePanel title="會員"><p className={styles.muted}>會員功能暫時無法使用，請稍後再試。</p></PagePanel>}
      {status === 'ready' && (user ? <MyCollection /> : <SignIn clientId={clientId} />)}
    </div>
  )
}

// ---------- 沒登入：功能說明＋登入按鈕 ----------
function SignIn({ clientId }) {
  const { login } = useAccount()
  const [error, setError] = useState('')
  const inAppBrowser = detectInAppBrowser()

  const handleCredential = async (credential) => {
    setError('')
    try {
      await login(credential)
    } catch (err) {
      setError(err instanceof AccountError ? err.message : '登入失敗，請再試一次。')
    }
  }

  return (
    <PagePanel title="會員">
      <p>登入後可以記錄你和臺灣動物的相遇：</p>
      <ul className={styles.features}>
        <li>
          <strong>看過的動物</strong>：瀏覽過的物種介紹會自動記錄，看看鳥類、蝴蝶、蛙類……各看過幾種，臺灣特有種看過幾種。
        </li>
        <li>
          <strong>收藏</strong>：把喜歡的動物存起來，下次直接找到。
        </li>
      </ul>

      {!clientId ? (
        <p className={styles.notice}>會員功能準備中，敬請期待。</p>
      ) : inAppBrowser ? (
        // App 內建的瀏覽器：Google 不允許登入，按鈕按了也沒反應，改成提示換瀏覽器
        <InAppBrowserNotice app={inAppBrowser} />
      ) : (
        <div className={styles.signIn}>
          <GoogleSignInButton clientId={clientId} onCredential={handleCredential} />
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      )}

      <p className={styles.privacy}>
        （使用 Google 帳號登入，本站不會取得你的密碼；只保存 Google 提供的名稱、Email、頭像，以及你看過、收藏的動物。可以隨時刪除帳號，資料會一併刪除。詳見<Link to="/privacy">隱私權政策</Link>。）
      </p>
    </PagePanel>
  )
}

// 在 LINE、Facebook 等 App 裡開啟時的提示：LINE 可以一鍵改用瀏覽器開啟，其他 App 提供複製網址
function InAppBrowserNotice({ app }) {
  const inputRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const pageUrl = window.location.href.replace(/[?&]openExternalBrowser=1/, '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
    } catch {
      inputRef.current?.select() // 有些 App 不允許程式複製，改成選取網址，讓訪客自己長按複製
    }
  }

  return (
    <div className={styles.inApp} role="alert">
      <p>
        <strong>目前是在 {app} 裡開啟網頁。</strong>
        Google 基於安全理由，不允許在 App 內建的瀏覽器登入，請改用 Safari 或 Chrome 開啟本頁。
      </p>
      {app === 'LINE' ? (
        <a className={styles.inAppButton} href={lineExternalUrl()}>
          用瀏覽器開啟
        </a>
      ) : (
        <p>點畫面右上角（或右下角）的「⋯」選單，選擇「在瀏覽器中開啟」。</p>
      )}
      <div className={styles.copyRow}>
        <input ref={inputRef} className={styles.copyInput} value={pageUrl} readOnly aria-label="本頁網址" />
        <button type="button" className={styles.copyButton} onClick={copy}>
          {copied ? '已複製' : '複製網址'}
        </button>
      </div>
    </div>
  )
}

// ---------- 已登入：個人資料、完成度、清單 ----------
function MyCollection() {
  const { user, collection, logout, deleteAccount } = useAccount()
  const { speciesList } = useSpeciesList()
  const [tab, setTab] = useState('seen')
  const [busy, setBusy] = useState(false)

  const speciesById = new Map(speciesList.map((s) => [s.id, s]))
  const activeTab = TABS.find((t) => t.list === tab)
  const items = (collection?.[tab] ?? []).map((id) => speciesById.get(id)).filter(Boolean)

  const run = async (action) => {
    setBusy(true)
    try {
      await action()
    } catch (err) {
      alert(err instanceof AccountError ? err.message : '操作失敗，請再試一次。')
      setBusy(false)
    }
  }

  const handleDelete = () => {
    if (window.confirm('確定要刪除帳號嗎？看過的動物和收藏會全部刪除，無法復原。')) run(deleteAccount)
  }

  return (
    <>
      <PagePanel title="我看過的動物">
        <div className={styles.profile}>
          {user.avatar && <img src={user.avatar} alt="" className={styles.avatar} referrerPolicy="no-referrer" />}
          <div className={styles.profileText}>
            <span className={styles.name}>{user.name ?? user.email}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
          <button type="button" className={styles.logout} onClick={() => run(logout)} disabled={busy}>
            登出
          </button>
        </div>
        {collection ? <Progress groups={collection.groups} /> : <p className={styles.muted}>載入中…</p>}
      </PagePanel>

      <section className={styles.lists}>
        <div className={styles.tabs} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.list}
              type="button"
              role="tab"
              aria-selected={tab === t.list}
              className={styles.tab}
              onClick={() => setTab(t.list)}
            >
              {t.label}
              <span className={styles.tabCount}>{collection?.[t.list].length ?? 0}</span>
            </button>
          ))}
        </div>
        {items.length > 0 ? <SpeciesGrid list={items} /> : <p className={styles.empty}>{activeTab.empty}</p>}
      </section>

      <button type="button" className={styles.delete} onClick={handleDelete} disabled={busy}>
        刪除帳號
      </button>
    </>
  )
}

// 看過的動物完成度：總數、特有種，以及各類群的進度條（只列出至少看過一種的類群，其他收起來）
function Progress({ groups }) {
  const [showAll, setShowAll] = useState(false)
  const sum = (key) => groups.reduce((total, g) => total + g[key], 0)
  const seen = sum('seen')
  const visible = showAll ? groups : groups.filter((g) => g.seen > 0)

  return (
    <div className={styles.progress}>
      <div className={styles.totals}>
        <Stat label="看過的動物" value={seen} total={sum('total')} />
        <Stat label="臺灣特有種" value={sum('endemicSeen')} total={sum('endemicTotal')} />
      </div>

      {visible.length > 0 && (
        <ul className={styles.groups}>
          {visible.map((g) => (
            <li key={g.code} className={styles.group}>
              <span className={styles.groupName}>{g.name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${(g.seen / g.total) * 100}%` }} />
              </span>
              <span className={styles.groupCount}>
                {g.seen} / {g.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.toggleAll} onClick={() => setShowAll((v) => !v)}>
        {showAll ? '只顯示看過的類群' : '顯示全部類群'}
      </button>
    </div>
  )
}

function Stat({ label, value, total }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span>
        <span className={styles.statValue}>{value.toLocaleString()}</span>
        <span className={styles.statTotal}> / {total.toLocaleString()} 種</span>
      </span>
    </div>
  )
}
