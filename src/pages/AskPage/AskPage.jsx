import { useEffect, useRef, useState } from 'react'
import PagePanel from '../../components/PagePanel/PagePanel.jsx'
import ExampleQuestions from '../../components/ExampleQuestions/ExampleQuestions.jsx'
import ChatMessage from '../../components/ChatMessage/ChatMessage.jsx'
import ChatInput from '../../components/ChatInput/ChatInput.jsx'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import { askQuestion, AskError } from '../../api/ask.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { ASK_QUESTIONS } from '../../constants/askQuestions.js'
import { shuffle } from '../../utils/random.js'
import resetIcon from '../../assets/icons/Reset.png'
import styles from './AskPage.module.css'

// 範例問題：從 100 題（constants/askQuestions.js）裡隨機挑 12 題，每次進頁面都不一樣
const EXAMPLE_COUNT = 12
const pickExamples = () => shuffle(ASK_QUESTIONS).slice(0, EXAMPLE_COUNT)

// 對話暫存在 sessionStorage：點物種卡片去看介紹、再回來時，對話還在
//   sessionStorage 只在這個分頁有效，關掉分頁就清空；另外超過 30 分鐘沒有新對話也會清掉
const STORAGE_KEY = 'ask-messages'
const STORAGE_TTL = 30 * 60 * 1000

// 讀回暫存的對話；還在等回答的那一題（離開頁面時已取消）連同問題一起拿掉
function loadMessages() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (!saved || Date.now() - saved.savedAt > STORAGE_TTL) return []
    return saved.messages.filter((m, i, all) => !m.loading && !all[i + 1]?.loading)
  } catch {
    return [] // 無痕模式等情況可能無法使用 sessionStorage，就從空白對話開始
  }
}

function saveMessages(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), messages }))
  } catch {
    // 存不了就算了，只是回來時對話不會保留
  }
}

let nextId = 0 // 每則對話的 key

// AI 動物通：用一句話問台灣動物的問題，AI 根據本站資料回答，並附上參考的物種卡片
export default function AskPage() {
  const { speciesList } = useSpeciesList()
  // { id, role: 'user' | 'assistant', text, sources, followUps, loading }
  const [messages, setMessages] = useState(() => {
    const saved = loadMessages()
    nextId = Math.max(nextId, ...saved.map((m) => m.id)) // 新訊息的 key 接在暫存的後面，不會重複
    return saved
  })
  // 按「試試看這些問題」前面的圖示，就換一批範例問題
  const [examples, setExamples] = useState(pickExamples)
  const controllerRef = useRef(null)
  const listEndRef = useRef(null)

  const isLoading = messages.some((m) => m.loading)
  const speciesById = new Map(speciesList.map((s) => [s.id, s]))

  useEffect(() => {
    document.title = 'AI 動物通｜發現台灣動物趣'
    return () => {
      document.title = '發現台灣動物趣 Taiwan Wildlife Explorer'
      controllerRef.current?.abort() // 離開頁面時，取消還沒回來的問題
    }
  }, [])

  // 有新訊息時，把最新的一則捲進畫面，並暫存起來
  useEffect(() => {
    if (messages.length > 0) listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    saveMessages(messages)
  }, [messages])

  const send = async (question) => {
    if (isLoading) return
    const answerId = ++nextId
    setMessages((prev) => [
      ...prev,
      { id: ++nextId, role: 'user', text: question },
      { id: answerId, role: 'assistant', loading: true },
    ])

    const controller = new AbortController()
    controllerRef.current = controller
    const update = (patch) =>
      setMessages((prev) => prev.map((m) => (m.id === answerId ? { ...m, loading: false, ...patch } : m)))

    try {
      const result = await askQuestion(question, controller.signal)
      update({ text: result.answer, sources: result.sources, followUps: result.followUps })
    } catch (error) {
      if (error.name === 'AbortError') return
      const text = error instanceof AskError ? error.message : '暫時無法回答，請稍後再試。'
      update({ text, sources: [], followUps: [] })
    }
  }

  const lastAnswerId = messages.findLast((m) => m.role === 'assistant')?.id

  return (
    <div className="container">
      <PagePanel title="AI 動物通">
        <ExampleQuestions
          label={
            <button type="button" className={styles.refresh} onClick={() => setExamples(pickExamples())}>
              <img src={resetIcon} alt="" className={styles.refreshIcon} />
              試試看這些問題
              <span className="visually-hidden">（按一下換一批）</span>
            </button>
          }
          questions={examples}
          onSelect={send}
          disabled={isLoading}
        />
        <p className={styles.intro}>
          用一句話問問台灣動物的食性、棲地、保育等級，AI 會根據本站收錄的動物資料回答，並列出參考的物種。
        </p>
        <p className={styles.notice}>（回答僅根據本站物種資料，資料沒有提到的會直接告訴你；AI 也可能出錯，請以物種介紹為準。）</p>
      </PagePanel>

      {/* 還沒有對話時只顯示輸入框，送出第一個問題後才出現對話區 */}
      <section className={styles.chat} aria-label="對話">
        {messages.length > 0 && (
          <ul className={styles.messages} aria-live="polite">
            {messages.map((message) => {
              const sources = (message.sources ?? []).map((id) => speciesById.get(id)).filter(Boolean)
              return (
                <ChatMessage key={message.id} role={message.role} text={message.text} loading={message.loading}>
                  {/* 參考資料卡片：證明回答有根據，點卡片到物種詳細頁 */}
                  {sources.length > 0 && (
                    <div className={styles.sources}>
                      <span className={styles.sourcesLabel}>參考資料</span>
                      <ul className={styles.sourceGrid}>
                        {sources.map((species) => (
                          <li key={species.id}>
                            <SpeciesCard species={species} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* 延伸問題：只在最新一則回答下方顯示 */}
                  {message.id === lastAnswerId && !message.loading && (
                    <ExampleQuestions
                      label="你可能也想問"
                      questions={message.followUps ?? []}
                      onSelect={send}
                      disabled={isLoading}
                    />
                  )}
                </ChatMessage>
              )
            })}
          </ul>
        )}
        {messages.length > 0 && <div ref={listEndRef} />}

        <div className={messages.length > 0 ? styles.inputBar : undefined}>
          <ChatInput onSend={send} disabled={isLoading} />
        </div>
      </section>
    </div>
  )
}
