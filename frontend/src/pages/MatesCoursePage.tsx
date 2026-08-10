import PatternCoursePage from '../components/PatternCoursePage'
import { mateExamples, mateLessons, mateTransferExamples } from '../course/mates'
import { gameStatus } from '../chess/movegen'

export default function MatesCoursePage() {
  return <PatternCoursePage
    lessons={mateLessons}
    examples={mateExamples}
    transferExamples={mateTransferExamples}
    stage="第二阶段 · 基本杀法"
    eyebrow="入门攻王 · 十课"
    heroTitle="先看控制点，再算将军"
    heroCopy="每课先讲清杀法结构，再逐着预测社区题局主线；完成概念检查后，换一个真实终局盲算同类杀法。"
    lessonKind="基本杀法"
    patternHeading="识别这个杀法"
    trainingLabel="引导 + 迁移盲算"
    trainingPrompt="先看控制点和将军方式，再从三个合法选择中判断社区主线。"
    transferPrompt="逐个标出将军方式、控制点、炮架或马腿；写下至少两个候选着以及三个半回合变化。"
    sourceSummary="WXF 入门课程标准 · WXF 将军与战术章节 · 本地 Vietcotuong 社区题库与共享局面图"
    completion={(position) => gameStatus(position) === 'stalemate'
      ? { title: '困毙：没有将军，但黑方无合法着', body: '规则内核已逐着验证这条线路，并在终局重新检查全部合法着。', className: 'is-stalemate' }
      : { title: '将死：黑方已无任何合法应将', body: '规则内核已逐着验证这条线路，并在终局重新检查全部合法着。' }}
  />
}
