import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { tokens, type SecaoAlvos } from '../lib/alinhar-narracao'
import NarracaoPlayer, { IconePlay, type NarracaoPlayerHandle } from '../components/NarracaoPlayer'
import { secaoDoChip } from '../lib/narracao-controles'
import LeituraTopo from '../components/LeituraTopo'
import SectionChips from '../components/SectionChips'
import { SkeletonLeitura } from '../components/Skeleton'
import VerseActions from '../components/VerseActions'
import DitarBotao from '../components/DitarBotao'
import {
  anteriorNoTestamento,
  getPericope,
  loadIndex,
  posicaoNoLivro,
  proximaNoTestamento,
  refLabel,
} from '../lib/content'
import { paragraphize, alvosDaResenha, MAX_PARAGRAFOS } from '../lib/paragraphize'
import { readingMinutes } from '../lib/reading-time'
import { textoSobrescrito } from '../lib/sobrescrito'
import { useWakeLock } from '../lib/use-wake-lock'
import { groupCorrido, parseTexto, type VerseBlock } from '../lib/parse-texto'
import {
  blocoDeRolagem,
  fracaoLida,
  refNoContexto,
  seletorDaPosicao,
} from '../lib/posicao-restauracao'
import { useSwipeNav } from '../lib/use-swipe-nav'
import { useKeyboardNav } from '../lib/use-keyboard-nav'
import { useReadingPrefs } from '../lib/use-reading-prefs'
import {
  clearPosicao,
  concluirProgresso,
  deleteAnotacao,
  desmarcarProgresso,
  destaqueId,
  enqueuePosicao,
  getPosicao,
  getProgresso,
  listAnotacoes,
  listDestaques,
  removeDestaque,
  saveAnotacao,
  setDestaque,
  setParaReler,
  setPosicaoLocal,
  setProgresso,
} from '../lib/user-db'
import { getVerseFocus, setVerseFocus } from '../lib/verse-highlight'
import { nextSelection, parseVerseRef, rangeLabel, rangeRef, verseRefLabel, versesInRange, type VerseSelection } from '../lib/verse-range'
import { promptConversa } from '../lib/contexto-ia'
import { getContextoAberto, setContextoAberto } from '../lib/contexto-collapse'
import { inserirNoCursor, substituirTrecho } from '../lib/ditado'
import type { Anotacao, DestaqueCor, Pericope, Progresso, ProgressoStatus } from '../lib/types'
import { useSyncRefresh } from '../lib/use-sync-refresh'
import { testamentLabel, testamentOf } from '../lib/testament'

type NotesTab = 'anotacoes' | 'topicos' | 'conversar'
type Vizinha = { ordem: number; titulo: string; narrado: boolean }

/**
 * Quebra em palavras só a unidade em fala — o resto da página fica com o nó de
 * texto único de sempre. O espaço entre os spans é um nó de texto real: é o
 * que faz "selecionar e copiar" continuar devolvendo o versículo legível.
 */
function TextoFalado({ texto, ativo }: { texto: string; ativo: boolean }) {
  if (!ativo) return <>{texto}</>
  return (
    <>
      {/* `data-w` tem que numerar exatamente como `tokens()` — é a mesma
          função que produz o campo `palavras` do manifesto (via
          alinhar-narracao.ts), e as duas numerações precisam ser uma só.

          O espaço separador vai DENTRO do span, no fim de cada palavra menos
          a última — e não entre os spans, que é onde ele estaria naturalmente.
          O motivo é o realce: ele é um fundo do span, então espaço fora de
          span é espaço que nenhuma luz alcança, e a luz piscava numa fresta
          escura a cada troca de palavra. Com os spans encostados, a palavra
          que sai encolhe para a direita enquanto a que entra cresce da
          esquerda, as duas metades se tocam na fronteira e o realce vira uma
          faixa contínua que desliza. O texto renderizado é o mesmo. */}
      {tokens(texto).map((tk, k, todos) => (
        <span data-w={k} key={k}>
          {k < todos.length - 1 ? `${tk} ` : tk}
        </span>
      ))}
    </>
  )
}

function inlineBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function TopicsView({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="topics-view">
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return null
        if (/^[-*]\s+/.test(t)) {
          return (
            <p key={i} className="topic-bullet">
              {inlineBold(t.replace(/^[-*]\s+/, ''))}
            </p>
          )
        }
        return (
          <h3 key={i} className="topic-h">
            {inlineBold(t.replace(/^#+\s*/, ''))}
          </h3>
        )
      })}
    </div>
  )
}

/** Cabeçalhos falados do manifesto → os mesmos rótulos dos chips de seção. */
const ROTULO_DO_CABECALHO: Record<string, string> = {
  contexto: 'Contexto',
  texto: 'Texto',
  resenha: 'Resenha',
  // "As palavras do trecho" é seção própria no áudio, mas na tela ela fecha a
  // Resenha — e é a Resenha que o ouvinte vê nos chips.
  palavras: 'Resenha',
  reflexoes: 'Reflexões',
}

/**
 * O que a doca mostra estar tocando agora. Os ids vêm de `alinhar-narracao.ts`
 * e de `paragraphize.ts`, e nenhum deles é legível: esta é a tradução para
 * gente. Nunca devolve vazio — sem alvo alinhado, a referência da perícope já
 * responde "o que estou ouvindo".
 */
function rotuloDoAlvo(p: Pericope, falando: string | null): string {
  if (!falando) return refLabel(p)
  if (falando === 'titulo' || falando === 'referencia') return p.titulo_pericope_pt
  const cabecalho = falando.match(/^cabecalho-(.+)$/)
  if (cabecalho) return ROTULO_DO_CABECALHO[cabecalho[1]!] ?? refLabel(p)
  const capitulo = falando.match(/^cap-(\d+)$/)
  if (capitulo) return `Texto · Capítulo ${capitulo[1]}`
  const versiculo = falando.match(/^(\d+):(\d+)$/)
  if (versiculo) return `Texto · ${p.livro} ${versiculo[1]}:${versiculo[2]}`
  if (falando.startsWith('contexto-')) return 'Contexto'
  if (falando.startsWith('resenha-') || falando.startsWith('palavra-')) return 'Resenha'
  if (falando.startsWith('reflexao-')) return 'Reflexões'
  return refLabel(p)
}

/**
 * Um lado do pager: para onde ir e — quando existe narração lá — a opção de ir
 * OUVINDO, DENTRO do mesmo botão.
 *
 * Dois links, uma caixa: o título abre em silêncio, o play (faixa na ponta)
 * abre com `?ouvir=1` (o mesmo da Home). Separados no DOM porque HTML não
 * aninha `<a>` em `<a>`; juntos no desenho porque play solto ao lado lia como
 * gambiarra.
 *
 * Sem vizinha o lado NÃO desaparece: fica o motivo, desabilitado. O vão vazio
 * ao lado do "próxima" parecia botão que não carregou — e, pior, fazia par com
 * o CTA laranja de cima, como se os dois fossem uma dupla.
 */
