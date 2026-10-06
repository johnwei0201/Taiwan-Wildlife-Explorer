import { useEffect, useState } from 'react'

// 判斷目前螢幕是否符合某個 media query（例如手機寬度），轉動手機或拉動視窗時會自動更新
//   const isMobile = useMediaQuery('(max-width: 767px)')
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}
