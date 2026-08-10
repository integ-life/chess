import PatternCoursePage from '../components/PatternCoursePage'
import { practiceExamples, practiceLessons } from '../course/practice'

export default function PracticeCoursePage() {
  return <PatternCoursePage
    lessons={practiceLessons}
    examples={practiceExamples}
    stage="第八阶段 · 计算、实战与复盘"
    eyebrow="综合运用 · 十课"
    heroTitle="把每一盘实战变成下一轮训练"
    heroCopy="从候选着、最佳回应和防漏开始，建立无引擎复盘、引擎验证、个人开局体系与完整实战分析流程。"
    lessonKind="计算与复盘"
    patternHeading="本课执行清单"
    trainingLabel="完整盲算 5 着"
    trainingPrompt="先在纸上写完整五着主线、每步对手最佳回应和终点评价。"
    hideCandidates
    sourceSummary="本地 Vietcotuong、WXF 与东萍 canonical games · 完整棋局规则回放验证 · 社区主线与引擎证据分离"
    completion={() => ({ title: '五着课堂片段完成', body: '打开本课完整棋谱，继续按执行清单回放、批注和验证；只走完课堂片段不等于完成复盘。' })}
  />
}
