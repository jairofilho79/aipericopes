import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SkeletonIndice } from '../components/Skeleton'
import CatalogoLivros from '../components/CatalogoLivros'
import LivroAberto from '../components/LivroAberto'
import ListaPericopes from '../components/ListaPericopes'
// `itemDeIndice`, `itemDeHit` e `ItemPericope` NÃO moram no arquivo do
// componente: exportar função pura ao lado de um componente dispara
// `react(only-export-components)` e quebra o fast refresh. Moram em
// `src/lib/item-pericope.ts`, seguindo o que o repositório já faz com toda
// lógica pura (mesmo movimento de `src/lib/perfil-secoes.ts`, commit d9ced2e).
import { itemDeHit, itemDeIndice, type ItemPericope } from '../lib/item-pericope'
import { bookByName, type BibleBook } from '../lib/bible-books'
import {
  contagemPorLivro,
  filtroDeOrdens,
  findPericopeByRef,
  listPericopes,
  listPericopesByBookChapter,
  loadIndex,
  mesmosStatus,
  progressoPorLivro,
  refLabel,
  statusPorOrdem,
  type FiltroLeitura,
} from '../lib/content'
import { parseConsulta } from '../lib/consulta'
import {
  fatiarResultado,
  indexPronto,
  LIMITE_RESULTADOS,
  MIN_CHARS,
  progressoDoIndice,
  searchTexto,
} from '../lib/fulltext'
import { listAllProgresso } from '../lib/user-db'
import { useSyncRefresh } from '../lib/use-sync-refresh'
import type { PericopeIndex, ProgressoStatus } from '../lib/types'

const FILTROS: { valor: FiltroLeitura; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'nao-lidos', rotulo: 'Não lidos' },
  { valor: 'comecei', rotulo: 'Comecei' },
  { valor: 'lidos', rotulo: 'Lidos' },
]

function ehFiltro(v: string | null): v is FiltroLeitura {
  return v === 'nao-lidos' || v === 'comecei' || v === 'lidos'
}

