import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  atualizarJornada,
  clearAllUserData,
  criarJornada,
  concluirProgresso,
  deleteMeta,
  enqueuePosicao,
  getMeta,
  getPosicao,
  getProgresso,
  listAnotacoes,
  listDestaques,
  listJornadas,
  listOutbox,
  saveAnotacao,
  setDestaque,
  setMeta,
  setPosicaoLocal,
  setProgresso,
} from './user-db'
import { MAX_ITENS_POR_LOTE } from './sync-limits'
import { onSync } from './sync-event'

vi.mock('./auth-client', () => ({
  authClient: { getSession: vi.fn(), signOut: vi.fn() },
}))

// Imported after the mock so the mocked module is what sync.ts resolves.
import { authClient } from './auth-client'
import { MAX_PAGINAS_PULL, signOutLocal, syncNow } from './sync'

const FAKE_SESSION = { data: { user: { id: 'u1', email: 'user@example.com' } } }
const NO_SESSION = { data: null }
// Must postdate whatever the real clock stamps local writes with in this test run, so that
// applyRemoteProgresso/applyRemoteAnotacoes treat these fixtures as the newer, winning side.
const FUTURE = '2099-01-01T00:00:00.000Z'

function jsonResponse(body: unknown, init?: { status?: number; ok?: boolean }) {
  const status = init?.status ?? 200
  return {
    ok: init?.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

/** Zera o estado local compartilhado por estes testes (fake-indexeddb é um singleton). */
async function resetLocal() {
  await clearAllUserData()
  await deleteMeta('sync-cursor')
  await deleteMeta('sync-user')
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('navigator', { onLine: true })
  // resetAllMocks zera a implementação; signOut precisa devolver uma promise
  // porque sync.ts encadeia .catch() nela.
  vi.mocked(authClient.signOut).mockResolvedValue(undefined as never)
})

describe('syncNow', () => {
  it('no session → no fetch calls', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(NO_SESSION as never)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offline → no fetch calls (session not even checked)', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const getSessionMock = vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getSessionMock).not.toHaveBeenCalled()
  })

  it('session + non-empty outbox → POST deduped payload, clears outbox, GET pulls and stores cursor', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    // ordem 20001 written twice: dedupe must keep only the LAST state ("em_andamento" then
    // "concluido" wins), proving toPush() collapses by key instead of pushing every outbox row.
    await setProgresso(20001, 'em_andamento')
    await concluirProgresso(20001)
    const nota = await saveAnotacao(20002, 'primeira anotação')

    const remoteAgora = '2026-08-31T12:00:00.000Z'
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string)
        expect(body.progresso).toEqual([
          {
            pericopeOrdem: 20001,
            status: 'concluido',
            // Não [] mais: concluirProgresso é quem grava agora, e ele
            // sempre anexa a data da conclusão ao histórico.
            historico: [expect.any(String)],
            paraReler: false,
            atualizadoEm: expect.any(String),
          },
        ])
        expect(body.anotacoes).toEqual([
          {
            id: nota.id,
            pericopeOrdem: 20002,
            texto: 'primeira anotação',
            verseRef: null,
            criadoEm: nota.criadoEm,
            atualizadoEm: nota.atualizadoEm,
            apagadoEm: null,
          },
        ])
        return jsonResponse({ ok: true, agora: remoteAgora })
      }
      expect(url).toBe(`/api/sync?since=${encodeURIComponent('')}`)
      return jsonResponse({
        progresso: [{ pericopeOrdem: 30001, status: 'concluido', atualizadoEm: remoteAgora }],
        anotacoes: [],
        agora: remoteAgora,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const outboxAfter = await listOutbox()
    expect(outboxAfter.some((i) => i.kind === 'progresso' && i.ordem === 20001)).toBe(false)
    expect(outboxAfter.some((i) => i.kind === 'anotacao' && i.nota.id === nota.id)).toBe(false)

    const pulled = await getProgresso(30001)
    expect(pulled?.status).toBe('concluido')

    expect(await getMeta('sync-cursor')).toBe(remoteAgora)
  })

  it('POST returning 401 → outbox NOT cleared, no pull attempted', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    await concluirProgresso(20003)

    const fetchMock = vi.fn(async () => jsonResponse({ error: 'não autenticado' }, { status: 401, ok: false }))
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(1) // only the POST — no GET pull after a 401
    const outboxAfter = await listOutbox()
    expect(outboxAfter.some((i) => i.kind === 'progresso' && i.ordem === 20003)).toBe(true)
    // contrato do 401: derruba a sessão do cliente para o header voltar a "Entrar"
    expect(authClient.signOut).toHaveBeenCalled()
  })

  it('GET returning 401 → signOut, cursor e dados locais intactos', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    await setMeta('sync-cursor', '2026-01-01T00:00:00.000Z')

    // outbox vazio → syncNow vai direto para o pull
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'não autenticado' }, { status: 401, ok: false }))
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(authClient.signOut).toHaveBeenCalled()
    expect(await getMeta('sync-cursor')).toBe('2026-01-01T00:00:00.000Z')
  })

  it('re-entrancy guard: a second syncNow() while one is running makes no extra request', async () => {
    // Deliberately NOT asserting an absolute call count: earlier tests may leave items in the
    // shared fake-indexeddb outbox (e.g. the 401 test's uncleared item), so a fresh syncNow()
    // here may issue a push + a pull. What matters for this guard is that the concurrent second
    // call contributes zero additional requests beyond what a single completed run would make.
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const fetchMock = vi.fn(async () =>
      jsonResponse({ progresso: [], anotacoes: [], agora: '2026-08-31T12:00:00.000Z' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    // `running` is set synchronously before the first `await`, so calling syncNow() again
    // before awaiting the first call must short-circuit on the guard.
    const first = syncNow()
    const second = syncNow()
    await first
    const callsAfterFirst = fetchMock.mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)
    await second
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst)
  })

  it('remote tombstone from pull removes the local note', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const local = await saveAnotacao(20004, 'nota a ser apagada remotamente')

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ ok: true, agora: FUTURE })
      return jsonResponse({
        progresso: [],
        anotacoes: [
          {
            id: local.id,
            pericopeOrdem: 20004,
            texto: local.texto,
            verseRef: local.verseRef,
            criadoEm: local.criadoEm,
            atualizadoEm: FUTURE,
            apagadoEm: FUTURE,
          },
        ],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect((await listAnotacoes(20004)).find((n) => n.id === local.id)).toBeUndefined()
  })
})

