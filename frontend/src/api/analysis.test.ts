import { describe, expect, it } from 'vitest'
import { parseSSEChunk } from './analysis'

describe('parseSSEChunk', () => {
  it('keeps partial events across network chunks', () => {
    let parsed = parseSSEChunk('', 'data: {"depth":1}\n\ndata: {"dep')
    expect(parsed.events).toEqual(['{"depth":1}'])

    parsed = parseSSEChunk(parsed.rest, 'th":2,"pv":["h2e2"]}\r\n\r\n')
    expect(parsed.events).toEqual(['{"depth":2,"pv":["h2e2"]}'])
    expect(parsed.rest).toBe('')
  })
})
