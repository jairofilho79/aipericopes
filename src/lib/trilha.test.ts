// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Manifesto } from './manifesto'
import {
  ATAQUE_S,
  GANHO_DUCK,
  SOLTURA_S,
  TRILHA_KEY,
  agendar,
  carregarMapaTrilha,
  envoltoria,
  esquecerMapaTrilha,
  getTrilhaLigada,
  indiceDeCamas,
  intervalosDeFala,
  mapaTrilhaValido,
  setTrilhaLigada,
  valorEm,
  type ParamAgendavel,
} from './trilha'
import { installLocalStorageMock } from './testing/storage-mock'

installLocalStorageMock()

function manifesto(unidades: Manifesto['unidades']): Manifesto {
  return { ordem: 1, dur_total: 100, unidades }
}

describe('mapaTrilhaValido', () => {
  it('aceita o mapa que o montador gera', () => {
    expect(mapaTrilhaValido({ prefixo: 'trilha-v1', camas: { louvor: [1, 2], juizo: [3] } })).toBe(
      true,
    )
  })

  it('recusa forma estranha vinda da rede', () => {
    expect(mapaTrilhaValido(null)).toBe(false)
    expect(mapaTrilhaValido({ camas: {} })).toBe(false)
    expect(mapaTrilhaValido({ prefixo: '', camas: {} })).toBe(false)
    expect(mapaTrilhaValido({ prefixo: 'trilha-v1', camas: [] })).toBe(false)
    expect(mapaTrilhaValido({ prefixo: 'trilha-v1', camas: { louvor: ['1'] } })).toBe(false)
  })
})

describe('indiceDeCamas', () => {
  it('responde qual cama toca em cada ordem', () => {
    const ix = indiceDeCamas({ prefixo: 'trilha-v1', camas: { louvor: [1, 5], juizo: [3] } })
    expect(ix.get(1)).toBe('louvor')
    expect(ix.get(3)).toBe('juizo')
    expect(ix.get(5)).toBe('louvor')
    expect(ix.get(2)).toBeUndefined()
  })
})

describe('intervalosDeFala', () => {
  it('usa as palavras quando o manifesto as tem', () => {
    // A `dur` da unidade vai até 9, mas a última palavra acaba em 3: o silêncio
    // de respiro no fim da unidade é pausa, e a cama sobe nele.
    const m = manifesto([
      {
        i: 0,
        secao: 'texto',
        texto: 'a b',
        inicio: 1,
        dur: 8,
        palavras: [
          { t: 'a', i: 1, d: 0.5 },
          { t: 'b', i: 1.7, d: 0.5 },
        ],
      },
    ])
    expect(intervalosDeFala(m)).toEqual([{ inicio: 1, fim: 2.2 }])
  })

  it('cai para a unidade quando não há palavras', () => {
    const m = manifesto([{ i: 0, secao: 'titulo', texto: 'x', inicio: 2, dur: 3 }])
    expect(intervalosDeFala(m)).toEqual([{ inicio: 2, fim: 5 }])
  })

  it('separa quando a pausa é longa e junta quando é curta', () => {
    const m = manifesto([
      { i: 0, secao: 'titulo', texto: 'a', inicio: 0, dur: 1 },
      { i: 1, secao: 'contexto', texto: 'b', inicio: 1.2, dur: 1 },
      { i: 2, secao: 'texto', texto: 'c', inicio: 10, dur: 1 },
    ])
    expect(intervalosDeFala(m)).toEqual([
      { inicio: 0, fim: 2.2 },
      { inicio: 10, fim: 11 },
    ])
  })

  it('devolve lista vazia para manifesto sem unidades', () => {
    expect(intervalosDeFala(manifesto([]))).toEqual([])
  })
})

describe('envoltoria', () => {
  it('desce no começo da fala e sobe depois do fim', () => {
    expect(envoltoria([{ inicio: 10, fim: 12 }])).toEqual([
      { t: 0, g: 1 },
      { t: 10 - ATAQUE_S, g: 1 },
      { t: 10, g: GANHO_DUCK },
      { t: 12, g: GANHO_DUCK },
      { t: 12 + SOLTURA_S, g: 1 },
    ])
  })

  it('não agenda tempo negativo quando a voz começa em zero', () => {
    const pontos = envoltoria([{ inicio: 0, fim: 2 }])
    expect(pontos[0]).toEqual({ t: 0, g: GANHO_DUCK })
    expect(pontos.every((p) => p.t >= 0)).toBe(true)
  })

  it('mantém o tempo estritamente crescente', () => {
    const pontos = envoltoria([
      { inicio: 1, fim: 2 },
      { inicio: 2.7, fim: 4 },
    ])
    for (let i = 1; i < pontos.length; i++) expect(pontos[i]!.t).toBeGreaterThan(pontos[i - 1]!.t)
  })

  it('sem fala nenhuma, envoltória vazia — a cama toca plana', () => {
    expect(envoltoria([])).toEqual([])
  })
})