// O servidor rejeita (400) qualquer lista com mais de MAX_ITENS_POR_LOTE itens.
// Sem fatiar, um outbox grande travava o sync para sempre: o POST voltava 400,
// o cliente não limpava nada e reenviava o mesmo lote inválido a cada rodada.
describe('syncNow — push em lotes', () => {
  const TOTAL = MAX_ITENS_POR_LOTE * 2 + 1 // 1001 → 3 lotes (500 + 500 + 1)

  async function encherOutbox() {
    for (let i = 0; i < TOTAL; i++) await concluirProgresso(40000 + i)
  }

  it('outbox acima do limite → vários POSTs, nenhuma lista acima de 500, outbox limpo no fim', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    await encherOutbox()

    const posts: { progresso: unknown[]; anotacoes: unknown[] }[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string))
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(posts.length).toBe(3)
    for (const p of posts) {
      expect(p.progresso.length).toBeLessThanOrEqual(MAX_ITENS_POR_LOTE)
      expect(p.anotacoes.length).toBeLessThanOrEqual(MAX_ITENS_POR_LOTE)
    }
    // nada se perde no caminho: a soma dos lotes é o outbox deduplicado inteiro
    expect(posts.reduce((n, p) => n + p.progresso.length, 0)).toBe(TOTAL)
    expect(await listOutbox()).toEqual([])
  })

  it('lote do meio falhando → outbox NÃO é limpo e o pull nem acontece', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    await encherOutbox()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let posts = 0
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts += 1
        if (posts === 2) return jsonResponse({ error: 'boom' }, { status: 500, ok: false })
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(2) // parou no lote que falhou, sem GET
    expect(await listOutbox()).toHaveLength(TOTAL) // at-least-once: nada é descartado
    expect(warn).toHaveBeenCalledWith('[sync] push falhou', 500)
    warn.mockRestore()
  })

  // Regressão específica de jornadas: se `lotesJornadas.length` saísse do
  // `Math.max` que calcula `total`, um outbox com MAIS lotes de jornadas do
  // que de qualquer outro grupo perderia em silêncio as jornadas do lote
  // excedente — sem erro, sem log, nenhum POST pra elas. Progresso presente
  // ao lado (1 lote) é o que garante que este teste morre por essa razão
  // específica (um lote de jornadas faltando na soma) e não pela razão
  // incidental de "nenhum POST saiu", que aconteceria se o outbox só
  // tivesse jornadas e `total` virasse 0.
  it('jornadas em mais lotes que progresso → nenhum lote de jornadas se perde', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    await concluirProgresso(90000) // 1 item → 1 lote
    const TOTAL_JORNADAS = MAX_ITENS_POR_LOTE + 1 // 501 → 2 lotes (500 + 1)
    for (let i = 0; i < TOTAL_JORNADAS; i++) {
      await criarJornada({
        nome: `Jornada ${i}`,
        tipo: 'livro',
        escopo: 'Salmos',
        inicioOrdem: 1,
        contaDesde: null,
      })
    }

    const posts: { jornadas: unknown[] }[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string))
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    // a asserção que importa vem primeiro: a soma dos lotes é o total de
    // jornadas criadas — se `jornadas` saísse do Math.max, o segundo lote
    // nunca seria POSTado e esta soma ficaria em 500, não 501 (o outbox NÃO
    // ficaria vazio, e é isso que a asserção final também comprova).
    expect(posts.reduce((n, p) => n + p.jornadas.length, 0)).toBe(TOTAL_JORNADAS)
    expect(posts.length).toBe(2)
    for (const p of posts) expect(p.jornadas.length).toBeLessThanOrEqual(MAX_ITENS_POR_LOTE)
    expect(await listOutbox()).toEqual([])
  }, 20000)
})