function PagerLado({
  v,
  proxima,
  fim,
  primario = false,
}: {
  v: Vizinha | null
  proxima: boolean
  /** Aviso de ponta: "Primeira do Velho Testamento". */
  fim: string
  /** Perícope concluída: o caminho para a frente vira o botão laranja. */
  primario?: boolean
}) {
  const [searchParams] = useSearchParams()
  // ponytail: carrega `de`/`mock` pra o chevron continuar apontando à jornada
  const qsVoltar = [
    searchParams.get('de') === 'jornada' ? 'de=jornada' : '',
    searchParams.has('mock') ? 'mock=1' : '',
  ]
    .filter(Boolean)
    .join('&')
  const comQs = (base: string) => {
    if (!qsVoltar) return base
    return base.includes('?') ? `${base}&${qsVoltar}` : `${base}?${qsVoltar}`
  }

  if (!v) {
    return (
      <button type="button" className="ghost pager-fim" disabled>
        {fim}
      </button>
    )
  }
  const rotulo = proxima ? `${v.titulo} →` : `← ${v.titulo}`
  const ariaNav = `${proxima ? 'Próxima' : 'Anterior'}: ${v.titulo}`
  const tituloAtalho = `Atalho: ${proxima ? '→' : '←'}`
  // Com narração a borda é do `.pager-lado`; sem, o link carrega ghost/cta.
  const chrome = v.narrado ? '' : primario ? ' cta' : ' ghost'
  const linkNav = (
    <Link
      className={`pager-link${proxima ? ' pager-next' : ''}${chrome}`}
      aria-label={ariaNav}
      title={tituloAtalho}
      to={comQs(`/leitura/${v.ordem}`)}
    >
      {rotulo}
    </Link>
  )
  if (!v.narrado) return linkNav
  // Play na borda da direção: antes no "anterior", depois no "próxima".
  const ouvir = (
    <Link
      className="pager-ouvir"
      to={comQs(`/leitura/${v.ordem}?ouvir=1`)}
      aria-label={`Ouvir ${v.titulo}`}
      title="Ouvir"
    >
      <IconePlay />
    </Link>
  )
  return (
    <div
      className={`pager-lado${proxima ? ' pager-lado-proxima' : ''}${primario ? ' pager-lado-primario' : ''}`}
    >
      {proxima ? (
        <>
          {linkNav}
          {ouvir}
        </>
      ) : (
        <>
          {ouvir}
          {linkNav}
        </>
      )}
    </div>
  )
}

