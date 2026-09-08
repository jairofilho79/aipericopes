import { authClient } from './auth-client'
import { MAX_ITENS_POR_LOTE } from './sync-limits'
import { notificarSync } from './sync-event'
import {
  applyRemoteDestaques,
  applyRemoteAnotacoes,
  applyRemoteJornadas,
  applyRemotePosicoes,
  applyRemoteProgresso,
  clearAllUserData,
  clearOutbox,
  clearOutboxAll,
  deleteMeta,
  getMeta,
  listOutbox,
  setMeta,
  type OutboxItem,
} from './user-db'
import type { Jornada } from './types'

const CURSOR_KEY = 'sync-cursor'
const USER_KEY = 'sync-user'
let running = false

/**
 * Teto de páginas de um único pull (ver `maisDados` em worker/index.ts). Um
 * servidor correto sempre para de sinalizar `maisDados` depois de um número
 * finito de páginas — este teto é só uma rede de segurança contra um bug de
 * servidor que sinalizasse `maisDados` pra sempre, o que sem este teto
 * giraria o cliente num loop infinito. Bem acima do que qualquer volume real
 * de usuário exigiria: 500 páginas de 2000 linhas (o tamanho de página do
 * Worker) dão um milhão de linhas por entidade.
 */
export const MAX_PAGINAS_PULL = 500

type PushProgresso = {
  pericopeOrdem: number
  status: string
  historico: string[]
  paraReler: boolean
  atualizadoEm: string
}
type PushAnotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  verseRef: string | null
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}
type PushDestaque = {
  id: string
  pericopeOrdem: number
  verseId: string
  cor: string
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}
type PushPosicao = {
  pericopeOrdem: number
  tipo: string
  ref: string
  tempo: number | null
  atualizadoEm: string
  apagadoEm: string | null
}
type PushJornada = Jornada & { apagadoEm: string | null }

function toPush(items: OutboxItem[]) {
  const progresso = new Map<number, PushProgresso>()
  const anotacoes = new Map<string, PushAnotacao>()
  const destaques = new Map<string, PushDestaque>()
  const posicoes = new Map<number, PushPosicao>()
  const jornadas = new Map<string, PushJornada>()
  for (const item of items) {
    if (item.kind === 'progresso') {
      progresso.set(item.ordem, {
        pericopeOrdem: item.ordem,
        status: item.status,
        // Item enfileirado por uma versão anterior do app não tem os campos.
        // `[]` é neutro na união do servidor e `false` é seguro: `paraReler`
        // não existia quando aquele item foi gravado.
        historico: item.historico ?? [],
        paraReler: item.paraReler ?? false,
        atualizadoEm: item.atualizadoEm,
      })
    } else if (item.kind === 'anotacao') {
      anotacoes.set(item.nota.id, { ...item.nota, apagadoEm: item.apagadoEm })
    } else if (item.kind === 'destaque') {
      destaques.set(item.destaque.id, { ...item.destaque, apagadoEm: item.apagadoEm })
    } else if (item.kind === 'jornada') {
      jornadas.set(item.jornada.id, { ...item.jornada, apagadoEm: item.apagadoEm })
    } else if (item.kind === 'posicao') {
      posicoes.set(item.posicao.pericopeOrdem, { ...item.posicao, apagadoEm: item.apagadoEm })
    }
  }
  return {
    progresso: [...progresso.values()],
    anotacoes: [...anotacoes.values()],
    destaques: [...destaques.values()],
    posicoes: [...posicoes.values()],
    jornadas: [...jornadas.values()],
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** A sessão morreu no servidor: derruba a do cliente para o header voltar a "Entrar". */
function derrubarSessao() {
  authClient.signOut().catch(() => {})
}

/**
 * Envia o outbox em lotes de no máximo MAX_ITENS_POR_LOTE itens por lista.
 * Deduplica antes de fatiar (último estado de cada chave vence) e devolve
 * `true` quando o chamador deve limpar o outbox: todos os lotes passaram, OU
 * um deles voltou 400 e foi abandonado de propósito (ver comentário abaixo).
 * `false` significa "tenta de novo depois" — o outbox fica intacto.
 * Reenviar um lote já aceito é inofensivo: o upsert no servidor é idempotente.
 */
async function pushOutbox(outbox: OutboxItem[]): Promise<boolean> {
  const { progresso, anotacoes, destaques, posicoes, jornadas } = toPush(outbox)
  const lotesProgresso = chunk(progresso, MAX_ITENS_POR_LOTE)
  const lotesAnotacoes = chunk(anotacoes, MAX_ITENS_POR_LOTE)
  const lotesDestaques = chunk(destaques, MAX_ITENS_POR_LOTE)
  const lotesPosicoes = chunk(posicoes, MAX_ITENS_POR_LOTE)
  const lotesJornadas = chunk(jornadas, MAX_ITENS_POR_LOTE)
  const total = Math.max(
    lotesProgresso.length,
    lotesAnotacoes.length,
    lotesDestaques.length,
    lotesPosicoes.length,
    lotesJornadas.length,
  )

  for (let i = 0; i < total; i++) {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        progresso: lotesProgresso[i] ?? [],
        anotacoes: lotesAnotacoes[i] ?? [],
        destaques: lotesDestaques[i] ?? [],
        posicoes: lotesPosicoes[i] ?? [],
        jornadas: lotesJornadas[i] ?? [],
      }),
    })
    if (res.status === 401) {
      derrubarSessao()
      return false
    }
    if (res.status === 400 || res.status === 413) {
      // 400 (payload inválido) e 413 (corpo acima do teto do Worker) são
      // rejeições determinísticas: reenviar o mesmo lote nunca muda o
      // resultado, e insistir travaria o outbox — e com ele o pull e TODAS as
      // outras entidades — para sempre. Abandona o lote em vez de retentar: as
      // linhas continuam intactas e visíveis no IndexedDB local, só a
      // sincronização delas é que é desistida. Pior seria um travamento
      // permanente por causa de um único item ruim.
      console.error(`[sync] push rejeitado (${res.status})`, await res.text().catch(() => ''))
      return true
    }
    if (!res.ok) {
      // fica no outbox para a próxima tentativa — mas agora com rastro no console
      console.warn('[sync] push falhou', res.status)
      return false
    }
  }
  return true
}