// 400 é validação determinística: reenviar o mesmo lote nunca muda o
// resultado. Sem esse escape, o outbox nunca esvaziava e travava o pull (e
// todas as outras entidades) para sempre atrás de um único item ruim.
describe('syncNow — push rejeitado com 400', () => {
  it('POST retornando 400 → outbox é limpo e o pull acontece mesmo assim', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    await concluirProgresso(80001)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let getUrl = ''
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'payload inválido' }, { status: 400, ok: false })
      }
      getUrl = url
      return jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(2) // POST rejeitado + GET do pull
    expect(await listOutbox()).toEqual([])
    expect(getUrl).toBe('/api/sync?since=')
    expect(await getMeta('sync-cursor')).toBe(FUTURE) // cursor avançou: o pull rodou de verdade
    expect(errorSpy).toHaveBeenCalledWith('[sync] push rejeitado (400)', expect.any(String))
    errorSpy.mockRestore()
  })

  // 413 é da mesma família: o corpo excede o teto do Worker e vai exceder de
  // novo em toda retentativa. Cair no ramo de "tenta na próxima" travaria o
  // outbox para sempre, que é justamente o que o escape do 400 evita.
  it('POST retornando 413 → mesmo tratamento determinístico do 400', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    await concluirProgresso(80002)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'corpo grande demais' }, { status: 413, ok: false })
      }
      return jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(2) // POST rejeitado + GET do pull
    expect(await listOutbox()).toEqual([])
    expect(await getMeta('sync-cursor')).toBe(FUTURE)
    expect(errorSpy).toHaveBeenCalledWith('[sync] push rejeitado (413)', expect.any(String))
    errorSpy.mockRestore()
  })
})

