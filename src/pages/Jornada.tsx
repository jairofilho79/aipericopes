import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { IconePlay } from '../components/NarracaoPlayer'
import { loadIndex, refLabel } from '../lib/content'
import {
  arquivarJornada,
  atualizarJornada,
  criarJornada,
  getJornadaCorrente,
  getPosicaoMaisRecente,
  listAllPosicoes,
  listAllProgresso,
  listJornadas,
  listJornadasAtivas,
} from '../lib/user-db'
import {
  avisosCriacao,
  cursorDaJornada,
  historicoDeJornadas,
  montarCatalogo,
  nomePadrao,
  patchEncerrarJornada,
  patchReiniciarJornada,
  progressoDaJornada,
  reconciliarJornadasEmLote,
  rotaCompletaDoEscopo,
  rotaDaJornada,
  type Catalogo,
  type ItemCatalogo,
  type ModoJornada,
  type ProgressoJornada,
} from '../lib/jornadas'
import { LIMITE_NOME } from '../lib/sync-limits'
import type { Jornada as JornadaType, JornadaTipo, PericopeIndex, PosicaoLeitura, Progresso } from '../lib/types'
import { useSyncRefresh } from '../lib/use-sync-refresh'
import { authClient } from '../lib/auth-client'

export type ItemAtiva = {
  jornada: JornadaType
  prog: ProgressoJornada
  periAtual: PericopeIndex | null
}

type ItemHistorico = { jornada: JornadaType; prog: ProgressoJornada }

type Estado = {
  indice: PericopeIndex[]
  progressos: Map<number, Progresso>
  ativas: ItemAtiva[]
  historico: ItemHistorico[]
}

type ConfirmacaoAcao = { id: string; acao: 'reiniciar' | 'encerrar' } | null

/**
 * O fluxo de criação, os dois passos do catálogo até a jornada gravada.
 * `null` fora do fluxo — é o estado inicial e o que "Cancelar" restaura.
 */
type Criacao =
  | { passo: 1 }
  | {
      passo: 2
      tipo: JornadaTipo
      escopo: string
      /** Rota inteira do escopo, sem corte — o passo 2 corta pelo que o leitor escolher em "Começar em". */
      rotaCompleta: number[]
      /** undefined = nenhum checkpoint dentro do escopo; a opção "de onde parei" some. */
      checkpoint: PosicaoLeitura | undefined
      nomeInicial: string
    }

const NOMES_GRUPO: Record<keyof Catalogo, string> = {
  curta: 'Curta — um livro',
  media: 'Média — um bloco',
  longa: 'Longa — um testamento',
  inteira: 'Inteira',
}

/** Mesma faixa "Ouvir" da Home — só quando `narrado` no índice. */
function BotaoOuvir({ peri, qs }: { peri: PericopeIndex; qs: string }) {
  if (!peri.narrado) return null
  const sufixo = qs ? `&${qs}` : ''
  return (
    <Link
      className="ouvir-botao"
      to={`/leitura/${peri.ordem}?ouvir=1${sufixo}`}
      aria-label={`Ouvir ${peri.titulo_pericope_pt}`}
      title="Ouvir"
    >
      <IconePlay />
    </Link>
  )
}

