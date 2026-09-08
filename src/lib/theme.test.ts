// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { getStoredTheme, getThemePref, resolveTheme, setThemePref } from './theme'
import { installLocalStorageMock } from './testing/storage-mock'

installLocalStorageMock()

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('sem chave, a preferência é seguir o sistema', () => {
    expect(getStoredTheme()).toBeNull()
    expect(getThemePref()).toBe('system')
    // happy-dom não prefere dark: o resolvido é claro
    expect(resolveTheme()).toBe('light')
  })

  it('tema sépia gravado vira claro, e não segue o sistema', () => {
    // Sépia era um tema CLARO. Cair no ramo de valor desconhecido levaria a
    // preferência para 'system', e quem escolheu papel bege acordaria no
    // escuro se o sistema estivesse escuro.
    localStorage.setItem('pericopes-theme', 'sepia')
    expect(getStoredTheme()).toBe('light')
    expect(getThemePref()).toBe('light')
    expect(resolveTheme()).toBe('light')
  })

  it('sépia migrado não é confundido com lixo desconhecido', () => {
    localStorage.setItem('pericopes-theme', 'roxo')
    expect(getThemePref()).toBe('system')
    localStorage.setItem('pericopes-theme', 'sepia')
    expect(getThemePref()).toBe('light')
  })

  it('setThemePref("system") remove a chave e aplica o resolvido', () => {
    setThemePref('dark')
    expect(setThemePref('system')).toBe('light')
    expect(localStorage.getItem('pericopes-theme')).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(getThemePref()).toBe('system')
  })

  it('valor armazenado desconhecido é ignorado', () => {
    localStorage.setItem('pericopes-theme', 'roxo')
    expect(getStoredTheme()).toBeNull()
    expect(getThemePref()).toBe('system')
  })

  it('setThemePref avisa quem escuta o evento, inclusive ao voltar para o sistema', () => {
    let avisos = 0
    const onTheme = () => avisos++
    window.addEventListener('pericopes-theme', onTheme)
    setThemePref('dark')
    setThemePref('system')
    window.removeEventListener('pericopes-theme', onTheme)
    expect(avisos).toBe(2)
  })

  it('trocar de tema gravado sobrescreve o anterior', () => {
    setThemePref('light')
    expect(setThemePref('dark')).toBe('dark')
    expect(localStorage.getItem('pericopes-theme')).toBe('dark')
    expect(getThemePref()).toBe('dark')
  })
})
