import type { QipuRecord } from './format'
import { catalogQipuRecords } from './catalog'
import { courseExampleQipuRecords } from '../opening/examples'
import practiceExamplesData from '../course/practice-examples.json'
import type { CourseLineExample } from '../course/pattern'

const practiceExamples = practiceExamplesData as Record<string, CourseLineExample>
const practiceQipuRecords: QipuRecord[] = Object.values(practiceExamples).map((example) => ({
  format: 'xiangqi-study-v1',
  id: `canonical-${example.id}`,
  title: example.title,
  rootFen: example.initialFen,
  summary: '第八阶段计算与复盘课程完整例局',
  tags: ['计算训练', '实战复盘'],
  source: { title: example.sourceName, url: example.sourceUrl },
  line: (example.fullMoves ?? example.moves).map((move) => ({ move })),
}))

export const learningQipuRecords: QipuRecord[] = [
  {
    format: 'xiangqi-study-v1',
    id: 'central-cannon-screen-horses',
    title: '中炮对屏风马：常见出子骨架',
    summary: '用一条短主线记录中炮、双马、明车和炮路展开，适合在推演页继续补自己的判断。',
    tags: ['开局布局', '中炮局', '屏风马', '入门'],
    source: {
      title: '象棋谱开局分类',
      url: 'https://www.xqipu.com/',
      note: '参考公开开局分类名称整理，不复制第三方完整棋谱。',
    },
    note: '这是平台内置的学习骨架，不是某一局比赛原谱。每一步批注会在推演页随选中节点展示。',
    line: [
      {
        move: 'h2e2',
        note: '红方架中炮，先占中路，是中炮体系的起点。',
        variations: [
          [
            {
              move: 'b9c7',
              note: '黑方也可先走左马，形成另一种出子次序。推演时可比较两边车路是否更顺。',
            },
          ],
        ],
      },
      {
        move: 'h9g7',
        note: '黑方右马屏护中卒，进入屏风马方向。',
      },
      {
        move: 'h0g2',
        note: '红方右马跟进，准备出车和保护中炮。',
      },
      {
        move: 'b9c7',
        note: '黑方左马补齐双马，屏风马骨架成型。',
      },
      {
        move: 'i0h0',
        note: '红方右车明出，后续常围绕车路速度争先。',
      },
      {
        move: 'i9h9',
        note: '黑方也明右车，双方开始比较车炮马的协同。',
      },
      {
        move: 'a0b0',
        note: '红方左车横出，给后续过河、巡河或兑车留下选择。',
      },
      {
        move: 'b7b4',
        note: '黑炮前压，限制红方左翼展开。这里很适合继续分支推演。',
      },
    ],
  },
  {
    format: 'xiangqi-study-v1',
    id: 'pawn-opening-vs-central-cannon',
    title: '仙人指路对卒底炮：短线观察',
    summary: '从进七兵开始，展示对方卒底炮和双方马炮展开，适合练习把开局转换成可分析树。',
    tags: ['开局布局', '仙人指路', '卒底炮', '分支'],
    source: {
      title: '广象网开局分类统计',
      url: 'https://www.gdchess.com/xqopening/xqolist.asp',
      note: '参考公开开局分类名称和统计入口整理。',
    },
    line: [
      {
        move: 'c3c4',
        note: '红方进七兵，先试探黑方布局方向。',
        variations: [
          [
            {
              move: 'c9e7',
              note: '黑方也可以先飞象稳住阵形，局面会转向较缓的对抗。',
            },
          ],
        ],
      },
      {
        move: 'b7e7',
        note: '黑方卒底炮瞄中路，和红方仙人指路形成典型对抗。',
      },
      {
        move: 'b0c2',
        note: '红方左马正出，保护三路兵并准备出车。',
      },
      {
        move: 'b9c7',
        note: '黑方左马应出，继续加固中路和三路线。',
      },
      {
        move: 'h2e2',
        note: '红方补中炮，开局可能转入中炮结构。',
      },
      {
        move: 'h9g7',
        note: '黑方右马补出，形成较完整的防守骨架。',
      },
      {
        move: 'i0h0',
        note: '红车明出，准备根据黑方车路选择压制点。',
      },
    ],
  },
]

export const publicQipuRecords: QipuRecord[] = [...new Map([
  ...learningQipuRecords,
  ...catalogQipuRecords,
  ...courseExampleQipuRecords,
  ...practiceQipuRecords,
].map((qipu) => [qipu.id, qipu])).values()]

export function getPublicQipu(id: string): QipuRecord | undefined {
  return publicQipuRecords.find((qipu) => qipu.id === id)
}
