// AI 動物通：向後端發問
//
//   階段二（目前）：後端還沒做好，先回傳「示範用」的假資料，用來確認畫面與互動
//   階段四：改成呼叫真正的 RAG 後端（Python FastAPI 的 /ask），回傳格式維持不變，畫面不必修改
//
// 回傳格式（未來後端也照這個格式回傳）：
//   {
//     answer: '回答文字',
//     sources: [8415, 12345],          // 參考的物種 id（畫面會用本站資料顯示成物種卡片）
//     followUps: ['延伸問題 1', '…'],   // 延伸問題按鈕
//   }
import { normalize } from '../utils/search.js'

export const IS_DEMO = true // 示範模式：頁面會顯示「示範模式」標籤

const DEMO_DELAY_MS = 900 // 模擬網路與 AI 思考的時間，讓載入動畫看得到
const MAX_SOURCES = 4

// 示範模式用：讀取本站物種清單（只讀一次，之後重複使用）
let speciesListPromise = null
function loadSpeciesList() {
  speciesListPromise ??= fetch('/data/species-list.json').then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
  return speciesListPromise
}

// 等待一段時間；使用者離開頁面（signal 取消）時立刻停止
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

// 示範模式：找出問題裡提到的物種（中文名出現在問題裡），名稱越長越優先（「臺灣藍鵲」優先於「藍鵲」）
function findMentionedSpecies(question, speciesList) {
  const text = normalize(question)
  return speciesList
    .filter((s) => s.nameZh && s.nameZh.length >= 2 && text.includes(normalize(s.nameZh)))
    .sort((a, b) => b.nameZh.length - a.nameZh.length)
    .slice(0, MAX_SOURCES)
}

export async function askQuestion(question, signal) {
  const [speciesList] = await Promise.all([loadSpeciesList(), wait(DEMO_DELAY_MS, signal)])
  const mentioned = findMentionedSpecies(question, speciesList)

  if (mentioned.length === 0) {
    return {
      answer:
        '（示範回答）這個問題裡沒有找到本站收錄的物種名稱。AI 動物通的後端還在建置中，完成後會根據本站資料回答，資料沒有提到的部分會直接告訴你。',
      sources: [],
      followUps: ['臺灣藍鵲吃什麼？', '什麼是特有種？'],
    }
  }

  const names = mentioned.map((s) => s.nameZh).join('、')
  const first = mentioned[0].nameZh
  return {
    answer: `（示範回答）你問到了「${names}」。AI 動物通的後端還在建置中，完成後會根據本站的物種資料回答這個問題。下方先列出相關的物種，點卡片可以看詳細介紹。`,
    sources: mentioned.map((s) => s.id),
    followUps: [`${first}住在哪裡？`, `${first}是保育類嗎？`],
  }
}
