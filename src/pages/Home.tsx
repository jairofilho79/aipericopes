import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SkeletonHome } from '../components/Skeleton'
import { loadIndex, refLabel } from '../lib/content'
import { atualizarJornada, getJornadaCorrente, listAllPosicoes, listAllProgresso } from '../lib/user-db'
import {
  cursorDaJornada,
  montarTrilhas,
  progressoDaJornada,
  reconciliacaoDeConclusao,
  rotaDaJornada,
  type ProgressoJornada,
  type Track,
} from '../lib/jornadas'
import { candidatosReler, type CandidatoReler } from '../lib/releitura'
import { testamentLabel } from '../lib/testament'
import type { Jornada, PericopeIndex } from '../lib/types'
import { computeStreak, diasComConclusao, type Streak } from '../lib/streak'
import { useSyncRefresh } from '../lib/use-sync-refresh'
import { authClient } from '../lib/auth-client'

type Estado =
  | {
      tipo: 'jornada'
      jornada: Jornada
      prog: ProgressoJornada
      cursor: number | null
      peri: PericopeIndex | undefined
    }
  | { tipo: 'trilhas'; tracks: Track[] }

// CandidatoReler não traz título nem referência — só o índice tem isso.
type ItemReler = CandidatoReler & { titulo: string; ref: string }

