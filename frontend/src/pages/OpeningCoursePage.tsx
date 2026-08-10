import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Board from '../components/board/Board'
import SpacedReviewCard from '../components/SpacedReviewCard'
import CourseTranslator from '../components/CourseTranslator'
import { explainOpeningAlternative, firstBranchIndex, openingLessons, teachingAlternatives } from '../opening/course'
import { describeCourseMove } from '../course/pattern'
import { openingDeepDives } from '../opening/deepDive'
import { openingExercises } from '../opening/exercises'
import { courseExamples } from '../opening/examples'
import { START_FEN, fromFEN, toFEN } from '../chess/fen'
import { moveFromICCS, moveToChinese } from '../chess/notation'
import { makeMove } from '../chess/position'
import type { Move } from '../chess/types'

const stages = [
  ['理解', '概念与判断'],
  ['推演', '主线与变招'],
  ['练习', '局面作答'],
  ['实战', '典型对局'],
] as const

function buildLine(initialFen: string, moves: string[]) {
  const positions = [fromFEN(initialFen)]
  const labels: string[] = []
  const parsedMoves = moves.map(moveFromICCS)
  for (const move of parsedMoves) {
    const before = positions.at(-1)!
    labels.push(moveToChinese(before, move))
    positions.push(makeMove(before, move))
  }
  return { labels, moves: parsedMoves, positions }
}

const moveKey = (move: Move) => `${move.from}-${move.to}`

