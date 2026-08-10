import PatternCoursePage from '../components/PatternCoursePage'
import { endgameExamples, endgameLessons, endgameTransferExamples } from '../course/endgames'

export default function EndgamesCoursePage() {
  return <PatternCoursePage
    lessons={endgameLessons}
    examples={endgameExamples}
    transferExamples={endgameTransferExamples}
    stage="第七阶段 · 实用残局"
    eyebrow="中高级 · 十六课"
    heroTitle="先判胜和边界，再选择兑现方法"
    heroCopy="每课先拆解残局职责和关键点，再逐着预测社区主线，并换一个真实局面重新判断胜和边界；当前不展示尚未完成的 Pikafish 评分。"
    lessonKind="实用残局"
    patternHeading="判断这个残局"
    trainingLabel="先判胜和"
    trainingPrompt="先判断胜、和、负及关键点，再写候选次序并显示选项。"
    transferPrompt="先写预期胜、和、负，标出关键点、双方职责和最危险反击，再列三个候选次序；社区题名只作分类线索。"
    hideCandidates
    sourceSummary="本地 Vietcotuong 残局基础、胜和定式、残局答疑与专题集合 · 规则内核合法着验证"
    completion={() => ({ title: '五着残局主线完成', body: '你已走完本课社区例局片段。回到初始局面，尝试不用提示说明每一步的职责；题名提供分类依据，但片段不是引擎胜负证明。' })}
  />
}