export default function Home() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [err, setErr] = useState('')
  const [streak, setStreak] = useState<Streak>({ atual: 0, recorde: 0 })
  const [candidatos, setCandidatos] = useState<ItemReler[]>([])
  const [todos, setTodos] = useState(false)
  const { data: session } = authClient.useSession()

  // Uma função só para as duas entradas: a montagem e o aviso de sync. O
  // streak sai daqui junto do resto porque as duas coisas leem o mesmo
  // progresso — separar faria a tela mostrar dois instantes diferentes.
  const carregar = useCallback(async () => {
    try {
      const all = await loadIndex()
      // UMA varredura do progresso e das posições, viradas em Map: a Home
      // antiga chamava doneSet() dentro do laço dos testamentos (quatro
      // varreduras completas por render). O mesmo vale para as posições.
      const progressos = new Map((await listAllProgresso()).map((p) => [p.pericopeOrdem, p]))
      const posicoes = new Map((await listAllPosicoes()).map((p) => [p.pericopeOrdem, p]))

      // getJornadaCorrente (não "ativa"): a jornada concluída continua sendo
      // a corrente até o leitor arquivá-la abrindo outra — ver o comentário
      // em user-db.ts. Uma seleção que também excluísse concluidaEm faria a
      // Home parar de examinar a jornada assim que ela fechasse, e a
      // reconciliação reversa abaixo nunca rodaria de novo.
      const corrente = await getJornadaCorrente()
      if (corrente) {
        const rota = rotaDaJornada(corrente, all)
        const prog = progressoDaJornada(rota, progressos, corrente.contaDesde)
        // Reconciliação nos DOIS sentidos (função pura testada em
        // jornadas.test.ts): a jornada fecha quando a rota acaba, e REABRE
        // se uma perícope da rota for desmarcada depois — caso real quando
        // outra frente do app desfaz uma conclusão de uma jornada já
        // terminada.
        const patch = reconciliacaoDeConclusao(corrente, prog.proximaOrdem)
        if (patch) await atualizarJornada(corrente.id, patch)
        const cursor = cursorDaJornada(rota, progressos, posicoes, corrente.contaDesde)
        setEstado({
          tipo: 'jornada',
          jornada: corrente,
          prog,
          cursor,
          peri: cursor === null ? undefined : all.find((p) => p.ordem === cursor),
        })
      } else {
        setEstado({ tipo: 'trilhas', tracks: montarTrilhas(all, progressos, posicoes) })
      }
      // Deriva do progresso que já sincroniza entre aparelhos — nenhuma
      // entidade nova, e o streak segue o usuário para o celular novo.
      setStreak(computeStreak(diasComConclusao([...progressos.values()]), new Date()))
      // Reaproveita o Map já carregado acima: candidatosReler pede um array de
      // Progresso, e varrer o store de novo faria a Home ler o mesmo dado duas
      // vezes e ainda arriscar dois instantes diferentes na mesma tela.
      const porOrdem = new Map(all.map((p) => [p.ordem, p]))
      setCandidatos(
        candidatosReler([...progressos.values()], new Date()).flatMap((c) => {
          const meta = porOrdem.get(c.ordem)
          // Perícope que saiu do catálogo não vira linha órfã na Home.
          return meta ? [{ ...c, titulo: meta.titulo_pericope_pt, ref: refLabel(meta) }] : []
        }),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])
  useSyncRefresh(() => void carregar())

  if (err) return <p className="muted">{err}</p>
  if (!estado) return <SkeletonHome />

  return (
    <section className="home">
      {estado.tipo === 'jornada' ? (
        <>
          <p className="eyebrow">Estudo de hoje</p>
          <h1>Continue de onde parou</h1>
          {streak.atual > 0 && (
            <p className="streak">
              <span className="streak-chama" aria-hidden />{' '}
              <strong>
                {streak.atual === 1 ? '1 dia seguido' : `${streak.atual} dias seguidos`}
              </strong>
              {streak.recorde > streak.atual && (
                <span className="streak-recorde"> · recorde: {streak.recorde}</span>
              )}
            </p>
          )}
          <article className="jornada-card">
            <p className="track-label">Sua jornada</p>
            <h2>{estado.jornada.nome}</h2>
            <p className="track-progress">
              {estado.prog.concluidas} de {estado.prog.total}
              {estado.prog.proximaOrdem === null ? ' · concluída' : ''}
            </p>
            {/* a barra é decoração: quem lê com leitor de tela recebe o "N de M" no parágrafo acima */}
            <span className="book-progress" aria-hidden>
              <span className="book-progress-fill" style={{ width: `${estado.prog.pct}%` }} />
            </span>
            {estado.peri ? (
              <>
                <p className="ref">
                  {refLabel(estado.peri)} · ~{estado.peri.minutos} min
                </p>
                <Link className="cta" to={`/leitura/${estado.peri.ordem}`}>
                  Continuar
                </Link>
              </>
            ) : (
              <Link className="cta" to="/jornada">
                Ver jornada
              </Link>
            )}
          </article>
        </>
      ) : (
        <>
          <p className="eyebrow">Estudo de hoje</p>
          <h1>Duas leituras em paralelo</h1>
          <p className="lead">
            Velho e Novo Testamento avançam cada um no seu ritmo. Escolha por onde continuar.
          </p>
          {streak.atual > 0 && (
            <p className="streak">
              <span className="streak-chama" aria-hidden />{' '}
              <strong>
                {streak.atual === 1 ? '1 dia seguido' : `${streak.atual} dias seguidos`}
              </strong>
              {streak.recorde > streak.atual && (
                <span className="streak-recorde"> · recorde: {streak.recorde}</span>
              )}
            </p>
          )}
          <div className="track-grid">
            {estado.tracks.map((t) => (
              <article key={t.testament} className="track-card">
                <p className="track-label">{testamentLabel(t.testament)}</p>
                <h2>{t.peri.titulo_pericope_pt}</h2>
                <p className="ref">
                  {refLabel(t.peri)} · ~{t.peri.minutos} min
                </p>
                <p className="track-progress">
                  {t.prog.concluidas} de {t.prog.total}
                  {t.prog.proximaOrdem === null ? ' · concluído' : ''}
                </p>
                <Link className="cta" to={`/leitura/${t.peri.ordem}`}>
                  {t.prog.proximaOrdem === null ? 'Rever' : 'Continuar'}
                </Link>
              </article>
            ))}
          </div>
          <p className="jornada-convite">
            {session ? (
              <Link className="ghost" to="/jornada">
                Comece uma jornada
              </Link>
            ) : (
              <Link className="ghost" to="/entrar">
                Entre para criar jornadas
              </Link>
            )}
          </p>
        </>
      )}
      {/* "Vale reler": abaixo e não acima porque a Home responde primeiro "para
          onde eu vou agora" — releitura é oferta, não instrução. Fica fora do
          ternário de propósito: vale nos dois modos, jornada e trilhas.
          Posição combinada entre as sessões de jornadas e releitura. */}
      {candidatos.length > 0 && (
        <section className="vale-reler">
          <h2>Vale reler</h2>
          <ul>
            {(todos ? candidatos : candidatos.slice(0, 3)).map((c) => (
              <li key={c.ordem}>
                <Link to={`/leitura/${c.ordem}`}>
                  <span aria-hidden>{c.paraReler ? '★' : '●'}</span>
                  <span className="vale-reler-texto">
                    <strong>{c.titulo}</strong>
                    <span>
                      {c.ref} · {c.vezes === 1 ? 'lida 1×' : `lida ${c.vezes}×`}
                      {c.paraReler ? ' · marcada' : ` · há ${Math.floor(c.dias / 30)} meses`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!todos && candidatos.length > 3 && (
            <button type="button" className="linkish" onClick={() => setTodos(true)}>
              ver todas ({candidatos.length})
            </button>
          )}
        </section>
      )}
    </section>
  )
}
