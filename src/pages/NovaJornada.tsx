import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconeFechar, IconeMais, IconeSetaEsquerda } from '../components/icones'
import { TempoEstimado } from '../components/TempoEstimado'
import { loadIndex, refLabel } from '../lib/content'
import { criarJornada, listAllProgresso } from '../lib/user-db'
import {
  avisosCriacao,
  montarCatalogo,
  nomePadrao,
  rotaCompletaDoEscopo,
  tamanhoDoEscopo,
  type Catalogo,
  type ItemCatalogo,
  type ModoJornada,
} from '../lib/jornadas'
import { LIMITE_NOME } from '../lib/sync-limits'
import type { JornadaTipo, PericopeIndex, Progresso } from '../lib/types'
import { authClient } from '../lib/auth-client'

/**
 * Variante visual por grupo: mapeia o nível de grandiosidade do card.
 * Curta = mais leve, Inteira = mais grandiosa.
 */
type Variante = 'curta' | 'media' | 'longa' | 'inteira'

const NOMES_GRUPO: Record<keyof Catalogo, string> = {
  curta: 'Curta — um livro',
  media: 'Média — um bloco',
  longa: 'Longa — um testamento',
  inteira: 'Inteira',
}

const VARIANTE_GRUPO: Record<keyof Catalogo, Variante> = {
  curta: 'curta',
  media: 'media',
  longa: 'longa',
  inteira: 'inteira',
}

/** Máximo de itens exibidos por padrão antes do "Ver mais". */
const LIMITE_PADRAO = 5

// ── Tooltip de Ajuda ─────────────────────────────────────────────────────────

/**
 * Ícone `(?)` inline que abre um balão explicativo ao clicar.
 * Fecha clicando novamente ou ao perder foco.
 */
function TooltipAjuda({ texto }: { texto: string }) {
  const [visivel, setVisivel] = useState(false)
  return (
    <span className="tooltip-ajuda">
      <button
        type="button"
        className="tooltip-btn"
        aria-label="Ajuda"
        aria-expanded={visivel}
        onClick={() => setVisivel((v) => !v)}
      >
        ?
      </button>
      {visivel && (
        <span className="tooltip-balao" role="tooltip">
          {texto}
          <button
            type="button"
            className="tooltip-fechar"
            aria-label="Fechar ajuda"
            onClick={() => setVisivel(false)}
          >
            <IconeFechar size={11} />
          </button>
        </span>
      )}
    </span>
  )
}

// ── Grupo do catálogo com expand/collapse e "Ver mais" ───────────────────────