describe('troca de conta e logout', () => {
  it('sessão de outro usuário → apaga os dados locais antes de aplicar os dele', async () => {
    await resetLocal()
    // dados do usuário A neste dispositivo
    await concluirProgresso(50001)
    const notaA = await saveAnotacao(50002, 'nota do usuário A')
    await setMeta('sync-user', 'usuario-A')
    await setMeta('sync-cursor', '2020-01-01T00:00:00.000Z')

    // agora quem está logado é u1 (FAKE_SESSION)
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    let posts = 0
    let getUrl = ''
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts += 1
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      getUrl = url
      return jsonResponse({
        progresso: [{ pericopeOrdem: 50003, status: 'concluido', atualizadoEm: FUTURE }],
        anotacoes: [],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    // o outbox de A foi descartado junto: nada dele sobe para a conta de u1
    expect(posts).toBe(0)
    expect(await getProgresso(50001)).toBeUndefined()
    expect((await listAnotacoes(50002)).find((n) => n.id === notaA.id)).toBeUndefined()
    // cursor zerado → pull completo da conta nova
    expect(getUrl).toBe('/api/sync?since=')
    expect((await getProgresso(50003))?.status).toBe('concluido')
    expect(await getMeta('sync-user')).toBe('u1')
  })

  it('mesma conta de novo → nada é apagado', async () => {
    await resetLocal()
    await setMeta('sync-user', 'u1')
    await concluirProgresso(50004)
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? jsonResponse({ ok: true, agora: FUTURE })
          : jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE }),
      ),
    )

    await syncNow()

    expect((await getProgresso(50004))?.status).toBe('concluido')
  })

  it('signOutLocal: esvazia o outbox, zera o cursor e desloga — mantendo a marca do dono', async () => {
    await resetLocal()
    await concluirProgresso(60001)
    await setMeta('sync-cursor', '2026-01-01T00:00:00.000Z')
    await setMeta('sync-user', 'u1')

    await signOutLocal()

    expect(await listOutbox()).toEqual([])
    expect(await getMeta('sync-cursor')).toBeUndefined()
    // a marca do dono fica: é ela que dispara o wipe se outra conta entrar aqui
    expect(await getMeta('sync-user')).toBe('u1')
    // sair não apaga o que já está lido/anotado neste dispositivo
    expect((await getProgresso(60001))?.status).toBe('concluido')
    expect(authClient.signOut).toHaveBeenCalled()
  })

  it('signOutLocal: se o signOut falhar, o outbox e o cursor ficam intactos', async () => {
    await resetLocal()
    await concluirProgresso(60002)
    await setMeta('sync-cursor', '2026-01-01T00:00:00.000Z')
    vi.mocked(authClient.signOut).mockRejectedValue(new Error('offline') as never)

    await expect(signOutLocal()).rejects.toThrow('offline')

    // nada de dado local jogado fora por um logout que nem aconteceu
    expect((await listOutbox()).some((i) => i.kind === 'progresso' && i.ordem === 60002)).toBe(true)
    expect(await getMeta('sync-cursor')).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('syncNow — destaques', () => {
  it('push envia destaques deduplicados por id e o pull aplica os remotos', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    // mesmo versículo destacado duas vezes: só a última cor sobe
    await setDestaque(70001, '1:3', 'verde')
    await setDestaque(70001, '1:3', 'verde')

    const posts: { destaques: unknown[] }[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string))
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({
        progresso: [],
        anotacoes: [],
        destaques: [
          {
            id: '70002:2:5',
            pericopeOrdem: 70002,
            verseId: '2:5',
            cor: 'azul',
            criadoEm: FUTURE,
            atualizadoEm: FUTURE,
            apagadoEm: null,
          },
        ],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(posts).toHaveLength(1)
    expect(posts[0].destaques).toEqual([
      {
        id: '70001:1:3',
        pericopeOrdem: 70001,
        verseId: '1:3',
        cor: 'verde',
        criadoEm: expect.any(String),
        atualizadoEm: expect.any(String),
        apagadoEm: null,
      },
    ])
    expect((await listDestaques(70002)).map((d) => d.cor)).toEqual(['azul'])
    expect(await listOutbox()).toEqual([])
  })

  it('push envia posições deduplicadas por perícope e o pull aplica as remotas', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    // duas escritas locais e dois enqueues: só o último estado sobe
    await setPosicaoLocal(75001, 'secao', 'texto')
    await enqueuePosicao(75001)
    await setPosicaoLocal(75001, 'versiculo', '2:9')
    await enqueuePosicao(75001)

    const posts: { posicoes: unknown[] }[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string))
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({
        progresso: [],
        anotacoes: [],
        destaques: [],
        posicoes: [
          {
            pericopeOrdem: 75002,
            tipo: 'narracao',
            ref: 'resenha-1',
            tempo: 88.5,
            atualizadoEm: FUTURE,
            apagadoEm: null,
          },
        ],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(posts).toHaveLength(1)
    expect(posts[0].posicoes).toEqual([
      {
        pericopeOrdem: 75001,
        tipo: 'versiculo',
        ref: '2:9',
        tempo: null,
        atualizadoEm: expect.any(String),
        apagadoEm: null,
      },
    ])
    expect((await getPosicao(75002))?.tempo).toBe(88.5)
    expect(await listOutbox()).toEqual([])
  })

  it('resposta de pull sem a lista destaques não quebra o sync', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })),
    )

    await syncNow()

    expect(await getMeta('sync-cursor')).toBe(FUTURE)
  })
})

