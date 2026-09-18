import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { alinhar, type SecaoAlvos } from '../lib/alinhar-narracao'
import { carregarManifesto, vozDaPericope, VOZ_V3, type Manifesto } from '../lib/manifesto'
import { type SecaoNarrada, formatarTempo, inicioDaSecao } from '../lib/narracao-controles'
import { indiceDaPalavra, indiceEm } from '../lib/narracao-timeline'
import { IconeFones } from './icones'

export type NarracaoPlayerHandle = {
  /**
   * Reposiciona o áudio no cabeçalho falado da seção ("Contexto.", "Texto
   * Bíblico.", …). Tocando, continua tocando de lá; pausado, só reposiciona.
   * Sem áudio ou sem manifesto, não faz nada.
   */
  irParaSecao: (secao: SecaoNarrada) => void
  /** Play/pause — o mesmo botão do player, para o controle compacto do header. */
  alternar: () => void
  /** currentTime do áudio agora, em segundos (0 sem áudio). */
  tempoAtual: () => number
}

type Props = {
  ordem: number
  /** Alvos renderizados, na ordem de leitura. Memoize na Leitura. */
  secoes: SecaoAlvos[]
  /** Chamado só quando o alvo em fala muda. DEVE ser uma referência estável. */
  onAlvo: (id: string | null) => void
  /** Avisa que o usuário reposicionou o áudio. DEVE ser referência estável. */
  onSeek?: () => void
  /**
   * Retomada de checkpoint: posiciona o áudio aqui UMA vez por perícope,
   * assim que a duração é conhecida — sem tocar sozinho (autoplay é bloqueado
   * pelos navegadores; o play continua sendo gesto do usuário).
   */
  tempoInicial?: number | null
  /** Play/pause mudou. DEVE ser referência estável. */
  onTocando?: (tocando: boolean) => void
  /** Fração 0..1 já ouvida, no ritmo do timeupdate (~4×/s). DEVE ser estável. */
  onProgresso?: (fracao: number) => void
  /**
   * A narração desta perícope já foi iniciada nesta sessão de leitura. É o que
   * decide a casa do controle: falso mostra o cartão "Ouvir esta perícope" no
   * corpo do artigo, verdadeiro sobe a doca fixa no rodapé.
   */
  usada: boolean
  /** O que está em fala, em rótulo humano, para a linha de estado da doca. */
  alvoRotulo: string
  /** Minutos de leitura, para a linha secundária do cartão pré-play. */
  minutos: number
  /**
   * `?ouvir=1` vindo da Home: tenta tocar sozinho assim que o áudio estiver
   * carregado. Decide só SE toca — nunca ONDE, que continua sendo do
   * checkpoint. A Leitura só liga isto depois de resolver o checkpoint.
   */
  tocarAoCarregar?: boolean
  /** A tentativa de autoplay aconteceu (deu certo ou não). DEVE ser estável. */
  onTentouTocar?: () => void
  ref?: Ref<NarracaoPlayerHandle>
}

/**
 * O que se sabe sobre a existência do áudio desta perícope. Antes havia só
 * "tem `src`" e "falhou depois de ter `src`", e a ausência apagava o
 * componente inteiro — o leitor não sabia se era bug, carregamento, ou
 * narração que nunca vai existir.
 */
type Disponibilidade = 'verificando' | 'ausente' | 'ok' | 'falhou'

/** Salto dos botões e das setas: curto o bastante para reouvir um versículo. */
const SALTO = 10

/**
 * Quanto o realce corre à frente do `currentTime`, em segundos. Compensa o
 * que o ouvido percebe como atraso: a latência entre ler o relógio e pintar
 * o quadro, mais a transição de 160 ms do sublinhado da palavra (`[data-w]`
 * no CSS), que só chega ao meio do caminho ~80 ms depois de começar. É o
 * único lugar para afinar de ouvido — nada mais no realce tem constante de
 * tempo.
 */
export const ADIANTO_S = 0.15

/**
 * Narração pré-gerada (voz clonada, servida do R2 via /api/audio). Um HEAD
 * barato decide se existe áudio, e o componente diz o resultado em vez de
 * desaparecer: cartão "Ouvir esta perícope" quando existe, esqueleto enquanto
 * verifica, linha explicando quando não existe ou quando falhou. Depois do
 * primeiro play a doca fixa no rodapé assume o lugar do cartão.
 *
 * O manifesto, quando existe e casa com a tela, transforma o relógio do áudio
 * em realce do alvo e da palavra em fala — lido a cada quadro enquanto toca, e
 * não no `timeupdate`, que dispara só ~4×/s e deixaria a palavra até 250 ms
 * atrás da voz.
 *
 * O `<audio>` fica sem `controls`: a UI é do app, para caber no tema e para
 * os chips de seção poderem mandar o áudio para o cabeçalho de cada uma.
 */