export default function Explorar() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const f = params.get('f')
  const filtro: FiltroLeitura = ehFiltro(f) ? f : 'todos'
  // Precisa vir ANTES da derivação de `livro`: a exclusão mútua usa o termo
  // APARADO (`consulta.termo`), não o `q` cru — ver comentário abaixo.
  const consulta = useMemo(() => parseConsulta(q), [q])
  const livroParam = params.get('livro') ?? ''
  // Busca e livro aberto são estados EXCLUSIVOS, e a exclusão precisa valer na
  // DERIVAÇÃO, não só nos manipuladores: uma URL que chegue com os dois — link
  // salvo, compartilhado, digitado à mão — não passa por `setQ` nem por
  // `abrirLivro`, e mostraria o painel do livro com a caixa de busca cheia e
  // muda. Entre os dois, a consulta vence: a seção "Livros" do resultado
  // devolve o livro a um toque, e o caminho contrário não existe.
  //
  // `consulta.termo`, não `q`: `q` cru conta um espaço como busca ativa, e
  // `?q=%20&livro=João` suprimiria o livro por causa de um espaço — apagar
  // esse espaço faria o livro reaparecer sem o leitor ter escolhido nada.
  const livro: BibleBook | undefined =
    !consulta.termo && livroParam ? bookByName(livroParam) : undefined
  const capParam = Number(params.get('cap'))
  const cap = livro && Number.isInteger(capParam) && capParam >= 1 ? capParam : null

  const [todas, setTodas] = useState<PericopeIndex[]>([])
  const [status, setStatus] = useState(new Map<number, ProgressoStatus>())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const aceita = useMemo(() => filtroDeOrdens(status, filtro), [status, filtro])
  const concluidas = useMemo(
    () => new Set([...status].filter(([, s]) => s === 'concluido').map(([o]) => o)),
    [status],
  )

  async function carregarProgresso() {
    const proximo = statusPorOrdem(await listAllProgresso())
    // Manter a mesma referência quando o conteúdo não mudou: `status` alimenta
    // `aceita`, que é dependência do efeito de busca no texto — um Map novo a
    // cada sync reiniciaria uma busca em voo sem necessidade.
    setStatus((atual) => (mesmosStatus(atual, proximo) ? atual : proximo))
  }

  useEffect(() => {
    let vivo = true
    // O progresso é opcional para desenhar esta tela: sem ele o catálogo, a
    // referência e os títulos continuam saindo do index.json, e só o ✓, as
    // barras e os recortes ficam zerados. O Pesquisar que esta tela substituiu
    // nem importava user-db, e funcionava com o IndexedDB quebrado — deixar uma
    // falha de progresso derrubar a busca inteira seria regressão.
    Promise.all([loadIndex(), listAllProgresso().catch(() => [])])
      .then(([tudo, prog]) => {
        if (!vivo) return
        setTodas(tudo)
        setStatus(statusPorOrdem(prog))
      })
      .catch(() => {
        if (vivo) setErro('Não foi possível carregar o catálogo.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  // Do sync só o progresso muda: o catálogo é estático e recarregá-lo faria a
  // lista piscar por causa de uma conclusão feita em outro aparelho.
  useSyncRefresh(() => {
    void carregarProgresso().catch(() => {})
  })

  function mexerNaUrl(mudar: (p: URLSearchParams) => void, replace: boolean) {
    const proximo = new URLSearchParams(params)
    mudar(proximo)
    setParams(proximo, { replace })
  }

  // Digitar navega com replace: teclar não pode entulhar o histórico. Mas o
  // `replace` é `!livro`, não sempre `true`: a primeira tecla que fecha um
  // livro aberto (`livro` ainda válido neste render) vira `push` de
  // propósito, para o botão voltar DEVOLVER o livro em vez de pular direto
  // para antes dele ter sido aberto — mesma lógica de `abrirLivro`.
  const setQ = (valor: string) =>
    mexerNaUrl((p) => {
      // Mesma exclusão dos dois lados: apagar o texto também não pode revelar
      // um painel de livro que o leitor nunca escolheu abrir (`?q=amor&livro=
      // João` apagado até vazio não é o mesmo que ter clicado em "João").
      p.delete('livro')
      p.delete('cap')
      if (!valor) {
        p.delete('q')
        return
      }
      p.set('q', valor)
    }, /* replace */ !livro)
  const setFiltro = (valor: FiltroLeitura) =>
    mexerNaUrl((p) => (valor === 'todos' ? p.delete('f') : p.set('f', valor)), false)
  const abrirLivro = (b: BibleBook) => {
    mexerNaUrl((p) => {
      p.set('livro', b.name)
      p.delete('cap')
      // Simétrico ao setQ: abrir um livro fecha a busca.
      p.delete('q')
    }, false)
    // Herdado do `selectBook` de Pesquisar.tsx:149 (main) — a lista de
    // catálogo em repouso ocupa ~4,5 telas, e sem isto abrir um livro do fim
    // (ex. Apocalipse) deixa o leitor no fim da lista antiga, sem ver o
    // cabeçalho do livro nem o formulário de capítulo/versículo.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const fecharLivro = () =>
    mexerNaUrl((p) => {
      p.delete('livro')
      p.delete('cap')
    }, false)
  const setCap = (valor: number | null) =>
    mexerNaUrl((p) => (valor == null ? p.delete('cap') : p.set('cap', String(valor))), false)

  /**
   * Submeter capítulo+versículo no livro aberto tem que FECHAR o livro, não só
   * setar `q`: o render é `livro ? <LivroAberto/> : …`, então deixar `livro` na
   * URL manteria o painel do livro na tela e a seção "Referência" nunca
   * apareceria — o botão não faria nada visível. Sair do livro é aceitável
   * porque a seção "Livros" logo abaixo do resultado traz ele de volta a um
   * toque (`parseConsulta` de uma referência devolve `livros: [livro]`).
   */
  const irParaReferencia = (abbrev: string, cap: number, ver: number) =>
    mexerNaUrl((p) => {
      p.set('q', `${abbrev} ${cap}:${ver}`)
      p.delete('livro')
      p.delete('cap')
    }, false)

  // ---- Seção Referência ----
  // Única seção que NÃO passa por `aceita`: Livros, Títulos e No texto
  // filtram pelo recorte de leitura ativo, mas quem digita uma referência
  // exata ("Jo 3:16") quer aquela perícope específica, não um recorte —
  // filtrar aqui esconderia a perícope certa atrás de "0 resultados" só
  // porque já foi lida. É a única exceção à regra "tudo passa por `aceita`",
  // e é deliberada.
  const [refHit, setRefHit] = useState<PericopeIndex | null>(null)
  const [refMiss, setRefMiss] = useState('')
  useEffect(() => {
    const r = consulta.ref
    if (!r) {
      setRefHit(null)
      setRefMiss('')
      return
    }
    let vivo = true
    void findPericopeByRef(r.livro.abbrev, r.cap, r.ver ?? 1)
      .then((achado) => {
        if (!vivo) return
        setRefHit(achado)
        setRefMiss(achado ? '' : `Nenhuma perícope contém ${r.livro.name} ${r.cap}:${r.ver ?? 1}.`)
      })
      .catch(() => {
        if (!vivo) return
        // Sem isto, uma falha depois de um acerto anterior mostrava a
        // perícope velha E a mensagem de erro juntas.
        setRefHit(null)
        setRefMiss('Não foi possível resolver a referência.')
      })
    return () => {
      vivo = false
    }
  }, [consulta.ref])

  // ---- Seção Títulos ----
  const [titulos, setTitulos] = useState<PericopeIndex[]>([])
  useEffect(() => {
    if (!consulta.termo || consulta.ref) {
      setTitulos([])
      return
    }
    let vivo = true
    void listPericopes({ q: consulta.termo })
      .then((r) => {
        if (vivo) setTitulos(r)
      })
      // `loadIndex` pode falhar (offline na primeira visita); o efeito de
      // carregamento principal já mostra o erro na tela, então aqui só evita
      // vazar uma rejeição não tratada no console.
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [consulta.termo, consulta.ref])

  // ---- Seção No texto ----
  const [resultado, setResultado] = useState<{
    termo: string
    hits: Awaited<ReturnType<typeof searchTexto>>
    truncado: boolean
  }>({ termo: '', hits: [], truncado: false })
  const [buscando, setBuscando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [erroBusca, setErroBusca] = useState(false)
  const [progressoBusca, setProgressoBusca] = useState({ feitos: 0, total: 0 })

  useEffect(() => {
    if (!consulta.buscarNoTexto) {
      setResultado({ termo: '', hits: [], truncado: false })
      setBuscando(false)
      setPreparando(false)
      setErroBusca(false)
      return
    }
    let vivo = true
    setBuscando(true)
    setErroBusca(false)
    setPreparando(!indexPronto())
    // Zera o progresso velho: sem isto, uma indexação que falhou no meio
    // deixava "Preparando busca…" mostrando o valor anterior ("— 40 de 66
    // livros") até o primeiro tique do intervalo abaixo.
    setProgressoBusca({ feitos: 0, total: 0 })
    const termo = consulta.termo
    // Debounce de 300 ms: digitar não pode disparar uma varredura por tecla.
    const timer = window.setTimeout(() => {
      // `+ 1` de propósito: é o item extra que distingue "achou 50" de "achou
      // 50 e tem mais". fatiarResultado descarta ele da lista.
      searchTexto(termo, LIMITE_RESULTADOS + 1, aceita)
        .then((r) => {
          if (vivo) setResultado({ termo, ...fatiarResultado(r, LIMITE_RESULTADOS) })
        })
        .catch(() => {
          if (vivo) {
            setResultado({ termo, hits: [], truncado: false })
            setErroBusca(true)
          }
        })
        .finally(() => {
          if (!vivo) return
          setBuscando(false)
          setPreparando(false)
        })
    }, 300)
    return () => {
      vivo = false
      window.clearTimeout(timer)
    }
  }, [consulta.buscarNoTexto, consulta.termo, aceita])

  // `progressoDoIndice()` é leitura de módulo, não estado de React: sem
  // amostragem periódica a barra congelaria no primeiro render.
  useEffect(() => {
    if (!preparando) return
    const id = window.setInterval(() => setProgressoBusca(progressoDoIndice()), 300)
    return () => window.clearInterval(id)
  }, [preparando])

  // ---- Livro aberto ----
  const [doLivro, setDoLivro] = useState<PericopeIndex[]>([])
  useEffect(() => {
    if (!livro) {
      setDoLivro([])
      return
    }
    let vivo = true
    void listPericopesByBookChapter(livro.abbrev, cap ?? undefined)
      .then((r) => {
        if (vivo) setDoLivro(r)
      })
      // Mesmo motivo do efeito de Títulos: não vazar rejeição não tratada.
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [livro, cap])

  const progresso = useMemo(() => progressoPorLivro(todas, concluidas), [todas, concluidas])
  const contagem = useMemo(() => contagemPorLivro(todas, aceita), [todas, aceita])

  const itensTitulos: ItemPericope[] = useMemo(
    () => titulos.filter((p) => aceita(p.ordem)).map(itemDeIndice),
    [titulos, aceita],
  )
  const titulos50 = useMemo(
    // Mesmo teto da busca no texto: sem ele, `q="a"` monta 2.600 links de uma
    // vez, e a seção barata custaria mais que a cara.
    () => fatiarResultado(itensTitulos, LIMITE_RESULTADOS),
    [itensTitulos],
  )
  const itensTexto: ItemPericope[] = useMemo(
    () => resultado.hits.map((h) => itemDeHit(h, resultado.termo)),
    [resultado],
  )
  const itensLivro: ItemPericope[] = useMemo(
    () => doLivro.filter((p) => aceita(p.ordem)).map(itemDeIndice),
    [doLivro, aceita],
  )

  if (erro) return <p className="muted">{erro}</p>

  const emRepouso = !consulta.termo && !livro

  return (
    <section className="explorar">
      <h1 className="sr-only">Explorar</h1>

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar livro, título, referência ou trecho…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar livro, título, referência ou trecho"
        />
      </div>

      <div className="chips-filtro" role="group" aria-label="Filtrar por leitura">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            className={`chip-filtro${filtro === f.valor ? ' active' : ''}`}
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <SkeletonIndice />
      ) : livro ? (
        <LivroAberto
          livro={livro}
          prog={progresso.get(livro.name)}
          itens={itensLivro}
          concluidas={concluidas}
          filtro={filtro}
          cap={cap}
          onCap={setCap}
          onTrocar={fecharLivro}
          onIrParaVersiculo={(c, v) => irParaReferencia(livro.abbrev, c, v)}
        />
      ) : emRepouso ? (
        <CatalogoLivros
          progresso={progresso}
          contagem={contagem}
          filtro={filtro}
          onAbrir={abrirLivro}
        />
      ) : (
        <>
          {(consulta.ref || consulta.refForaDeFaixa) && (
            <section className="secao-resultado">
              <h2 className="secao-h">Referência</h2>
              {consulta.refForaDeFaixa && <p className="muted">{consulta.refForaDeFaixa.motivo}</p>}
              {refMiss && <p className="muted">{refMiss}</p>}
              {/* Sem `aceita` de propósito — ver comentário no efeito acima
                  que preenche `refHit`. Com `?f=lidos` e uma referência já
                  lida, ela aparece aqui mesmo com o livro zerado em Livros. */}
              {refHit && (
                <ListaPericopes
                  itens={[
                    {
                      ordem: refHit.ordem,
                      titulo: refHit.titulo_pericope_pt,
                      ref: refLabel(refHit),
                      verseId: consulta.ref
                        ? `${consulta.ref.cap}:${consulta.ref.ver ?? 1}`
                        : undefined,
                    },
                  ]}
                  concluidas={concluidas}
                />
              )}
            </section>
          )}

          {/* `consulta.livros` vem de `filterBooks`, que filtra BIBLE_BOOKS sem
              reordenar. `agruparLivros` monta as seções por TRANSIÇÃO, então
              depende dessa ordem: uma lista reordenada produziria duas seções
              com o mesmo nome. Não ordene isto. */}
          {consulta.livros.length > 0 && (
            <section className="secao-resultado">
              <h2 className="secao-h">
                Livros <span className="secao-n">{consulta.livros.length}</span>
              </h2>
              <CatalogoLivros
                livros={consulta.livros}
                progresso={progresso}
                contagem={contagem}
                filtro={filtro}
                onAbrir={abrirLivro}
                nivelTestamento={3}
              />
            </section>
          )}

          {titulos50.hits.length > 0 && (
            <section className="secao-resultado">
              <h2 className="secao-h">
                Títulos{' '}
                <span className="secao-n">
                  {titulos50.hits.length}
                  {titulos50.truncado ? ' (primeiros)' : ''}
                </span>
              </h2>
              <ListaPericopes itens={titulos50.hits} concluidas={concluidas} />
            </section>
          )}

          {consulta.buscarNoTexto && (
            <section className="secao-resultado">
              <h2 className="secao-h">
                No texto{' '}
                {!buscando && !erroBusca && (
                  <span className="secao-n">
                    {itensTexto.length}
                    {resultado.truncado ? ' (primeiros)' : ''}
                  </span>
                )}
              </h2>
              <div aria-live="polite">
                {preparando && (
                  <p className="muted">
                    Preparando busca
                    {progressoBusca.total > 0 &&
                      ` — ${progressoBusca.feitos} de ${progressoBusca.total} livros`}
                    …
                  </p>
                )}
                {!preparando && buscando && <p className="muted">Buscando…</p>}
                {!buscando && erroBusca && (
                  <p className="muted">
                    Não foi possível buscar agora — verifique a conexão e tente de novo.
                  </p>
                )}
                {!buscando && !erroBusca && itensTexto.length === 0 && (
                  <p className="muted">Nenhum resultado no texto.</p>
                )}
              </div>
              <ListaPericopes itens={itensTexto} concluidas={concluidas} />
            </section>
          )}

          {consulta.termo.length > 0 && consulta.termo.length < MIN_CHARS && (
            <p className="muted">Digite ao menos {MIN_CHARS} letras para buscar no texto.</p>
          )}
        </>
      )}
    </section>
  )
}
