import { describe, expect, it } from 'vitest'
import { wakeLockDe, wakeLockSupported } from './use-wake-lock'

/** Navigator sintético: só o que o guard olha. */
function nav(forma: unknown): Navigator {
  return forma as Navigator
}

describe('wakeLockSupported', () => {
  it('navigator ausente não suporta', () => {
    expect(wakeLockSupported(undefined)).toBe(false)
  })

  it('navigator sem wakeLock não suporta', () => {
    expect(wakeLockSupported(nav({}))).toBe(false)
  })

  it('wakeLock sem request não suporta', () => {
    expect(wakeLockSupported(nav({ wakeLock: {} }))).toBe(false)
  })

  it('wakeLock com request suporta e é devolvido por wakeLockDe', () => {
    const wakeLock = { request: async () => ({ released: false, release: async () => {} }) }
    expect(wakeLockSupported(nav({ wakeLock }))).toBe(true)
    expect(wakeLockDe(nav({ wakeLock }))).toBe(wakeLock)
  })
})
