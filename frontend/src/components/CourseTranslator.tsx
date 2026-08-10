import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n, type Locale } from '../i18n'

type CourseCatalog = Record<string, string>
const loaders: Record<Exclude<Locale, 'zh-CN'>, () => Promise<{ default: CourseCatalog }>> = {
  en: () => import('../course/translations/en.json'),
  es: () => import('../course/translations/es.json'),
  fr: () => import('../course/translations/fr.json'),
  de: () => import('../course/translations/de.json'),
  id: () => import('../course/translations/id.json'),
  ja: () => import('../course/translations/ja.json'),
  ko: () => import('../course/translations/ko.json'),
}

function translatedText(source: string, locale: Locale, translations: CourseCatalog | null, sourcePhrases: string[]) {
  if (locale === 'zh-CN' || !translations || !/\p{Script=Han}/u.test(source)) return source
  const leading = source.match(/^\s*/)?.[0] ?? ''
  const trailing = source.match(/\s*$/)?.[0] ?? ''
  const clean = source.trim().replace(/\s+/g, ' ')
  const exact = translations[clean]
  if (exact) return `${leading}${exact}${trailing}`
  let result = source
  for (const phrase of sourcePhrases) {
    const translated = translations[phrase]
    if (translated && result.includes(phrase)) result = result.replaceAll(phrase, translated)
  }
  return result
}

export default function CourseTranslator({ children }: { children: ReactNode }) {
  const { locale } = useI18n()
  const [translations, setTranslations] = useState<CourseCatalog | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const originals = useRef(new WeakMap<Node, string>())
  const originalAttributes = useRef(new WeakMap<Element, Record<string, string>>())

  const sourcePhrases = useMemo(() => Object.keys(translations ?? {}).sort((a, b) => b.length - a.length), [translations])

  useEffect(() => {
    let active = true
    if (locale === 'zh-CN') {
      setTranslations(null)
      return () => { active = false }
    }
    setTranslations(null)
    void loaders[locale]().then((module) => { if (active) setTranslations(module.default) })
    return () => { active = false }
  }, [locale])

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const translate = () => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        const original = originals.current.get(node) ?? node.nodeValue ?? ''
        originals.current.set(node, original)
        const next = translatedText(original, locale, translations, sourcePhrases)
        if (node.nodeValue !== next) node.nodeValue = next
        node = walker.nextNode()
      }
      for (const target of element.querySelectorAll<HTMLElement>('[aria-label], [title], [placeholder]')) {
        const saved = originalAttributes.current.get(target) ?? {}
        for (const attribute of ['aria-label', 'title', 'placeholder']) {
          const value = target.getAttribute(attribute)
          if (!value) continue
          const original = saved[attribute] ?? value
          saved[attribute] = original
          target.setAttribute(attribute, translatedText(original, locale, translations, sourcePhrases))
        }
        originalAttributes.current.set(target, saved)
      }
    }
    translate()
    const observer = new MutationObserver(translate)
    observer.observe(element, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [locale, sourcePhrases, translations])

  return <div ref={root} data-course-language={locale}>{children}</div>
}