function GrupoCatalogo({
  titulo,
  itens,
  onEscolher,
}: {
  titulo: string
  itens: ItemCatalogo[]
  onEscolher: (item: ItemCatalogo) => void
}) {
  return (
    <div className="jornada-grupo">
      <h3>{titulo}</h3>
      <ul className="jornada-escopos">
        {itens.map((item) => (
          <li key={`${item.tipo}:${item.escopo}`}>
            <button type="button" className="jornada-escopo" onClick={() => onEscolher(item)}>
              <span className="jornada-escopo-nome">{item.nome}</span>
              <span className="jornada-escopo-tamanho muted">
                {item.total} perícope{item.total === 1 ? '' : 's'} · {item.duracao}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Passo 1: a escada de quatro degraus, do menor escopo ao maior. */
function PassoCatalogo({
  catalogo,
  onEscolher,
  onCancelar,
}: {
  catalogo: Catalogo
  onEscolher: (item: ItemCatalogo) => void
  onCancelar: () => void
}) {
  return (
    <div className="jornada-catalogo">
      <h2>Escolha um escopo</h2>
      {(Object.keys(NOMES_GRUPO) as (keyof Catalogo)[]).map((grupo) => (
        <GrupoCatalogo
          key={grupo}
          titulo={NOMES_GRUPO[grupo]}
          itens={catalogo[grupo]}
          onEscolher={onEscolher}
        />
      ))}
      <button type="button" className="linkish" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}

/**
 * Passo 2: nome, ponto de partida e modo — com os dois avisos ANTES do
 * botão. `nome` acompanha `nomePadrao(...)` enquanto o leitor não editar o
 * campo à mão; a partir daí, a edição manual tem prioridade.
 */
function PassoConfirmacao({
  indice,
  progressos,
  tipo,
  escopo,
  rotaCompleta,
  checkpoint,
  nomeInicial,
  onCriar,
  onCancelar,
}: {
  indice: PericopeIndex[]
  progressos: Map<number, Progresso>
  tipo: JornadaTipo
  escopo: string
  rotaCompleta: number[]
  checkpoint: PosicaoLeitura | undefined
  nomeInicial: string
  onCriar: (input: {
    nome: string
    tipo: JornadaTipo
    escopo: string
    inicioOrdem: number
    contaDesde: string | null
  }) => Promise<void>
  onCancelar: () => void
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [nomeEditado, setNomeEditado] = useState(false)
  const [comecarEm, setComecarEm] = useState<'inicio' | 'checkpoint'>('inicio')
  const [modo, setModo] = useState<ModoJornada>('continuar')
  const [criando, setCriando] = useState(false)

  // `?? 0`: igual ao irmão em escolherEscopo. Hoje inalcançável (todo item do
  // catálogo tem ao menos uma perícope), mas se um escopo vazio chegar aqui,
  // `undefined` viajaria como `inicioOrdem` até o Worker, que reprova
  // `isOrdem(undefined)` e devolve 400 — e sync.ts trata 400 como rejeição
  // determinística, abandonando o lote inteiro (progresso, anotações,
  // destaques e posições que viajavam junto).
  const inicioOrdem =
    comecarEm === 'checkpoint' && checkpoint ? checkpoint.pericopeOrdem : (rotaCompleta[0] ?? 0)
  // A rota que a jornada teria de verdade com este início — é ela, não a
  // rota completa do escopo, que alimenta o aviso de "já lido" abaixo.
  const rotaFinal = useMemo(
    () => rotaCompleta.slice(rotaCompleta.indexOf(inicioOrdem)),
    [rotaCompleta, inicioOrdem],
  )
  const avisos = useMemo(
    () => avisosCriacao(null, modo, rotaFinal, progressos),
    [modo, rotaFinal, progressos],
  )

  useEffect(() => {
    if (!nomeEditado) setNome(nomePadrao(tipo, escopo, inicioOrdem, indice))
  }, [tipo, escopo, inicioOrdem, indice, nomeEditado])

  const checkpointPeri = checkpoint ? indice.find((p) => p.ordem === checkpoint.pericopeOrdem) : undefined

  async function criar() {
    if (criando) return
    setCriando(true)
    try {
      await onCriar({
        // Nome em branco (o leitor apagou tudo) cai de volta no padrão, em
        // vez de gravar uma jornada sem nome.
        nome: nome.trim() || nomePadrao(tipo, escopo, inicioOrdem, indice),
        tipo,
        escopo,
        inicioOrdem,
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

      <fieldset className="jornada-campo">
        <legend>Começar em</legend>
        <label>
          <input
            type="radio"
            name="jornada-comecar-em"
            checked={comecarEm === 'inicio'}
            onChange={() => setComecarEm('inicio')}
          />
          Do início
        </label>
        {checkpointPeri && (
          <label>
            <input
              type="radio"
              name="jornada-comecar-em"
              checked={comecarEm === 'checkpoint'}
              onChange={() => setComecarEm('checkpoint')}
            />
            De onde parei — {refLabel(checkpointPeri)}
          </label>
        )}
      </fieldset>

      <fieldset className="jornada-campo">
        <legend>Modo</legend>
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
          Criar jornada
        </button>
        <button type="button" className="linkish" onClick={onCancelar}>
          Cancelar
        </button>
      </p>
    </div>
  )
}

export default function Jornada() {
  const { data: session } = authClient.useSession()
  const [searchParams] = useSearchParams()
  // ponytail: mock só em DEV — desbloqueia a UI sem login
  const mock = import.meta.env.DEV && searchParams.has('mock')
  const liberado = Boolean(session) || mock
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState<ConfirmacaoAcao>(null)
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [criacao, setCriacao] = useState<Criacao | null>(() =>
    searchParams.get('nova') === '1' ? { passo: 1 } : null,
  )

  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setCriacao((prev) => (prev === null ? { passo: 1 } : prev))
    }
  }, [searchParams])

  // Derivado do índice já carregado, não de public/data/index.json de novo —
  // useMemo em vez de outro estado porque é puramente função de `estado`.
  const catalogo = useMemo(() => (estado ? montarCatalogo(estado.indice) : null), [estado])

  const carregar = useCallback(async () => {
    try {
      const all = await loadIndex()
      // ponytail: mock em memória + import dinâmico — fora do bundle de prod
      if (mock) {
        const { estadoMockJornada } = await import('../lib/mock-jornada')
        const mockDados = estadoMockJornada(all)
        const rota = rotaDaJornada(mockDados.corrente, all)
        const cursor = cursorDaJornada(rota, mockDados.progressos, new Map(), mockDados.corrente.contaDesde)
        const periAtual = cursor === null ? null : all.find((p) => p.ordem === cursor) ?? null
        setEstado({
          indice: all,
          progressos: mockDados.progressos,
          ativas: [
            {
              jornada: mockDados.corrente,
              prog: mockDados.progCorrente,
              periAtual,
            },
          ],
          historico: mockDados.historico,
        })
        return
      }

      const progressos = new Map((await listAllProgresso()).map((p) => [p.pericopeOrdem, p]))
      const posicoesList = typeof listAllPosicoes === 'function' ? await listAllPosicoes() : []
      const posicoes = new Map(posicoesList.map((p) => [p.pericopeOrdem, p]))

      const ativasDirect = typeof listJornadasAtivas === 'function' ? await listJornadasAtivas() : []
      const todas = await listJornadas()
      const corrente = typeof getJornadaCorrente === 'function' ? await getJornadaCorrente() : undefined

      const ativasJornadas =
        ativasDirect.length > 0
          ? ativasDirect
          : todas.filter((j) => j.arquivadaEm === null).length > 0
            ? todas.filter((j) => j.arquivadaEm === null)
            : corrente
              ? [corrente]
              : []

      const patches = reconciliarJornadasEmLote(ativasJornadas, all, progressos)
      for (const p of patches) {
        await atualizarJornada(p.id, p.patch)
      }
      const patchMap = new Map(patches.map((p) => [p.id, p.patch]))

      const ativas: ItemAtiva[] = ativasJornadas.map((j) => {
        const patch = patchMap.get(j.id)
        const jAtualizada = patch ? { ...j, ...patch } : j
        const rota = rotaDaJornada(jAtualizada, all)
        const prog = progressoDaJornada(rota, progressos, jAtualizada.contaDesde)
        const cursor = cursorDaJornada(rota, progressos, posicoes, jAtualizada.contaDesde)
        const periAtual = cursor === null ? null : all.find((p) => p.ordem === cursor) ?? null
        return { jornada: jAtualizada, prog, periAtual }
      })

      const historico = historicoDeJornadas(todas).map((j) => ({
        jornada: j,
        prog: progressoDaJornada(rotaDaJornada(j, all), progressos, j.contaDesde),
      }))

      setEstado({ indice: all, progressos, ativas, historico })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    }
  }, [mock])

  useEffect(() => {
    if (liberado) void carregar()
  }, [liberado, carregar])

  useSyncRefresh(() => {
    if (liberado) void carregar()
  })

  async function renomear(id: string, nome: string) {
    if (aplicando) return
    setAplicando(true)
    try {
      if (mock) {
        if (estado) {
          setEstado({
            ...estado,
            ativas: estado.ativas.map((item) =>
              item.jornada.id === id ? { ...item, jornada: { ...item.jornada, nome } } : item,
            ),
          })
        }
        setRenomeandoId(null)
        return
      }
      await atualizarJornada(id, { nome })
      setRenomeandoId(null)
      await carregar()
    } finally {
      setAplicando(false)
    }
  }

  async function executarAcao(id: string, acao: 'reiniciar' | 'encerrar') {
    if (aplicando) return
    setAplicando(true)
    try {
      if (mock) {
        if (!estado) return
        const agora = new Date().toISOString()
        if (acao === 'encerrar') {
          const itemAlvo = estado.ativas.find((item) => item.jornada.id === id)
          if (itemAlvo) {
            setEstado({
              ...estado,
              ativas: estado.ativas.filter((item) => item.jornada.id !== id),
              historico: [
                {
                  jornada: { ...itemAlvo.jornada, arquivadaEm: agora },
                  prog: itemAlvo.prog,
                },
                ...estado.historico,
              ],
            })
          }
        } else if (acao === 'reiniciar') {
          setEstado({
            ...estado,
            ativas: estado.ativas.map((item) => {
              if (item.jornada.id !== id) return item
              const atualizada = { ...item.jornada, contaDesde: agora, concluidaEm: null }
              const rota = rotaDaJornada(atualizada, estado.indice)
              const prog = progressoDaJornada(rota, estado.progressos, atualizada.contaDesde)
              const cursor = cursorDaJornada(rota, estado.progressos, new Map(), atualizada.contaDesde)
              const periAtual = cursor === null ? null : estado.indice.find((p) => p.ordem === cursor) ?? null
              return { jornada: atualizada, prog, periAtual }
            }),
          })
        }
        setConfirmando(null)
        return
      }

      if (acao === 'reiniciar') {
        await atualizarJornada(id, patchReiniciarJornada())
      } else {
        if (typeof arquivarJornada === 'function') {
          await arquivarJornada(id)
        } else {
          await atualizarJornada(id, patchEncerrarJornada())
        }
      }
      setConfirmando(null)
      await carregar()
    } finally {
      setAplicando(false)
    }
  }

  async function escolherEscopo(item: ItemCatalogo) {
    if (!estado) return
    const rotaCompleta = rotaCompletaDoEscopo(item.tipo, item.escopo, estado.indice)
    // O checkpoint mais recente DENTRO do escopo, não da leitura em geral —
    // "de onde parei" só faz sentido se aquele ponto pertence a esta jornada.
    const checkpoint = await getPosicaoMaisRecente(rotaCompleta)
    const inicioOrdem = rotaCompleta[0] ?? 0
    setCriacao({
      passo: 2,
      tipo: item.tipo,
      escopo: item.escopo,
      rotaCompleta,
      checkpoint,
      nomeInicial: nomePadrao(item.tipo, item.escopo, inicioOrdem, estado.indice),
    })
  }

  async function criar(input: {
    nome: string
    tipo: JornadaTipo
    escopo: string
    inicioOrdem: number
    contaDesde: string | null
  }) {
    if (mock) {
      if (!estado) return
      const agora = new Date().toISOString()
      const nova: JornadaType = {
        id: `mock-${crypto.randomUUID()}`,
        nome: input.nome,
        tipo: input.tipo,
        escopo: input.escopo,
        inicioOrdem: input.inicioOrdem,
        contaDesde: input.contaDesde,
        criadoEm: agora,
        atualizadoEm: agora,
        arquivadaEm: null,
        concluidaEm: null,
      }
      const rota = rotaDaJornada(nova, estado.indice)
      const prog = progressoDaJornada(rota, estado.progressos, nova.contaDesde)
      const cursor = cursorDaJornada(rota, estado.progressos, new Map(), nova.contaDesde)
      const periAtual = cursor === null ? null : estado.indice.find((p) => p.ordem === cursor) ?? null
      setEstado({
        ...estado,
        ativas: [{ jornada: nova, prog, periAtual }, ...estado.ativas],
      })
      setCriacao(null)
      return
    }
    await criarJornada(input)
    navigate('/') // a Home já mostra o card da nova jornada
  }

  if (!liberado) {
    return (
      <section className="jornada">
        <h1>Jornada</h1>
        <p className="lead">
          <Link to="/entrar">Entre</Link> para criar e acompanhar suas jornadas de leitura.
        </p>
      </section>
    )
  }

  if (erro) return <p className="muted">{erro}</p>
  if (!estado || !catalogo) return <p className="muted">Carregando…</p>

  return (
    <section className="jornada">
      <h1>Jornada</h1>

      {estado.ativas.length > 0 ? (
        <div className="jornadas-ativas">
          {estado.ativas.map(({ jornada: j, prog, periAtual }) => {
            const qsLeitura = [
              `jornadaId=${encodeURIComponent(j.id)}`,
              'de=jornada',
              mock ? 'mock=1' : '',
            ]
              .filter(Boolean)
              .join('&')
            const estaConfirmando = confirmando?.id === j.id
            const estaRenomeando = renomeandoId === j.id

            return (
              <article key={j.id} className="jornada-card">
                {estaRenomeando ? (
                  <form
                    className="jornada-form-renomear"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const trimmed = novoNome.trim()
                      if (trimmed && trimmed !== j.nome) {
                        void renomear(j.id, trimmed)
                      } else {
                        setRenomeandoId(null)
                      }
                    }}
                  >
                    <input
                      type="text"
                      className="jornada-input-nome"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      aria-label="Novo nome da jornada"
                      autoFocus
                    />
                    <button type="submit" className="linkish" disabled={aplicando}>
                      Salvar
                    </button>
                    <button type="button" className="linkish" onClick={() => setRenomeandoId(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="jornada-titulo-wrap">
                    <h2>{j.nome}</h2>
                    <button
                      type="button"
                      className="jornada-btn-renomear"
                      title="Renomear jornada"
                      aria-label={`Renomear jornada ${j.nome}`}
                      onClick={() => {
                        setNovoNome(j.nome)
                        setRenomeandoId(j.id)
                      }}
                    >
                      Renomear
                    </button>
                  </div>
                )}
                <p className="track-progress">
                  {prog.concluidas} de {prog.total}
                  {prog.proximaOrdem === null ? ' · concluída' : ''}
                </p>
                {/* a barra é decoração: quem lê com leitor de tela recebe o "N de M" no parágrafo acima */}
                <span className="book-progress" aria-hidden>
                  <span className="book-progress-fill" style={{ width: `${prog.pct}%` }} />
                </span>
                {periAtual && (
                  <div className="card-acoes">
                    <Link className="cta" to={`/leitura/${periAtual.ordem}?${qsLeitura}`}>
                      Continuar
                    </Link>
                    <BotaoOuvir peri={periAtual} qs={qsLeitura} />
                  </div>
                )}
                {estaConfirmando ? (
                  <p className="jornada-confirmar">
                    <span className="muted">
                      {confirmando.acao === 'reiniciar'
                        ? 'Reiniciar esta jornada do zero?'
                        : 'Encerrar esta jornada?'}
                    </span>
                    <button
                      type="button"
                      className="linkish"
                      disabled={aplicando}
                      onClick={() => void executarAcao(j.id, confirmando.acao)}
                    >
                      Sim
                    </button>
                    <button type="button" className="linkish" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </button>
                  </p>
                ) : (
                  <p className="jornada-acoes">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setConfirmando({ id: j.id, acao: 'reiniciar' })}
                    >
                      Reiniciar
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setConfirmando({ id: j.id, acao: 'encerrar' })}
                    >
                      Encerrar
                    </button>
                  </p>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <p className="muted">Nenhuma jornada ainda.</p>
      )}

      {criacao === null ? (
        <p className="jornada-convite">
          <button type="button" className="ghost" onClick={() => setCriacao({ passo: 1 })}>
            {estado.ativas.length > 0 ? 'Nova jornada' : 'Comece uma jornada'}
          </button>
        </p>
      ) : criacao.passo === 1 ? (
        <PassoCatalogo
          catalogo={catalogo}
          onEscolher={(item) => void escolherEscopo(item)}
          onCancelar={() => setCriacao(null)}
        />
      ) : (
        <PassoConfirmacao
          indice={estado.indice}
          progressos={estado.progressos}
          tipo={criacao.tipo}
          escopo={criacao.escopo}
          rotaCompleta={criacao.rotaCompleta}
          checkpoint={criacao.checkpoint}
          nomeInicial={criacao.nomeInicial}
          onCriar={criar}
          onCancelar={() => setCriacao(null)}
        />
      )}

      {estado.historico.length > 0 && (
        <>
          <h2 className="jornada-historico-titulo">Anteriores</h2>
          <ul className="jornada-historico">
            {estado.historico.map(({ jornada, prog }) => (
              <li key={jornada.id}>
                <span className="jornada-historico-nome">{jornada.nome}</span>
                <span className="track-progress">
                  {prog.concluidas} de {prog.total}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
