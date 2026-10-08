import { describe, expect, it } from 'vitest'
import {
  formatarRefVersos,
  montarPromptExplicacao,
  recuperarChaveUsuario,
} from './ia-handlers'
import { cifrarChave } from './ia-cripto'

describe('ia-handlers formatarRefVersos', () => {
  it('formata versículo único', () => {
    expect(formatarRefVersos(3, 16, 3, 16)).toBe('3:16')
  })

  it('formata intervalo dentro do mesmo capítulo', () => {
    expect(formatarRefVersos(3, 16, 3, 18)).toBe('3:16-18')
  })

  it('formata intervalo entre capítulos diferentes', () => {
    expect(formatarRefVersos(1, 26, 2, 3)).toBe('1:26 - 2:3')
  })
})

describe('ia-handlers montarPromptExplicacao', () => {
  it('gera prompt contendo exatamente as três seções solicitadas e somente o texto selecionado', () => {
    const trecho = 'Porque Deus amou o mundo de tal maneira...'
    const { system, user } = montarPromptExplicacao({
      livro: 'João',
      capituloInicio: 3,
      versiculoInicio: 16,
      capituloFim: 3,
      versiculoFim: 16,
      trechoTexto: trecho,
    })

    expect(system).toContain('assistente de estudos bíblicos')
    expect(system).toContain('exclusivamente sobre o trecho bíblico selecionado')

    expect(user).toContain('João 3:16')
    expect(user).toContain(trecho)
    expect(user).toContain('### Contexto')
    expect(user).toContain('### Resenha')
    expect(user).toContain('### Reflexão')
  })
})

describe('ia-handlers recuperarChaveUsuario', () => {
  it('devolve null se secret for ausente', async () => {
    const fakeDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
        }),
      }),
    } as unknown as D1Database

    const res = await recuperarChaveUsuario(fakeDb, undefined, 'u1')
    expect(res).toBeNull()
  })

  it('recupera e decifra a chave corretamente', async () => {
    const secret = 'segredo-mestre-123'
    const userId = 'u1'
    const chaveOriginal = 'sk-minha-chave-secreta'
    const { cifrada, iv } = await cifrarChave(secret, userId, chaveOriginal)

    const fakeDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            provedor: 'openai',
            modelo: 'gpt-4o-mini',
            contaId: null,
            chaveCifrada: cifrada,
            iv,
          }),
        }),
      }),
    } as unknown as D1Database

    const dados = await recuperarChaveUsuario(fakeDb, secret, userId)
    expect(dados).not.toBeNull()
    expect(dados?.provedor).toBe('openai')
    expect(dados?.chave).toBe(chaveOriginal)
    expect(dados?.contaId).toBeNull()
  })
})