export default function Leitura() {
  const { ordem: ordemParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLElement>(null)
  const pagerRef = useRef<HTMLElement>(null)
  const notaRef = useRef<HTMLTextAreaElement>(null)
  const ordem = Number(ordemParam)
  const verseParam = searchParams.get('v')
  const [p, setP] = useState<Pericope | null>(null)
  const [prev, setPrev] = useState<Vizinha | null>(null)
  const [next, setNext] = useState<Vizinha | null>(null)
  // "N de M no livro", para o topo contextual. Anda junto com `p`, não com
  // `ordem`: zerá-lo antes da carga apagaria a posição da perícope que ainda
  // está na tela enquanto a próxima chega.
  const [posNoLivro, setPosNoLivro] = useState<{ n: number; m: number } | null>(null)
  const [status, setStatus] = useState<ProgressoStatus>('nao_iniciado')
  const [prog, setProg] = useState<Progresso | null>(null)
  const [notes, setNotes] = useState<Anotacao[]>([])
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const prefs = useReadingPrefs()
  const [selection, setSelection] = useState<VerseSelection | null>(null)
  const [barOpen, setBarOpen] = useState(false)
  const [destaques, setDestaques] = useState<Map<string, DestaqueCor>>(new Map())
  const [draftRef, setDraftRef] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmarId, setConfirmarId] = useState<string | null>(null)
  const [tab, setTab] = useState<NotesTab>('anotacoes')
  const [copied, setCopied] = useState(false)
  const doneRef = useRef(false)
  // Espelha `p` para o listener de rolagem: evita reinscrever o `scroll` a
  // cada troca de skeleton → conteúdo (ver efeito de salvar posição abaixo).
  const pRef = useRef<Pericope | null>(null)
  // Último valor de `?v=` já rolado até — evita re-centralizar a cada toque
  // em versículo (ver efeito abaixo).
  const vAplicado = useRef<string | null>(null)
  // Handle do player: os chips de seção mandam o áudio para o cabeçalho falado.
  const playerRef = useRef<NarracaoPlayerHandle>(null)
  const [falando, setFalando] = useState<string | null>(null)
  const [contextoAberto, setContextoAbertoState] = useState(() => getContextoAberto())
  // Estado do controle compacto de narração no header: `narracaoUsada` mantém
  // o botão visível depois do primeiro play (pausou? o botão vira "continuar").
  const [tocandoNarracao, setTocandoNarracao] = useState(false)
  const [narracaoUsada, setNarracaoUsada] = useState(false)
  // Checkpoint de narração restaurado: o player posiciona o áudio aqui e o
  // play do usuário retoma do ponto salvo.
  const [tempoInicialNarracao, setTempoInicialNarracao] = useState<number | null>(null)
  // De QUAL perícope o checkpoint já foi lido do IndexedDB (com ou sem
  // resultado). O autoplay do `?ouvir=1` espera por isto: soltá-lo antes faria
  // o áudio começar do zero e saltar para o ponto salvo um instante depois.
  //
  // A ordem, e não um booleano: o `?ouvir=1` agora também chega do pager, ou
  // seja, de uma perícope para outra sem desmontar a página. Nesse caminho o
  // render seguinte ao clique já vê `ouvir=1` com o booleano ainda VERDADEIRO
  // da perícope anterior (quem o zera é o efeito de carga, que só roda depois)
  // — e o autoplay saía no áudio velho, gastando a única tentativa e limpando
  // a URL antes de o novo áudio existir. Comparar com `ordem` fecha essa
  // janela sem depender de ordem de efeitos.
  const [posicaoResolvida, setPosicaoResolvida] = useState<number | null>(null)
  // Espelhos para handlers que não podem renascer a cada render.
  const tocandoRef = useRef(false)
  // A rolagem automática da restauração dispara o observer de seções — a
  // janela de supressão impede que esse eco vire um checkpoint mais grosso
  // por cima do fino que acabou de ser restaurado.
  const supressaoSecaoAte = useRef(0)
  // Barra de progresso do header: pintada direto no DOM (CSS var), sem
  // setState — um render de página inteira por evento de scroll seria caro.
  const barraRef = useRef<HTMLDivElement>(null)

  // Memoizado: o parser roda uma vez por perícope, não a cada render — e os
  // handlers de seleção precisam dos blocos antes dos returns antecipados.
  const blocks = useMemo(() => (p ? parseTexto(p.texto) : []), [p])
  const selecionados = useMemo(
    () => (selection ? versesInRange(blocks, selection.start, selection.end) : []),
    [blocks, selection],
  )
  const primeiroCapitulo = useMemo(
    () => blocks.find((b) => b.kind === 'chapter'),
    [blocks],
  )
  const gruposCorrido = useMemo(
    () => (prefs.layout === 'corrido' ? groupCorrido(blocks) : []),
    [prefs.layout, blocks],
  )
  const primeiroGrupoComCapitulo = useMemo(
    () => gruposCorrido.find((g) => g.label !== null),
    [gruposCorrido],
  )
  // Só o texto bíblico entra na conta: contexto, resenha e reflexão são
  // leitura de primeira classe, mas o "~N min" é do texto da NAA.
  const minutos = useMemo(() => (p ? readingMinutes(p.texto) : 1), [p])
  // Os MESMOS parágrafos que a página mostra (paragraphize com os mesmos
  // limites) alimentam os alvos de alinhamento da narração das seções em
  // prosa.
  const parasContexto = useMemo(
    () => (p ? paragraphize(p.contexto_historico_literario, { maxParas: MAX_PARAGRAFOS.contexto }) : []),
    [p],
  )
  // A narração funde "Capítulo N." com o sobrescrito numa frase só e fecha
  // com ponto (o campo do catálogo não tem). O <TextoFalado> do sobrescrito e
  // o alvo de alinhamento abaixo usam ESTE texto — nunca `p.sobrescrito` cru —
  // para tela e áudio dizerem a mesma coisa. Ver `sobrescrito.ts`.
  const sobrescritoFalado = useMemo(
    () => (p?.sobrescrito ? textoSobrescrito(p.sobrescrito) : undefined),
    [p],
  )
  // A resenha alimenta DUAS seções: a prosa e as palavras do trecho. Na tela a
  // lista se distingue pela cor; no áudio não há cor, então ela é seção própria,
  // com cabeçalho falado. Os mesmos arrays daqui viram os alvos de alinhamento.
  const resenhaAlvos = useMemo(
    () => (p ? alvosDaResenha(p.resenha) : { prosa: [], palavras: [] }),
    [p],
  )
  // Os mesmos arrays que a página renderiza viram os alvos do alinhamento —
  // é isso que garante que o realce valide o que o olho vê.
  const secoesNarracao = useMemo<SecaoAlvos[]>(
    () => [
      { secao: 'contexto', alvos: parasContexto.map((t, i) => ({ id: `contexto-${i}`, texto: t })) },
      {
        secao: 'texto',
        // O sobrescrito é falado ANTES do versículo 1 (fundido com "Capítulo
        // N."), então entra como 1º alvo da seção — sem ele, o fluxo de
        // tokens do manifesto não bate com a tela e a seção inteira perde o
        // realce (Salmos 102 e as outras 119 perícopes com sobrescrito).
        alvos: [
          ...(sobrescritoFalado ? [{ id: 'sobrescrito', texto: sobrescritoFalado }] : []),
          ...blocks.filter((b): b is VerseBlock => b.kind === 'verse').map((b) => ({ id: b.id, texto: b.text })),
        ],
      },
      { secao: 'resenha', alvos: resenhaAlvos.prosa },
      { secao: 'palavras', alvos: resenhaAlvos.palavras },
      {
        secao: 'reflexoes',
        alvos: (p?.perguntas_reflexao ?? []).map((q, i) => ({ id: `reflexao-${i}`, texto: q })),
      },
    ],
    [parasContexto, blocks, resenhaAlvos, p, sobrescritoFalado],
  )

  async function refreshNotes() {
    setNotes(await listAnotacoes(ordem))
  }

  // Refresh estreito para o aviso de sync: mexe só no que vem do sync
  // (destaques, notas, status, pin e histórico) e não encosta em rascunho,
  // seleção nem barra de ações. O efeito grande de troca de perícope reseta
  // tudo isso — usá-lo aqui apagaria a anotação que o usuário está digitando
  // neste instante.
  useSyncRefresh(() => {
    void (async () => {
      try {
        const hl = await listDestaques(ordem)
        setDestaques(new Map(hl.map((d) => [d.verseId, d.cor])))
        // O IndexedDB já é a palavra final: o LWW resolveu quem ganhou antes
        // de o aviso sair.
        const prog = await getProgresso(ordem)
        setProg(prog ?? null)
        // status deriva do mesmo `prog` lido acima — badge e pin não podem
        // discordar sobre a mesma linha.
        const proximo = prog?.status ?? 'em_andamento'
        setStatus(proximo === 'nao_iniciado' ? 'em_andamento' : proximo)
        doneRef.current = proximo === 'concluido'
        await refreshNotes()
      } catch (e) {
        // Tropeço aqui é transitório e a próxima rodada de sync tenta de novo:
        // não vale trocar uma tela que funciona por um estado de erro.
        console.warn('[leitura] refresh pós-sync falhou', e)
      }
    })()
  })

  useEffect(() => {
    ;(async () => {
      doneRef.current = false
      // Ids de versículo são relativos ("cap:vers"): o mesmo `?v=` pode
      // valer para outra perícope, então a marca de "já rolei" não atravessa
      // a troca de perícope.
      vAplicado.current = null
      // Checkpoint e controle de narração também são por perícope.
      setTempoInicialNarracao(null)
      setPosicaoResolvida(null)
      setNarracaoUsada(false)
      try {
        const all = await loadIndex()
        const peri = await getPericope(ordem)
        if (!peri) {
          setErr('Perícope não encontrada')
          return
        }
        setP(peri)
        // Mesmo `all` que já serve prev/next: a posição no livro é uma conta
        // sobre o índice em memória, não um fetch novo.
        setPosNoLivro(posicaoNoLivro(all, peri.livro, ordem))
        const vizinha = (o: number | null): Vizinha | null => {
          if (o == null) return null
          const v = all.find((x) => x.ordem === o)
          return v ? { ordem: v.ordem, titulo: v.titulo_pericope_pt, narrado: v.narrado } : null
        }
        setPrev(vizinha(anteriorNoTestamento(all, ordem)))
        setNext(vizinha(proximaNoTestamento(all, ordem)))
        setCopied(false)
        // Rascunho, edição e confirmação zeram por TROCA DE PERÍCOPE, não por
        // mudança de `?v=`: navegar pelo chip de vínculo de uma anotação é
        // movimento dentro da mesma perícope e não pode apagar o que a pessoa
        // está escrevendo. Quem cuida do `?v=` é o efeito logo abaixo.
        setDraftRef(null)
        setEditingId(null)
        setConfirmarId(null)
        setDraft('')
        const hl = await listDestaques(ordem)
        setDestaques(new Map(hl.map((d) => [d.verseId, d.cor])))
        const prog = await getProgresso(ordem)
        setProg(prog ?? null)
        const next = prog?.status ?? 'em_andamento'
        setStatus(next === 'nao_iniciado' ? 'em_andamento' : next)
        if (prog?.status === 'concluido') doneRef.current = true
        if (!prog || prog.status === 'nao_iniciado') {
          await setProgresso(ordem, 'em_andamento')
        }
        await refreshNotes()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro')
      }
    })()
  }, [ordem])

  // Foco do versículo: `?v=` na URL, senão o foco salvo da perícope. Fica
  // separado da carga acima porque muda muito mais vezes que a perícope — e
  // porque é síncrono: a carga é `async`, e se ela também mexesse em
  // `selection` sobrescreveria o que este efeito acabou de decidir.
  useEffect(() => {
    const fromQuery = verseParam && /^\d+:\d+$/.test(verseParam) ? verseParam : null
    const focus = fromQuery ?? getVerseFocus(ordem)
    // Restaurar foco seleciona só aquele versículo e NÃO abre a barra:
    // a barra é resposta a toque, não a navegação.
    setSelection(focus ? { start: focus, end: focus } : null)
    setBarOpen(false)
    if (fromQuery) setVerseFocus(ordem, fromQuery)
  }, [ordem, verseParam])

  // Prioridade de rolagem ao abrir: ?v= na URL > checkpoint salvo > topo.
  // O checkpoint ancora num ELEMENTO (seção/versículo/alvo de narração), não
  // em pixels: sobrevive a troca de fonte, de layout e de aparelho — é o que
  // permite sincronizá-lo.
  useEffect(() => {
    if (!p || p.ordem !== ordem) return
    if (verseParam && /^\d+:\d+$/.test(verseParam)) {
      // `?v=` manda na rolagem e não há checkpoint a esperar aqui.
      setPosicaoResolvida(ordem)
      return
    }
    let vivo = true
    void (async () => {
      const pos = await getPosicao(ordem)
      if (!vivo) return
      // Nos dois setters juntos: o React comita o tempo inicial e a liberação
      // do autoplay no mesmo render, então o player nunca vê um sem o outro.
      if (pos?.tipo === 'narracao') setTempoInicialNarracao(pos.tempo)
      setPosicaoResolvida(ordem)
      if (!pos) {
        window.scrollTo(0, 0)
        return
      }
      // Direto nos setters (idempotentes e estáveis) em vez de abrirContexto():
      // a função nasce de novo a cada render e entraria nas dependências.
      if (refNoContexto(pos.ref)) {
        setContextoAbertoState(true)
        setContextoAberto(true)
      }
      // A rolagem vai disparar o observer de seções: sem a supressão, o eco
      // gravaria um checkpoint de seção por cima do fino recém-restaurado.
      supressaoSecaoAte.current = Date.now() + 2500
      // Um quadro de espera: se o Contexto acabou de abrir, o alvo ainda não
      // tem caixa de layout neste commit.
      requestAnimationFrame(() => {
        if (!vivo) return
        const el = document.querySelector<HTMLElement>(seletorDaPosicao(pos))
        if (!el) return
        el.scrollIntoView({ block: blocoDeRolagem(pos), behavior: 'auto' })
        // Leve destaque de "você parou aqui": a animação CSS morre sozinha,
        // a classe sai depois para o próximo retorno poder pulsar de novo.
        el.classList.add('retomada-flash')
        window.setTimeout(() => el.classList.remove('retomada-flash'), 2100)
      })
    })()
    return () => {
      vivo = false
    }
  }, [ordem, p, verseParam])

  useEffect(() => {
    if (!selection || !p) return
    if (!(verseParam && /^\d+:\d+$/.test(verseParam))) return
    // Só rola uma vez por valor de `?v=`: sem isso, cada toque em versículo
    // muda `selection` e o efeito re-centraliza a tela no ?v= original.
    if (vAplicado.current === verseParam) return
    const el = document.querySelector('.verse-focus')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    vAplicado.current = verseParam
  }, [selection, p, verseParam])

  useEffect(() => {
    pRef.current = p
  }, [p])

  // Barra de progresso do header: pinta a fração rolada direto na CSS var do
  // filete, um quadro por rajada de scroll (rAF), sem passar pelo React.
  // Enquanto a narração toca, quem manda na barra é o áudio (onProgresso).
  useEffect(() => {
    let quadro = 0
    const pintar = () => {
      quadro = 0
      if (tocandoRef.current) return
      const el = barraRef.current
      if (!el) return
      const fracao = fracaoLida(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      )
      el.style.setProperty('--pct-lida', `${fracao * 100}%`)
      el.setAttribute('aria-valuenow', String(Math.round(fracao * 100)))
    }
    const onScroll = () => {
      if (!quadro) quadro = requestAnimationFrame(pintar)
    }
    pintar()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', onScroll)
    }
    // `p` nas dependências: a fração inicial só está certa depois que o
    // conteúdo real deu altura à página (no skeleton ela seria 1).
  }, [ordem, p])

  const pintarBarra = useCallback((fracao: number) => {
    const el = barraRef.current
    if (!el) return
    el.style.setProperty('--pct-lida', `${fracao * 100}%`)
    el.setAttribute('aria-valuenow', String(Math.round(fracao * 100)))
  }, [])

  // ——— Checkpoint de leitura: eventos discretos, o último vence ———

  // 1/3 — a seção em leitura mudou (observer dos chips). Não grava com a
  // narração tocando (o alvo narrado é mais fino e já grava) nem no eco da
  // rolagem de restauração.
  const salvarSecaoAtiva = useCallback(
    (id: string) => {
      if (doneRef.current || !pRef.current) return
      if (tocandoRef.current) return
      if (Date.now() < supressaoSecaoAte.current) return
      void setPosicaoLocal(ordem, 'secao', id)
    },
    [ordem],
  )

  // 2/3 — o item narrado mudou: alvo + relógio do áudio, para o play seguinte
  // retomar do ponto. (O 3/3, versículo tocado, mora em selectVerse.)
  useEffect(() => {
    if (!falando || doneRef.current) return
    void setPosicaoLocal(ordem, 'narracao', falando, playerRef.current?.tempoAtual() ?? null)
  }, [falando, ordem])

  // O outbox só recebe o checkpoint ao SAIR (aba escondida, pagehide, troca
  // de rota/perícope) — uma linha por perícope, upsert idempotente. É a
  // exceção deliberada ao "linha + outbox juntos" das outras entidades: os
  // eventos acima são frequentes demais para encher o outbox.
  useEffect(() => {
    const subir = () => void enqueuePosicao(ordem)
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden') subir()
    }
    document.addEventListener('visibilitychange', aoEsconder)
    window.addEventListener('pagehide', subir)
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder)
      window.removeEventListener('pagehide', subir)
      subir()
    }
  }, [ordem])

  const onTocandoNarracao = useCallback(
    (tocando: boolean) => {
      tocandoRef.current = tocando
      setTocandoNarracao(tocando)
      if (tocando) {
        setNarracaoUsada(true)
      } else {
        // pausou: a barra volta a mostrar o scroll sem esperar o próximo gesto
        pintarBarra(
          fracaoLida(window.scrollY, window.innerHeight, document.documentElement.scrollHeight),
        )
      }
    },
    [pintarBarra],
  )

  const onProgressoNarracao = useCallback(
    (fracao: number) => {
      pintarBarra(fracao)
    },
    [pintarBarra],
  )

  // `?ouvir=1` é o botão "Ouvir" da Home: intenção de UMA vez. Sai da URL na
  // tentativa (deu certo ou não), senão recarregar a página ou voltar pelo
  // histórico faria a perícope tocar sozinha de novo. `replace` para o
  // histórico não ganhar uma entrada por causa disto.
  const querOuvir = searchParams.get('ouvir') === '1'
  const limparOuvir = useCallback(() => {
    setSearchParams(
      (atuais) => {
        const proximos = new URLSearchParams(atuais)
        proximos.delete('ouvir')
        return proximos
      },
      { replace: true },
    )
  }, [setSearchParams])

  const irAnterior = useCallback(() => {
    if (!prev) return
    const qs = [
      searchParams.get('de') === 'jornada' ? 'de=jornada' : '',
      searchParams.has('mock') ? 'mock=1' : '',
    ]
      .filter(Boolean)
      .join('&')
    navigate(`/leitura/${prev.ordem}${qs ? `?${qs}` : ''}`)
  }, [navigate, prev, searchParams])

  const irProxima = useCallback(() => {
    if (!next) return
    const qs = [
      searchParams.get('de') === 'jornada' ? 'de=jornada' : '',
      searchParams.has('mock') ? 'mock=1' : '',
    ]
      .filter(Boolean)
      .join('&')
    navigate(`/leitura/${next.ordem}${qs ? `?${qs}` : ''}`)
  }, [navigate, next, searchParams])

  useSwipeNav(rootRef, { onPrev: irAnterior, onNext: irProxima, enabled: p !== null })
  useKeyboardNav({ onPrev: irAnterior, onNext: irProxima, enabled: p !== null })

  // Ler é o caso de uso: com a perícope aberta a tela fica acesa, sem toggle.
  useWakeLock(p !== null)

  // Realçar parágrafo escondido não serve para nada: se o contexto entra em
  // fala com a seção colapsada, ela abre.
  useEffect(() => {
    // O cabeçalho falado ("Contexto.") conta como entrar em fala: abrir aí
    // dá à seção o tempo do cabeçalho para ganhar caixa antes do 1º parágrafo.
    const emContexto = falando?.startsWith('contexto-') || falando === 'cabecalho-contexto'
    if (emContexto && !contextoAberto) {
      setContextoAbertoState(true)
      setContextoAberto(true)
    }
  }, [falando, contextoAberto])

  // Rolagem automática cede à mão do usuário: qualquer rolagem que não veio
  // do scrollIntoView suspende o acompanhamento por 10s. NUNCA escutar
  // `scroll` aqui — o próprio scrollIntoView o dispara e desligaria o
  // acompanhamento para sempre no primeiro realce.
  const cedeuAte = useRef(0)

  // A intenção do seek é mais recente que a de uma rolagem anterior: arrastar
  // a barra do player para ouvir um trecho vence a suspensão que uma rolagem
  // manual tenha armado.
  const onSeekNarracao = useCallback(() => {
    cedeuAte.current = 0
  }, [])

  useEffect(() => {
    // Sem exceção para gestos que nascem no player: o `target` de um
    // `touchmove` fica fixado no elemento do `touchstart`, então ignorar o que
    // vem de `.narracao` também ignoraria uma rolagem de página inteira cujo
    // dedo apenas pousou sobre ele — e a tela voltaria a ser puxada debaixo da
    // mão do leitor. Arrastar a barra do player já é resolvido pelo `onSeek`,
    // que zera a suspensão quando o seek termina.
    const ceder = () => {
      cedeuAte.current = Date.now() + 10_000
    }
    const tecla = (e: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) ceder()
    }
    window.addEventListener('wheel', ceder, { passive: true })
    window.addEventListener('touchmove', ceder, { passive: true })
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('wheel', ceder)
      window.removeEventListener('touchmove', ceder)
      window.removeEventListener('keydown', tecla)
    }
  }, [])

  useEffect(() => {
    // Ouvir continua, mas a rolagem cede quando o leitor está interagindo:
    // barra de ações aberta, nota em edição ou vínculo de versículo pendente
    // são sinais de que a tela não pode ser puxada de baixo dos dedos dele.
    if (!falando || barOpen || editingId || draftRef) return
    if (Date.now() < cedeuAte.current) return
    // Títulos em fala carregam `data-fala-id`, não `data-verse-id`: esse
    // atributo é das unidades de texto realçáveis (versículo, parágrafo,
    // pergunta), e um <h1> não é uma delas.
    const el = document.querySelector<HTMLElement>(
      `[data-verse-id="${falando}"], [data-fala-id="${falando}"]`,
    )
    if (!el) return
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    el.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' })
    // `contextoAberto` entra aqui porque o efeito que abre a seção Contexto
    // ao entrar em fala roda no mesmo commit, mas o DOM só ganha caixa de
    // layout no render seguinte: sem esta dependência, o scrollIntoView de
    // cima teria rodado cedo demais e não rodaria de novo.
  }, [falando, barOpen, editingId, draftRef, contextoAberto])

  async function onSaveNote(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    try {
      await saveAnotacao(ordem, draft.trim(), editingId ?? undefined, draftRef)
      setDraft('')
      setDraftRef(null)
      setEditingId(null)
      await refreshNotes()
    } catch {
      flashAviso('Não foi possível salvar agora')
    }
  }

  /**
   * O texto ditado entra onde o cursor estava (ou no lugar da seleção), e o
   * foco volta pro textarea com o cursor logo depois — a pessoa revisa e
   * salva como sempre; nada é gravado sozinho. Lê `el.value` em vez de
   * `draft`: a transcrição chega segundos depois do render que criou este
   * callback, e o valor do elemento é sempre o atual.
   */
  function inserirDitado(trecho: string) {
    const el = notaRef.current
    const atual = el?.value ?? draft
    const inicio = el?.selectionStart ?? atual.length
    const fim = el?.selectionEnd ?? atual.length
    const { texto, cursor } = inserirNoCursor(atual, inicio, fim, trecho)
    setDraft(texto)
    // Depois do commit do React, senão o setSelectionRange cai no valor velho.
    window.setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    }, 0)
  }

  /**
   * A revisão por IA chega segundos depois do ditado: troca o trecho que
   * entrou (do fim para o começo, que é onde ele está) pela versão revisada.
   * Se a pessoa já mexeu nele, não está mais lá e nada acontece.
   */
  function aplicarRevisao(original: string, revisado: string) {
    const el = notaRef.current
    const r = substituirTrecho(el?.value ?? draft, original, revisado)
    if (!r) return
    setDraft(r.texto)
    window.setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(r.cursor, r.cursor)
    }, 0)
  }

  function editarNota(n: Anotacao) {
    setEditingId(n.id)
    setDraft(n.texto)
    setDraftRef(n.verseRef ?? null)
    setConfirmarId(null)
    setTab('anotacoes')
  }

  function cancelarEdicao() {
    setEditingId(null)
    setDraft('')
    setDraftRef(null)
  }

  async function apagarNota(id: string) {
    try {
      await deleteAnotacao(id)
      setConfirmarId(null)
      if (editingId === id) cancelarEdicao()
      await refreshNotes()
    } catch {
      flashAviso('Não foi possível salvar agora')
    }
  }

  async function markDone() {
    await concluirProgresso(ordem)
    // Concluiu: o checkpoint morre (com lápide — sem ela o pull ressuscitaria)
    // e a próxima abertura começa do topo, como sempre foi.
    await clearPosicao(ordem)
    doneRef.current = true
    setStatus('concluido')
    setProg((await getProgresso(ordem)) ?? null)
    // O "próxima" do pager vira o CTA laranja agora — sem rolar, em celular ele
    // fica abaixo da dobra e a pessoa conclui sem achar por onde continuar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pagerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    })
  }

  async function desmarcar() {
    await desmarcarProgresso(ordem)
    doneRef.current = false
    setStatus('em_andamento')
    setProg((await getProgresso(ordem)) ?? null)
  }

  // Pin não-destrutivo: liga/desliga sem tocar em status nem histórico —
  // ao contrário de desmarcar, a jornada não regride.
  async function alternarReler() {
    await setParaReler(ordem, !prog?.paraReler)
    setProg((await getProgresso(ordem)) ?? null)
  }

  function selectVerse(id: string) {
    const prox = nextSelection(blocks, selection, id)
    setSelection(prox)
    setBarOpen(prox !== null)
    const verses = prox ? versesInRange(blocks, prox.start, prox.end) : []
    // "versículo em leitura" persistido continua sendo o PRIMEIRO da seleção.
    setVerseFocus(ordem, verses[0]?.id ?? null)
    // 3/3 do checkpoint: tocar num versículo é o gesto mais explícito de
    // "estou aqui" — só a seleção limpa não grava (fechar a barra não é mover-se).
    if (!doneRef.current && verses[0]) void setPosicaoLocal(ordem, 'versiculo', verses[0].id)
  }

  function flashAviso(msg: string) {
    setAviso(msg)
    window.setTimeout(() => setAviso(''), 1600)
  }

  function citacaoSelecao(): string {
    if (!p) return ''
    return `"${selecionados.map((v) => v.text).join(' ')}" (${rangeLabel(p, selecionados)}, NAA)`
  }

  async function copiarSelecao() {
    try {
      await navigator.clipboard.writeText(citacaoSelecao())
      flashAviso('Copiado ✓')
    } catch {
      flashAviso('Não foi possível copiar')
    }
  }

  async function compartilharSelecao() {
    if (navigator.share) {
      try {
        await navigator.share({ text: citacaoSelecao() })
        return
      } catch (e) {
        // cancelar o share nativo não é erro: some em silêncio
        if (e instanceof Error && e.name === 'AbortError') return
      }
    }
    await copiarSelecao()
  }

  async function destacarSelecao(cor: DestaqueCor) {
    try {
      const proximos = new Map(destaques)
      for (const v of selecionados) {
        // Belt-and-suspenders: setDestaque já recusa ids fora do formato
        // "capitulo:versiculo", mas filtrar aqui evita que o Map de estado da UI
        // registre uma cor para um versículo que nunca foi de fato gravado.
        if (!/^\d+:\d+$/.test(v.id)) continue
        await setDestaque(ordem, v.id, cor)
        proximos.set(v.id, cor)
      }
      setDestaques(proximos)
    } catch {
      flashAviso('Não foi possível salvar agora')
    }
  }

  async function removerDestaqueSelecao() {
    try {
      const proximos = new Map(destaques)
      for (const v of selecionados) {
        if (!/^\d+:\d+$/.test(v.id)) continue
        await removeDestaque(destaqueId(ordem, v.id))
        proximos.delete(v.id)
      }
      setDestaques(proximos)
    } catch {
      flashAviso('Não foi possível salvar agora')
    }
  }

  function anotarSelecao() {
    setTab('anotacoes')
    setEditingId(null)
    setConfirmarId(null)
    setDraft('')
    setDraftRef(rangeRef(selecionados))
    setBarOpen(false)
    window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('.note-form textarea')
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus()
    }, 0)
  }

  function fecharBarra() {
    setBarOpen(false)
  }

  function alternarContexto() {
    const proximo = !contextoAberto
    setContextoAbertoState(proximo)
    setContextoAberto(proximo)
  }

  function abrirContexto() {
    if (contextoAberto) return
    setContextoAbertoState(true)
    setContextoAberto(true)
  }

  async function copyContexto() {
    if (!p) return
    await navigator.clipboard.writeText(promptConversa(p))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  // As duas saídas antecipadas montam o topo também. O header do App não
  // renderiza em /leitura/*, então sem ele um link velho (`/leitura/999999`) ou
  // uma falha de rede na primeira carga deixariam a página sem saída nenhuma
  // além do botão voltar do navegador — que num PWA standalone nem aparece.
  // Sem perícope na tela o topo não afirma livro nem posição: `p` pode ainda
  // guardar a perícope ANTERIOR (a carga não a limpa ao trocar de `ordem`), e
  // "1 de 45" de uma perícope que não está sendo lida é pior que nada.
  // O esqueleto não pede offset: `.top` é sticky e segue ocupando lugar no
  // fluxo, então o conteúdo continua começando embaixo dele.
  if (err)
    return (
      <>
        <LeituraTopo livro={null} posicao={null} />
        <p className="muted">{err}</p>
      </>
    )
  if (!p)
    return (
      <>
        <LeituraTopo livro={null} posicao={null} />
        <SkeletonLeitura />
      </>
    )

  const selecionadosIds = new Set(selecionados.map((v) => v.id))
  // Cor "atual" da seleção para os swatches (aria-pressed): só quando TODOS os
  // versículos selecionados compartilham a mesma cor — misto ou sem destaque
  // vira null, e nenhum swatch aparece marcado.
  const coresSelecionadas = new Set(selecionados.map((v) => destaques.get(v.id) ?? null))
  const corAtual: DestaqueCor | null =
    coresSelecionadas.size === 1 ? [...coresSelecionadas][0] : null

  function falaClass(base: string, id: string): string {
    if (falando !== id) return base
    return base ? `${base} prose-speaking` : 'prose-speaking'
  }

  // Títulos e subtítulos também são narrados ("Contexto.", "Capítulo 1."):
  // ganham um realce mais leve que o da unidade — a candeia passa por eles,
  // não para neles.
  function tituloClass(base: string, id: string): string {
    if (falando !== id) return base
    return base ? `${base} heading-speaking` : 'heading-speaking'
  }

  function verseClass(base: string, id: string): string {
    const cor = destaques.get(id)
    const foco = selecionadosIds.has(id) ? ' verse-focus' : ''
    const fala = falando === id ? ' verse-speaking' : ''
    return `${base}${foco}${fala}${cor ? ` verse-hl-${cor}` : ''}`
  }

  function verseAria(b: VerseBlock): string {
    if (!b.verse) return b.text.slice(0, 40)
    const cor = destaques.get(b.id)
    const marcas = [
      selecionadosIds.has(b.id) ? 'selecionado' : '',
      cor ? `destacado em ${cor}` : '',
    ]
      .filter(Boolean)
      .join(', ')
    return `Versículo ${b.chapter}:${b.verse}${marcas ? `, ${marcas}` : ''}`
  }

  const sobrescritoEl = p?.sobrescrito && sobrescritoFalado ? (
    /*
     * Sobrescrito do salmo: epígrafe fora da numeração que vem entre o
     * cabeçalho do capítulo ("Capítulo N.") e o versículo 1, na ordem falada
     * da narração ("Texto", "Capítulo 102", "Oração do aflito...", versículos).
     */
    <p
      className={falaClass('sobrescrito', 'sobrescrito')}
      data-fala-id="sobrescrito"
      data-verse-id="sobrescrito"
    >
      <TextoFalado texto={sobrescritoFalado} ativo={falando === 'sobrescrito'} />
    </p>
  ) : null

  return (
    // Fragmento, e não um filho do <article>: `LeituraTopo` é o `.top` desta
    // página (o header do App não renderiza em /leitura/*), e ele precisa do
    // MESMO bloco contentor que o header do App tinha para continuar sendo o
    // que era. Como irmão do <article>, o pai é `<main className="main">`,
    // cuja caixa de conteúdo é a mesma de `.shell` — então o full-bleed de
    // `.top` (`width: 100vw; margin-inline: calc(50% - 50vw)`) cai onde
    // sempre caiu, e o `position: sticky` vale pela página inteira.
    //
    // Dentro do <article> as duas coisas quebrariam: `.leitura` é a coluna de
    // papel (`max-width: var(--read-measure)`, padding próprio), então o
    // `calc(50% - 50vw)` mediria a partir de uma caixa estreita e descentrada,
    // e o sticky ficaria preso ao retângulo do artigo.
    <>
      <LeituraTopo livro={p.livro} posicao={posNoLivro} />
      {/* `narracao-ativa` só existe para o CSS reservar, no fim do artigo, a
          folga da altura da doca: sem ela a doca cobriria as últimas perguntas
          de reflexão. */}
      <article
        className={narracaoUsada ? 'leitura narracao-ativa' : 'leitura'}
        ref={rootRef}
      >
        <h1 className={tituloClass('', 'titulo') || undefined} data-fala-id="titulo">
          {p.titulo_pericope_pt}
        </h1>
        <div className="ref-row">
          {/* A referência também é falada ("Mateus, capítulo 1, versículos 1 a
              17.") logo depois do título: acende na sua vez, como o <h1>. */}
          <p className={tituloClass('ref', 'referencia')} data-fala-id="referencia">
            {refLabel(p)} · <span className="ref-min">~{minutos} min</span>
          </p>
        </div>

        <SectionChips
          ordem={p.ordem}
          onIr={(id) => {
            if (id === 'contexto') abrirContexto()
            // O chip rola a tela até a seção; com narração, o áudio vai junto
            // para o cabeçalho falado dela. O `seeked` que resulta zera a
            // suspensão de rolagem, então o acompanhamento volta a valer.
            const secao = secaoDoChip(id)
            if (secao) playerRef.current?.irParaSecao(secao)
          }}
          onSecaoAtiva={salvarSecaoAtiva}
          progresso={
            <div
              ref={barraRef}
              className="leitura-progresso"
              role="progressbar"
              aria-label={tocandoNarracao ? 'Progresso da narração' : 'Progresso da perícope'}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          }
        />

        {/* Este ponto do artigo é a casa do cartão "Ouvir esta perícope" (e
            dos três estados de indisponibilidade). A doca que o substitui
            depois do primeiro play é `position: fixed` e sai do fluxo daqui —
            nenhum ancestral cria bloco contentor, então ela mede a viewport. */}
        <NarracaoPlayer
          ref={playerRef}
          ordem={p.ordem}
          secoes={secoesNarracao}
          onAlvo={setFalando}
          onSeek={onSeekNarracao}
          tempoInicial={tempoInicialNarracao}
          onTocando={onTocandoNarracao}
          onProgresso={onProgressoNarracao}
          usada={narracaoUsada}
          alvoRotulo={rotuloDoAlvo(p, falando)}
          minutos={minutos}
          tocarAoCarregar={querOuvir && posicaoResolvida === ordem}
          onTentouTocar={limparOuvir}
        />

        <section className="block block-plain" id="contexto" tabIndex={-1}>
          {/* o realce vai no h2, não no botão: o botão é o controle, o título é o
              que a narração está lendo. */}
          <h2 className={tituloClass('collapse-h', 'cabecalho-contexto')} data-fala-id="cabecalho-contexto">
            <button
              type="button"
              className="collapse-btn"
              aria-expanded={contextoAberto}
              aria-controls="contexto-corpo"
              onClick={alternarContexto}
            >
              <span className={`collapse-chevron${contextoAberto ? ' open' : ''}`} aria-hidden>
                ▸
              </span>
              Contexto
            </button>
          </h2>
          <div id="contexto-corpo" hidden={!contextoAberto}>
            {parasContexto.map((para, i) => (
              <p key={i} className={falaClass('prose', `contexto-${i}`)} data-verse-id={`contexto-${i}`}>
                <TextoFalado texto={para} ativo={falando === `contexto-${i}`} />
              </p>
            ))}
          </div>
        </section>

        <section className="block block-plain" id="texto" tabIndex={-1}>
          <h2 className={tituloClass('', 'cabecalho-texto') || undefined} data-fala-id="cabecalho-texto">
            Texto
          </h2>
          <div className="texto-biblico">
            {prefs.layout === 'corrido'
              ? gruposCorrido.map((g, gi) => (
                  <div key={g.label ? `c-${g.chapter}` : `orfao-${gi}`} className="corrido-group">
                    {g.label && (
                      <h3 className={tituloClass('cap-label', `cap-${g.chapter}`)} data-fala-id={`cap-${g.chapter}`}>
                        {g.label}
                      </h3>
                    )}
                    {(g === primeiroGrupoComCapitulo || (!primeiroGrupoComCapitulo && gi === 0)) && sobrescritoEl}
                    <p className="corrido">
                      {g.verses.map((b) => (
                        <Fragment key={b.id}>
                          <button
                            type="button"
                            className={verseClass('verse-inline', b.id)}
                            data-verse-id={b.id}
                            aria-pressed={selecionadosIds.has(b.id)}
                            aria-label={verseAria(b)}
                            onClick={() => selectVerse(b.id)}
                          >
                            {b.verse > 0 && <sup className="verse-num">{b.verse}</sup>}
                            <span className="verse-text">
                              <TextoFalado texto={b.text} ativo={falando === b.id} />
                            </span>
                          </button>{' '}
                        </Fragment>
                      ))}
                    </p>
                  </div>
                ))
              : (
                  <>
                    {!primeiroCapitulo && sobrescritoEl}
                    {blocks.map((b) =>
                      b.kind === 'chapter' ? (
                        <Fragment key={`c-${b.chapter}`}>
                          <h3
                            className={tituloClass('cap-label', `cap-${b.chapter}`)}
                            data-fala-id={`cap-${b.chapter}`}
                          >
                            {b.label}
                          </h3>
                          {b === primeiroCapitulo && sobrescritoEl}
                        </Fragment>
                      ) : (
                        <button
                          key={b.id}
                          type="button"
                          className={verseClass('verse', b.id)}
                          data-verse-id={b.id}
                          aria-pressed={selecionadosIds.has(b.id)}
                          aria-label={verseAria(b)}
                          onClick={() => selectVerse(b.id)}
                        >
                          {b.verse > 0 && <sup className="verse-num">{b.verse}</sup>}
                          <span className="verse-text">
                            <TextoFalado texto={b.text} ativo={falando === b.id} />
                          </span>
                        </button>
                      ),
                    )}
                  </>
                )}
          </div>
        </section>

        <section className="block block-plain" id="resenha" tabIndex={-1}>
          <h2 className={tituloClass('', 'cabecalho-resenha') || undefined} data-fala-id="cabecalho-resenha">
            Resenha
          </h2>
          {resenhaAlvos.prosa.map((alvo) => (
            <p key={alvo.id} className={falaClass('prose', alvo.id)} data-verse-id={alvo.id}>
              <TextoFalado texto={alvo.texto} ativo={falando === alvo.id} />
            </p>
          ))}
          {resenhaAlvos.palavras.length > 0 && (
            <>
              <h3
                className={tituloClass('palavras-titulo', 'cabecalho-palavras') || undefined}
                data-fala-id="cabecalho-palavras"
              >
                As palavras do trecho
              </h3>
              <ul className="palavras-do-trecho">
                {resenhaAlvos.palavras.map((alvo) => (
                  <li key={alvo.id} className={falaClass('prose', alvo.id)} data-verse-id={alvo.id}>
                    <TextoFalado texto={alvo.texto} ativo={falando === alvo.id} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="block block-plain" id="reflexao" tabIndex={-1}>
          {/* a section chama-se `reflexao`, mas o manifesto chama a seção de
              `reflexoes` — o id do alvo segue o manifesto. */}
          <h2 className={tituloClass('', 'cabecalho-reflexoes') || undefined} data-fala-id="cabecalho-reflexoes">
            Reflexões
          </h2>
          <ol className="perguntas">
            {p.perguntas_reflexao.map((q, i) => (
              <li key={i} className={falaClass('', `reflexao-${i}`)} data-verse-id={`reflexao-${i}`}>
                <TextoFalado texto={q} ativo={falando === `reflexao-${i}`} />
              </li>
            ))}
          </ol>
        </section>

        <section className="block notes" id="notas">
          <div className="notes-tabs" role="tablist" aria-label="Anotações, tópicos e conversa">
            {(
              [
                ['anotacoes', 'Anotações'],
                ['topicos', 'Tópicos'],
                ['conversar', 'Conversar'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`notes-tab${tab === id ? ' active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'anotacoes' && (
            <>
              <form onSubmit={onSaveNote} className="note-form">
                {draftRef && (
                  <p className="note-ref-row">
                    <span className="note-ref-chip">{verseRefLabel(p.abbrev, draftRef)}</span>
                    <button type="button" className="linkish" onClick={() => setDraftRef(null)}>
                      Remover vínculo
                    </button>
                  </p>
                )}
                <textarea
                  ref={notaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  placeholder="Escreva pensamentos, orações, aplicações…"
                />
                <div className="note-form-actions">
                  <button type="submit">{editingId ? 'Salvar alterações' : 'Salvar anotação'}</button>
                  {editingId && (
                    <button type="button" className="linkish" onClick={cancelarEdicao}>
                      Cancelar
                    </button>
                  )}
                  {/* Último da linha e encostado à direita (margin-left:auto no
                      CSS): o estado do ditado cresce para a esquerda e o
                      microfone nunca sai do lugar. */}
                  <DitarBotao onTexto={inserirDitado} onRevisao={aplicarRevisao} onAviso={flashAviso} />
                </div>
              </form>
              <ul className="note-list">
                {notes.map((n) => (
                  <li key={n.id}>
                    {n.verseRef && (
                      <Link
                        className="note-ref-chip"
                        to={`/leitura/${ordem}?v=${parseVerseRef(n.verseRef)?.start ?? ''}`}
                      >
                        {verseRefLabel(p.abbrev, n.verseRef)}
                      </Link>
                    )}
                    <p>{n.texto}</p>
                    <div className="note-item-actions">
                      {confirmarId === n.id ? (
                        <>
                          <span className="muted">Apagar mesmo?</span>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => void apagarNota(n.id)}
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => setConfirmarId(null)}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="linkish" onClick={() => editarNota(n)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => setConfirmarId(n.id)}
                          >
                            Apagar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'topicos' &&
            (p.topicos_pregar ? (
              <TopicsView text={p.topicos_pregar} />
            ) : (
              <p className="muted">Ainda não gerado.</p>
            ))}

          {/* A porta para a IA é aba, não rodapé de "Anotações": solta ali
              embaixo ela aparecia debaixo dos dois painéis, sem pertencer a
              nenhum, e o prompt comprido empurrava a lista de notas.

              O que a tirou de aba antes era o NOME: chamava-se "Contexto", igual
              à seção histórico-literária lá em cima, significando outra coisa, e
              as duas na tela ao mesmo tempo. Com "Conversar" o problema não
              existe. Continua sendo a última das três porque conversar é o que
              se faz depois de ler. */}
          {tab === 'conversar' && (
            <div className="conversar-bloco">
              <p className="muted">
                Leve este trecho para uma conversa com IA: o texto abaixo já vem pronto para
                colar.
              </p>
              <pre className="contexto-ia-text">{promptConversa(p)}</pre>
              <button type="button" className="ghost copy-btn" onClick={copyContexto}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}

          <div className="actions">
            {status !== 'concluido' ? (
              <button type="button" className="cta" onClick={() => void markDone()}>
                Marcar como concluída
              </button>
            ) : (
              <>
                {/* Uma linha: "Concluída ✓" é o próprio desmarcar (toque de
                    volta), estrela é só ícone. "Desmarcar como…" e "Marcar
                    para reler" em texto puro empilhado comiam a dobra e
                    pareciam links, não botões. */}
                <div className="actions-linha">
                  <button
                    type="button"
                    className="ghost actions-concluir"
                    aria-pressed="true"
                    aria-label="Desmarcar como concluída"
                    title="Desmarcar como concluída"
                    onClick={() => void desmarcar()}
                  >
                    Concluída ✓
                  </button>
                  <button
                    type="button"
                    className="ghost actions-reler"
                    aria-pressed={prog?.paraReler ?? false}
                    aria-label={prog?.paraReler ? 'Desmarcar para reler' : 'Marcar para reler'}
                    title={prog?.paraReler ? 'Desmarcar para reler' : 'Marcar para reler'}
                    onClick={() => void alternarReler()}
                  >
                    {prog?.paraReler ? '★' : '☆'}
                  </button>
                </div>
                {prog && prog.historico.length > 0 && (
                  <p className="historico-leitura">
                    {prog.historico.length === 1 ? 'lida 1×' : `lida ${prog.historico.length}×`} ·{' '}
                    {prog.historico
                      .slice(0, 3)
                      .map((d) =>
                        new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                      )
                      .join(' · ')}
                  </p>
                )}
              </>
            )}
          </div>
          <nav ref={pagerRef} className="pager" aria-label="Navegação entre perícopes">
            <PagerLado
              v={prev}
              proxima={false}
              fim={`Primeira do ${testamentLabel(testamentOf(p))}`}
            />
            <PagerLado
              v={next}
              proxima
              fim={`Última do ${testamentLabel(testamentOf(p))}`}
              primario={status === 'concluido'}
            />
          </nav>
        </section>

        {barOpen && selecionados.length > 0 && (
          <VerseActions
            label={rangeLabel(p, selecionados)}
            temDestaque={selecionados.some((v) => destaques.has(v.id))}
            corAtual={corAtual}
            aviso={aviso}
            onCopiar={() => void copiarSelecao()}
            onCompartilhar={() => void compartilharSelecao()}
            onDestacar={(cor) => void destacarSelecao(cor)}
            onRemoverDestaque={() => void removerDestaqueSelecao()}
            onAnotar={anotarSelecao}
            onFechar={fecharBarra}
          />
        )}
      </article>
    </>
  )
}
