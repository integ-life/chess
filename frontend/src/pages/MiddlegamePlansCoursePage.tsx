import PatternCoursePage from '../components/PatternCoursePage'
import { middlegamePlanExamples, middlegamePlanLessons, middlegamePlanTransferExamples } from '../course/middlegamePlans'

export default function MiddlegamePlansCoursePage() {
  return <PatternCoursePage
    lessons={middlegamePlanLessons}
    examples={middlegamePlanExamples}
    transferExamples={middlegamePlanTransferExamples}
    stage="第六阶段 · 中局攻防与计划"
    eyebrow="中高级 · 十课"
    heroTitle="把局面判断转化为可执行计划"
    heroCopy="每课围绕一个攻防计划，先说明成立条件，再逐着预测社区主线，并换一个真实局面重新生成计划；合法候选着不冒充尚未完成的 Pikafish 评分。"
    lessonKind="中局计划"
    patternHeading="执行计划前检查"
    trainingLabel="计划线 5 着"
    trainingPrompt="先写计划目标、执行次序和对手反击，再盲算本段五着。"
    transferPrompt="先写计划目标、到场兵力、执行次序、对手反击和计划终点，再列三个候选计划。"
    hideCandidates
    sourceSummary="本地 Vietcotuong 实战中局、中局妙手、中局答疑与弃子中局专题 · 规则内核合法着验证"
    completion={() => ({ title: '五着计划主线完成', body: '你已走完本课社区片段。回到初始局面，尝试写出目标、到场兵力、对手反击和计划终点，再对照逐着解释。' })}
  />
}
