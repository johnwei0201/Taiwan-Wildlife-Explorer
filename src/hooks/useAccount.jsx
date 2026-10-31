import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../api/account.js'

// 會員狀態放在 Context：頁首、會員頁、物種頁的「看過／收藏」按鈕都讀同一份，不用各自向後端查詢
const AccountContext = createContext(null)

export function AccountProvider({ children }) {
  // status：loading 確認中 / ready 確認完成 / error 後端無法使用
  const [session, setSession] = useState({ status: 'loading', user: null, clientId: null })
  const [collection, setCollection] = useState(null) // { seen, favorite, groups }；沒登入是 null

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

  const value = { ...session, collection, login, logout: () => signOut(), deleteAccount: () => signOut(true), toggle }
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  return useContext(AccountContext)
}
