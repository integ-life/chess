import { useState } from 'react'
import { Link } from 'react-router-dom'
import Board from '../components/board/Board'
import SpacedReviewCard from '../components/SpacedReviewCard'
import { foundationLessons } from '../course/foundation'
import { START_FEN, fromFEN } from '../chess/fen'
import CourseTranslator from '../components/CourseTranslator'

export default function FoundationCoursePage() {
  const [lessonIndex, setLessonIndex] = useState(0)
  const [answerIndex, setAnswerIndex] = useState<number | null>(null)
  const lesson = foundationLessons[lessonIndex]
  const answer = answerIndex === null ? null : lesson.quiz.choices[answerIndex]
  const practiceFen = lesson.practiceFen ?? START_FEN

  function selectLesson(index: number) {
    setLessonIndex(index)
    setAnswerIndex(null)
  }

  return (
    <CourseTranslator>
    <div className="foundation-course opening-course">
      <div className="foundation-course__back"><Link to="/course">← 完整学习路线</Link><span>第一阶段 · 规则与记谱</span></div>
      <section className="opening-course__hero">
        <div className="opening-course__hero-copy">
          <p className="opening-course__eyebrow">零基础 · 八课</p>
          <h2>先把规则变成判断</h2>
          <p>不只背棋子怎么走，还要理解路线为什么被阻挡、什么是合法着，以及怎样把棋盘动作准确记录下来。</p>
        </div>
        <dl className="opening-course__facts"><div><dt>课程</dt><dd>8</dd></div><div><dt>练习</dt><dd>{foundationLessons.reduce((sum, lesson) => sum + lesson.reviewPrompts.length + 3, 0)} 题</dd></div><div><dt>判例</dt><dd>8 题</dd></div><div><dt>检查</dt><dd>8 题</dd></div></dl>
      </section>

      <label className="opening-course__mobile-picker">
        <span>选择课程</span>
        <select value={lessonIndex} onChange={(event) => selectLesson(Number(event.target.value))}>
          {foundationLessons.map((item, index) => <option key={item.id} value={index}>第 {index + 1} 课 · {item.title}</option>)}
        </select>
      </label>

      <div className="opening-course__layout">
        <aside className="opening-course__sidebar" aria-label="规则课程目录">
          <p className="opening-course__sidebar-title">规则与记谱 · 八课</p>
          <ol>{foundationLessons.map((item, index) => <li key={item.id}><button className={index === lessonIndex ? 'is-active' : undefined} onClick={() => selectLesson(index)} type="button"><span>{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span></button></li>)}</ol>
        </aside>

        <article className="opening-course__lesson">
          <header className="opening-course__lesson-header"><div><p>第 {lessonIndex + 1} 课 · 规则基础</p><h2>{lesson.title}</h2><p>{lesson.summary}</p></div><span className="opening-course__lesson-number">{String(lessonIndex + 1).padStart(2, '0')}</span></header>
          <section className="foundation-course__lecture">
            {lesson.sections.map((section, index) => <section key={section.title}><span>{index + 1}</span><div><h3>{section.title}</h3><p>{section.body}</p></div></section>)}
            <div className="foundation-course__points"><h3>学完要记住</h3><ul>{lesson.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul></div>
          </section>
          <section className="foundation-course__practice">
            <div><Board position={fromFEN(practiceFen)} /></div>
            <div><p className="opening-course__eyebrow">棋盘练习</p><h3>先预测，再验证</h3><p>{lesson.practicePrompt}</p><Link to={`/explore?fen=${encodeURIComponent(practiceFen)}`}>打开推演验证 →</Link><p><strong>规则判例：</strong>{lesson.ruling.prompt}</p><details className="foundation-course__ruling" key={lesson.id}><summary>我已写下结论和适用规则，查看依据</summary><p>{lesson.ruling.answer}</p></details></div>
          </section>
          <section className="opening-course__quiz">
            <p className="opening-course__eyebrow">本课检查</p><h3>{lesson.quiz.prompt}</h3>
            <div className="opening-course__answers">{lesson.quiz.choices.map((choice, index) => <button className={answerIndex === index ? (choice.correct ? 'is-correct' : 'is-wrong') : undefined} key={choice.text} onClick={() => setAnswerIndex(index)} type="button"><span>{String.fromCharCode(65 + index)}</span>{choice.text}</button>)}</div>
            {answer && <p className={`opening-course__feedback ${answer.correct ? 'is-correct' : 'is-wrong'}`} aria-live="polite">{answer.feedback}</p>}
          </section>
          <SpacedReviewCard key={lesson.id} lessonKey={`foundation-${lesson.id}`} prompts={lesson.reviewPrompts} ready={Boolean(answer?.correct)} readyHint="答对本课检查后安排复习" />
          <footer className="opening-course__lesson-footer"><button disabled={lessonIndex === 0} onClick={() => selectLesson(lessonIndex - 1)} type="button">上一课</button><span>{lessonIndex + 1} / {foundationLessons.length}</span><button disabled={lessonIndex === foundationLessons.length - 1} onClick={() => selectLesson(lessonIndex + 1)} type="button">下一课</button></footer>
        </article>
      </div>
      <footer className="opening-course__sources"><strong>课程依据</strong><p>本地 WXF《Introduction to Chess》与学校课程资料 · 项目 TypeScript / Go 双规则内核与 perft</p></footer>
    </div>
    </CourseTranslator>
  )
}
