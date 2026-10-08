// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GANHO_DUCK, envoltoria } from './trilha'

/**
 * O jsdom/happy-dom não tem Web Audio, então o grafo é falsificado inteiro.
 * O que este teste garante não é o som — é o encanamento: a chave que vai ao
 * Worker, o laço ligado, o buffer reaproveitado, e a envoltória chegando no
 * `AudioParam` certo. O som quem confere é o ouvido, no aparelho.
 */
class ParamFalso {
  valor = 1
  eventos: string[] = []
  get value() {
    return this.valor
  }
  set value(v: number) {
    this.valor = v
  }
  cancelScheduledValues(t: number) {
    this.eventos.push(`cancel@${t}`)
  }
  setValueAtTime(v: number, t: number) {
    this.valor = v
    this.eventos.push(`set ${v}@${t}`)
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.eventos.push(`ramp ${v}@${t}`)
  }
}

class GainFalso {
  gain = new ParamFalso()
  ligados: unknown[] = []
  connect(destino: unknown) {
    this.ligados.push(destino)
  }
  disconnect() {}
}

class FonteFalsa {
  buffer: unknown = null
  loop = false
  iniciada = false
  parada: number | null = null
  ligados: unknown[] = []
  connect(destino: unknown) {
    this.ligados.push(destino)
  }
  disconnect() {}
  start() {
    this.iniciada = true
  }
  stop(quando?: number) {
    this.parada = quando ?? 0
  }
}

class ContextoFalso {
  state = 'running'
  currentTime = 100
  destination = { nome: 'saida' }
  ganhos: GainFalso[] = []
  fontes: FonteFalsa[] = []
  decodificados = 0
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  createGain() {
    const g = new GainFalso()
    this.ganhos.push(g)
    return g
  }
  createBufferSource() {
    const f = new FonteFalsa()
    this.fontes.push(f)
    return f
  }
  async decodeAudioData() {
    this.decodificados++
    return { duracao: 120, duration: 120 }
  }
}

let ctx: ContextoFalso
let pista: typeof import('./trilha-pista')
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  ctx = new ContextoFalso()
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return ctx as unknown as AudioContext
      }
    },
  )
  fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  vi.stubGlobal('fetch', fetchMock)
  // Módulo com estado próprio (a pista é singleton): recarrega a cada caso.
  vi.resetModules()
  pista = await import('./trilha-pista')
})

afterEach(() => vi.unstubAllGlobals())

const PONTOS = envoltoria([{ inicio: 10, fim: 12 }])

describe('tocar', () => {
  it('busca a cama na chave que o Worker aceita', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    expect(fetchMock).toHaveBeenCalledWith('/api/audio/trilha-v1/louvor.m4a')
  })

  it('põe a cama em laço e a liga no grafo', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    const fonte = ctx.fontes[0]!
    expect(fonte.loop).toBe(true)
    expect(fonte.iniciada).toBe(true)
    expect(fonte.buffer).toBeTruthy()
  })

  it('não recomeça a música quando a cama não muda', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 30)
    expect(ctx.fontes).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ctx.decodificados).toBe(1)
  })

  it('troca a fonte quando a cama muda, e não rebaixa a que já tem', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    await pista.tocar('trilha-v1', 'lamento', PONTOS, 0)
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    expect(ctx.fontes).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('agenda a envoltória no ganho do ducking, no relógio do contexto', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    // O primeiro ganho criado é o mestre; o segundo é o ducking.
    const duck = ctx.ganhos[1]!
    expect(duck.gain.eventos).toContain('cancel@100')
    expect(duck.gain.eventos).toContain(`ramp ${GANHO_DUCK}@110`)
  })

  it('acorda um contexto suspenso — o iOS entrega assim', async () => {
    ctx.state = 'suspended'
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('cama que o R2 não tem não quebra nada', async () => {
    fetchMock.mockResolvedValue({ ok: false })
    await pista.tocar('trilha-v1', 'inexistente', PONTOS, 0)
    expect(ctx.fontes).toHaveLength(0)
  })
})

describe('deriva', () => {
  it('mede o afastamento entre os dois relógios', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    // Passaram 10 s no contexto e só 9 no áudio: 1 s de deriva.
    ctx.currentTime = 110
    expect(pista.deriva(9)).toBeCloseTo(1, 6)
    expect(pista.deriva(10)).toBeCloseTo(0, 6)
  })

  it('sem pista tocando, não há deriva', () => {
    expect(pista.deriva(5)).toBe(0)
  })
})

describe('silenciar e parar', () => {
  it('silenciar desce o mestre mas deixa a fonte girando', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    pista.silenciar()
    expect(ctx.ganhos[0]!.gain.eventos.at(-1)).toMatch(/^ramp 0@/)
    expect(ctx.fontes[0]!.parada).toBeNull()
  })

  it('parar encerra a fonte — depois do fade, não durante', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    pista.parar()
    expect(ctx.fontes[0]!.parada).toBeGreaterThan(ctx.currentTime)
  })

  it('depois de parar, tocar de novo cria fonte nova sem rebaixar', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    pista.parar()
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    expect(ctx.fontes).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('encerrar', () => {
  it('tocar diz se a música soou', async () => {
    expect(await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)).toBe(true)
    fetchMock.mockResolvedValue({ ok: false })
    expect(await pista.tocar('trilha-v1', 'inexistente', PONTOS, 0)).toBe(false)
  })

  it('faltando 5 s para o fim da volta, o fadeout dura 5 s', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0) // começa em t=100, volta de 120 s
    ctx.currentTime = 100 + 115
    pista.encerrar()
    expect(ctx.ganhos[0]!.gain.eventos.at(-1)).toBe(`ramp 0@${100 + 115 + 5}`)
  })

  it('o fadeout nunca passa de 30 s, mesmo faltando mais', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    ctx.currentTime = 100 + 10 // faltam 110 s
    pista.encerrar()
    expect(ctx.ganhos[0]!.gain.eventos.at(-1)).toBe(`ramp 0@${110 + 30}`)
  })

  it('conta a posição pela volta em curso, não pelo tempo total', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    ctx.currentTime = 100 + 120 * 3 + 104 // 3 voltas e 104 s: faltam 16 s
    pista.encerrar()
    expect(ctx.ganhos[0]!.gain.eventos.at(-1)).toBe(`ramp 0@${100 + 360 + 104 + 16}`)
  })

  it('terminando junto com a volta, cai no fade curto de sempre', async () => {
    await pista.tocar('trilha-v1', 'louvor', PONTOS, 0)
    ctx.currentTime = 100 + 119.99
    pista.encerrar()
    const [, quando] = ctx.ganhos[0]!.gain.eventos.at(-1)!.split('@')
    expect(Number(quando) - ctx.currentTime).toBeCloseTo(0.35, 6)
  })

  it('sem música tocando, não faz nada além de não quebrar', () => {
    expect(() => pista.encerrar()).not.toThrow()
  })
})
