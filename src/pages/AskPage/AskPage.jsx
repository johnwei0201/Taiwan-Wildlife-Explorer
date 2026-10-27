import { useEffect, useRef, useState } from 'react'
import PagePanel from '../../components/PagePanel/PagePanel.jsx'
import ExampleQuestions from '../../components/ExampleQuestions/ExampleQuestions.jsx'
import ChatMessage from '../../components/ChatMessage/ChatMessage.jsx'
import ChatInput from '../../components/ChatInput/ChatInput.jsx'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import { askQuestion, AskError } from '../../api/ask.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import styles from './AskPage.module.css'

// 範例問題：只放 RAG 擅長的題型（單一物種、兩種比較、名詞解釋），訪客和面試官點了就能直接試用
//   都是 20 題測試裡回答良好的題目（另加列舉題，向量搜尋也能找到）
//   本站用 TaiCOL 的正式中文名，俗名寫在括號裡（例如帝雉的正式名稱是黑長尾雉）
const EXAMPLE_QUESTIONS = [
  '臺灣藍鵲吃什麼？',
  '黑長尾雉（帝雉）是保育類嗎？',
  '藍腹鷴和黑長尾雉有什麼不同？',
  '什麼是特有種？',
  '石虎幾月最容易看到？',
  '臺灣黑熊住在哪裡？',
  '五色鳥長什麼樣子？',
  '外來種和入侵種有什麼不同？',
  '會吃昆蟲的青蛙有哪些？',
  '台灣有哪些螢火蟲？',
]

let nextId = 0 // 每則對話的 key

// AI 動物通：用一句話問台灣動物的問題，AI 根據本站資料回答，並附上參考的物種卡片
export default function AskPage() {
  const { speciesList } = useSpeciesList()
  const [messages, setMessages] = useState([]) // { id, role: 'user' | 'assistant', text, sources, followUps, loading }
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

  // 有新訊息時，把最新的一則捲進畫面
  useEffect(() => {
    if (messages.length > 0) listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
        <ExampleQuestions label="試試看這些問題" questions={EXAMPLE_QUESTIONS} onSelect={send} disabled={isLoading} />
        <p className={styles.intro}>
          用一句話問問台灣動物的食性、棲地、保育等級，AI 會根據本站收錄的動物資料回答，並列出參考的物種。
        </p>
        <p className={styles.notice}>回答僅根據本站物種資料，資料沒有提到的會直接告訴你；AI 也可能出錯，請以物種介紹為準。</p>
      </PagePanel>

      <section className={styles.chat} aria-label="對話">
        {messages.length === 0 ? (
          <p className={styles.empty}>還沒有對話。點上方的範例問題，或在下方輸入你的問題。</p>
        ) : (
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
        <div ref={listEndRef} />

        <div className={styles.inputBar}>
          <ChatInput onSend={send} disabled={isLoading} />
        </div>
      </section>
    </div>
  )
}