describe('syncNow — jornadas', () => {
  it('push envia jornadas deduplicadas por id e o pull aplica as remotas', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    // mesma jornada criada e depois renomeada: só o último nome sobe
    const jornada = await criarJornada({
      nome: 'Salmos',
      tipo: 'livro',
      escopo: 'Salmos',
      inicioOrdem: 2,
      contaDesde: null,
    })
    await atualizarJornada(jornada.id, { nome: 'Salmos (releitura)' })

    const posts: { jornadas: unknown[] }[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string))
        return jsonResponse({ ok: true, agora: FUTURE })
      }
      return jsonResponse({
        progresso: [],
        anotacoes: [],
        destaques: [],
        posicoes: [],
        jornadas: [
          {
            id: 'remota-1',
            nome: 'Pentateuco',
            tipo: 'bloco',
            escopo: 'pentateuco',
            inicioOrdem: 1,
            contaDesde: null,
            criadoEm: FUTURE,
            atualizadoEm: FUTURE,
            arquivadaEm: null,
            concluidaEm: null,
            apagadoEm: null,
          },
        ],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(posts).toHaveLength(1)
    expect(posts[0].jornadas).toEqual([
      {
        id: jornada.id,
        nome: 'Salmos (releitura)',
        tipo: 'livro',
        escopo: 'Salmos',
        inicioOrdem: 2,
        contaDesde: null,
        criadoEm: expect.any(String),
        atualizadoEm: expect.any(String),
        arquivadaEm: null,
        concluidaEm: null,
        apagadoEm: null,
      },
    ])
    expect((await listJornadas()).map((j) => j.id)).toContain('remota-1')
    expect(await listOutbox()).toEqual([])
  })
})

// P4: o pull vira um loop quando o servidor sinaliza `maisDados` — a resposta
// foi truncada (worker/sync-logic.ts) e há mais páginas esperando pelo mesmo
// cursor. Um servidor antigo nunca manda esse campo, então `!data.maisDados`
// encerra o loop na primeira página — é assim que o caminho de hoje continua
// intacto para quem não estourou a página.
describe('syncNow — pull paginado', () => {
  it('duas páginas: aplica linhas de ambas e termina com o cursor final', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)

    const urls: string[] = []
    const CURSOR_PAGINA_1 = '2026-08-31T12:00:00.000Z'
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ ok: true, agora: FUTURE })
      urls.push(url)
      if (url === '/api/sync?since=') {
        return jsonResponse({
          progresso: [{ pericopeOrdem: 90001, status: 'concluido', atualizadoEm: FUTURE }],
          anotacoes: [],
          destaques: [],
          agora: CURSOR_PAGINA_1,
          maisDados: true,
        })
      }
      return jsonResponse({
        progresso: [{ pericopeOrdem: 90002, status: 'concluido', atualizadoEm: FUTURE }],
        anotacoes: [],
        destaques: [],
        agora: FUTURE,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    // a segunda página é pedida com o cursor devolvido pela primeira — não com
    // o `since` original, e não com o `agora` (que não existiria se a
    // primeira página não tivesse sido truncada)
    expect(urls).toEqual([
      '/api/sync?since=',
      `/api/sync?since=${encodeURIComponent(CURSOR_PAGINA_1)}`,
    ])
    expect((await getProgresso(90001))?.status).toBe('concluido')
    expect((await getProgresso(90002))?.status).toBe('concluido')
    expect(await getMeta('sync-cursor')).toBe(FUTURE)
  })

  it('página 2 falha no meio do loop: o cursor fica na fronteira da página 1 E as telas são avisadas', async () => {
    // O caso que a paginação criou e que não existia antes dela: um pull podia
    // falhar sem ter aplicado nada, então sair sem avisar era inofensivo. Agora
    // a página 1 pode entrar no IndexedDB e a página 2 falhar — as linhas já
    // gravadas PRECISAM chegar nas telas abertas (useSyncRefresh só relê no
    // evento; sem ele uma Leitura montada fica velha até o próximo timer, 5
    // minutos). É exatamente o cenário-alvo da funcionalidade: primeira sync
    // num aparelho novo, rede instável.
    //
    // O mesmo teste prende a retomada: o cursor tem que ser gravado A CADA
    // página, não só no fim do loop. Se fosse só no fim, ele ficaria vazio aqui
    // e a próxima rodada refaria a página 1 do zero.
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const avisos = vi.fn()
    const desinscrever = onSync(avisos)

    const CURSOR_PAGINA_1 = '2026-08-31T12:00:00.000Z'
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ ok: true, agora: FUTURE })
      if (url === '/api/sync?since=') {
        return jsonResponse({
          progresso: [{ pericopeOrdem: 90003, status: 'concluido', atualizadoEm: FUTURE }],
          anotacoes: [],
          destaques: [],
          agora: CURSOR_PAGINA_1,
          maisDados: true,
        })
      }
      return jsonResponse({ error: 'erro interno' }, { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((await getProgresso(90003))?.status).toBe('concluido')
    expect(await getMeta('sync-cursor')).toBe(CURSOR_PAGINA_1)
    expect(avisos).toHaveBeenCalledTimes(1)
    desinscrever()
    warn.mockRestore()
  })

  it('página 2 lança (rede instável) em vez de responder com status ruim: mesma garantia', async () => {
    // Variante do teste acima que não é um corte por status HTTP: um `fetch`
    // pode REJEITAR a promise — conexão caindo no meio, DNS falhando — em vez
    // de resolver com um 500. Isso sobe pelo `await` até o catch()/finally()
    // de syncNow(), sem passar pelos `break` do loop. É o caso mais provável
    // por trás do "rede instável" do teste acima: uma rede que cai não costuma
    // devolver um 500 educado, ela derruba a conexão.
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const avisos = vi.fn()
    const desinscrever = onSync(avisos)

    const CURSOR_PAGINA_1 = '2026-08-31T12:00:00.000Z'
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ ok: true, agora: FUTURE })
      if (url === '/api/sync?since=') {
        return jsonResponse({
          progresso: [{ pericopeOrdem: 90004, status: 'concluido', atualizadoEm: FUTURE }],
          anotacoes: [],
          destaques: [],
          agora: CURSOR_PAGINA_1,
          maisDados: true,
        })
      }
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((await getProgresso(90004))?.status).toBe('concluido')
    expect(await getMeta('sync-cursor')).toBe(CURSOR_PAGINA_1)
    expect(avisos).toHaveBeenCalledTimes(1)
    desinscrever()
    warn.mockRestore()
  })

  it('respeita o teto de páginas mesmo se o servidor insistir em maisDados', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let n = 0
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ ok: true, agora: FUTURE })
      n += 1
      return jsonResponse({
        progresso: [],
        anotacoes: [],
        destaques: [],
        agora: `cursor-pagina-${n}`,
        maisDados: true,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncNow()

    expect(fetchMock).toHaveBeenCalledTimes(MAX_PAGINAS_PULL)
    expect(await getMeta('sync-cursor')).toBe(`cursor-pagina-${MAX_PAGINAS_PULL}`)
    expect(warn).toHaveBeenCalledWith(
      '[sync] pull interrompido: teto de páginas atingido',
      MAX_PAGINAS_PULL,
    )
    warn.mockRestore()
  })
})

