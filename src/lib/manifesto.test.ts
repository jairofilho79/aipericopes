import { describe, expect, it, afterEach, vi } from 'vitest'
import { manifestoValido, carregarManifesto, VOZ } from './manifesto'
import bruto from './__fixtures__/manifesto-1600.json'

describe('manifestoValido', () => {
  it('aceita o manifesto real', () => {
    expect(manifestoValido(bruto)).toBe(true)
  })

  it('recusa não-objeto', () => {
    expect(manifestoValido(null)).toBe(false)
    expect(manifestoValido('{}')).toBe(false)
    expect(manifestoValido([])).toBe(false)
  })

  it('recusa sem unidades', () => {
    expect(manifestoValido({ ordem: 1, dur_total: 1 })).toBe(false)
    expect(manifestoValido({ ordem: 1, dur_total: 1, unidades: {} })).toBe(false)
  })

  it('recusa unidade sem os campos do eixo de tempo', () => {
    const m = { ordem: 1, dur_total: 9, unidades: [{ i: 0, secao: 'texto', texto: 'oi' }] }
    expect(manifestoValido(m)).toBe(false)
  })

  it('recusa seção desconhecida', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [{ i: 0, secao: 'rodape', texto: 'oi', inicio: 0, dur: 1 }],
    }
    expect(manifestoValido(m)).toBe(false)
  })

  it('aceita unidade sem palavras (manifesto não realinhado)', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [{ i: 0, secao: 'texto', texto: 'oi', inicio: 0, dur: 1 }],
    }
    expect(manifestoValido(m)).toBe(true)
  })

  it('recusa palavras malformadas', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [
        { i: 0, secao: 'texto', texto: 'oi', inicio: 0, dur: 1, palavras: [{ t: 'oi', i: 0 }] },
      ],
    }
    expect(manifestoValido(m)).toBe(false)
  })
})

function respostaJson(corpo: unknown, init: { status?: number } = {}): Response {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => corpo,
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('carregarManifesto', () => {
  it('devolve o manifesto quando a resposta é 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(bruto)))
    const m = await carregarManifesto(1600)
    expect(m?.ordem).toBe(1600)
  })

  it('aceita 206 — o Worker responde parcial em GET do R2', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson(bruto, { status: 206 })))
    expect(await carregarManifesto(1600)).not.toBeNull()
  })

  it('404 vira null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({}, { status: 404 })))
    expect(await carregarManifesto(9999)).toBeNull()
  })

  it('content-type que não é json vira null', async () => {
    const html = {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: async () => bruto,
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn(async () => html))
    expect(await carregarManifesto(1600)).toBeNull()
  })

  it('corpo com forma errada vira null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ ordem: 1 })))
    expect(await carregarManifesto(1600)).toBeNull()
  })

  it('rede caída vira null, sem lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(carregarManifesto(1600)).resolves.toBeNull()
  })

  it('busca a URL do manifesto da ordem', async () => {
    const f = vi.fn(async () => respostaJson(bruto))
    vi.stubGlobal('fetch', f)
    await carregarManifesto(1600)
    expect((f.mock.calls as unknown[][])[0][0]).toBe(`/api/audio/${VOZ}/1600.json`)
  })
})

describe('manifestoValido — a seção das palavras do trecho', () => {
  const unidade = (secao: string) => ({ i: 0, secao, texto: 'oi', inicio: 0, dur: 1 })

  it('aceita `palavras`: a narração lê a lista como seção própria, com cabeçalho falado', () => {
    expect(manifestoValido({ ordem: 1, dur_total: 9, unidades: [unidade('palavras')] })).toBe(true)
  })

  it('uma unidade de seção desconhecida invalida o manifesto INTEIRO — é por isso que isto importa', () => {
    const m = {
      ordem: 1,
      dur_total: 9,
      unidades: [unidade('resenha'), unidade('secao-que-nao-existe')],
    }
    expect(manifestoValido(m)).toBe(false)
  })
})

describe('VOZ — a chave do acervo', () => {
  /**
   * `gam-ash1` é a narração da NAA, e ela continua no bucket. As chaves são
   * por `ordem`, iguais às que este app busca — então voltar para essa voz
   * faz o tocador ler a NAA em voz alta por cima do texto da Bíblia Livre.
   *
   * Este teste existe porque um comentário não impede ninguém de reverter uma
   * linha, e a falha seria silenciosa: o app funcionaria, só estaria narrando
   * uma tradução protegida com o texto errado na tela.
   */
  it('nunca aponta para o acervo da NAA', () => {
    expect(VOZ).not.toBe('gam-ash1')
    expect(VOZ).not.toBe('nt-ml')
  })

  it('é uma chave que o worker aceita', () => {
    // chaveAudio() em worker/audio.ts exige /^[a-z][a-z0-9-]*$/ no segmento
    expect(VOZ).toMatch(/^[a-z][a-z0-9-]*$/)
  })
})