describe('valorEm', () => {
  const pontos = envoltoria([{ inicio: 10, fim: 12 }])

  it('interpola dentro da rampa', () => {
    expect(valorEm(pontos, 10 - ATAQUE_S / 2)).toBeCloseTo((1 + GANHO_DUCK) / 2, 6)
  })

  it('segura o valor fora das pontas', () => {
    expect(valorEm(pontos, -5)).toBe(1)
    expect(valorEm(pontos, 11)).toBe(GANHO_DUCK)
    expect(valorEm(pontos, 999)).toBe(1)
  })

  it('sem envoltória, ganho cheio', () => {
    expect(valorEm([], 3)).toBe(1)
  })
})

describe('agendar', () => {
  function fake() {
    const chamadas: string[] = []
    const param: ParamAgendavel = {
      cancelScheduledValues: (t) => void chamadas.push(`cancel@${t}`),
      setValueAtTime: (v, t) => void chamadas.push(`set ${v}@${t}`),
      linearRampToValueAtTime: (v, t) => void chamadas.push(`ramp ${v}@${t}`),
    }
    return { param, chamadas }
  }

  it('desloca os pontos futuros para o relógio do contexto', () => {
    const { param, chamadas } = fake()
    // Narração em 0 s, contexto em 100 s: a diferença é o offset.
    agendar(param, [{ t: 0, g: 1 }, { t: 5, g: GANHO_DUCK }], 0, 100)
    expect(chamadas).toEqual(['cancel@100', 'set 1@100', `ramp ${GANHO_DUCK}@105`])
  })

  it('ignora o passado e ancora no valor de agora', () => {
    // Reagendamento no meio: só o que ainda não passou vale, e o ganho parte
    // de onde a envoltória já estava, sem salto.
    const { param, chamadas } = fake()
    agendar(param, envoltoria([{ inicio: 10, fim: 12 }]), 11, 50)
    expect(chamadas).toEqual([
      'cancel@50',
      `set ${GANHO_DUCK}@50`,
      `ramp ${GANHO_DUCK}@51`,
      `ramp 1@${51 + SOLTURA_S}`,
    ])
  })
})

describe('preferência da trilha', () => {
  beforeEach(() => localStorage.clear())

  it('vem ligada por padrão', () => {
    expect(getTrilhaLigada()).toBe(true)
  })

  it('só o desligamento explícito silencia', () => {
    setTrilhaLigada(false)
    expect(localStorage.getItem(TRILHA_KEY)).toBe('0')
    expect(getTrilhaLigada()).toBe(false)
    setTrilhaLigada(true)
    expect(getTrilhaLigada()).toBe(true)
  })

  it('lixo de versão antiga vale como ligada', () => {
    localStorage.setItem(TRILHA_KEY, 'talvez')
    expect(getTrilhaLigada()).toBe(true)
  })
})

describe('carregarMapaTrilha', () => {
  beforeEach(() => esquecerMapaTrilha())
  // Devolve o `fetch` real e recoloca o localStorage: `unstubAllGlobals`
  // derruba TODOS os stubs, inclusive o do storage instalado lá em cima.
  afterEach(() => {
    vi.unstubAllGlobals()
    installLocalStorageMock()
  })

  it('busca uma vez só e reaproveita', async () => {
    const mapa = { prefixo: 'trilha-v1', camas: { louvor: [1] } }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mapa })
    vi.stubGlobal('fetch', fetchMock)
    expect(await carregarMapaTrilha()).toEqual(mapa)
    expect(await carregarMapaTrilha()).toEqual(mapa)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('data/trilha.json')
  })

  it('falha de rede vira null, sem quebrar a leitura', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await carregarMapaTrilha()).toBeNull()
  })

  it('corpo estranho vira null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ a: 1 }) }))
    expect(await carregarMapaTrilha()).toBeNull()
  })
})
