import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_SEGUNDOS_DITADO,
  escolherMime,
  formatarContador,
  formatarHoraVolta,
  inserirNoCursor,
  mensagemEsgotado,
  msAteVolta,
  substituirTrecho,
  transcrever,
} from './ditado'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('escolherMime', () => {
  function comSuporte(aceitos: string[]) {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (t: string) => aceitos.includes(t),
    })
  }

  it('prefere webm/opus, depois webm, mp4 (Safari) e ogg/opus', () => {
    comSuporte(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'])
    expect(escolherMime()).toBe('audio/webm;codecs=opus')
    comSuporte(['audio/webm', 'audio/mp4'])
    expect(escolherMime()).toBe('audio/webm')
    comSuporte(['audio/mp4'])
    expect(escolherMime()).toBe('audio/mp4')
    comSuporte(['audio/ogg;codecs=opus'])
    expect(escolherMime()).toBe('audio/ogg;codecs=opus')
  })

  it('null quando nada da lista é suportado ou o MediaRecorder não existe', () => {
    comSuporte([])
    expect(escolherMime()).toBeNull()
    vi.stubGlobal('MediaRecorder', undefined)
    expect(escolherMime()).toBeNull()
  })
})

describe('inserirNoCursor', () => {
  it('em texto vazio entra sem espaço na frente', () => {
    expect(inserirNoCursor('', 0, 0, 'Amém.')).toEqual({ texto: 'Amém.', cursor: 5 })
  })

  it('no fim de um texto sem espaço final ganha um espaço antes', () => {
    expect(inserirNoCursor('Oração', 6, 6, 'da manhã')).toEqual({
      texto: 'Oração da manhã',
      cursor: 15,
    })
  })

  it('não duplica espaço quando já há um antes ou depois', () => {
    expect(inserirNoCursor('Oração ', 7, 7, 'da manhã')).toEqual({
      texto: 'Oração da manhã',
      cursor: 15,
    })
    expect(inserirNoCursor('Oração  fim', 7, 7, 'da manhã')).toEqual({
      texto: 'Oração da manhã fim',
      cursor: 15,
    })
  })

  it('no meio do texto põe espaço dos dois lados quando falta', () => {
    expect(inserirNoCursor('ab', 1, 1, 'x')).toEqual({ texto: 'a x b', cursor: 4 })
  })

  it('quebra de linha vale como espaço', () => {
    expect(inserirNoCursor('linha\n', 6, 6, 'x')).toEqual({ texto: 'linha\nx', cursor: 7 })
    expect(inserirNoCursor('\nlinha', 0, 0, 'x')).toEqual({ texto: 'x\nlinha', cursor: 1 })
  })

  it('substitui a seleção', () => {
    expect(inserirNoCursor('um dois três', 3, 7, 'DOIS')).toEqual({
      texto: 'um DOIS três',
      cursor: 7,
    })
  })

  it('não põe espaço antes de pontuação que segue o cursor', () => {
    expect(inserirNoCursor('Oração.', 6, 6, ' forte')).toEqual({
      texto: 'Oração forte.',
      cursor: 12,
    })
  })

  it('trecho vazio (ou só espaços) não muda nada', () => {
    expect(inserirNoCursor('abc', 1, 2, '   ')).toEqual({ texto: 'abc', cursor: 2 })
  })

  it('tolera cursor fora do intervalo (cai no fim)', () => {
    expect(inserirNoCursor('ab', 99, 99, 'c')).toEqual({ texto: 'ab c', cursor: 4 })
  })
})

describe('substituirTrecho', () => {
  it('troca a última ocorrência e põe o cursor no fim do revisado', () => {
    expect(substituirTrecho('Nota. amém amém', 'amém', 'Amém.')).toEqual({
      texto: 'Nota. amém Amém.',
      cursor: 16,
    })
  })

  it('null quando o trecho não está mais no texto ou é vazio', () => {
    expect(substituirTrecho('Nota editada', 'amém', 'Amém.')).toBeNull()
    expect(substituirTrecho('Nota', '', 'x')).toBeNull()
  })

  it('preserva o que vem depois do trecho', () => {
    expect(substituirTrecho('a se deus quiser b', 'se deus quiser', 'Se Deus quiser.')).toEqual({
      texto: 'a Se Deus quiser. b',
      cursor: 17,
    })
  })
})

describe('formatarContador', () => {
  it('m:ss / 1:00', () => {
    expect(formatarContador(0)).toBe('0:00 / 1:00')
    expect(formatarContador(7)).toBe('0:07 / 1:00')
    expect(formatarContador(MAX_SEGUNDOS_DITADO)).toBe('1:00 / 1:00')
    expect(formatarContador(75)).toBe('1:00 / 1:00')
  })
})

