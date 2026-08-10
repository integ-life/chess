import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { courseMoveOptions, describeCourseMove } from '../course/pattern'
import type { CourseLineExample, PatternLesson } from '../course/pattern'
import { fromFEN, toFEN } from '../chess/fen'
import { moveFromICCS, moveToChinese } from '../chess/notation'
import { makeMove } from '../chess/position'
import type { Move, Position } from '../chess/types'
import Board from './board/Board'
import SpacedReviewCard from './SpacedReviewCard'
import CourseTranslator from './CourseTranslator'

const moveKey = (move: Move) => `${move.from}-${move.to}`

function buildLine(initialFen: string, moves: string[]) {
  const positions = [fromFEN(initialFen)]
  const parsedMoves = moves.map(moveFromICCS)
  const labels: string[] = []
  for (const move of parsedMoves) {
    const before = positions.at(-1)!
    labels.push(moveToChinese(before, move))
    positions.push(makeMove(before, move))
  }
  return { positions, moves: parsedMoves, labels }
}

interface PatternCoursePageProps {
  lessons: PatternLesson[]
  examples: Record<string, CourseLineExample>
  transferExamples?: Record<string, CourseLineExample>
  stage: string
  eyebrow: string
  heroTitle: string
  heroCopy: string
  lessonKind: string
  patternHeading: string
  sourceSummary: string
  trainingLabel: string
  trainingPrompt: string
  transferPrompt?: string
  hideCandidates?: boolean
  completion: (position: Position) => { title: string; body: string; className?: string }
}

