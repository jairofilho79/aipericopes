import { describe, expect, it } from 'vitest'
import { detectarPlataforma } from './plataforma'

describe('detectarPlataforma', () => {
  it('detecta iPhone como ios', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    expect(detectarPlataforma(ua, 'iPhone', 5)).toBe('ios')
  })

  it('detecta iPad como ios', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15'
    expect(detectarPlataforma(ua, 'iPad', 5)).toBe('ios')
  })

  it('detecta iPad Pro moderno (Safari desktop mode: MacIntel + multi-touch) como ios', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
    expect(detectarPlataforma(ua, 'MacIntel', 5)).toBe('ios')
  })

  it('detecta Mac desktop como ios', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    expect(detectarPlataforma(ua, 'MacIntel', 0)).toBe('ios')
  })

  it('detecta Android como android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(detectarPlataforma(ua, 'Linux aarch64', 5)).toBe('android')
  })

  it('detecta Samsung Android como android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/118.0.0.0 Mobile Safari/537.36'
    expect(detectarPlataforma(ua, 'Linux armv8l', 5)).toBe('android')
  })

  it('detecta Windows como padrao', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    expect(detectarPlataforma(ua, 'Win32', 0)).toBe('padrao')
  })

  it('detecta Linux desktop como padrao', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
    expect(detectarPlataforma(ua, 'Linux x86_64', 0)).toBe('padrao')
  })

  it('retorna padrao para strings vazias', () => {
    expect(detectarPlataforma('', '', 0)).toBe('padrao')
  })
})
