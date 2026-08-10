import PatternCoursePage from '../components/PatternCoursePage'
import { tacticExamples, tacticLessons, tacticTransferExamples } from '../course/tactics'

export default function TacticsCoursePage() {
  return <PatternCoursePage
    lessons={tacticLessons}
    examples={tacticExamples}
    transferExamples={tacticTransferExamples}
    stage="第三阶段 · 基本战术"
    eyebrow="入门进阶 · 十课"
    heroTitle="先看强制手段，再计算回应"
    heroCopy="每课先拆解战术成立条件，再逐着预测社区题局主线；合法候选着只用于比较思路，不冒充尚未完成的 Pikafish 评分。"
    lessonKind="基本战术"
    patternHeading="识别这个战术"
    trainingLabel="盲算 3–5 着"
    trainingPrompt="先写下至少两个候选着，并算到对手最强回应，再显示选项。"
    transferPrompt="检查目标、强制性和对手兼应；写下至少两个候选着以及三个半回合变化。"
    hideCandidates
    sourceSummary="WXF 基础战术章节 · 本地 Vietcotuong 中局战术精选、杀法强化与残局杀技 · 规则内核合法着验证"
    completion={() => ({ title: '五着战术片段完成', body: '你已经走完社区题局的教学主线。这里验证的是来源与合法性；其他合法选择的优劣等待本地 Pikafish 数据完成后再比较。' })}
  />
}
