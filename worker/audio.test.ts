import { describe, expect, it } from 'vitest'
import { cabecalhoContentRange, chaveAudio } from './audio'

describe('chaveAudio', () => {
  it('aceita voz/ordem.m4a', () => {
    expect(chaveAudio('nt-ml/1600.m4a')).toBe('nt-ml/1600.m4a')
  })

  it('aceita o manifesto voz/ordem.json', () => {
    expect(chaveAudio('nt-ml/1600.json')).toBe('nt-ml/1600.json')
  })

  it('aceita dígito no nome da voz', () => {
    // Cada regeração ganha um prefixo novo (o cache é `immutable`), e eles são
    // numerados: `nt-ml` virou `gam-ash1`. Se o regex passasse a exigir só letras
    // no prefixo, toda a narração publicada sumiria em 404.
    expect(chaveAudio('gam-ash1/1600.m4a')).toBe('gam-ash1/1600.m4a')
    expect(chaveAudio('gam-ash1/1600.json')).toBe('gam-ash1/1600.json')
  })

  it('rejeita travessia de caminho', () => {
    expect(chaveAudio('../segredo.m4a')).toBeNull()
    expect(chaveAudio('nt-ml/../1600.m4a')).toBeNull()
  })

  it('aceita nome de registro, não só número', () => {
    // A trilha é servida por registro, não por ordem: `trilha-v1/santuario.m4a`.
    expect(chaveAudio('trilha-v1/santuario.m4a')).toBe('trilha-v1/santuario.m4a')
    expect(chaveAudio('trilha-v1/santuario-2.m4a')).toBe('trilha-v1/santuario-2.m4a')
  })

  it('rejeita nomes fora do formato', () => {
    expect(chaveAudio('nt-ml/1600.mp4')).toBeNull()
    expect(chaveAudio('trilha-v1/Santuario.m4a')).toBeNull()
    expect(chaveAudio('trilha-v1/santuario_2.m4a')).toBeNull()
    expect(chaveAudio('trilha-v1/-santuario.m4a')).toBeNull()
    expect(chaveAudio('trilha-v1/.m4a')).toBeNull()
    expect(chaveAudio('nt-ml/1600.mp3')).toBeNull()
    expect(chaveAudio('NT-ML/1600.m4a')).toBeNull()
    expect(chaveAudio('nt-ml/1600.m4a/extra')).toBeNull()
    expect(chaveAudio('')).toBeNull()
  })
})

describe('cabecalhoContentRange', () => {
  it('offset + length', () => {
    expect(cabecalhoContentRange({ offset: 0, length: 100 }, 1000)).toBe('bytes 0-99/1000')
  })

  it('offset sem length vai até o fim', () => {
    expect(cabecalhoContentRange({ offset: 900 }, 1000)).toBe('bytes 900-999/1000')
  })

  it('suffix pega o rabo do arquivo', () => {
    expect(cabecalhoContentRange({ suffix: 100 }, 1000)).toBe('bytes 900-999/1000')
  })

  it('sem range não há cabeçalho', () => {
    expect(cabecalhoContentRange(undefined, 1000)).toBeNull()
  })
})
