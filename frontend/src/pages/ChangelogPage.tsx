import { appBuild, changelog } from '../changelog'
import { useI18n } from '../i18n'

export default function ChangelogPage() {
  const { locale, t } = useI18n()
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-amber-950">{t('changelog')}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {t('currentBuild')}: {appBuild.version} · {new Date(appBuild.buildTime).toLocaleString(locale)}
        </p>
      </div>

      <div className="space-y-4">
        {changelog.map((entry) => (
          <article key={entry.version} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold text-amber-950">{entry.title}</h3>
              <span className="text-xs font-medium text-amber-700">{entry.version}</span>
              <time className="text-xs text-gray-500">{entry.date}</time>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}
