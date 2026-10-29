import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BotaoVoltar from '../components/BotaoVoltar'
import {
  IconeFones,
  IconeLivroAberto,
  IconeSetaDireita,
  IconeVoltar,
} from '../components/icones'
import { IconePausa, IconePlay, IconeSalto } from '../components/NarracaoPlayer'
import { tokens } from '../lib/alinhar-narracao'
import {
  carregarIntroducao,
  carregarManifestoIntroducao,
  obterPrimeiraPericopeDoLivro,
  urlAudioIntroducao,
  type IntroducaoLivroData,
  type ManifestoIntroducao,
  type SecaoIntroducao,
} from '../lib/introducoes'
import { formatarTempo } from '../lib/narracao-controles'

export default function IntroducaoLivro() {
  const { slug } = useParams<{ slug: string }>()
  const [intro, setIntro] = useState<IntroducaoLivroData | null>(null)
  const [primeiraOrdem, setPrimeiraOrdem] = useState<number | null>(null)
  const [manifesto, setManifesto] = useState<ManifestoIntroducao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Áudio e reprodução
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioDisponivel, setAudioDisponivel] = useState<boolean | null>(null) // null = verificando
  const [tocando, setTocando] = useState(false)
  const [tempo, setTempo] = useState(0)
  const [duracao, setDuracao] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const [tempoArrasto, setTempoArrasto] = useState(0)
  const [secaoAtivaId, setSecaoAtivaId] = useState<string | null>(null)
  const [palavraAtiva, setPalavraAtiva] = useState<number | null>(null)

  // Carrega os dados da introdução, primeira perícope e verifica o áudio
  useEffect(() => {
    if (!slug) return
    const ac = new AbortController()
    setCarregando(true)
    setErro(null)
    setTocando(false)
    setTempo(0)
    setDuracao(0)
    setSecaoAtivaId(null)
    setPalavraAtiva(null)
    setAudioDisponivel(null)

    async function carregar() {
      try {
        const dados = await carregarIntroducao(slug!, ac.signal)
        if (!dados) {
          setErro('Introdução não encontrada para este livro.')
          setCarregando(false)
          return
        }
        setIntro(dados)

        // Busca primeira perícope para o CTA
        const primeira = await obterPrimeiraPericopeDoLivro(dados.livro || slug!)
        if (primeira) {
          setPrimeiraOrdem(primeira.ordem)
        }

        // Tenta buscar manifesto de áudio
        const man = await carregarManifestoIntroducao(slug!, ac.signal)
        if (man) {
          setManifesto(man)
          if (man.dur_total > 0) {
            setDuracao(man.dur_total)
          }
        }

        // Verifica existência do arquivo de áudio via HEAD
        try {
          const audioUrl = urlAudioIntroducao(slug!)
          const res = await fetch(audioUrl, { method: 'HEAD', signal: ac.signal })
          setAudioDisponivel(res.ok)
        } catch {
          setAudioDisponivel(false)
        }
      } catch {
        if (!ac.signal.aborted) {
          setErro('Não foi possível carregar a introdução do livro.')
        }
      } finally {
        if (!ac.signal.aborted) {
          setCarregando(false)
        }
      }
    }

    carregar()
    const audioEl = audioRef.current
    return () => {
      ac.abort()
      if (audioEl) {
        audioEl.pause()
      }
    }
  }, [slug])

  // Contagem de palavras e estimativa de tempo por seção
  const secoesIntervalos = useMemo(() => {
    if (!intro) return []
    const contagens = intro.secoes.map((s) => ({
      id: s.id,
      tokens: tokens(s.texto),
    }))
    const totalPalavras = contagens.reduce((acc, curr) => acc + curr.tokens.length, 0)
    let accInicio = 0
    return contagens.map((item) => {
      const durSec = duracao > 0 && totalPalavras > 0
        ? (item.tokens.length / totalPalavras) * duracao
        : 0
      const inicio = accInicio
      const fim = accInicio + durSec
      accInicio = fim
      return {
        id: item.id,
        inicio,
        fim,
        dur: durSec,
        numPalavras: item.tokens.length,
      }
    })
  }, [intro, duracao])

  // Atualização de tempo e detecção da seção / palavra ativa
  const atualizarPosicao = useCallback(
    (t: number) => {
      if (!intro) return

      // Caso 1: manifesto explícito com unidades
      if (manifesto && manifesto.unidades.length > 0) {
        const u = manifesto.unidades.find(
          (uni) => t >= uni.inicio && t < uni.inicio + uni.dur,
        )
        if (u) {
          setSecaoAtivaId(u.secao)
          if (u.palavras && u.palavras.length > 0) {
            const wIdx = u.palavras.findIndex((w) => {
              const durW = w.dur ?? w.d ?? 0.35
              return t >= w.i && t < w.i + durW
            })
            setPalavraAtiva(wIdx >= 0 ? wIdx : null)
          } else {
            setPalavraAtiva(null)
          }
          return
        }
      }

      // Caso 2: alinhamento proporcional por tamanho das seções
      if (secoesIntervalos.length > 0 && duracao > 0) {
        const intSecao = secoesIntervalos.find((s) => t >= s.inicio && t < s.fim)
        if (intSecao) {
          setSecaoAtivaId(intSecao.id)
          if (intSecao.dur > 0 && intSecao.numPalavras > 0) {
            const tNaSecao = t - intSecao.inicio
            const progSecao = Math.max(0, Math.min(1, tNaSecao / intSecao.dur))
            const wIdx = Math.floor(progSecao * intSecao.numPalavras)
            setPalavraAtiva(wIdx)
          } else {
            setPalavraAtiva(null)
          }
          return
        }
      }

      setSecaoAtivaId(null)
      setPalavraAtiva(null)
    },
    [intro, manifesto, secoesIntervalos, duracao],
  )

  // Controles de áudio
  const alternarPlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (tocando) {
      audio.pause()
    } else {
      audio.play().catch(() => setTocando(false))
    }
  }, [tocando])

  const saltar = useCallback(
    (segundos: number) => {
      const audio = audioRef.current
      if (!audio) return
      const alvo = Math.max(0, Math.min(duracao || 0, audio.currentTime + segundos))
      audio.currentTime = alvo
      setTempo(alvo)
      atualizarPosicao(alvo)
    },
    [duracao, atualizarPosicao],
  )

  const mudarSeek = (novoTempo: number) => {
    setTempoArrasto(novoTempo)
    atualizarPosicao(novoTempo)
  }

  const aplicarSeek = (novoTempo: number) => {
    setArrastando(false)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = novoTempo
      setTempo(novoTempo)
      atualizarPosicao(novoTempo)
    }
  }

  const pularParaSecao = (secaoId: string) => {
    const audio = audioRef.current
    if (!audio || !duracao) return
    // Busca no manifesto
    if (manifesto) {
      const u = manifesto.unidades.find((uni) => uni.secao === secaoId)
      if (u) {
        audio.currentTime = u.inicio
        setTempo(u.inicio)
        atualizarPosicao(u.inicio)
        if (!tocando) audio.play().catch(() => {})
        return
      }
    }
    // Busca na proporção
    const intSecao = secoesIntervalos.find((s) => s.id === secaoId)
    if (intSecao) {
      audio.currentTime = intSecao.inicio
      setTempo(intSecao.inicio)
      atualizarPosicao(intSecao.inicio)
      if (!tocando) audio.play().catch(() => {})
    }
  }

  if (carregando) {
    return (
      <article className="introducao-pagina leitura">
        <div className="subpagina-topo">
          <BotaoVoltar to="/explorar" rotulo="Voltar para o Explorar" />
        </div>
        <div className="introducao-esqueleto" aria-busy="true">
          <span className="sr-only">Carregando introdução do livro…</span>
          <div className="skeleton" style={{ height: '2rem', width: '40%', marginBottom: '1rem' }} />
          <div className="skeleton" style={{ height: '3rem', width: '85%', marginBottom: '2rem' }} />
          <div className="skeleton" style={{ height: '10rem', width: '100%', marginBottom: '1.5rem' }} />
        </div>
      </article>
    )
  }

  if (erro || !intro) {
    return (
      <article className="introducao-pagina leitura">
        <div className="subpagina-topo">
          <BotaoVoltar to="/explorar" rotulo="Voltar para o Explorar" />
        </div>
        <div className="introducao-erro-container">
          <h2>Introdução não encontrada</h2>
          <p className="muted">{erro ?? 'Não foi possível carregar os dados desta introdução.'}</p>
          <Link to="/explorar" className="cta">
            <IconeVoltar size={18} />
            <span>Voltar ao Explorar</span>
          </Link>
        </div>
      </article>
    )
  }

  const rotaExplorar = `/explorar?livro=${encodeURIComponent(intro.livro)}`
  const linkCap1 = primeiraOrdem !== null ? `/leitura/${primeiraOrdem}` : '/explorar'
  const tempoExibido = arrastando ? tempoArrasto : tempo
  const pct = duracao > 0 ? Math.min(100, Math.max(0, (tempoExibido / duracao) * 100)) : 0

  return (
    <article className="introducao-pagina leitura">
      {/* Elemento de áudio invisível */}
      {audioDisponivel && slug && (
        <audio
          ref={audioRef}
          src={urlAudioIntroducao(slug)}
          preload="metadata"
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => {
            setTocando(false)
            setSecaoAtivaId(null)
            setPalavraAtiva(null)
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && (!duracao || duracao <= 0)) {
              setDuracao(audioRef.current.duration)
            }
          }}
          onTimeUpdate={() => {
            if (!arrastando && audioRef.current) {
              const cur = audioRef.current.currentTime
              setTempo(cur)
              atualizarPosicao(cur)
            }
          }}
        />
      )}

      {/* Barra de Topo */}
      <div className="introducao-topo">
        <BotaoVoltar to={rotaExplorar} rotulo="Voltar para o Explorar" />
        <Link
          to={linkCap1}
          className="cta introducao-cta-topo"
          aria-label={`Iniciar Leitura de ${intro.livro} no Capítulo 1`}
        >
          <span>Iniciar Leitura (Capítulo 1)</span>
          <IconeSetaDireita size={16} />
        </Link>
      </div>

      {/* Cabeçalho Canônico Nobre */}
      <header className="introducao-header">
        <div className="introducao-meta">
          <span className="introducao-testamento">
            {intro.testamento === 'vt' || intro.testamento === 'antigo'
              ? 'Antigo Testamento'
              : 'Novo Testamento'}
          </span>
          <span className="introducao-meta-sep" aria-hidden="true">·</span>
          <span className="introducao-abbrev">{intro.abbrev}</span>
        </div>
        <h1 className="introducao-titulo-canonico">{intro.titulo_canonico}</h1>
        <p className="introducao-subtitulo-obra">{intro.titulo_introducao}</p>
      </header>

      {/* Player de Narração em Áudio */}
      <section className="introducao-player-secao" aria-label="Narração em áudio">
        {audioDisponivel === true && (
          <div className={`introducao-player-card ${tocando ? 'player-tocando' : ''}`}>
            <div className="introducao-player-estado">
              <span className="narracao-doca-chama" aria-hidden="true" />
              <span className="introducao-player-tag">
                {tocando ? 'Narrando Introdução' : 'Narração em Áudio'}
              </span>
              {secaoAtivaId && (
                <span className="introducao-player-alvo">
                  {intro.secoes.find((s) => s.id === secaoAtivaId)?.subtitulo}
                </span>
              )}
              <span className="introducao-player-tempo" aria-live="off">
                <span>{formatarTempo(tempoExibido)}</span>
                <span className="introducao-tempo-sep">/</span>
                <span>{formatarTempo(duracao)}</span>
              </span>
            </div>

            {/* Barra de Progresso */}
            <input
              type="range"
              className="narracao-doca-barra introducao-player-barra"
              aria-label="Posição do áudio"
              min={0}
              max={duracao > 0 ? duracao : 100}
              step={0.1}
              value={tempoExibido}
              style={{ '--pct': `${pct}%` } as React.CSSProperties}
              onMouseDown={() => setArrastando(true)}
              onTouchStart={() => setArrastando(true)}
              onInput={(e) => mudarSeek(Number(e.currentTarget.value))}
              onChange={(e) => aplicarSeek(Number(e.currentTarget.value))}
            />

            {/* Controles */}
            <div className="introducao-player-controles">
              <button
                type="button"
                className="narracao-doca-btn narracao-doca-salto"
                aria-label="Voltar 10 segundos"
                title="Voltar 10s"
                onClick={() => saltar(-10)}
              >
                <IconeSalto direcao="tras" />
              </button>

              <button
                type="button"
                className="narracao-doca-btn narracao-doca-play"
                aria-label={tocando ? 'Pausar narração' : 'Tocar narração'}
                title={tocando ? 'Pausar' : 'Tocar'}
                onClick={alternarPlay}
              >
                {tocando ? <IconePausa /> : <IconePlay />}
              </button>

              <button
                type="button"
                className="narracao-doca-btn narracao-doca-salto"
                aria-label="Avançar 10 segundos"
                title="Avançar 10s"
                onClick={() => saltar(10)}
              >
                <IconeSalto direcao="frente" />
              </button>
            </div>
          </div>
        )}

        {audioDisponivel === false && (
          <div className="introducao-sem-audio">
            <span className="introducao-sem-audio-icone" aria-hidden="true">
              <IconeFones size={20} />
            </span>
            <p className="muted">Narração em áudio desta introdução em breve.</p>
          </div>
        )}
      </section>

      {/* Os 4 Blocos da Introdução */}
      <main className="introducao-corpo">
        {intro.secoes.map((secao: SecaoIntroducao, idx: number) => {
          const ativa = secaoAtivaId === secao.id
          const tks = tokens(secao.texto)

          return (
            <section
              key={secao.id}
              id={`secao-${secao.id}`}
              className={`introducao-bloco ${ativa ? 'secao-ativa' : ''}`}
              data-secao-id={secao.id}
            >
              <header className="introducao-bloco-cabecalho">
                <span className="introducao-bloco-numero">Pilar {idx + 1}</span>
                <button
                  type="button"
                  className={`introducao-bloco-titulo-btn ${ativa ? 'heading-speaking' : ''}`}
                  onClick={() => pularParaSecao(secao.id)}
                  title="Ouvir a partir desta seção"
                >
                  <h2 className="introducao-bloco-titulo">{secao.subtitulo}</h2>
                </button>
              </header>

              <div className={`prose introducao-bloco-texto ${ativa ? 'prose-speaking' : ''}`}>
                <p>
                  {!ativa ? (
                    secao.texto
                  ) : (
                    <>
                      {tks.map((tk, k) => (
                        <span
                          key={k}
                          data-w={k}
                          className={palavraAtiva === k ? 'word-speaking' : undefined}
                        >
                          {tk}
                          {k < tks.length - 1 ? ' ' : ''}
                        </span>
                      ))}
                    </>
                  )}
                </p>
              </div>
            </section>
          )
        })}
      </main>

      {/* Rodapé e CTA de Leitura */}
      <footer className="introducao-rodape">
        <div className="introducao-rodape-card">
          <div className="introducao-rodape-icone" aria-hidden="true">
            <IconeLivroAberto size={28} />
          </div>
          <h3 className="introducao-rodape-titulo">Iniciar Leitura do Livro</h3>
          <p className="introducao-rodape-sub">
            Mergulhe no texto bíblico a partir do Capítulo 1, com estrutura devocional e referências.
          </p>
          <Link
            to={linkCap1}
            className="cta introducao-cta-grande"
            aria-label={`Iniciar Leitura de ${intro.livro} no Capítulo 1`}
          >
            <IconeLivroAberto size={20} />
            <span>Iniciar Leitura (Capítulo 1)</span>
          </Link>
        </div>

        <div className="introducao-rodape-voltar">
          <Link to={rotaExplorar} className="ghost">
            <IconeVoltar size={18} />
            <span>Voltar ao Explorar</span>
          </Link>
        </div>
      </footer>
    </article>
  )
}