export async function syncNow(): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  // Fora do try: precisa sobreviver a um `throw` no meio do pull (fetch
  // rejeitando por instabilidade de rede, ou res.json()/applyRemote* dando
  // erro) para o finally lá embaixo enxergar quantas linhas já entraram antes
  // do estouro.
  let totalAplicadas = 0
  try {
    const { data: session } = await authClient.getSession()
    if (!session) return

    // Troca de conta no mesmo dispositivo: os stores locais são do usuário
    // anterior. Apaga tudo ANTES de sincronizar para não vazar dado de um
    // usuário para a conta do outro.
    const donoLocal = await getMeta(USER_KEY)
    if (donoLocal && donoLocal !== session.user.id) {
      await clearAllUserData()
      await deleteMeta(CURSOR_KEY)
    }
    // Carimba o dono antes do tráfego: se o push/pull falhar, o dispositivo já
    // está corretamente marcado e uma escrita local feita nesse meio-tempo não
    // será apagada por um segundo wipe na próxima rodada.
    if (donoLocal !== session.user.id) await setMeta(USER_KEY, session.user.id)

    // push: outbox → servidor (dedupe por chave, último estado vence)
    const outbox = await listOutbox()
    if (outbox.length) {
      const lastSeq = outbox[outbox.length - 1].seq ?? 0
      if (!(await pushOutbox(outbox))) return
      await clearOutbox(lastSeq)
    }

    // pull incremental — em loop: quando a resposta vem truncada
    // (worker/index.ts, ver paginarPull em sync-logic.ts), ela sinaliza
    // `maisDados` e o cursor devolvido é a fronteira do corte, não `agora`.
    // Um servidor antigo nunca manda `maisDados`, então o loop sempre para na
    // primeira página para ele — o caminho de hoje continua intacto.
    let since = (await getMeta(CURSOR_KEY)) ?? ''
    for (let pagina = 0; ; pagina++) {
      const res = await fetch(`/api/sync?since=${encodeURIComponent(since)}`, {
        credentials: 'include',
      })
      // Os dois cortes abaixo saem com `break`: nada acontece depois do loop
      // além do notificarSync() do finally, então sair do loop não continua
      // sincronizando nada, só entrega o que já foi gravado. O notificarSync()
      // mora no finally exatamente para cobrir também os cortes que NÃO são um
      // `break` daqui — um `fetch` que rejeita (rede caindo no meio) ou um
      // res.json()/applyRemote* que estoura sobem como `throw` até lá embaixo,
      // e a página 1 pode ter aplicado linhas antes disso: elas têm que chegar
      // nas telas abertas (useSyncRefresh só relê no evento) sem esperar o
      // timer de 5 minutos. Vale igual para o 401 abaixo — a sessão já foi
      // derrubada, e as linhas que entraram antes dela morrer são tão válidas
      // quanto quaisquer outras.
      if (res.status === 401) {
        derrubarSessao()
        break
      }
      if (!res.ok) {
        // o outbox já foi limpo lá em cima; não há nada a proteger saindo cedo
        console.warn('[sync] pull falhou', res.status)
        break
      }
      const data = (await res.json()) as {
        progresso: Parameters<typeof applyRemoteProgresso>[0]
        anotacoes: Parameters<typeof applyRemoteAnotacoes>[0]
        // opcional: uma resposta sem a lista (servidor mais velho, ou um mock de
        // teste) vira lista vazia em vez de estourar e abortar o pull inteiro.
        destaques?: Parameters<typeof applyRemoteDestaques>[0]
        posicoes?: Parameters<typeof applyRemotePosicoes>[0]
        jornadas?: Parameters<typeof applyRemoteJornadas>[0]
        agora: string
        // opcional pelo mesmo motivo: um servidor antigo nunca manda este campo.
        maisDados?: boolean
      }
      totalAplicadas +=
        (await applyRemoteProgresso(data.progresso)) +
        (await applyRemoteAnotacoes(data.anotacoes)) +
        (await applyRemoteDestaques(data.destaques ?? [])) +
        (await applyRemotePosicoes(data.posicoes ?? [])) +
        (await applyRemoteJornadas(data.jornadas ?? []))
      // Salva o cursor a cada página, não só no fim: um pull interrompido no
      // meio (erro de rede na página seguinte, aba fechada) retoma da última
      // página aplicada em vez de repetir tudo desde o início.
      since = data.agora
      await setMeta(CURSOR_KEY, since)
      if (!data.maisDados) break
      if (pagina + 1 >= MAX_PAGINAS_PULL) {
        console.warn('[sync] pull interrompido: teto de páginas atingido', MAX_PAGINAS_PULL)
        break
      }
    }
  } catch (err) {
    // offline/erro transitório: outbox preservado, próxima chance sincroniza
    console.warn('[sync] erro', err)
  } finally {
    // No finally, não depois do loop: precisa disparar tanto no caminho feliz
    // quanto quando o catch acima acabou de engolir um throw (fetch rejeitado
    // por rede instável, por exemplo) — nos dois casos as linhas já aplicadas
    // antes do corte já estão gravadas no cursor e no IndexedDB, então quem
    // está com uma tela aberta precisa saber. Se o aviso disparar antes de uma
    // tela reler, ela já lê o estado final. `totalAplicadas` começa em 0 e só
    // sai do try antes de mexer no pull (sem sessão, push falhou) com esse
    // valor, então dispara no máximo uma vez e só quando algo de fato mudou.
    if (totalAplicadas) notificarSync()
    running = false
  }
}

/**
 * Logout que não deixa rastro sincronizável do usuário anterior. O sign-out vem
 * PRIMEIRO de propósito: se ele falhar (rede fora), o outbox e o cursor ficam
 * intactos e o usuário continua logado — limpar antes destruía escritas ainda
 * não sincronizadas de uma sessão que seguia viva. A marca `sync-user`
 * permanece: é ela que dispara o wipe se outra conta entrar aqui.
 */
export async function signOutLocal(): Promise<void> {
  await authClient.signOut()
  await clearOutboxAll()
  await deleteMeta(CURSOR_KEY)
}

export function initSyncTriggers(): void {
  syncNow()
  window.addEventListener('online', () => syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
  })
  window.setInterval(() => syncNow(), 5 * 60 * 1000)
}