function GrupoCatalogo({
  titulo,
  itens,
  variante,
  onEscolher,
}: {
  titulo: string
  itens: ItemCatalogo[]
  variante: Variante
  onEscolher: (item: ItemCatalogo) => void
}) {
  const [aberto, setAberto] = useState(true)
  const [verMais, setVerMais] = useState(false)

  const temMais = itens.length > LIMITE_PADRAO
  const visiveis = verMais ? itens : itens.slice(0, LIMITE_PADRAO)
  const ocultos = itens.length - LIMITE_PADRAO

  return (
    <div className={`jornada-grupo jornada-grupo--${variante}`}>
      <button
        type="button"
        className="jornada-grupo-header"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <h3>{titulo}</h3>
        <span className="jornada-grupo-chevron" aria-hidden>
          {aberto ? '▼' : '▶'}
        </span>
      </button>

      {aberto && (
        <>
          <ul className="jornada-escopos">
            {visiveis.map((item) => (
              <li key={`${item.tipo}:${item.escopo}`}>
                <button
                  type="button"
                  className={`jornada-escopo jornada-escopo--${variante}`}
                  onClick={() => onEscolher(item)}
                >
                  <span className="jornada-escopo-nome">{item.nome}</span>
                  <span className="jornada-escopo-tamanho muted">
                    {item.total} perícope{item.total === 1 ? '' : 's'} ·{' '}
                    <TempoEstimado leitura={item.duracaoLeitura} audio={item.duracaoAudio} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {temMais && !verMais && (
            <button
              type="button"
              className="jornada-ver-mais linkish"
              onClick={() => setVerMais(true)}
            >
              Ver mais ({ocultos} oculto{ocultos === 1 ? '' : 's'}) ↓
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Passo 1: Catálogo ────────────────────────────────────────────────────────

/** Passo 1: a escada de quatro degraus, do menor escopo ao maior. */
function PassoCatalogo({
  catalogo,
  onEscolher,
}: {
  catalogo: Catalogo
  onEscolher: (item: ItemCatalogo) => void
}) {
  return (
    <div className="jornada-catalogo">
      <h2>Escolha um escopo</h2>
      {(Object.keys(NOMES_GRUPO) as (keyof Catalogo)[]).map((grupo) => (
        <GrupoCatalogo
          key={grupo}
          titulo={NOMES_GRUPO[grupo]}
          itens={catalogo[grupo]}
          variante={VARIANTE_GRUPO[grupo]}
          onEscolher={onEscolher}
        />
      ))}
    </div>
  )
}

// ── Seletor de Perícope ──────────────────────────────────────────────────────

/**
 * Seletor inline de perícopes — reutilizado para "Começar em" e "Terminar em".
 * Mostra a lista agrupada por livro com ✓ nas já concluídas e destaque na selecionada.
 */
function SeletorPericope({
  label,
  pericopes,
  progressos,
  selecionada,
  onEscolher,
}: {
  label: string
  pericopes: PericopeIndex[]
  progressos: Map<number, Progresso>
  selecionada: number
  onEscolher: (ordem: number) => void
}) {
  const porLivro = useMemo(() => {
    const grupos: { livro: string; itens: PericopeIndex[] }[] = []
    for (const p of pericopes) {
      const ultimo = grupos[grupos.length - 1]
      if (ultimo && ultimo.livro === p.livro) {
        ultimo.itens.push(p)
      } else {
        grupos.push({ livro: p.livro, itens: [p] })
      }
    }
    return grupos
  }, [pericopes])

  return (
    <div className="seletor-pericope">
      <p className="seletor-pericope-label">{label}</p>
      <div className="seletor-pericope-lista">
        {porLivro.map((g) => (
          <div key={g.livro} className="seletor-pericope-livro">
            <span className="seletor-pericope-livro-nome">{g.livro}</span>
            <ul>
              {g.itens.map((p) => {
                const lida = progressos.get(p.ordem)?.status === 'concluido'
                const ativa = p.ordem === selecionada
                return (
                  <li key={p.ordem}>
                    <button
                      type="button"
                      className={`seletor-pericope-item${ativa ? ' seletor-pericope-item--ativa' : ''}`}
                      onClick={() => onEscolher(p.ordem)}
                      aria-pressed={ativa}
                    >
                      <span className="seletor-pericope-check" aria-hidden>
                        {lida ? '✓' : ''}
                      </span>
                      <span className="seletor-pericope-texto">
                        <strong>{p.titulo_pericope_pt}</strong>
                        <span className="muted ref">
                          <span>{refLabel(p)}</span>
                          <span className="ref-sep" aria-hidden="true">
                            ·
                          </span>
                          <TempoEstimado leitura={p.minutos} audio={p.audio_minutos} />
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Passo 2: Confirmação ─────────────────────────────────────────────────────

/**
 * Passo 2: nome, ponto de partida, ponto de término e modo.
 * Com tooltips (?) explicativos ao lado dos títulos de campo.
 */
function PassoConfirmacao({
  indice,
  progressos,
  tipo,
  escopo,
  rotaCompleta,
  nomeInicial,
  onCriar,
  onCancelar,
}: {
  indice: PericopeIndex[]
  progressos: Map<number, Progresso>
  tipo: JornadaTipo
  escopo: string
  rotaCompleta: number[]
  nomeInicial: string
  onCriar: (input: {
    nome: string
    tipo: JornadaTipo
    escopo: string
    inicioOrdem: number
    fimOrdem?: number
    contaDesde: string | null
  }) => Promise<void>
  onCancelar: () => void
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [nomeEditado, setNomeEditado] = useState(false)
  const [modo, setModo] = useState<ModoJornada>('continuar')
  const [criando, setCriando] = useState(false)

  const [inicioIdx, setInicioIdx] = useState(0)
  const [fimIdx, setFimIdx] = useState(rotaCompleta.length - 1)

  const pericopesRota = useMemo(
    () => rotaCompleta.map((o) => indice.find((p) => p.ordem === o)).filter(Boolean) as PericopeIndex[],
    [rotaCompleta, indice],
  )

  const inicioOrdem = rotaCompleta[inicioIdx] ?? 0
  const fimOrdem = rotaCompleta[fimIdx] ?? 0

  const pericopesParaFim = useMemo(() => pericopesRota.slice(inicioIdx), [pericopesRota, inicioIdx])

  useEffect(() => {
    if (fimIdx < inicioIdx) setFimIdx(inicioIdx)
  }, [inicioIdx, fimIdx])

  const rotaFinal = useMemo(
    () => rotaCompleta.slice(inicioIdx, fimIdx + 1),
    [rotaCompleta, inicioIdx, fimIdx],
  )

  const tamanhoFinal = useMemo(() => {
    const selecionadas = pericopesRota.slice(inicioIdx, fimIdx + 1)
    return tamanhoDoEscopo(selecionadas)
  }, [pericopesRota, inicioIdx, fimIdx])

  const avisos = useMemo(
    () => avisosCriacao(null, modo, rotaFinal, progressos),
    [modo, rotaFinal, progressos],
  )

  useEffect(() => {
    if (!nomeEditado) setNome(nomePadrao(tipo, escopo, inicioOrdem, indice))
  }, [tipo, escopo, inicioOrdem, indice, nomeEditado])

  const [painelAberto, setPainelAberto] = useState<'inicio' | 'fim' | null>(null)

  const periInicio = pericopesRota[inicioIdx]
  const periFim = pericopesRota[fimIdx]

  const ehEscopoCompleto = inicioIdx === 0 && fimIdx === rotaCompleta.length - 1

  function construirLabelFim(): string {
    if (!periFim) return 'Fim do escopo'
    if (ehEscopoCompleto) return `Fim — ${refLabel(periFim)}`
    return refLabel(periFim)
  }

  async function criar() {
    if (criando) return
    setCriando(true)
    try {
      await onCriar({
        nome: nome.trim() || nomePadrao(tipo, escopo, inicioOrdem, indice),
        tipo,
        escopo,
        inicioOrdem,
        fimOrdem: ehEscopoCompleto ? undefined : fimOrdem,
        contaDesde: modo === 'reler' ? new Date().toISOString() : null,
      })
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="jornada-confirmacao">
      <h2>Confirme sua jornada</h2>
      <label className="jornada-campo">
        Nome
        <input
          type="text"
          value={nome}
          maxLength={LIMITE_NOME}
          onChange={(e) => {
            setNome(e.target.value)
            setNomeEditado(true)
          }}
        />
      </label>

      <div className="jornada-confirmacao-resumo">
        <span className="jornada-confirmacao-total">
          {rotaFinal.length} {rotaFinal.length === 1 ? 'perícope selecionada' : 'perícopes selecionadas'}
        </span>
        <span className="jornada-confirmacao-sep">·</span>
        <TempoEstimado leitura={tamanhoFinal.duracaoLeitura} audio={tamanhoFinal.duracaoAudio} />
      </div>

      {/* ── Começar em ── */}
      <div className="jornada-campo">
        <span className="jornada-campo-legenda">
          Começar em
          <TooltipAjuda texto="A perícope em que sua leitura começa. Você pode adiantar para pular partes já lidas." />
        </span>
        <button
          type="button"
          className={`seletor-pericope-botao${painelAberto === 'inicio' ? ' seletor-pericope-botao--aberto' : ''}`}
          onClick={() => setPainelAberto(painelAberto === 'inicio' ? null : 'inicio')}
        >
          {periInicio ? (
            <>
              <strong>{periInicio.titulo_pericope_pt}</strong>
              <span className="muted">{refLabel(periInicio)}</span>
              <span className="seletor-pericope-tempos">
                <TempoEstimado leitura={periInicio.minutos} audio={periInicio.audio_minutos} />
              </span>
            </>
          ) : (
            <span className="muted">Início do escopo</span>
          )}
          <span className="seletor-chevron" aria-hidden>
            {painelAberto === 'inicio' ? '▲' : '▼'}
          </span>
        </button>
        {painelAberto === 'inicio' && (
          <SeletorPericope
            label="Escolha a perícope de início"
            pericopes={pericopesRota}
            progressos={progressos}
            selecionada={inicioOrdem}
            onEscolher={(o) => {
              const idx = rotaCompleta.indexOf(o)
              if (idx >= 0) setInicioIdx(idx)
              setPainelAberto(null)
            }}
          />
        )}
      </div>

      {/* ── Terminar em ── */}
      <div className="jornada-campo">
        <span className="jornada-campo-legenda">
          Terminar em
          <TooltipAjuda texto="A última perícope da jornada (inclusive). Por padrão é o fim do escopo escolhido." />
        </span>
        <button
          type="button"
          className={`seletor-pericope-botao${painelAberto === 'fim' ? ' seletor-pericope-botao--aberto' : ''}`}
          onClick={() => setPainelAberto(painelAberto === 'fim' ? null : 'fim')}
        >
          {periFim ? (
            <>
              <strong>{construirLabelFim()}</strong>
              {!ehEscopoCompleto && <span className="muted">{periFim.titulo_pericope_pt}</span>}
              <span className="seletor-pericope-tempos">
                <TempoEstimado leitura={periFim.minutos} audio={periFim.audio_minutos} />
              </span>
            </>
          ) : (
            <span className="muted">Fim do escopo</span>
          )}
          <span className="seletor-chevron" aria-hidden>
            {painelAberto === 'fim' ? '▲' : '▼'}
          </span>
        </button>
        {painelAberto === 'fim' && (
          <SeletorPericope
            label="Escolha a perícope de término (inclusive)"
            pericopes={pericopesParaFim}
            progressos={progressos}
            selecionada={fimOrdem}
            onEscolher={(o) => {
              const idx = rotaCompleta.indexOf(o)
              if (idx >= 0) setFimIdx(idx)
              setPainelAberto(null)
            }}
          />
        )}
      </div>

      {/* ── Modo ── */}
      <fieldset className="jornada-campo">
        <legend>
          Modo
          <TooltipAjuda texto="Continuar mantém seu progresso anterior — a jornada avança de onde você parou. Reler ignora leituras passadas e começa do zero." />
        </legend>
        <label>
          <input
            type="radio"
            name="jornada-modo"
            checked={modo === 'continuar'}
            onChange={() => setModo('continuar')}
          />
          Continuar
        </label>
        <label>
          <input
            type="radio"
            name="jornada-modo"
            checked={modo === 'reler'}
            onChange={() => setModo('reler')}
          />
          Reler
        </label>
      </fieldset>

      {avisos.escopoJaLido && (
        <p className="jornada-aviso">
          Você já leu tudo desse escopo; em modo Reler ela começa do zero.
        </p>
      )}

      <p className="jornada-acoes">
        <button type="button" className="cta" disabled={criando} onClick={() => void criar()}>
          <IconeMais size={18} />
          <span>Criar jornada</span>
        </button>
        <button type="button" className="linkish" onClick={onCancelar}>
          Cancelar
        </button>
      </p>
    </div>
  )
}



// ── Tipo de estado do fluxo de criação ───────────────────────────────────────

type Criacao =
  | null
  | {
      tipo: JornadaTipo
      escopo: string
      rotaCompleta: number[]
      nomeInicial: string
    }

// ── Página Principal ──────────────────────────────────────────────────────────

export default function NovaJornada() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  const [indice, setIndice] = useState<PericopeIndex[] | null>(null)
  const [progressos, setProgressos] = useState<Map<number, Progresso>>(new Map())
  const [erro, setErro] = useState('')
  const [criacao, setCriacao] = useState<Criacao>(null)

  const catalogo = useMemo(() => (indice ? montarCatalogo(indice) : null), [indice])

  const carregar = useCallback(async () => {
    try {
      const all = await loadIndex()
      const progressosList = await listAllProgresso()
      const progMap = new Map(progressosList.map((p) => [p.pericopeOrdem, p]))
      setIndice(all)
      setProgressos(progMap)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    }
  }, [])

  useEffect(() => {
    if (!session) return
    void carregar()
  }, [session, carregar])

  async function escolherEscopo(item: ItemCatalogo) {
    if (!indice) return
    const rotaCompleta = rotaCompletaDoEscopo(item.tipo, item.escopo, indice)
    const inicioOrdem = rotaCompleta[0] ?? 0
    setCriacao({
      tipo: item.tipo,
      escopo: item.escopo,
      rotaCompleta,
      nomeInicial: nomePadrao(item.tipo, item.escopo, inicioOrdem, indice),
    })
  }

  async function criar(input: {
    nome: string
    tipo: JornadaTipo
    escopo: string
    inicioOrdem: number
    fimOrdem?: number
    contaDesde: string | null
  }) {
    await criarJornada(input)
    navigate('/')
  }

  // Usuário não logado: redireciona para /entrar via mensagem
  if (!session) {
    return (
      <section className="nova-jornada">
        <p className="lead">
          <Link to="/entrar">Entre</Link> para criar e acompanhar suas jornadas de leitura.
        </p>
      </section>
    )
  }

  if (erro) return <p className="muted">{erro}</p>
  if (!indice || !catalogo) return <p className="muted">Carregando…</p>

  return (
    <section className="nova-jornada">
      {/* Cabeçalho da página com botão Voltar */}
      <div className="nova-jornada-topo">
        <Link to="/jornada" className="nova-jornada-voltar linkish">
          <IconeSetaEsquerda size={15} />
          <span>Jornadas</span>
        </Link>
        <h1>Nova jornada</h1>
      </div>

      {criacao === null ? (
        <PassoCatalogo
          catalogo={catalogo}
          onEscolher={(item) => void escolherEscopo(item)}
        />
      ) : (
        <PassoConfirmacao
          indice={indice}
          progressos={progressos}
          tipo={criacao.tipo}
          escopo={criacao.escopo}
          rotaCompleta={criacao.rotaCompleta}
          nomeInicial={criacao.nomeInicial}
          onCriar={criar}
          onCancelar={() => setCriacao(null)}
        />
      )}
    </section>
  )
}