describe('volta da cota', () => {
  it('formatarHoraVolta mostra HH:mm no fuso do aparelho', () => {
    // 03:00Z em pt-BR com o fuso que o vitest estiver usando: confere pelo
    // próprio Date, sem assumir fuso da máquina.
    const iso = '2026-09-03T03:00:00.000Z'
    const esperado = new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(formatarHoraVolta(iso)).toBe(esperado)
    expect(formatarHoraVolta(iso)).toMatch(/^\d{2}:\d{2}$/)
  })

  it('mensagemEsgotado embute a hora', () => {
    const iso = '2026-09-03T03:00:00.000Z'
    expect(mensagemEsgotado(iso)).toBe(`Ditado volta às ${formatarHoraVolta(iso)}`)
  })

  it('msAteVolta: positivo antes, zero (nunca negativo) depois', () => {
    const agora = Date.parse('2026-09-02T23:59:00.000Z')
    expect(msAteVolta('2026-09-03T00:00:00.000Z', agora)).toBe(60_000)
    expect(msAteVolta('2026-09-03T00:00:00.000Z', agora + 60_000)).toBe(0)
    expect(msAteVolta('2026-09-01T00:00:00.000Z', agora)).toBe(0)
    // ISO inválido: trata como já passado (volta ao ocioso, sem travar o botão).
    expect(msAteVolta('não é data', agora)).toBe(0)
  })
})

describe('transcrever', () => {
  function comFetch(resposta: () => Promise<Response>) {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(resposta)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })

  it('envia o blob com content-type, duração e cookies', async () => {
    const fetchMock = comFetch(async () => Response.json({ texto: 'Amém' }))
    const r = await transcrever(blob, 'audio/webm;codecs=opus', 7)
    expect(r).toEqual({ ok: true, texto: 'Amém' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/transcrever')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(blob)
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({
      'content-type': 'audio/webm;codecs=opus',
      'X-Duracao-Segundos': '7',
    })
  })

  it('arredonda a duração para cima e nunca acima do teto', async () => {
    const fetchMock = comFetch(async () => Response.json({ texto: '' }))
    await transcrever(blob, 'audio/webm', 0.2)
    await transcrever(blob, 'audio/webm', 59.4)
    await transcrever(blob, 'audio/webm', 61)
    const duracoes = fetchMock.mock.calls.map(
      (c) => (c[1].headers as Record<string, string>)['X-Duracao-Segundos'],
    )
    expect(duracoes).toEqual(['1', '60', '60'])
  })

  it('traduz cada status numa mensagem curta', async () => {
    const casos: [number, string][] = [
      [401, 'Entre para ditar'],
      [413, 'Gravação grande demais'],
      [415, 'Formato de áudio não suportado'],
      [400, 'Não foi possível transcrever'],
      [502, 'Não foi possível transcrever'],
      [500, 'Não foi possível transcrever'],
    ]
    for (const [status, mensagem] of casos) {
      comFetch(async () => Response.json({ erro: 'x' }, { status }))
      expect(await transcrever(blob, 'audio/webm', 3), String(status)).toEqual({
        ok: false,
        mensagem,
      })
    }
  })

  it('429/503 devolvem a mensagem de volta com o voltaEm do servidor', async () => {
    for (const status of [429, 503]) {
      comFetch(async () =>
        Response.json({ erro: 'x', voltaEm: '2026-09-03T00:00:00.000Z' }, { status }),
      )
      expect(await transcrever(blob, 'audio/webm', 3)).toEqual({
        ok: false,
        mensagem: mensagemEsgotado('2026-09-03T00:00:00.000Z'),
        voltaEm: '2026-09-03T00:00:00.000Z',
      })
    }
  })

  it('429/503 sem voltaEm (servidor antigo) caem na mensagem genérica', async () => {
    comFetch(async () => Response.json({ erro: 'x' }, { status: 429 }))
    expect(await transcrever(blob, 'audio/webm', 3)).toEqual({
      ok: false,
      mensagem: 'Cota de ditado esgotada por hoje',
    })
    comFetch(async () => Response.json({ erro: 'x' }, { status: 503 }))
    expect(await transcrever(blob, 'audio/webm', 3)).toEqual({
      ok: false,
      mensagem: 'Ditado indisponível hoje',
    })
  })

  it('falha de rede e JSON quebrado viram mensagens, não exceções', async () => {
    comFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await transcrever(blob, 'audio/webm', 3)).toEqual({
      ok: false,
      mensagem: 'Sem conexão para transcrever',
    })
    comFetch(async () => new Response('não é json', { status: 200 }))
    expect(await transcrever(blob, 'audio/webm', 3)).toEqual({
      ok: false,
      mensagem: 'Não foi possível transcrever',
    })
  })
})
