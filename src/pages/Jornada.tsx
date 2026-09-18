import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  IconeBandeira,
  IconeFones,
  IconeLapis,
  IconeLivroAberto,
  IconeMais,
  IconeOlho,
  IconeReiniciar,
} from '../components/icones'
import { TempoEstimado } from '../components/TempoEstimado'
import { loadIndex, refLabel } from '../lib/content'
import {
  arquivarJornada,
  atualizarJornada,
  getJornadaCorrente,
  listAllPosicoes,
  listAllProgresso,
  listJornadas,
  listJornadasAtivas,
} from '../lib/user-db'
import {
  cursorDaJornada,
  historicoDeJornadas,
  patchEncerrarJornada,
  patchReiniciarJornada,
  progressoDaJornada,
  reconciliarJornadasEmLote,
  rotaDaJornada,
  tamanhoDoEscopo,
  type ProgressoJornada,
} from '../lib/jornadas'
import type { Jornada as JornadaType, PericopeIndex, Progresso } from '../lib/types'
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
      <IconeFones size={18} />
      <span>Ouvir</span>
    </Link>
  )
}

export default function Jornada() {
  const { data: session } = authClient.useSession()
  const [searchParams] = useSearchParams()
  // ponytail: mock só em DEV — desbloqueia a UI sem login
  const mock = import.meta.env.DEV && searchParams.has('mock')
  const liberado = Boolean(session) || mock
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState<ConfirmacaoAcao>(null)
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [aplicando, setAplicando] = useState(false)

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
  if (!estado) return <p className="muted">Carregando…</p>

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

            const rota = rotaDaJornada(j, estado.indice)
            const pericopesDaRota = rota
              .map((o) => estado.indice.find((p) => p.ordem === o))
              .filter(Boolean) as PericopeIndex[]
            const tamanhoJornada = tamanhoDoEscopo(pericopesDaRota)

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
                      <IconeLapis size={14} />
                      <span>Renomear</span>
                    </button>
                  </div>
                )}
                <span className="book-progress" aria-hidden>
                  <span className="book-progress-fill" style={{ width: `${prog.pct}%` }} />
                </span>
                <p className="track-progress">
                  {prog.concluidas} de {prog.total}
                  {prog.proximaOrdem === null ? ' · concluída' : ''}
                  {' · '}
                  <TempoEstimado
                    leitura={tamanhoJornada.duracaoLeitura}
                    audio={tamanhoJornada.duracaoAudio}
                  />
                </p>
                {periAtual && (
                  <div className="jornada-sugestao">
                    <p className="ref">
                      <span>{refLabel(periAtual)}</span>
                      <span className="ref-sep">·</span>
                      <TempoEstimado leitura={periAtual.minutos} audio={periAtual.audio_minutos} />
                    </p>
                    <p className="jornada-peri-titulo">{periAtual.titulo_pericope_pt}</p>
                  </div>
                )}
                {periAtual && (
                  <div className="card-acoes">
                    <Link className="cta" to={`/leitura/${periAtual.ordem}?${qsLeitura}`}>
                      <IconeLivroAberto />
                      {prog.concluidas === 0 ? 'Começar' : 'Continuar'}
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
                    <Link
                      className="ghost"
                      to={
                        j.tipo === 'livro'
                          ? `/explorar?jornada=${j.id}&livro=${encodeURIComponent(j.escopo)}`
                          : `/explorar?jornada=${j.id}`
                      }
                    >
                      <IconeOlho size={16} />
                      <span>Ver</span>
                    </Link>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setConfirmando({ id: j.id, acao: 'reiniciar' })}
                    >
                      <IconeReiniciar size={16} />
                      <span>Reiniciar</span>
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setConfirmando({ id: j.id, acao: 'encerrar' })}
                    >
                      <IconeBandeira size={16} />
                      <span>Encerrar</span>
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

      {/* Convite para nova jornada — navega para página dedicada */}
      <p className="jornada-convite">
        <Link className="ghost" to="/jornada/nova">
          <IconeMais size={17} />
          <span>{estado.ativas.length > 0 ? 'Nova jornada' : 'Comece uma jornada'}</span>
        </Link>
      </p>

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
