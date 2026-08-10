import PatternCoursePage from '../components/PatternCoursePage'
import { middlegameExamples, middlegameLessons, middlegameTransferExamples } from '../course/middlegame'

export default function MiddlegameCoursePage() {
  return <PatternCoursePage
    lessons={middlegameLessons}
    examples={middlegameExamples}
    transferExamples={middlegameTransferExamples}
    stage="第五阶段 · 中局形势判断"
    eyebrow="中级 · 十课"
    heroTitle="先评价局面，再生成有依据的计划"
    heroCopy="每课从一个评价因素出发，逐着预测本地社区主线，再换一个真实局面重新完成评价与候选计划；Pikafish 本地评分完成前不展示引擎优劣。"
    lessonKind="中局判断"
    patternHeading="检查这个因素"
    trainingLabel="评价 + 3 候选"
    trainingPrompt="先写局面评价和三个候选计划，再沿对手最强回应比较。"
    transferPrompt="先写双方优势、弱点和完整局面评价，再列三个候选计划以及对手最强回应。"
    hideCandidates
    sourceSummary="本地 Vietcotuong 形势判断专题 · 子力价值、子与势、位置、弱点、选点出击与实战误判 · 规则内核合法着验证"
    completion={() => ({ title: '五着判断主线完成', body: '你已走完本课社区片段。回到初始局面，先写出双方优势、弱点和三个候选计划，再对照逐着解释；片段不是引擎评分。' })}
  />
}