export default function OpeningCoursePage() {
  const [lessonIndex, setLessonIndex] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [drillIndex, setDrillIndex] = useState(0)
  const [showDrillCandidates, setShowDrillCandidates] = useState(false)
  const [drillAnswer, setDrillAnswer] = useState<string | null>(null)
  const [answerIndex, setAnswerIndex] = useState<number | null>(null)
  const [modelStep, setModelStep] = useState(0)
  const lesson = openingLessons[lessonIndex]
  const example = courseExamples[lesson.id]

  const line = useMemo(() => buildLine(START_FEN, lesson.steps.map((step) => step.move)), [lesson])
  const modelLine = useMemo(() => buildLine(example.initialFen, example.moves), [example])
  const modelBranch = firstBranchIndex(lesson.steps.map((step) => step.move), example.moves)
  const modelDeviates = modelBranch < lesson.steps.length
  const drillCheckpoints = openingExercises[lesson.id].checkpoints
  const checkpoint = drillCheckpoints[drillIndex]
  const drillPosition = line.positions[checkpoint]
  const drillMainMove = line.moves[checkpoint]
  const drillOptions = useMemo(() => {
    const options = [drillMainMove, ...teachingAlternatives(drillPosition, drillMainMove)]
    const offset = (lesson.number + drillIndex) % options.length
    return [...options.slice(offset), ...options.slice(0, offset)]
  }, [drillIndex, drillMainMove, drillPosition, lesson.number])

  const position = line.positions[stepIndex]
  const positionBeforeMove = stepIndex > 0 ? line.positions[stepIndex - 1] : null
  const mainMove = stepIndex > 0 ? line.moves[stepIndex - 1] : null
  const alternatives = positionBeforeMove && mainMove ? teachingAlternatives(positionBeforeMove, mainMove) : []
  const selectedAnswer = answerIndex === null ? null : lesson.quiz.choices[answerIndex]
  const drillCorrect = drillAnswer === moveKey(drillMainMove)
  const currentNote = stepIndex === 0
    ? `先观察初始阵型。本课会用 ${lesson.steps.length} 个半回合建立基本结构。`
    : lesson.steps[stepIndex - 1].note
  const modelPosition = modelLine.positions[modelStep]
  const modelNote = modelStep === 0
    ? `先找本局与课内主线的共同走序；${modelDeviates ? `首次真实分叉发生在第 ${modelBranch + 1} 着。` : `课内主线走完后，代表局从第 ${modelBranch + 1} 着继续进入实战。`}`
    : modelStep - 1 < modelBranch
      ? `本着与课内主线一致：${lesson.steps[modelStep - 1].note}`
      : modelStep - 1 === modelBranch
        ? modelDeviates
          ? `真实分叉：本局走 ${modelLine.labels[modelBranch]}，课内主线是 ${line.labels[modelBranch]}。${explainOpeningAlternative(modelLine.positions[modelBranch], modelLine.moves[modelBranch], line.moves[modelBranch])}`
          : `课内主线已经完整出现；代表局接着走 ${modelLine.labels[modelBranch]}。${describeCourseMove(modelLine.positions[modelBranch], modelLine.moves[modelBranch])}，开始检验此前建立的结构如何进入实战。`
        : '本局已经进入代表棋局的真实分支。继续检查双方怎样处理课内主线被推迟的任务，以及开局结构如何转入中局。'

  function selectLesson(index: number) {
    setLessonIndex(index)
    setStageIndex(0)
    setStepIndex(0)
    setDrillIndex(0)
    setShowDrillCandidates(false)
    setDrillAnswer(null)
    setAnswerIndex(null)
    setModelStep(0)
  }

  function selectDrill(index: number) {
    setDrillIndex(index)
    setShowDrillCandidates(false)
    setDrillAnswer(null)
  }

  function goToStage(index: number) {
    setStageIndex(index)
    if (index === 2) {
      setShowDrillCandidates(false)
      setDrillAnswer(null)
    }
  }

  return (
    <CourseTranslator>
    <div className="opening-course">
      <div className="foundation-course__back"><Link to="/course">← 完整学习路线</Link><span>第四阶段 · 开局体系</span></div>
      <section className="opening-course__hero">
        <div className="opening-course__hero-copy">
          <p className="opening-course__eyebrow">系统开局训练 · 十二课</p>
          <h2>从看懂，到会走</h2>
          <p>
            每课经过概念、推演、局面练习和实战复盘四步。不是背一条变化，
            而是学会在不同走序里认出结构、比较选择，并从真实棋局验证计划。
          </p>
        </div>
        <div className="opening-course__seal" aria-hidden="true"><span>知</span><span>行</span></div>
        <dl className="opening-course__facts">
          <div><dt>课程</dt><dd>12</dd></div>
          <div><dt>学习环节</dt><dd>4 / 课</dd></div>
          <div><dt>局面练习</dt><dd>24</dd></div>
          <div><dt>实战例局</dt><dd>12</dd></div>
        </dl>
      </section>

      <label className="opening-course__mobile-picker">
        <span>选择课程</span>
        <select value={lessonIndex} onChange={(event) => selectLesson(Number(event.target.value))}>
          {openingLessons.map((item, index) => (
            <option key={item.id} value={index}>第 {item.number} 课 · {item.title}</option>
          ))}
        </select>
      </label>

      <div className="opening-course__layout">
        <aside className="opening-course__sidebar" aria-label="课程目录">
          <p className="opening-course__sidebar-title">四单元 · 十二课</p>
          <ol>
            {openingLessons.map((item, index) => (
              <li key={item.id}>
                <button
                  aria-current={index === lessonIndex ? 'page' : undefined}
                  className={index === lessonIndex ? 'is-active' : undefined}
                  onClick={() => selectLesson(index)}
                  type="button"
                >
                  <span>{String(item.number).padStart(2, '0')}</span>
                  <span><small>{item.unit} · {item.ecco}</small>{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <article className="opening-course__lesson">
          <header className="opening-course__lesson-header">
            <div>
              <p>第 {lesson.number} 课 · {lesson.unit} · {lesson.ecco}</p>
              <h2>{lesson.title}</h2>
              <p>{lesson.summary}</p>
            </div>
            <span className="opening-course__lesson-number">{String(lesson.number).padStart(2, '0')}</span>
          </header>

          <nav className="opening-course__stages" aria-label="本课学习环节">
            {stages.map(([title, subtitle], index) => (
              <button
                aria-current={stageIndex === index ? 'step' : undefined}
                className={stageIndex === index ? 'is-active' : undefined}
                key={title}
                onClick={() => goToStage(index)}
                type="button"
              >
                <span>{index + 1}</span>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </button>
            ))}
          </nav>

          {stageIndex === 0 && (
            <section className="opening-course__theory" aria-labelledby="lesson-theory-title">
              <p className="opening-course__eyebrow">第一阶段 · 先理解</p>
              <h3 id="lesson-theory-title">先把基本概念说清楚</h3>
              <div className="opening-course__explanation">
                {lesson.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <div className="opening-course__deep-dive">
                {openingDeepDives[lesson.id].map((section, index) => (
                  <section key={section.title}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div><h4>{section.title}</h4><p>{section.body}</p></div>
                  </section>
                ))}
              </div>
              <div className="opening-course__concept-grid">
                {lesson.concepts.map((concept) => (
                  <section key={concept.term}><h4>{concept.term}</h4><p>{concept.definition}</p></section>
                ))}
              </div>
              <div className="opening-course__checklist">
                <h4>上棋盘前，先会回答</h4>
                <ol>{lesson.checklist.map((question) => <li key={question}>{question}</li>)}</ol>
              </div>
              <button className="opening-course__start" onClick={() => goToStage(1)} type="button">
                概念已读，开始比较走法
              </button>
            </section>
          )}

          {stageIndex === 1 && (
            <section className="opening-course__practice" aria-labelledby="lesson-practice-title">
              <div className="opening-course__practice-header">
                <div><p className="opening-course__eyebrow">第二阶段 · 再推演</p><h3 id="lesson-practice-title">主线为什么这样走</h3></div>
                <button onClick={() => goToStage(0)} type="button">返回概念</button>
              </div>
              <div className="opening-course__board-section" aria-label="着法演示">
                <div className="opening-course__board-wrap">
                  <Board position={position} lastMove={stepIndex > 0 ? line.moves[stepIndex - 1] : null} />
                </div>
                <div className="opening-course__notation">
                  <div className="opening-course__step-heading"><span>基本阵型</span><strong>{stepIndex} / {lesson.steps.length}</strong></div>
                  <div className="opening-course__move-list">
                    {line.labels.map((label, index) => (
                      <button className={stepIndex === index + 1 ? 'is-current' : undefined} key={`${lesson.id}-${index}`} onClick={() => setStepIndex(index + 1)} type="button">
                        <span>{index + 1}</span>{label}
                      </button>
                    ))}
                  </div>
                  <div className="opening-course__note" aria-live="polite">
                    <small>{stepIndex === 0 ? '起始局面' : `第 ${stepIndex} 着 · ${line.labels[stepIndex - 1]}`}</small>
                    <p>{currentNote}</p>
                  </div>
                  {positionBeforeMove && mainMove && (
                    <div className="opening-course__variations">
                      <h4>如果不走主线，会怎样？</h4>
                      <p>这些都是合法选择，不代表引擎优劣；重点是看它们改变了哪项开局任务。</p>
                      {alternatives.map((move) => (
                        <div key={moveKey(move)}><strong>{moveToChinese(positionBeforeMove, move)}</strong><p>{explainOpeningAlternative(positionBeforeMove, move, mainMove)}</p></div>
                      ))}
                    </div>
                  )}
                  <div className="opening-course__controls">
                    <button disabled={stepIndex === 0} onClick={() => setStepIndex((value) => value - 1)} type="button">上一步</button>
                    <button disabled={stepIndex === lesson.steps.length} onClick={() => setStepIndex((value) => value + 1)} type="button">下一步</button>
                    <Link to={`/explore?fen=${encodeURIComponent(toFEN(position))}`}>从这里自由推演</Link>
                  </div>
                </div>
              </div>
              <button className="opening-course__stage-next" onClick={() => goToStage(2)} type="button">我看懂了，进入局面练习 →</button>
            </section>
          )}

          {stageIndex === 2 && (
            <section className="opening-course__drills" aria-labelledby="lesson-drills-title">
              <div className="opening-course__practice-header">
                <div><p className="opening-course__eyebrow">第三阶段 · 自己判断</p><h3 id="lesson-drills-title">轮到你选择计划</h3></div>
                <span className="opening-course__drill-count">局面 {drillIndex + 1} / {drillCheckpoints.length}</span>
              </div>
              <div className="opening-course__board-section">
                <div className="opening-course__board-wrap"><Board position={drillPosition} lastMove={checkpoint > 0 ? line.moves[checkpoint - 1] : null} /></div>
                <div className="opening-course__drill-panel">
                  <p className="opening-course__eyebrow">{drillPosition.turn === 'r' ? '红方' : '黑方'}走</p>
                  <h4>哪一步最符合本课的主线计划？</h4>
                  <p>先判断要发展哪枚子、争夺哪里，以及会不会耽误车路或将帅安全。</p>
                  {!showDrillCandidates ? <div className="opening-course__blind"><strong>先生成候选，再看选项</strong><p>在纸上写下至少两着候选；每着补一项对手回应，并说明它完成或推迟了哪项开局任务。</p><button onClick={() => setShowDrillCandidates(true)} type="button">我已写下候选，显示选项</button></div> : <div className="opening-course__answers">
                    {drillOptions.map((move, index) => {
                      const key = moveKey(move)
                      const isCorrect = key === moveKey(drillMainMove)
                      const className = drillAnswer === key ? (isCorrect ? 'is-correct' : 'is-wrong') : drillAnswer && isCorrect ? 'is-correct' : undefined
                      return <button className={className} key={key} onClick={() => setDrillAnswer(key)} type="button"><span>{String.fromCharCode(65 + index)}</span>{moveToChinese(drillPosition, move)}</button>
                    })}
                  </div>}
                  {drillAnswer && (
                    <div className={`opening-course__feedback ${drillCorrect ? 'is-correct' : 'is-wrong'}`} aria-live="polite">
                      <strong>{drillCorrect ? '判断正确。' : `主线选择是 ${moveToChinese(drillPosition, drillMainMove)}。`}</strong>
                      <p>{drillCorrect ? lesson.steps[checkpoint].note : explainOpeningAlternative(drillPosition, drillOptions.find((move) => moveKey(move) === drillAnswer)!, drillMainMove)}</p>
                    </div>
                  )}
                  {drillAnswer && drillIndex < drillCheckpoints.length - 1 && <button className="opening-course__stage-next" onClick={() => selectDrill(drillIndex + 1)} type="button">下一道局面题 →</button>}
                </div>
              </div>
              <section className="opening-course__quiz">
                <p className="opening-course__eyebrow">概念检查</p>
                <h3>{lesson.quiz.prompt}</h3>
                <div className="opening-course__answers">
                  {lesson.quiz.choices.map((choice, index) => (
                    <button className={answerIndex === index ? (choice.correct ? 'is-correct' : 'is-wrong') : undefined} key={choice.text} onClick={() => setAnswerIndex(index)} type="button"><span>{String.fromCharCode(65 + index)}</span>{choice.text}</button>
                  ))}
                </div>
                {selectedAnswer && <p className={`opening-course__feedback ${selectedAnswer.correct ? 'is-correct' : 'is-wrong'}`} aria-live="polite">{selectedAnswer.feedback}</p>}
              </section>
              <button className="opening-course__stage-next" onClick={() => goToStage(3)} type="button">带着判断看一盘实战 →</button>
            </section>
          )}

          {stageIndex === 3 && (
            <section className="opening-course__model" aria-labelledby="lesson-model-title">
              <div className="opening-course__practice-header">
                <div><p className="opening-course__eyebrow">第四阶段 · 典型对局</p><h3 id="lesson-model-title">在完整实战里认出本课结构</h3></div>
                <span className="opening-course__source-badge">canonical game</span>
              </div>
              <div className="opening-course__model-card">
                <div><small>{example.opening}</small><h4>{example.redPlayer} <span>对</span> {example.blackPlayer}</h4><p>{[example.event, example.playedAt].filter(Boolean).join(' · ') || example.title}</p><code>canonical ID · {example.id}</code></div>
                <dl><div><dt>结果</dt><dd>{example.result}</dd></div><div><dt>半回合</dt><dd>{example.moves.length}</dd></div><div><dt>来源</dt><dd>{example.sourceName}</dd></div></dl>
              </div>
              <div className="opening-course__board-section">
                <div className="opening-course__board-wrap"><Board position={modelPosition} lastMove={modelStep > 0 ? modelLine.moves[modelStep - 1] : null} /></div>
                <div className="opening-course__notation">
                  <div className="opening-course__step-heading"><span>实战回放</span><strong>{modelStep} / {example.moves.length}</strong></div>
                  <div className="opening-course__move-list opening-course__move-list--model">
                    {modelLine.labels.map((label, index) => <button className={modelStep === index + 1 ? 'is-current' : undefined} key={`${example.id}-${index}`} onClick={() => setModelStep(index + 1)} type="button"><span>{index + 1}</span>{label}</button>)}
                  </div>
                  <div className="opening-course__note"><small>{modelStep === 0 ? '开局前' : `实战第 ${modelStep} 着`}</small><p>{modelNote}</p></div>
                  <div className="opening-course__checklist">
                    <h4>偏离主线后，重新排任务</h4>
                    <ol>{lesson.transitionChecks.map((check) => <li key={check}>{check}</li>)}</ol>
                  </div>
                  <div className="opening-course__controls">
                    <button disabled={modelStep === 0} onClick={() => setModelStep((value) => value - 1)} type="button">上一步</button>
                    <button disabled={modelStep === example.moves.length} onClick={() => setModelStep((value) => value + 1)} type="button">下一步</button>
                    <Link to={`/explore?qipu=${encodeURIComponent(`canonical-${example.id}`)}`}>打开完整棋谱与分支推演</Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          <SpacedReviewCard key={lesson.id} lessonKey={`opening-${lesson.id}`} prompts={openingExercises[lesson.id].reviewPrompts} ready={stageIndex === 3 && Boolean(selectedAnswer?.correct)} readyHint="完成四个环节并答对概念检查后安排复习" />

          <footer className="opening-course__lesson-footer">
            <button disabled={lessonIndex === 0} onClick={() => selectLesson(lessonIndex - 1)} type="button">上一课</button>
            <span>{lesson.number} / {openingLessons.length}</span>
            <button disabled={lessonIndex === openingLessons.length - 1} onClick={() => selectLesson(lessonIndex + 1)} type="button">下一课</button>
          </footer>
        </article>
      </div>

      <footer className="opening-course__sources">
        <strong>课程依据</strong>
        <p>WXF 分级课程结构 · Chess.com 互动课程与练习模式 · ECCO 分类体系 · 本地社区棋谱共享局面图</p>
      </footer>
    </div>
    </CourseTranslator>
  )
}
