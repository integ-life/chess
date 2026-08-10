# 开局课程社区资料目录

原始资料由 `scripts/pull-opening-materials.sh` 下载到 gitignored 的
`backend/qipu-sources/opening-materials/`。这些文件只用于本地研究；产品课程是重新组织和独立表达的版本，不发布第三方全文。

## 分类

| 分类 | 本地文件 | 来源 | 用途与边界 |
| --- | --- | --- | --- |
| 课程分级 | `wxf-school-course.pdf` | [WXF 校本课程研究](https://www.wxf-xiangqi.org/images/hangzhou-chess/2022_46_wang_bi_xiao_.pdf) | 启蒙到高级的能力分层、训练记录和考核；公开下载论文，仅摘要 |
| 开局定义 | `wxf-xiangqi-introduction.pdf` | [WXF Introduction to Chinese Chess](https://www.wxf-xiangqi.org/images/free_download_books/xiangqi_introduction_chessplayers_20150323.pdf) | 开局命名、阵型对阵型、原则和自测；免费公开教材，仅摘要 |
| 开放教材 | `wikibooks-opening.html` | [维基教科书：中国象棋/开局](https://zh.wikibooks.org/wiki/中國象棋/開局) | 出子、车路、忌频移、帅安全及常见开局骨架；CC BY-SA 4.0，保留来源 |
| 基础原则 | `xiangqi-opening-principles.html` | [Xiangqi.com：十个开局原则](https://www.zh.xiangqi.com/articles/10-xiangqi-opening-principles.html) | 大子、拥堵、中心、孤军深入等初学者误区；原创文章，不复制原文 |
| 全局学习法 | `xiangqi-learning-guide.html` | [Xiangqi.com：新手教程](https://www.zh.xiangqi.com/how-to-play-xiangqi/) | 车马炮兵的职责、从开局到中局的转换；原创文章，不复制原文 |
| 中炮体系 | `xiangqi-central-cannon.html` | [Xiangqi.com：中炮主流变化](https://www.zh.xiangqi.com/opening-central-cannon.html) | 屏风马、反宫马、顺炮、列炮的结构比较；原创文章，不复制原文 |
| 弹性体系 | `xiangqi-angel-guide.html` | [Xiangqi.com：仙人指路](https://www.zh.xiangqi.com/opening-angels-guide.html) | 保留选择、卒底炮及转型；原创文章，不复制原文 |
| 开局地图 | `xiangqiqipu-opening-systems.html` | [象棋棋谱网：布局体系分类](https://www.xiangqiqipu.com/Category/View-32159.html) | 炮类、仙人指路、飞相、起马的分类与适用场景；版权未明，仅本地研究 |

## 课程采用的整理框架

1. 先解释棋子职责和判断问题，再展示定式。
2. 每个体系同时讲红方计划、黑方反击、走序原因和常见误区。
3. 把开局名称理解为“双方阵型的组合”，而不是必须背诵的单线答案。
4. 用合法局面练习检验选择，用本地 canonical game 检验计划如何进入中局。
5. 尚未完成的 Pikafish 评分不参与“好坏”结论；当前只陈述规则、结构和可解释的计划取舍。

`SHA256SUMS` 随每次本地拉取生成，用于确认资料版本；原始文件不进入 Git。Reddit 当前返回验证页而非正文，因此不伪装成已成功拉取的来源。
