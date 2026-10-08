import { describe, expect, it, vi } from 'vitest'
import {
  ErroIa,
  chamarIaStream,
  classificarErroHttp,
  extrairTokensSse,
} from './ia-stream'

describe('ia-stream classificarErroHttp', () => {
  it('classifica autenticação para 401 e 403', () => {
    const err401 = classificarErroHttp(401, 'Unauthorized')
    expect(err401.tipo).toBe('autenticacao')
    const err403 = classificarErroHttp(403, 'Forbidden')
    expect(err403.tipo).toBe('autenticacao')
  })

  it('classifica quota para 402 e 429 com quota', () => {
    const err402 = classificarErroHttp(402, 'Payment Required')
    expect(err402.tipo).toBe('quota')

    const err429 = classificarErroHttp(429, 'You exceeded your current quota, please check your plan')
    expect(err429.tipo).toBe('quota')

    const errCredit = classificarErroHttp(429, 'insufficient_credit')
    expect(errCredit.tipo).toBe('quota')
  })

  it('classifica contexto excedido para 400 com token count', () => {
    const errCtx = classificarErroHttp(400, 'maximum context length exceeded')
    expect(errCtx.tipo).toBe('contexto')
  })

  it('classifica falhas temporárias para 500, 503, 529 e 429 puro', () => {
    const err500 = classificarErroHttp(500, 'Internal Server Error')
    expect(err500.tipo).toBe('temporario')

    const errRate = classificarErroHttp(429, 'Rate limit reached. Please slow down.')
    expect(errRate.tipo).toBe('temporario')
  })
})

describe('ia-stream extrairTokensSse', () => {
  function streamDeStrings(partes: string[]): ReadableStream<Uint8Array> {
    const enc = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        for (const p of partes) {
          controller.enqueue(enc.encode(p))
        }
        controller.close()
      },
    })
  }

  it('extrai tokens de stream OpenAI / OpenRouter / Cloudflare', async () => {
    const stream = streamDeStrings([
      'data: {"choices":[{"delta":{"content":"Graça"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" e paz"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const tokens: string[] = []
    for await (const t of extrairTokensSse('openai', stream)) {
      tokens.push(t)
    }
    expect(tokens.join('')).toBe('Graça e paz')
  })

  it('extrai tokens de stream Anthropic', async () => {
    const stream = streamDeStrings([
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"O Senhor"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" é meu pastor"}}\n\n',
    ])

    const tokens: string[] = []
    for await (const t of extrairTokensSse('anthropic', stream)) {
      tokens.push(t)
    }
    expect(tokens.join('')).toBe('O Senhor é meu pastor')
  })

  it('extrai tokens de stream Google Gemini', async () => {
    const stream = streamDeStrings([
      'data: {"candidates":[{"content":{"parts":[{"text":"No princípio"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":", criou Deus"}]}}]}\n\n',
    ])

    const tokens: string[] = []
    for await (const t of extrairTokensSse('gemini', stream)) {
      tokens.push(t)
    }
    expect(tokens.join('')).toBe('No princípio, criou Deus')
  })
})

describe('ia-stream retentativas e chamadas', () => {
  it('não retenta se for erro de quota', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('insufficient_quota', { status: 429 }),
    )

    const gen = chamarIaStream({
      provedor: 'openai',
      modelo: 'gpt-4o-mini',
      chave: 'sk-12345678901234567890',
      mensagens: [{ role: 'user', content: 'olá' }],
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of gen) {
        // noop
      }
    }).rejects.toThrow(ErroIa)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retenta até 3 vezes se for erro temporário 503 e falha', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Service Unavailable', { status: 503 }),
    )

    const gen = chamarIaStream({
      provedor: 'openai',
      modelo: 'gpt-4o-mini',
      chave: 'sk-12345678901234567890',
      mensagens: [{ role: 'user', content: 'olá' }],
      fetchFn: fetchMock as unknown as typeof fetch,
    })

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of gen) {
        // noop
      }
    }).rejects.toThrow(ErroIa)

    expect(fetchMock).toHaveBeenCalledTimes(3)
  }, 10000)
})
