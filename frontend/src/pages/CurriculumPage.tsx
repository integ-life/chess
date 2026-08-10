import { Link } from 'react-router-dom'
import { curriculumStages, totalCurriculumLessons } from '../course/curriculum'
import { useI18n } from '../i18n'
import CourseTranslator from '../components/CourseTranslator'

export default function CurriculumPage() {
  const { t } = useI18n()
  return (
    <CourseTranslator>
    <div className="curriculum">
      <section className="curriculum__hero">
        <p className="opening-course__eyebrow">{t('curriculumEyebrow')}</p>
        <h2>{t('curriculumTitle')}</h2>
        <p>{t('curriculumIntro')}</p>
        <dl>
          <div><dt>{t('stages')}</dt><dd>{curriculumStages.length}</dd></div>
          <div><dt>{t('lessons')}</dt><dd>{totalCurriculumLessons}</dd></div>
          <div><dt>{t('available')}</dt><dd>{t('allStages')}</dd></div>
        </dl>
      </section>

      <section className="curriculum__principle">
        <strong>{t('learningLoop')}</strong>
        <span>{t('explain')}</span><span>{t('calculate')}</span><span>{t('exercises')}</span><span>{t('examples')}</span><span>{t('review')}</span>
      </section>

      <div className="curriculum__grid">
        {curriculumStages.map((stage, index) => (
          <article className={stage.path ? 'is-available' : undefined} key={stage.id}>
            <header><span>{String(stage.number).padStart(2, '0')}</span><small>{stage.level}</small></header>
            <h3>{stage.title}</h3>
            <p>{stage.summary}</p>
            <ol>{stage.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ol>
            <div className="curriculum__outcome"><strong>衔接与通过标准</strong><p>{index === 0 ? '无需先修，从第一课开始。' : `先达到上一阶段标准：${curriculumStages[index - 1].outcome}`} 本阶段完成后：{stage.outcome}</p></div>
            {stage.path ? <Link to={stage.path}>{t('enterLessons', { count: stage.lessons.length })}</Link> : <span className="curriculum__pending">内容编写与审查中</span>}
          </article>
        ))}
      </div>

      <footer className="opening-course__sources">
        <strong>课程资料与边界</strong>
        <p>基于本地 WXF、Wikibooks、Chess.com 社区资料和 canonical games 独立编写；规则以项目规则内核和测试为准。</p>
      </footer>
    </div>
    </CourseTranslator>
  )
}
