// 洗牌（Fisher–Yates）：從最後一張開始，每張都和前面隨機一張交換，每種排列機率相同
export function shuffle(list) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
