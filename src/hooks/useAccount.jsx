import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../api/account.js'

// 會員狀態放在 Context：會員頁、物種頁（自動記錄看過、收藏按鈕）都讀同一份，不用各自向後端查詢
const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  // status：loading 確認中 / ready 確認完成 / error 後端無法使用
  const [session, setSession] = useState({ status: 'loading', user: null, clientId: null })
  const [collection, setCollection] = useState(null) // { seen, favorite, groups }；沒登入是 null
  const recordingRef = useRef(new Set()) // 正在記錄成「看過」的物種，避免同一種重複送出

  useEffect(() => {
    api
      .fetchSession()
      .then(({ user, clientId }) => setSession({ status: 'ready', user, clientId }))
      .catch(() => setSession({ status: 'error', user: null, clientId: null }))
  }, [])

  // 登入後載入清單；登出時清空
  const userId = session.user?.id
  useEffect(() => {
    if (!userId) {
      setCollection(null)
      return
    }
    api.fetchCollection().then(setCollection).catch(() => setCollection(null))
  }, [userId])

  const login = useCallback(async (credential) => {
    const { user } = await api.login(credential)
    setSession((prev) => ({ ...prev, user }))
  }, [])

  const signOut = useCallback(async (removeAccount = false) => {
    await (removeAccount ? api.deleteAccount() : api.logout())
    setSession((prev) => ({ ...prev, user: null }))
  }, [])

  // 加入或移出清單；後端回傳更新後的完整清單（含各類群完成度）
  const toggle = useCallback(async (speciesId, list) => {
    const has = collection?.[list].includes(speciesId)
    const next = await (has ? api.removeFromCollection(speciesId, list) : api.addToCollection(speciesId, list))
    setCollection(next)
  }, [collection])

  // 自動記錄看過的動物：已登入時打開物種介紹頁就呼叫；已經記錄過的不再送出
  const markSeen = useCallback(async (speciesId) => {
    if (!collection || collection.seen.includes(speciesId) || recordingRef.current.has(speciesId)) return
    recordingRef.current.add(speciesId)
    try {
      setCollection(await api.addToCollection(speciesId, 'seen'))
    } catch {
      // 記錄失敗不打擾訪客，下次打開這一頁會再試
    } finally {
      recordingRef.current.delete(speciesId)
    }
  }, [collection])

  const value = {
    ...session, collection, login, logout: () => signOut(), deleteAccount: () => signOut(true), toggle, markSeen,
  }
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  return useContext(AccountContext)
}
