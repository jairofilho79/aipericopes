import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadIndex, refLabel } from '../lib/content'
import {
  atualizarJornada,
  criarJornada,
  getJornadaCorrente,
  getPosicaoMaisRecente,
  listAllProgresso,
  listJornadas,
} from '../lib/user-db'
import {
  avisosCriacao,
  historicoDeJornadas,
  montarCatalogo,
  nomePadrao,
  patchEncerrarJornada,
  patchReiniciarJornada,
  progressoDaJornada,
  reconciliacaoDeConclusao,
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

type ItemHistorico = { jornada: JornadaType; prog: ProgressoJornada }

type Estado = {
  indice: PericopeIndex[]
  progressos: Map<number, Progresso>
  corrente: JornadaType | null
  progCorrente: ProgressoJornada | null
  historico: ItemHistorico[]
}

/** Qual das duas ações pede confirmação inline agora — nunca as duas ao mesmo tempo. */
type Confirmando = 'reiniciar' | 'encerrar' | null

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
  corrente,
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
  corrente: JornadaType | null
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
    () => avisosCriacao(corrente, modo, rotaFinal, progressos),
    [corrente, modo, rotaFinal, progressos],
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

      {/* Os dois avisos vêm ANTES do botão — não depois do fato. */}
      {avisos.arquivaAtual && corrente && (
        <p className="jornada-aviso">
          Isto arquiva <em>{corrente.nome}</em>, que fica no histórico.
        </p>
      )}
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
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState<Confirmando>(null)
  const [aplicando, setAplicando] = useState(false)
  const [criacao, setCriacao] = useState<Criacao | null>(null)

  // Derivado do índice já carregado, não de public/data/index.json de novo —
  // useMemo em vez de outro estado porque é puramente função de `estado`.
  const catalogo = useMemo(() => (estado ? montarCatalogo(estado.indice) : null), [estado])

  const carregar = useCallback(async () => {
    try {
      const all = await loadIndex()
      // Uma varredura só do progresso: tanto a jornada corrente quanto cada
      // item do histórico calculam o progresso final sobre o mesmo Map —
      // mesma economia que Home.tsx já faz. O catálogo e o passo 2 da
      // criação também reaproveitam este Map em vez de relerem o store.
      const progressos = new Map((await listAllProgresso()).map((p) => [p.pericopeOrdem, p]))
      const [corrente, todas] = await Promise.all([getJornadaCorrente(), listJornadas()])
      const progCorrente = corrente
        ? progressoDaJornada(rotaDaJornada(corrente, all), progressos, corrente.contaDesde)
        : null
      // Mesma reconciliação de Home.tsx, mesmo padrão: a spec promete que os
      // dois caminhos de carga (Home e /jornada) reconciliam `concluidaEm`,
      // idempotente. Sem custo hoje (nada lê o campo para comportamento aqui),
      // mas é a divergência declarada da spec que vira dívida quando alguém
      // ler o campo.
      if (corrente && progCorrente) {
        const patch = reconciliacaoDeConclusao(corrente, progCorrente.proximaOrdem)
        if (patch) await atualizarJornada(corrente.id, patch)
      }
      const historico = historicoDeJornadas(todas).map((j) => ({
        jornada: j,
        prog: progressoDaJornada(rotaDaJornada(j, all), progressos, j.contaDesde),
      }))
      setEstado({ indice: all, progressos, corrente: corrente ?? null, progCorrente, historico })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    }
  }, [])

  useEffect(() => {
    if (session) void carregar()
  }, [session, carregar])
  // Uma jornada criada ou mudada em outro aparelho precisa aparecer aqui sem
  // que o leitor precise navegar para fora e voltar (mesmo padrão de Home e
  // Índice).
  useSyncRefresh(() => {
    if (session) void carregar()
  })

  async function aplicar(patch: Partial<Pick<JornadaType, 'contaDesde' | 'concluidaEm' | 'arquivadaEm'>>) {
    if (!estado?.corrente || aplicando) return
    setAplicando(true)
    try {
      await atualizarJornada(estado.corrente.id, patch)
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
    // criarJornada arquiva a corrente anterior (se houver) na mesma
    // transação — o aviso do passo 2 já preparou o leitor para isso.
    await criarJornada(input)
    navigate('/') // a Home já mostra o card da nova jornada
  }

  if (!session) {
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

      {estado.corrente && estado.progCorrente ? (
        <article className="jornada-card">
          <h2>{estado.corrente.nome}</h2>
          <p className="track-progress">
            {estado.progCorrente.concluidas} de {estado.progCorrente.total}
            {estado.progCorrente.proximaOrdem === null ? ' · concluída' : ''}
          </p>
          {/* a barra é decoração: quem lê com leitor de tela recebe o "N de M" no parágrafo acima */}
          <span className="book-progress" aria-hidden>
            <span className="book-progress-fill" style={{ width: `${estado.progCorrente.pct}%` }} />
          </span>
          {confirmando ? (
            <p className="jornada-confirmar">
              <span className="muted">
                {confirmando === 'reiniciar'
                  ? 'Reiniciar esta jornada do zero?'
                  : 'Encerrar esta jornada?'}
              </span>
              <button
                type="button"
                className="linkish"
                disabled={aplicando}
                onClick={() =>
                  void aplicar(
                    confirmando === 'reiniciar' ? patchReiniciarJornada() : patchEncerrarJornada(),
                  )
                }
              >
                Sim
              </button>
              <button type="button" className="linkish" onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
            </p>
          ) : (
            <p className="jornada-acoes">
              <button type="button" className="ghost" onClick={() => setConfirmando('reiniciar')}>
                Reiniciar
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmando('encerrar')}>
                Encerrar
              </button>
            </p>
          )}
        </article>
      ) : (
        <p className="muted">Nenhuma jornada ainda.</p>
      )}

      {criacao === null ? (
        <p className="jornada-convite">
          <button type="button" className="ghost" onClick={() => setCriacao({ passo: 1 })}>
            {estado.corrente ? 'Nova jornada' : 'Comece uma jornada'}
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
          corrente={estado.corrente}
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
