import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconePlay } from '../components/NarracaoPlayer'
import { IconeEntrar, IconeLivroAberto, IconeTrilha } from '../components/icones'
import { JornadasCarrossel, type CardJornadaItem } from '../components/JornadasCarrossel'
import { SkeletonHome } from '../components/Skeleton'
import { loadIndex, refLabel } from '../lib/content'
import { atualizarJornada, listAllPosicoes, listAllProgresso, listJornadasAtivas } from '../lib/user-db'
import {
  cursorDaJornada,
  montarTrilhas,
  progressoDaJornada,
  reconciliarJornadasEmLote,
  rotaDaJornada,
  type Track,
} from '../lib/jornadas'
import { candidatosReler, type CandidatoReler } from '../lib/releitura'
import { testamentLabel } from '../lib/testament'
import type { PericopeIndex } from '../lib/types'
import { computeStreak, diasComConclusao, type Streak } from '../lib/streak'
import { useSyncRefresh } from '../lib/use-sync-refresh'
import { authClient } from '../lib/auth-client'

type Estado =
  | { tipo: 'jornadas'; itens: CardJornadaItem[] }
  | { tipo: 'trilhas'; tracks: Track[] }

// CandidatoReler não traz título nem referência — só o índice tem isso.
type ItemReler = CandidatoReler & { titulo: string; ref: string }

/**
 * Ouvir em um toque, DENTRO do "Continuar" — mesma faixa do pager. Só existe
 * quando há narração publicada: o sinal vem de `narrado` no índice (uma vez
 * por deploy), e não de um `HEAD` por card — a Home renderiza a lista inteira
 * de "Vale reler" sem limite superior, e um `HEAD` por linha não escala nem
 * funciona offline.
 *
 * O `aria-label` carrega o título porque numa lista de cards "Ouvir" sozinho
 * obriga o leitor de tela a adivinhar de qual card é o botão.
 */
function BotaoOuvir({ peri, deJornada = false }: { peri: PericopeIndex; deJornada?: boolean }) {
  if (!peri.narrado) return null
  const qs = deJornada ? '?ouvir=1&de=jornada' : '?ouvir=1'
  return (
    <Link
      className="ouvir-botao"
      to={`/leitura/${peri.ordem}${qs}`}
      aria-label={`Ouvir ${peri.titulo_pericope_pt}`}
      title="Ouvir"
    >
      <IconePlay />
    </Link>
  )
}

/**
 * Onde o botão estaria, o motivo de ele não estar — mas só quando a frase
 * informa alguma coisa. Ela só vale por CONTRASTE ("as outras têm, esta não"):
 * com o catálogo inteiro sem narração (o caso de hoje, `audio-cobertura.json`
 * vazio) ela sairia nas 2.823 perícopes e viraria um mural de negativas, e
 * ainda contradiria a Leitura, que descobre o áudio por `HEAD` e pode oferecer
 * "Ouvir esta perícope" na mesma perícope. Por isso, enquanto ninguém tem, a
 * ausência é silenciosa: não é bug, é a frase não tendo nada a dizer.
 */
function SemNarracao({ peri, alguemTem }: { peri: PericopeIndex; alguemTem: boolean }) {
  if (peri.narrado || !alguemTem) return null
  return <span className="ref-sem-narracao"> · narração ainda não gravada</span>
}

export default function Home() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [err, setErr] = useState('')
  const [streak, setStreak] = useState<Streak>({ atual: 0, recorde: 0 })
  const [candidatos, setCandidatos] = useState<ItemReler[]>([])
  // Booleano, e não o índice inteiro em estado: a varredura acontece uma vez
  // por carga, junto do resto, e nada aqui volta a recalcular quando a lista
  // de "Vale reler" abre.
  const [alguemTem, setAlguemTem] = useState(false)
  const [todos, setTodos] = useState(false)
  const { data: session } = authClient.useSession()

  // Uma função só para as duas entradas: a montagem e o aviso de sync. O
  // streak sai daqui junto do resto porque as duas coisas leem o mesmo
  // progresso — separar faria a tela mostrar dois instantes diferentes.
  const carregar = useCallback(async () => {
    try {
      const all = await loadIndex()
      // Uma passada no índice que a Home já tem em mãos, para saber se a frase
      // "narração ainda não gravada" tem contra o que contrastar (ver
      // SemNarracao).
      setAlguemTem(all.some((p) => p.narrado))
      // UMA varredura do progresso e das posições, viradas em Map: a Home
      // antiga chamava doneSet() dentro do laço dos testamentos (quatro
      // varreduras completas por render). O mesmo vale para as posições.
      const progressos = new Map((await listAllProgresso()).map((p) => [p.pericopeOrdem, p]))
      const posicoes = new Map((await listAllPosicoes()).map((p) => [p.pericopeOrdem, p]))

      const ativas = await listJornadasAtivas()
      if (ativas.length > 0) {
        const patches = reconciliarJornadasEmLote(ativas, all, progressos)
        for (const p of patches) {
          await atualizarJornada(p.id, p.patch)
        }
        const itens: CardJornadaItem[] = ativas.map((j) => {
          const rota = rotaDaJornada(j, all)
          const prog = progressoDaJornada(rota, progressos, j.contaDesde)
          const cursor = cursorDaJornada(rota, progressos, posicoes, j.contaDesde)
          const periAtual = cursor === null ? null : all.find((p) => p.ordem === cursor) ?? null
          return { jornada: j, prog, periAtual }
        })
        setEstado({ tipo: 'jornadas', itens })
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
      {estado.tipo === 'jornadas' ? (
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
          <JornadasCarrossel itens={estado.itens} />
          <p className="jornada-convite">
            <Link className="ghost" to="/jornada">
              <IconeTrilha />
              Ver todas as jornadas
            </Link>
          </p>
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
                  <SemNarracao peri={t.peri} alguemTem={alguemTem} />
                </p>
                <p className="track-progress">
                  {t.prog.concluidas} de {t.prog.total}
                  {t.prog.proximaOrdem === null ? ' · concluído' : ''}
                </p>
                <div className="card-acoes">
                  <Link className="cta" to={`/leitura/${t.peri.ordem}`}>
                    <IconeLivroAberto />
                    {t.prog.proximaOrdem === null ? 'Rever' : 'Continuar'}
                  </Link>
                  <BotaoOuvir peri={t.peri} />
                </div>
              </article>
            ))}
          </div>
          <p className="jornada-convite">
            {session ? (
              <Link className="ghost" to="/jornada">
                <IconeTrilha />
                Comece uma jornada
              </Link>
            ) : (
              <Link className="ghost" to="/entrar">
                <IconeEntrar />
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
