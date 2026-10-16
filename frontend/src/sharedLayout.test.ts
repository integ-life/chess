import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { I18nProvider } from './i18n'
import type { AuthUser } from './auth'
const auth = vi.hoisted(() => ({ ready: true, user: null as AuthUser | null }))
vi.mock('./auth', () => ({ useAuthStore: () => auth, loadCurrentUser: vi.fn(), logout: vi.fn(), consumeUnifiedLoginError: () => null, startUnifiedLogin: vi.fn() }))

function renderShell() {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(I18nProvider, null, createElement(App))))
}
describe('shared family header', () => {
  it('keeps product switching and board appearance available before sign-in', () => {
    auth.user = null
    const html = renderShell()
    expect(html).toContain('data-ui-version="0.6.0"')
    expect(html).toContain('https://context.integ.life/')
    expect(html).toContain('board-theme-picker__select')
    expect(html).not.toContain('class="il-appearance"')
  })
  it('preserves course and play routes with the authenticated header', () => {
    auth.user = { id: 1, username: 'Shell test', createdAt: 0 }
    const html = renderShell()
    expect(html).toContain('href="/course"')
    expect(html).toContain('href="/play"')
    expect(html).toContain('Shell test')
    expect(html.match(/data-ui-version=/g)).toHaveLength(1)
    auth.user = null
  })
})
