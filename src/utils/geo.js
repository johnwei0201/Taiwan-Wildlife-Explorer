// 兩個經緯度之間的直線距離（公里），使用 Haversine 公式：把地球當成球體計算大圓距離
export function distanceKm(a, b) {
  const R = 6371 // 地球半徑（公里）
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// 顯示用：10 公里內顯示到小數一位，其他四捨五入到整數
export function formatKm(km) {
  return km < 10 ? km.toFixed(1) : String(Math.round(km))
}
