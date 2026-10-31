import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PagePanel from '../../components/PagePanel/PagePanel.jsx'
import SpeciesGrid from '../../components/SpeciesGrid/SpeciesGrid.jsx'
import GoogleSignInButton from '../../components/GoogleSignInButton/GoogleSignInButton.jsx'
import { AccountError } from '../../api/account.js'
import { useAccount } from '../../hooks/useAccount.jsx'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import styles from './AccountPage.module.css'

const TABS = [
  { list: 'seen', label: '看過的動物', empty: '還沒有記錄。在物種介紹頁按「看過」，就會出現在這裡。' },
  { list: 'favorite', label: '收藏', empty: '還沒有收藏。在物種介紹頁按「收藏」，就會出現在這裡。' },
]

// 會員：沒登入時顯示說明和 Google 登入按鈕；登入後顯示生命清單的完成度、看過的動物、收藏
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
          <strong>生命清單</strong>：記下在野外看過的動物，看看鳥類、蝴蝶、蛙類……各收集了幾種，臺灣特有種看過幾種。
        </li>
        <li>
          <strong>收藏</strong>：把喜歡的動物存起來，下次直接找到。
        </li>
      </ul>

      {clientId ? (
        <div className={styles.signIn}>
          <GoogleSignInButton clientId={clientId} onCredential={handleCredential} />
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      ) : (
        <p className={styles.notice}>會員功能準備中，敬請期待。</p>
      )}

      <p className={styles.privacy}>
        （使用 Google 帳號登入，本站不會取得你的密碼；只保存 Google 提供的名稱、Email、頭像，以及你記錄的動物。可以隨時刪除帳號，資料會一併刪除。詳見<Link to="/privacy">隱私權政策</Link>。）
      </p>
    </PagePanel>
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
    if (window.confirm('確定要刪除帳號嗎？生命清單和收藏會全部刪除，無法復原。')) run(deleteAccount)
  }

  return (
    <>
      <PagePanel title="我的生命清單">
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

// 生命清單的完成度：總數、特有種，以及各類群的進度條（只列出至少看過一種的類群，其他收起來）
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
