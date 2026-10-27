import styles from './ExampleQuestions.module.css'

// 範例問題／延伸問題：一排按鈕，點了直接送出這個問題
//   label：按鈕前面的小標題（文字或元件，可省略）；disabled：AI 回答中時先不能點
export default function ExampleQuestions({ questions, onSelect, label, disabled = false }) {
  if (questions.length === 0) return null

  return (
    <div className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <ul className={styles.list}>
        {questions.map((question) => (
          <li key={question}>
            <button type="button" className={styles.button} onClick={() => onSelect(question)} disabled={disabled}>
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