// O evento é o gatilho do live refresh das telas abertas. Ele sai do pull, e
// só quando o pull mudou alguma coisa: o servidor reentrega linhas de
// propósito, e uma rodada de sync acontece de 5 em 5 minutos.
describe('syncNow — evento de live refresh', () => {
  it('avisa uma vez quando o pull aplicou linhas', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const avisos = vi.fn()
    const desinscrever = onSync(avisos)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          progresso: [{ pericopeOrdem: 70001, status: 'concluido', atualizadoEm: FUTURE }],
          anotacoes: [],
          agora: FUTURE,
        }),
      ),
    )

    await syncNow()

    expect(avisos).toHaveBeenCalledTimes(1)
    expect((await getProgresso(70001))?.status).toBe('concluido')
    desinscrever()
  })

  it('fica quieto quando o pull não muda nada', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const avisos = vi.fn()
    const desinscrever = onSync(avisos)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ progresso: [], anotacoes: [], agora: FUTURE })),
    )

    await syncNow()

    expect(avisos).not.toHaveBeenCalled()
    expect(await getMeta('sync-cursor')).toBe(FUTURE) // o cursor avança do mesmo jeito
    desinscrever()
  })

  it('desinscrever corta o aviso', async () => {
    await resetLocal()
    vi.mocked(authClient.getSession).mockResolvedValue(FAKE_SESSION as never)
    const avisos = vi.fn()
    onSync(avisos)()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          progresso: [{ pericopeOrdem: 70002, status: 'concluido', atualizadoEm: FUTURE }],
          anotacoes: [],
          agora: FUTURE,
        }),
      ),
    )

    await syncNow()

    expect(avisos).not.toHaveBeenCalled()
  })
})