export default function PatternCoursePage({ lessons, examples, transferExamples, stage, eyebrow, heroTitle, heroCopy, lessonKind, patternHeading, sourceSummary, trainingLabel, trainingPrompt, transferPrompt, hideCandidates = false, completion }: PatternCoursePageProps) {
  const [lessonIndex, setLessonIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [moveAnswer, setMoveAnswer] = useState<string | null>(null)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)
  const [showCandidates, setShowCandidates] = useState(!hideCandidates)
  const [transferRevealed, setTransferRevealed] = useState(false)
  const [transferAnswer, setTransferAnswer] = useState<string | null>(null)
  const lesson = lessons[lessonIndex]
  const example = examples[lesson.id]
  const line = useMemo(() => buildLine(example.initialFen, example.moves), [example])
  const transferExample = transferExamples?.[lesson.id]
  const transferLine = useMemo(() => transferExample ? buildLine(transferExample.initialFen, transferExample.moves) : null, [transferExample])
  const transferPosition = transferLine?.positions[0]
  const transferMainMove = transferLine?.moves[0]
  const transferOptions = useMemo(() => transferPosition && transferMainMove ? courseMoveOptions(transferPosition, transferMainMove, lessonIndex + 17) : [], [lessonIndex, transferMainMove, transferPosition])
  const transferCorrect = transferMainMove && transferAnswer === moveKey(transferMainMove)
  const position = line.positions[stepIndex]
  const mainMove = line.moves[stepIndex]
  const options = useMemo(() => mainMove ? courseMoveOptions(position, mainMove, lessonIndex + stepIndex) : [], [lessonIndex, mainMove, position, stepIndex])
  const forcedMove = options.length === 1
  const candidatesHidden = hideCandidates && !forcedMove && !showCandidates
  const moveCorrect = mainMove && moveAnswer === moveKey(mainMove)
  const selectedQuiz = quizAnswer === null ? null : lesson.quiz.choices[quizAnswer]

  function selectLesson(index: number) {
    setLessonIndex(index)
    setStepIndex(0)
    setMoveAnswer(null)
    setQuizAnswer(null)
    setShowCandidates(!hideCandidates)
    setTransferRevealed(false)
    setTransferAnswer(null)
  }

  function selectStep(index: number) {
    setStepIndex(index)
    setMoveAnswer(null)
    setShowCandidates(!hideCandidates)
  }

  const result = !mainMove ? completion(position) : null

  return (
    <CourseTranslator>
    <div className="mates-course opening-course">
      <div className="foundation-course__back"><Link to="/course">← 完整学习路线</Link><span>{stage}</span></div>
      <section className="opening-course__hero">
        <div className="opening-course__hero-copy"><p className="opening-course__eyebrow">{eyebrow}</p><h2>{heroTitle}</h2><p>{heroCopy}</p></div>
        <dl className="opening-course__facts"><div><dt>课程</dt><dd>{lessons.length}</dd></div><div><dt>课堂着数</dt><dd>{lessons.reduce((sum, item) => sum + examples[item.id].moves.length, 0)} 着</dd></div><div><dt>训练难度</dt><dd>{trainingLabel}</dd></div><div><dt>来源例局</dt><dd>{lessons.length + Object.keys(transferExamples ?? {}).length}</dd></div></dl>
      </section>

      <label className="opening-course__mobile-picker"><span>选择课程</span><select value={lessonIndex} onChange={(event) => selectLesson(Number(event.target.value))}>{lessons.map((item, index) => <option key={item.id} value={index}>第 {index + 1} 课 · {item.title}</option>)}</select></label>

      <div className="opening-course__layout">
        <aside className="opening-course__sidebar" aria-label={`${lessonKind}课程目录`}><p className="opening-course__sidebar-title">{lessonKind} · {lessons.length} 课</p><ol>{lessons.map((item, index) => <li key={item.id}><button aria-current={index === lessonIndex ? 'page' : undefined} className={index === lessonIndex ? 'is-active' : undefined} onClick={() => selectLesson(index)} type="button"><span>{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span></button></li>)}</ol></aside>

        <article className="opening-course__lesson">
          <header className="opening-course__lesson-header"><div><p>第 {lessonIndex + 1} 课 · {lessonKind}</p><h2>{lesson.title}</h2><p>{lesson.summary}</p></div><span className="opening-course__lesson-number">{String(lessonIndex + 1).padStart(2, '0')}</span></header>

          <section className="foundation-course__lecture">{lesson.explanation.map((section, index) => <section key={section.title}><span>{index + 1}</span><div><h3>{section.title}</h3><p>{section.body}</p></div></section>)}<div className="foundation-course__points"><h3>{patternHeading}</h3><ul>{lesson.pattern.map((point) => <li key={point}>{point}</li>)}</ul></div></section>

          <section className="mates-course__line">
            <div className="opening-course__practice-header"><div><p className="opening-course__eyebrow">逐着练习</p><h3>先选下一着，再看解释</h3></div><strong>{stepIndex} / {line.moves.length}</strong></div>
            <div className="opening-course__board-section">
              <div className="opening-course__board-wrap"><Board position={position} lastMove={stepIndex > 0 ? line.moves[stepIndex - 1] : null} /></div>
              <div className="opening-course__drill-panel">
                <div className="mates-course__steps" aria-label="主线进度">{line.labels.map((label, index) => <button className={stepIndex === index + 1 ? 'is-current' : undefined} disabled={hideCandidates && index >= stepIndex} key={`${lesson.id}-${index}`} onClick={() => selectStep(index + 1)} type="button"><span>{index + 1}</span>{index < stepIndex ? label : `第 ${index + 1} 着`}</button>)}</div>
                {mainMove ? <>
                  <p className="opening-course__eyebrow">{position.turn === 'r' ? '红方' : '黑方'}走 · 第 {stepIndex + 1} 着</p><h4>{forcedMove ? '当前只有一着合法应法' : '哪一步延续社区题局主线？'}</h4><p>{forcedMove ? '规则内核已排除其他走法；选择唯一合法着，再看它在主线中的作用。' : trainingPrompt}</p>
                  {candidatesHidden ? <div className="opening-course__blind"><strong>先盲算，再看选项</strong><p>在纸上写下候选着、对手最强回应和你的局面判断；不要只在脑中说“差不多”。</p><button onClick={() => setShowCandidates(true)} type="button">我已写下候选，显示选项</button></div> : <>
                    <div className="opening-course__answers">{options.map((move, index) => { const key = moveKey(move); const isCorrect = key === moveKey(mainMove); const className = moveAnswer === key ? (isCorrect ? 'is-correct' : 'is-wrong') : undefined; return <button className={className} key={key} onClick={() => setMoveAnswer(key)} type="button"><span>{String.fromCharCode(65 + index)}</span>{moveToChinese(position, move)}</button> })}</div>
                    {moveAnswer && <div className={`opening-course__feedback ${moveCorrect ? 'is-correct' : 'is-wrong'}`} aria-live="polite"><strong>{moveCorrect ? '主线正确。' : `这是一着合法棋，但本题社区主线是 ${line.labels[stepIndex]}。`}</strong><p>{moveCorrect ? lesson.steps[stepIndex].purpose : `${describeCourseMove(position, options.find((move) => moveKey(move) === moveAnswer)!)}。主线目的：${lesson.steps[stepIndex].purpose} 偏离时要检查：${lesson.steps[stepIndex].alternative} 这不是对所选着的引擎评价。`}</p></div>}
                    <button className="opening-course__stage-next" disabled={!moveCorrect} onClick={() => selectStep(stepIndex + 1)} type="button">落子并继续 →</button>
                  </>}
                </> : result && <div className={`mates-course__result ${result.className ?? ''}`}><p className="opening-course__eyebrow">主线完成</p><h4>{result.title}</h4><p>{result.body}</p></div>}
                <div className="opening-course__controls"><button disabled={stepIndex === 0} onClick={() => selectStep(stepIndex - 1)} type="button">上一步</button><button disabled={stepIndex === line.moves.length || candidatesHidden} onClick={() => selectStep(stepIndex + 1)} type="button">直接看下一步</button><Link to={`/explore?fen=${encodeURIComponent(toFEN(position))}`}>从当前局面自由推演</Link></div>
              </div>
            </div>
            <div className="mates-course__source"><div><small>本地 canonical game</small><strong>{example.title}</strong><span>{example.sourceName}</span><code>canonical ID · {example.id}</code></div>{example.fullMoves && <Link to={`/explore?qipu=${encodeURIComponent(`canonical-${example.id}`)}`}>打开完整棋谱 →</Link>}</div>
          </section>

          {lesson.deliverable && <section className="foundation-course__lecture"><div className="foundation-course__points"><h3>本课复盘产物</h3><ul>{lesson.deliverable.map((item) => <li key={item}>{item}</li>)}</ul></div></section>}
          <section className="opening-course__quiz"><p className="opening-course__eyebrow">概念检查</p><h3>{lesson.quiz.prompt}</h3><div className="opening-course__answers">{lesson.quiz.choices.map((choice, index) => <button className={quizAnswer === index ? (choice.correct ? 'is-correct' : 'is-wrong') : undefined} key={choice.text} onClick={() => setQuizAnswer(index)} type="button"><span>{String.fromCharCode(65 + index)}</span>{choice.text}</button>)}</div>{selectedQuiz && <p className={`opening-course__feedback ${selectedQuiz.correct ? 'is-correct' : 'is-wrong'}`} aria-live="polite">{selectedQuiz.feedback}</p>}</section>
          {transferExample && transferLine && transferPosition && transferMainMove && <section className="course-transfer opening-course__quiz">
            <p className="opening-course__eyebrow">跨局面迁移</p><h3>换一个局面，还能认出“{lesson.title}”吗？</h3>
            <p>不要回忆主例局着法。先完成下面的独立检查，再看社区例局怎样走。</p>
            <div className="opening-course__board-section">
              <div className="opening-course__board-wrap"><Board position={transferPosition} lastMove={null} /></div>
              <div className="opening-course__drill-panel"><p className="opening-course__eyebrow">{transferPosition.turn === 'r' ? '红方' : '黑方'}走 · 第二例局首着</p><h4>{transferExample.title}</h4>
                {!transferRevealed ? <div className="opening-course__blind"><strong>先独立识别，不看候选</strong><p>{transferPrompt ?? '检查目标、强制性和对手兼应；写下至少两个候选着以及三个半回合变化。'}</p><button onClick={() => setTransferRevealed(true)} type="button">我已写下候选，显示选项</button></div> : <>
                  <div className="opening-course__answers">{transferOptions.map((move, index) => { const key = moveKey(move); const isCorrect = key === moveKey(transferMainMove); return <button className={transferAnswer === key ? (isCorrect ? 'is-correct' : 'is-wrong') : undefined} key={key} onClick={() => setTransferAnswer(key)} type="button"><span>{String.fromCharCode(65 + index)}</span>{moveToChinese(transferPosition, move)}</button> })}</div>
                  {transferAnswer && <div className={`opening-course__feedback ${transferCorrect ? 'is-correct' : 'is-wrong'}`} aria-live="polite"><strong>{transferCorrect ? `你找到了社区例局首着：${transferLine.labels[0]}。` : `这是一着合法棋；社区例局首着是 ${transferLine.labels[0]}。`}</strong><p>{transferCorrect ? lesson.transferNote : `${describeCourseMove(transferPosition, transferOptions.find((move) => moveKey(move) === transferAnswer)!)}。先比较它是否满足本课判断条件；这里没有 Pikafish 分数，因此不把你的选择判作引擎劣着。`}</p></div>}
                  {transferAnswer && lesson.defenseNote && <div className="opening-course__note"><small>替对手找招</small><p>{lesson.defenseNote}</p></div>}
                </>}
                <div className="opening-course__controls"><Link to={`/explore?fen=${encodeURIComponent(toFEN(transferPosition))}`}>从这个局面自由推演</Link></div>
              </div>
            </div>
            <div className="mates-course__source"><div><small>第二个本地 canonical game · 已校验首五着</small><strong>{transferExample.title}</strong><span>{transferExample.sourceName}</span><code>canonical ID · {transferExample.id}</code></div></div>
          </section>}
          <SpacedReviewCard key={`${stage}-${lesson.id}`} lessonKey={`${stage}-${lesson.id}`} prompts={lesson.reviewPrompts} ready={stepIndex === line.moves.length && Boolean(selectedQuiz?.correct)} readyHint="走完五着并答对概念检查后安排复习" />
          <footer className="opening-course__lesson-footer"><button disabled={lessonIndex === 0} onClick={() => selectLesson(lessonIndex - 1)} type="button">上一课</button><span>{lessonIndex + 1} / {lessons.length}</span><button disabled={lessonIndex === lessons.length - 1} onClick={() => selectLesson(lessonIndex + 1)} type="button">下一课</button></footer>
        </article>
      </div>
      <footer className="opening-course__sources"><strong>课程依据</strong><p>{sourceSummary}</p></footer>
    </div>
    </CourseTranslator>
  )
}
