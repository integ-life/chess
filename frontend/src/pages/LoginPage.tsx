import { useState } from 'react'
import { consumeUnifiedLoginError, startUnifiedLogin } from '../auth'
import { useI18n } from '../i18n'

export default function LoginPage() {
  const { locale, t } = useI18n()
  const [error] = useState<string | null>(() => consumeUnifiedLoginError())

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="rounded-lg border border-amber-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <img alt="" className="h-12 w-12 rounded-xl shadow-sm" src="/favicon.svg" />
          <div>
            <h1 className="text-lg font-bold text-amber-950">{t('appName')}</h1>
            <h2 className="text-sm font-medium text-gray-600">{t('unifiedLogin')}</h2>
          </div>
        </div>
        {error && <p className="mt-5 text-sm text-red-700">{error}</p>}
        <button
          className="mt-5 w-full rounded-md bg-amber-800 px-3 py-2 font-medium text-white hover:bg-amber-900"
          onClick={() => startUnifiedLogin(locale)}
          type="button"
        >
          {t('continueWith')}
        </button>
      </div>
    </div>
  )
}
