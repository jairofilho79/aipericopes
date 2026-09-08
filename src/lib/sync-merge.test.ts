import { describe, expect, it } from 'vitest'
import { remoteWinsLocal } from './sync-merge'

describe('remoteWinsLocal', () => {
  it('remoto mais novo vence', () => {
    expect(remoteWinsLocal('2026-08-31T11:00:00.000Z', '2026-08-31T10:00:00.000Z')).toBe(true)
  })
  it('local mais novo ou igual vence', () => {
    expect(remoteWinsLocal('2026-08-31T10:00:00.000Z', '2026-08-31T11:00:00.000Z')).toBe(false)
    expect(remoteWinsLocal('2026-08-31T10:00:00.000Z', '2026-08-31T10:00:00.000Z')).toBe(false)
  })
  it('sem local, remoto vence', () => {
    expect(remoteWinsLocal('2026-08-31T10:00:00.000Z', undefined)).toBe(true)
  })
})
