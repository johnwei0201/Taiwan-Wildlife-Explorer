import { useEffect, useState } from 'react'

/**
 * 執行非同步函式並追蹤狀態（詳細頁每個即時區塊都會用到）
 *
 *   const { status, data } = useAsync((signal) => fetchTaxon(id, signal), [id])
 *
 * status：loading 載入中 / success 成功 / error 失敗
 * 依賴改變或元件離開畫面時，會取消還沒回來的請求
 */
export function useAsync(asyncFn, deps) {
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', data: null })

    asyncFn(controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null })
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
