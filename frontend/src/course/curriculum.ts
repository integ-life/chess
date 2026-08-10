export interface CurriculumStage {
  id: string
  number: number
  title: string
  level: string
  summary: string
  outcome: string
  lessons: string[]
  path?: string
}

export const curriculumStages: CurriculumStage[] = [
  {
    id: 'foundation', number: 1, title: '规则、记谱与基本判断', level: '零基础',
    summary: '先建立不会出错的棋盘方向、行棋规则和记谱能力。',
    outcome: '能够独立完成合法对局，并正确读写基础棋谱。',
    lessons: ['棋盘、九宫与河界', '车、马、炮的走法', '将、士、象与兵卒', '蹩马腿、塞象眼与炮架', '将军、应将、将死与困毙', '将帅照面', '中文记谱与 ICCS', '合法着、重复与胜负'],
    path: '/course/foundation',
  },
  {
    id: 'mates', number: 2, title: '基本杀法', level: '入门',
    summary: '把将死结构拆成可以识别、可以复现的控制点。',
    outcome: '看到常见将门结构时，能找到杀法并说明防守方法。',
    lessons: ['白脸将与对面笑', '双车错', '重炮与天地炮', '闷宫与闷杀', '卧槽马', '挂角马与八角马', '马后炮', '铁门栓与夹车炮', '大胆穿心与三子归边', '困毙'],
    path: '/course/mates',
  },
  {
    id: 'tactics', number: 3, title: '基本战术', level: '入门进阶',
    summary: '从一步威胁进阶到三至五个半回合的强制计算。',
    outcome: '能够识别战术条件、计算对手回应，并避免只看自己的威胁。',
    lessons: ['捉双', '串打', '牵制', '闪击与闪将', '引离与吸引', '封锁与堵塞', '拦截与腾挪', '过载与消除保护', '兑子与弃子', '顿挫与停着'],
    path: '/course/tactics',
  },
  {
    id: 'opening', number: 4, title: '开局判断与主要体系', level: '体系建立',
    summary: '用出子、车路、河界和安全理解主要开局，而不是背一条谱。',
    outcome: '脱谱后仍能提出合理候选着，并从真实棋局识别结构。',
    lessons: ['开局的四个目标', '效率与子力协调', 'ECCO 与转置', '中炮与屏风马', '过河车与七路兵', '五七炮与河界争夺', '反宫马与三步虎', '顺炮：速度战', '列炮：错位对抗', '仙人指路', '飞相与起马', '过宫炮与总复习'],
    path: '/course/opening',
  },
  {
    id: 'middlegame-evaluation', number: 5, title: '中局形势判断', level: '中级',
    summary: '学会评价实际战斗力，并从局面弱点生成计划。',
    outcome: '能说明双方优势、弱点和三个有依据的候选计划。',
    lessons: ['子力价值与战斗力', '先手、攻势与空间', '改善最差的子', '开放线与肋道', '好马与坏马', '炮架与炮位', '兵形与弱兵', '将帅安全', '优势简化', '劣势求变'],
    path: '/course/middlegame',
  },
  {
    id: 'middlegame-plans', number: 6, title: '中局攻防与计划', level: '中高级',
    summary: '把形势判断转换为突破、防守、兑子和局面转换。',
    outcome: '能组织多子协同，并判断什么时候打开或关闭局面。',
    lessons: ['集中优势兵力', '打开线路', '弃子开将门', '增加防守', '兑换进攻核心', '反击与解杀还杀', '两翼转换', '位置优势转战术', '转入有利残局', '大师中局案例'],
    path: '/course/middlegame-plans',
  },
  {
    id: 'endgames', number: 7, title: '实用残局', level: '中高级',
    summary: '先掌握胜和边界，再学习单兵种和复合残局的准确次序。',
    outcome: '识别常见胜和定式，并能把优势局面稳定兑现。',
    lessons: ['将帅活动', '兵卒价值', '等着与对应点', '堡垒与胜和', '兵对士象', '双兵残局', '马类残局', '炮类残局', '单车杀法', '车兵残局', '车马对车炮', '炮兵残局', '马兵残局', '多兵残局', '兑子转换', '实战防守'],
    path: '/course/endgames',
  },
  {
    id: 'practice', number: 8, title: '计算、实战与复盘', level: '综合运用',
    summary: '建立候选着、计算、防漏、时间管理和复盘的完整习惯。',
    outcome: '能够独立分析一盘自己的棋，并建立可维护的个人开局体系。',
    lessons: ['将吃威候选着', '强制变化与安静着', '寻找最佳回应', '行棋前防漏', '时间管理', '棋谱批注', '无引擎复盘', '用引擎验证', '个人开局体系', '毕业实战分析'],
    path: '/course/practice',
  },
]

export const totalCurriculumLessons = curriculumStages.reduce((total, stage) => total + stage.lessons.length, 0)