export default function NarracaoPlayer({
  ordem,
  secoes,
  onAlvo,
  onSeek,
  tempoInicial,
  onTocando,
  onProgresso,
  usada,
  alvoRotulo,
  minutos,
  tocarAoCarregar,
  onTentouTocar,
  ref,
}: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [manifesto, setManifesto] = useState<Manifesto | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const [tocando, setTocando] = useState(false)
  const [tempo, setTempo] = useState(0)
  const [duracao, setDuracao] = useState(Number.NaN)
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>('verificando')
  // "Tentar de novo" refaz o HEAD: entra nas dependências do efeito de carga.
  const [tentativa, setTentativa] = useState(0)
  const erro = disponibilidade === 'falhou'

  // Índices da última busca: o relógio anda para frente quase sempre.
  const iAlvo = useRef(0)
  const iPalavra = useRef(0)
  const alvoAtual = useRef<string | null>(null)
  const spanAtual = useRef<HTMLElement | null>(null)
  // Uma aplicação por perícope: depois que o usuário mexeu no áudio, o
  // checkpoint antigo não pode voltar a puxar o relógio.
  const tempoInicialAplicado = useRef(false)
  // Uma tentativa de autoplay por perícope, deu certo ou não.
  const autoTentado = useRef(false)

  const alinhamento = useMemo(
    () => (manifesto ? alinhar(manifesto, secoes) : []),
    [manifesto, secoes],
  )

  useEffect(() => {
    const ac = new AbortController()
    let vivo = true
    setSrc(null)
    setManifesto(null)
    setTocando(false)
    setTempo(0)
    setDuracao(Number.NaN)
    setDisponibilidade('verificando')
    tempoInicialAplicado.current = false
    autoTentado.current = false

    const vozInicial = vozDaPericope(ordem)

    async function resolverAudio() {
      let voz = vozInicial
      let url = `/api/audio/${voz}/${ordem}.m4a`
      let res = await fetch(url, { method: 'HEAD', signal: ac.signal })

      // Se a ordem caiu no fallback legado mas já foi gerada na voz V4, promove automaticamente
      if (!res.ok && voz !== VOZ_V3) {
        const urlV3 = `/api/audio/${VOZ_V3}/${ordem}.m4a`
        try {
          const resV3 = await fetch(urlV3, { method: 'HEAD', signal: ac.signal })
          if (resV3.ok) {
            voz = VOZ_V3
            url = urlV3
            res = resV3
          }
        } catch {
          // segue com res original
        }
      }

      if (!vivo) return
      if (!res.ok) {
        setDisponibilidade('ausente')
        return
      }
      setSrc(url)
      setDisponibilidade('ok')
      const m = await carregarManifesto(ordem, ac.signal, voz)
      if (vivo) setManifesto(m)
    }

    resolverAudio().catch(() => {
      if (vivo) setDisponibilidade('falhou')
    })

    return () => {
      vivo = false
      ac.abort()
    }
  }, [ordem, tentativa])

  // Efeito (e não onLoadedMetadata): o checkpoint chega do IndexedDB depois
  // que o player montou, então `tempoInicial` e a duração podem aparecer em
  // qualquer ordem — este efeito roda quando o ÚLTIMO dos dois chegar.
  useEffect(() => {
    const a = audioRef.current
    if (!a || tempoInicialAplicado.current) return
    if (tempoInicial == null || tempoInicial <= 0) return
    if (!Number.isFinite(duracao) || duracao <= 0 || tempoInicial >= duracao) return
    tempoInicialAplicado.current = true
    a.currentTime = tempoInicial
    setTempo(tempoInicial)
  }, [tempoInicial, duracao])

  // Autoplay do `?ouvir=1`. Espera a duração (e não só o `src`) porque o
  // efeito acima, declarado antes deste e disparado pela MESMA duração, é
  // quem posiciona o checkpoint: tocar antes dele começaria do zero e daria
  // um salto audível para o ponto salvo um instante depois.
  //
  // Se o navegador recusar — entre o toque na Home e este `play()` passam a
  // troca de rota e o HEAD, e a ativação transitória do gesto pode ter
  // expirado —, a rejeição morre aqui em silêncio: `tocando` fica falso,
  // `usada` fica falso, e o cartão "Ouvir esta perícope" continua na tela com
  // o áudio já carregado. Um toque a mais, nenhum erro.
  useEffect(() => {
    if (!tocarAoCarregar || autoTentado.current) return
    const a = audioRef.current
    if (!a || !Number.isFinite(duracao) || duracao <= 0) return
    autoTentado.current = true
    a.play().catch(() => {})
    onTentouTocar?.()
  }, [tocarAoCarregar, duracao, onTentouTocar])

  const limparPalavra = useCallback(() => {
    spanAtual.current?.classList.remove('word-speaking')
    spanAtual.current = null
  }, [])

  const trocarAlvo = useCallback(
    (id: string | null) => {
      if (id === alvoAtual.current) return
      alvoAtual.current = id
      iPalavra.current = 0
      limparPalavra()
      onAlvo(id)
    },
    [limparPalavra, onAlvo],
  )

  // Sair da perícope (ou perder o alinhamento) devolve a tela ao normal.
  useEffect(() => {
    return () => {
      limparPalavra()
      alvoAtual.current = null
      onAlvo(null)
    }
  }, [ordem, limparPalavra, onAlvo])

  const aoTempo = useCallback(() => {
    const a = audioRef.current
    if (!a || !alinhamento.length) return
    // Adiantado de propósito (ver ADIANTO_S). Fora de qualquer janela — antes
    // da 1ª, no fim — a busca devolve -1 e nada acende, como sempre.
    const t = a.currentTime + ADIANTO_S

    const i = indiceEm(alinhamento, t, iAlvo.current)
    if (i >= 0) iAlvo.current = i
    const alvo = i >= 0 ? alinhamento[i]! : null

    if ((alvo?.id ?? null) !== alvoAtual.current) {
      trocarAlvo(alvo?.id ?? null)
      // Os spans do alvo novo só existem depois do render — o próximo quadro
      // marca a palavra.
      return
    }
    if (!alvo) return

    const w = indiceDaPalavra(alvo, t, iPalavra.current)
    if (w < 0) return
    // Sai antes de tocar no DOM quando a palavra não mudou: o loop roda a
    // cada quadro (~60×/s) e a palavra troca ~2,5×/s, então quase todo quadro
    // não tem nada a fazer. `spanAtual` cobre o caso de o span ainda não
    // existir.
    if (w === iPalavra.current && spanAtual.current) return
    iPalavra.current = w
    const el = document.querySelector<HTMLElement>(`[data-verse-id="${alvo.id}"] [data-w="${w}"]`)
    if (!el || el === spanAtual.current) return
    limparPalavra()
    el.classList.add('word-speaking')
    spanAtual.current = el
  }, [alinhamento, trocarAlvo, limparPalavra])

  // Enquanto toca, o realce segue o relógio quadro a quadro. Começa no
  // `play`, para no `pause`/`ended` (os dois zeram `tocando`) e na
  // desmontagem; `aoTempo` na lista de dependências faz o loop nascer de novo
  // com o alinhamento fresco quando o manifesto chega no meio da reprodução.
  useEffect(() => {
    if (!tocando) return
    let quadro = 0
    const passo = () => {
      aoTempo()
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [tocando, aoTempo])

  function alternar() {
    const a = audioRef.current
    if (!a) return
    // `play()` rejeita quando o áudio não carregou; `onError` já mostra o
    // aviso, então aqui basta não deixar a rejeição virar erro não tratado.
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }

  /** Reposiciona por `currentTime`: o `seeked` que resulta avisa a Leitura. */
  function irPara(segundos: number) {
    const a = audioRef.current
    if (!a) return
    const fim = Number.isFinite(a.duration) ? a.duration : Number.POSITIVE_INFINITY
    a.currentTime = Math.min(Math.max(0, segundos), fim)
    setTempo(a.currentTime)
  }

  function saltar(delta: number) {
    const a = audioRef.current
    if (a) irPara(a.currentTime + delta)
  }

  useImperativeHandle(
    ref,
    () => ({
      irParaSecao(secao) {
        const inicio = inicioDaSecao(manifesto, secao)
        if (inicio === null || !audioRef.current) return
        irPara(inicio)
      },
      alternar,
      tempoAtual: () => audioRef.current?.currentTime ?? 0,
    }),
    [manifesto],
  )

  // ←/→ em qualquer controle do player saltam ±10 s, o mesmo dos botões. A
  // alternativa — deixar o passo nativo do range — daria uma resposta às
  // setas com foco na barra e nenhuma com foco nos botões; um salto só, igual
  // em todo o player, é mais fácil de aprender. O `preventDefault` também é o
  // que impede o passo nativo do range de somar ao nosso. A navegação entre
  // perícopes já ignora setas vindas de `.narracao` (ver use-keyboard-nav).
  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    saltar(e.key === 'ArrowLeft' ? -SALTO : SALTO)
  }

  const temDuracao = Number.isFinite(duracao) && duracao > 0
  const pct = temDuracao ? Math.min(100, (tempo / duracao) * 100) : 0
  const tempoTexto = formatarTempo(tempo)
  const duracaoTexto = formatarTempo(duracao)
  // A doca substitui o cartão pré-play depois do primeiro play, e continua
  // montada pausada — some só na troca de perícope, que zera `usada`.
  const naDoca = usada && src !== null

  // Sem `role="status"` próprio: quem anuncia é a região estável que o
  // envolve nos dois lugares onde ele aparece (o slot pré-play e a doca).
  const falha = (
    <div className="narracao-indisponivel">
      <span>Não foi possível carregar a narração desta perícope.</span>
      <button
        type="button"
        className="narracao-retentar"
        onClick={() => setTentativa((n) => n + 1)}
      >
        Tentar de novo
      </button>
    </div>
  )

  return (
    <>
      {src !== null && (
        <audio
          ref={audioRef}
          preload="metadata"
          src={src}
          hidden
          // Só o mostrador: o realce vem do loop de quadros. Um setState por
          // quadro seria desperdício para uma barra que muda a olho a cada
          // segundo.
          onTimeUpdate={() => {
            const a = audioRef.current
            if (!a) return
            setTempo(a.currentTime)
            // A barra do header segue o áudio no mesmo ritmo ~4×/s do mostrador.
            if (Number.isFinite(a.duration) && a.duration > 0) {
              onProgresso?.(a.currentTime / a.duration)
            }
          }}
          onSeeked={() => {
            // A tela precisa estar liberada antes de calcular o novo alvo,
            // senão o realce salta para o lugar certo mas fora da tela.
            onSeek?.()
            aoTempo()
          }}
          onEnded={() => {
            setTocando(false)
            onTocando?.(false)
            limparPalavra()
            trocarAlvo(null)
          }}
          onPlay={() => {
            setTocando(true)
            onTocando?.(true)
          }}
          onPause={() => {
            setTocando(false)
            onTocando?.(false)
          }}
          onLoadedMetadata={() => {
            const a = audioRef.current
            if (a) setDuracao(a.duration)
          }}
          onDurationChange={() => {
            const a = audioRef.current
            if (a) setDuracao(a.duration)
          }}
          onError={() => setDisponibilidade('falhou')}
        />
      )}

      {/* Antes do primeiro play, este ponto do artigo (logo depois dos chips)
          é a casa do convite — e, quando não há áudio, do motivo. Depois do
          primeiro play a doca assume, fixa no rodapé.

          A região viva é ESTE invólucro, montado junto com o componente e
          nunca substituído: leitor de tela só relata mudança de conteúdo em
          região que já existia no DOM, e um `role="status"` que nasce já
          contendo a mensagem não é anunciado — a mesma razão escrita no aviso
          do ditado (Explorar) e no `.nav-conta-erro` (Perfil). Por isso o
          esqueleto, a linha de indisponível e o cartão trocam DENTRO dele, em
          vez de cada um trazer o seu `role`.

          Sem classe de propósito: sem borda, padding nem display próprio, as
          margens dos filhos atravessam o invólucro e a altura casada de
          `.ouvir-skeleton` e `.ouvir-cartao` (o piso que impede a resposta do
          HEAD de refluir o artigo) continua sendo a que o fluxo enxerga. */}
      <div role="status">
        {!naDoca &&
          (disponibilidade === 'verificando' ? (
            // Do tamanho do cartão final, para a resposta do HEAD não refluir o
            // artigo. Decoração para quem vê, anúncio para quem não vê — o mesmo
            // princípio do esqueleto da página inteira.
            <div className="ouvir-skeleton">
              <span className="sr-only">Verificando narração desta perícope…</span>
              <span className="skeleton" />
            </div>
          ) : disponibilidade === 'ausente' ? (
            <p className="narracao-indisponivel">
              A narração desta perícope ainda não foi gravada.
            </p>
          ) : disponibilidade === 'falhou' ? (
            falha
          ) : (
            // Um <button> só, e não ícone + título + linha soltos: um alvo de
            // toque, um ponto de foco, um rótulo que já diz a duração.
            <button
              type="button"
              className="ouvir-cartao"
              aria-label={`Ouvir esta perícope, ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`}
              onClick={alternar}
            >
              <span className="ouvir-cartao-play" aria-hidden>
                <IconeFones size={26} />
              </span>
              <span className="ouvir-cartao-texto" aria-hidden>
                <span className="ouvir-cartao-titulo">Ouvir esta perícope</span>
                <span className="ouvir-cartao-sub">
                  {minutos} min · voz sintetizada, lida sobre o texto
                </span>
              </span>
            </button>
          ))}
      </div>

      {naDoca && (
        // `narracao` ao lado de `narracao-doca` não é estilo: é o marcador que
        // `isMediaTarget` (use-keyboard-nav) procura para deixar ←/→ com o
        // salto de ±10 s em vez de trocar de perícope. Só o `narracao-doca`
        // recebe CSS.
        <div
          className="narracao-doca narracao"
          role="region"
          aria-label="Narração"
          onKeyDown={aoTeclar}
        >
          <div className="narracao-doca-estado">
            <span className="narracao-doca-chama" aria-hidden />
            <span className="narracao-doca-rotulo">Narrando</span>
            <span className="narracao-doca-alvo">{alvoRotulo}</span>
            <span className="narracao-doca-tempo" aria-hidden>
              <span>{tempoTexto}</span>
              <span className="narracao-doca-tempo-sep">/</span>
              <span>{duracaoTexto}</span>
            </span>
          </div>

          <input
            type="range"
            className="narracao-doca-barra"
            aria-label="Posição na narração"
            aria-valuetext={`${tempoTexto} de ${duracaoTexto}`}
            min={0}
            max={temDuracao ? duracao : 0}
            // Passo fino para o arrasto; as setas não passam por ele (ver aoTeclar).
            step={0.1}
            value={temDuracao ? tempo : 0}
            disabled={!temDuracao || erro}
            style={{ '--pct': `${pct}%` } as CSSProperties}
            onInput={(e) => irPara(Number(e.currentTarget.value))}
          />

          <div className="narracao-doca-controles">
            <button
              type="button"
              className="narracao-doca-btn narracao-doca-salto"
              aria-label={`Voltar ${SALTO} segundos`}
              title={`Voltar ${SALTO} s`}
              disabled={erro}
              onClick={() => saltar(-SALTO)}
            >
              <IconeSalto direcao="tras" />
            </button>
            <button
              type="button"
              className="narracao-doca-btn narracao-doca-play"
              aria-label={tocando ? 'Pausar narração' : 'Tocar narração'}
              title={tocando ? 'Pausar' : 'Tocar'}
              disabled={erro}
              onClick={alternar}
            >
              {tocando ? <IconePausa /> : <IconePlay />}
            </button>
            <button
              type="button"
              className="narracao-doca-btn narracao-doca-salto"
              aria-label={`Avançar ${SALTO} segundos`}
              title={`Avançar ${SALTO} s`}
              disabled={erro}
              onClick={() => saltar(SALTO)}
            >
              <IconeSalto direcao="frente" />
            </button>
          </div>

          {/* O áudio pode quebrar depois de já ter tocado: o mesmo aviso do
              estado pré-play serve aqui, com o mesmo botão que refaz o HEAD.
              O invólucro vazio espera montado pela mesma razão da região lá de
              cima — a doca nasce antes da falha, mas o aviso não pode nascer
              junto da região que o anuncia. Vazio ele não abre linha no grid
              da doca (que não tem `gap`), então `--doca-h` segue valendo. */}
          <div role="status">{erro && falha}</div>
        </div>
      )}
    </>
  )
}

// Re-exportado para manter consistência de ícone único em toda a aplicação.
export { IconeFones }

export function IconePlay() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" />
    </svg>
  )
}

export function IconePausa() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <path d="M7 5.5h3.5v13H7zM13.5 5.5H17v13h-3.5z" fill="currentColor" />
    </svg>
  )
}

/** Seta em arco com o "10" dentro — a convenção que todo player já usa. */
function IconeSalto({ direcao }: { direcao: 'tras' | 'frente' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden
      focusable="false"
      style={direcao === 'frente' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M12 5a8 8 0 1 1-7.2 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 3.5v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="var(--font-ui)"
        fill="currentColor"
        // O texto vira junto com o arco no botão de avançar; desfaz o espelho.
        transform={direcao === 'frente' ? 'scale(-1 1) translate(-24 0)' : undefined}
      >
        10
      </text>
    </svg>
  )
}
