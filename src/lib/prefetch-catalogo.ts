import { loadIndex } from './content'
import { livroSlug } from './livro-slug'
import { carregarEstudo, carregarTexto, shardCarregado } from './shards'

export type ItemDaFila = { tipo: 'texto' | 'estudo'; slug: string }

/**
 * Ordem do preenchimento: todos os textos antes de qualquer estudo. É o que
 * deixa a busca pronta depois de 4,3 MB em vez dos 13,7 MB do catálogo.
 */
export function filaDePrefetch(slugs: string[]): ItemDaFila[] {
  return [
    ...slugs.map((slug) => ({ tipo: 'texto' as const, slug })),
    ...slugs.map((slug) => ({ tipo: 'estudo' as const, slug })),
  ]
}

let rodando = false
let ouvintesRegistrados = false

// Só para testes: reseta o estado
export function __resetStateForTesting(): void {
  rodando = false
  ouvintesRegistrados = false
}

async function executarFila(): Promise<void> {
  try {
    const slugs = [...new Set((await loadIndex()).map((p) => livroSlug(p.livro)))]
    for (const { tipo, slug } of filaDePrefetch(slugs)) {
      if (shardCarregado(tipo, slug)) continue
      try {
        if (tipo === 'texto') await carregarTexto(slug)
        else await carregarEstudo(slug)
      } catch (err) {
        // Offline no meio da fila é rotina num PWA: para por aqui e a próxima
        // visita retoma de onde o Cache Storage deixou.
        rodando = false
        console.warn('[prefetch] fila interrompida por falha de rede', err)
        return
      }
    }
    rodando = false
  } catch (err) {
    rodando = false
    console.warn('[prefetch] falha ao carregar índice', err)
  }
}

/**
 * Os shards que a fila baixa só chegam ao Cache Storage se o service worker já
 * estiver no controle da página. Na primeira visita ele ainda está instalando
 * (2,27 MB de precache) quando o primeiro momento ocioso chega: sem esperar,
 * a fila iria direto à rede e o download se perderia ao fechar a aba.
 */
async function esperarServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  // Em dev (sem service worker registrado) `ready` nunca resolve: o teto de
  // 10 s garante que a fila rode do mesmo jeito.
  let teto: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      navigator.serviceWorker.ready.catch(() => undefined),
      new Promise((resolve) => {
        teto = setTimeout(resolve, 10_000)
      }),
    ])
  } finally {
    clearTimeout(teto)
  }
}

function registrarOuvintes(): void {
  if (ouvintesRegistrados) return
  if (typeof window === 'undefined') return // Não em ambiente navegador
  ouvintesRegistrados = true

  window.addEventListener('online', () => {
    if (!rodando) iniciarPrefetch()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !rodando) iniciarPrefetch()
  })
}

/**
 * Baixa o catálogo inteiro em segundo plano, um arquivo por vez, para o app
 * voltar a funcionar offline por completo. Começa no primeiro momento ocioso:
 * a renderização inicial tem prioridade.
 */
export function iniciarPrefetch(): void {
  if (rodando) return
  rodando = true
  registrarOuvintes()

  const comecar = () => {
    // Mesmo só ler `navigator.serviceWorker` pode lançar (ex.: SecurityError
    // num iframe sandboxed no Firefox). Sem este catch, a promise rejeitada
    // pula o `.then(executarFila)` e `rodando` fica travado em `true` para
    // sempre — os ouvintes de `online`/`visibilitychange` nunca mais tentam
    // de novo nesta sessão.
    void esperarServiceWorker()
      .then(executarFila)
      .catch((err) => {
        rodando = false
        console.warn('[prefetch] falha ao aguardar o service worker', err)
      })
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(comecar, { timeout: 3000 })
  else setTimeout(comecar, 2000)
}
