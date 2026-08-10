import { describe, expect, it } from 'vitest'
import { parseUnifiedLoginFragment } from './auth'

describe('parseUnifiedLoginFragment', () => {
  it('accepts only the unified-login hash callback', () => {
    expect(parseUnifiedLoginFragment('#/?token=local-session')).toEqual({ token: 'local-session' })
    expect(parseUnifiedLoginFragment('#/?auth_error=%E8%AF%B7%E9%87%8D%E8%AF%95')).toEqual({ error: '请重试' })
    expect(parseUnifiedLoginFragment('#/course?token=ignored')).toBeNull()
  })
})
