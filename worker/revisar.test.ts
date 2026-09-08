import { describe, expect, it } from 'vitest'
import {
  COTA_USUARIO_CARACTERES,
  MAX_CARACTERES,
  MODELO,
  PROMPT,
  TETO_GLOBAL_CARACTERES,
  decidirCota,
  limparSaida,
  montarInput,
  montarMensagens,
  parseTexto,
} from './revisar'

describe('constantes', () => {
  it('limites e modelo', () => {
    expect(MAX_CARACTERES).toBe(6000)
    expect(COTA_USUARIO_CARACTERES).toBe(30_000)
    expect(TETO_GLOBAL_CARACTERES).toBe(300_000)
    expect(MODELO).toBe('@cf/meta/llama-3.1-8b-instruct-fast')
  })
})

describe('parseTexto', () => {
  it('devolve o texto trimado de { texto: string }', () => {
    expect(parseTexto({ texto: '  deus é amor  ' })).toBe('deus é amor')
  })

  it('rejeita corpo sem texto, não-string, vazio ou só espaço', () => {
    expect(parseTexto(null)).toBeNull()
    expect(parseTexto({})).toBeNull()
    expect(parseTexto({ texto: 42 })).toBeNull()
    expect(parseTexto({ texto: '' })).toBeNull()
    expect(parseTexto({ texto: '   \n ' })).toBeNull()
    expect(parseTexto('deus é amor')).toBeNull()
  })

  it('o teto é inclusivo e medido depois do trim', () => {
    expect(parseTexto({ texto: 'a'.repeat(MAX_CARACTERES) })).toHaveLength(MAX_CARACTERES)
    expect(parseTexto({ texto: 'a'.repeat(MAX_CARACTERES + 1) })).toBeNull()
    expect(parseTexto({ texto: `  ${'a'.repeat(MAX_CARACTERES)}  ` })).toHaveLength(MAX_CARACTERES)
  })
})

describe('montarMensagens / montarInput', () => {
  it('system com o prompt estrito, user com o texto cru', () => {
    expect(montarMensagens('deus é amor')).toEqual([
      { role: 'system', content: PROMPT },
      { role: 'user', content: 'deus é amor' },
    ])
    expect(PROMPT).toMatch(/não reescreva/i)
    expect(PROMPT).toMatch(/Espírito Santo/)
  })

  it('max_tokens proporcional ao texto, preso a 2048, temperatura zero', () => {
    const curto = montarInput('amém')
    expect(curto.temperature).toBe(0)
    expect(curto.max_tokens).toBe(Math.ceil(4 / 2) + 64)
    expect(curto.messages).toEqual(montarMensagens('amém'))
    expect(montarInput('a'.repeat(1000)).max_tokens).toBe(564)
    expect(montarInput('a'.repeat(MAX_CARACTERES)).max_tokens).toBe(2048)
  })
})

describe('limparSaida', () => {
  const original = 'deus é amor e a gente precisa lembrar disso'

  it('devolve `response` trimada', () => {
    expect(limparSaida({ response: '  Deus é amor, e a gente precisa lembrar disso. \n' }, original)).toBe(
      'Deus é amor, e a gente precisa lembrar disso.',
    )
  })

  it('tira prefixos e aspas/crases envolventes', () => {
    const limpo = 'Deus é amor, e a gente precisa lembrar disso.'
    for (const bruto of [
      `Texto revisado: ${limpo}`,
      `Aqui está o texto revisado:\n${limpo}`,
      `"${limpo}"`,
      `“${limpo}”`,
      '```\n' + limpo + '\n```',
      '```text\n' + limpo + '```',
      `Revisão: "${limpo}"`,
    ]) {
      expect(limparSaida({ response: bruto }, original), bruto).toBe(limpo)
    }
  })

  it('não confunde aspas de dentro do texto com envoltório', () => {
    const t = 'Ele disse "vai" e foi. Ela disse "fica".'
    expect(limparSaida({ response: t }, 'ele disse vai e foi ela disse fica')).toBe(t)
  })

  it('null sem `response` string ou vazia depois da limpeza', () => {
    expect(limparSaida(null, original)).toBeNull()
    expect(limparSaida({}, original)).toBeNull()
    expect(limparSaida({ response: 7 }, original)).toBeNull()
    expect(limparSaida({ response: '   ' }, original)).toBeNull()
    expect(limparSaida({ response: '""' }, original)).toBeNull()
    expect(limparSaida({ response: 'Texto revisado:' }, original)).toBeNull()
  })

  it('null quando o tamanho foge de 0,6×–1,6× do original (reescreveu/resumiu)', () => {
    expect(limparSaida({ response: 'Deus é amor.' }, original)).toBeNull()
    expect(limparSaida({ response: `${original} ${original} ${original}` }, original)).toBeNull()
    // Nos limites ainda passa.
    const n = original.length
    expect(limparSaida({ response: 'x'.repeat(Math.ceil(n * 0.6)) }, original)).not.toBeNull()
    expect(limparSaida({ response: 'x'.repeat(Math.floor(n * 1.6)) }, original)).not.toBeNull()
  })
})

describe('decidirCota', () => {
  it('ok dentro das duas, inclusive fechando exatamente o teto', () => {
    expect(decidirCota({ usoUsuario: 0, usoGlobal: 0, caracteres: 10 })).toBe('ok')
    expect(
      decidirCota({ usoUsuario: COTA_USUARIO_CARACTERES - 10, usoGlobal: 0, caracteres: 10 }),
    ).toBe('ok')
    expect(
      decidirCota({ usoUsuario: 0, usoGlobal: TETO_GLOBAL_CARACTERES - 10, caracteres: 10 }),
    ).toBe('ok')
  })

  it('usuario quando a pessoal estoura; global quando só a global estoura', () => {
    expect(
      decidirCota({ usoUsuario: COTA_USUARIO_CARACTERES - 9, usoGlobal: 0, caracteres: 10 }),
    ).toBe('usuario')
    expect(
      decidirCota({ usoUsuario: 0, usoGlobal: TETO_GLOBAL_CARACTERES - 9, caracteres: 10 }),
    ).toBe('global')
  })

  it('a do usuário prevalece quando as duas estouram', () => {
    expect(
      decidirCota({
        usoUsuario: COTA_USUARIO_CARACTERES,
        usoGlobal: TETO_GLOBAL_CARACTERES,
        caracteres: 1,
      }),
    ).toBe('usuario')
  })
})
