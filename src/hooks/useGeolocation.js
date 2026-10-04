import { useState } from 'react'

// 隱私：座標四捨五入到小數點後兩位（約 1 公里精度），位置只存在瀏覽器的記憶體裡，不會儲存
const roundCoord = (value) => Math.round(value * 100) / 100

/**
 * 瀏覽器定位（「我附近的動物」與物種詳細頁的「我的位置」共用）
 *
 * location：{ lat, lng } 或 null
 * error：'unsupported' 瀏覽器不支援 / 'denied' 使用者拒絕或逾時 / null
 * locate()：要求定位（需要使用者同意，而且網站必須是 HTTPS 或 localhost）
 * pickLocation({ lat, lng })：直接指定位置（例如點地圖）
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState(null)

  const pickLocation = ({ lat, lng }) => {
    setLocation({ lat: roundCoord(lat), lng: roundCoord(lng) })
    setError(null)
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setError('unsupported')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        pickLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => {
        setIsLocating(false)
        setError('denied')
      },
      { timeout: 10000 },
    )
  }

  return { location, isLocating, error, locate, pickLocation }
}
