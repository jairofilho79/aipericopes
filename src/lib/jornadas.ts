import { BIBLE_BOOKS } from './bible-books'
import { abbrevsDoBloco, blocoPorId, BLOCOS } from './blocos'
// O predicado vem de conclusao.ts, o seam com a fase de releitura/esquecimento:
// jornadas nunca toca no formato de armazenamento de `progresso`.
import { contaComoLida } from './conclusao'
import { ordensDoTestamento, refLabel } from './content'
import { LIMITE_NOME } from './sync-limits'
import { testamentOf, type Testament } from './testament'
import type { Jornada, JornadaTipo, PericopeIndex, PosicaoLeitura, Progresso } from './types'

/**
 * A rota da jornada: as ordens do escopo, cortadas no ponto de partida.
 *
 * O corte é POSICIONAL (indexOf + slice), não numérico (o >= inicioOrdem):
 * na ordem canônica os dois coincidem, mas na cronológica que virá as ordens
 * não são crescentes e só o posicional está correto.
 *
 * Este switch é o ÚNICO ponto de extensão para 'cronologica'.
 */
export function rotaDaJornada(j: Jornada, indice: PericopeIndex[]): number[] {
  const seq =
    j.tipo === 'livro'
      ? indice.filter((p) => p.livro === j.escopo).map((p) => p.ordem)
      : j.tipo === 'bloco'
        ? ((abbrevs) => indice.filter((p) => abbrevs.has(p.abbrev)).map((p) => p.ordem))(
            abbrevsDoBloco(j.escopo),
          )
        : j.escopo === 'biblia'
          ? indice.map((p) => p.ordem)
          : ordensDoTestamento(indice, j.escopo as Testament)
  const i = seq.indexOf(j.inicioOrdem)
  // -1 só ocorre se o catálogo mudou debaixo de uma jornada antiga. Degrada
  // para o escopo inteiro — nunca para uma jornada vazia.
  return seq.slice(i < 0 ? 0 : i)
}

export type ProgressoJornada = {
  total: number
  concluidas: number
  /** 0–100, arredondado; 0 quando a rota é vazia. */
  pct: number
  /** null quando a rota acabou. */
  proximaOrdem: number | null
}

export function progressoDaJornada(
  rota: number[],
  progressos: Map<number, Progresso>,
  desde: string | null,
): ProgressoJornada {
  let concluidas = 0
  let proximaOrdem: number | null = null
  for (const ordem of rota) {
    if (contaComoLida(progressos.get(ordem), desde)) concluidas++
    else if (proximaOrdem === null) proximaOrdem = ordem
  }
  return {
    total: rota.length,
    concluidas,
    pct: rota.length ? Math.round((concluidas / rota.length) * 100) : 0,
    proximaOrdem,
  }
}

/**
 * Onde o "Continuar" leva.
 *
 * Prefere o checkpoint mais recente dentro da rota à primeira não lida —
 * é o que retoma uma perícope longa deixada no meio, e era a heurística da
 * Home antes das jornadas. Duas guardas:
 * - checkpoint de perícope que já conta como lida não vale (o rótulo diz
 *   "continuar", não "reler");
 * - em modo reler, checkpoint anterior à âncora não vale, senão a jornada
 *   devolveria o leitor no meio da passada anterior.
 */
export function cursorDaJornada(
  rota: number[],
  progressos: Map<number, Progresso>,
  posicoes: Map<number, PosicaoLeitura>,
  desde: string | null,
): number | null {
  const { proximaOrdem } = progressoDaJornada(rota, progressos, desde)
  if (proximaOrdem === null) return null

  let melhor: PosicaoLeitura | undefined
  for (const ordem of rota) {
    const pos = posicoes.get(ordem)
    if (!pos) continue
    if (desde !== null && pos.atualizadoEm < desde) continue
    if (contaComoLida(progressos.get(ordem), desde)) continue
    if (!melhor || pos.atualizadoEm > melhor.atualizadoEm) melhor = pos
  }
  return melhor ? melhor.pericopeOrdem : proximaOrdem
}

/**
 * O patch de `concluidaEm` a aplicar depois de recalcular o progresso da
 * jornada corrente — ou `null` quando o estado gravado já bate com a rota.
 *
 * Nos DOIS sentidos: se a rota acabou (`proximaOrdem === null`) e a jornada
 * ainda não estava marcada, grava a conclusão; se a rota NÃO acabou e a
 * jornada estava marcada, LIMPA — é o caso real de outra frente do app
 * desmarcar uma perícope de uma jornada já concluída, que precisa reabrir
 * sozinha. Extraída como função pura (em vez de embutida em Home.tsx) para
 * poder testar os quatro casos sem IndexedDB nem componente React.
 *
 * `agora` é parâmetro para o chamador poder injetar um relógio determinístico
 * em teste; por padrão usa o instante real.
 */
export function reconciliacaoDeConclusao(
  jornada: Pick<Jornada, 'concluidaEm'>,
  proximaOrdem: number | null,
  agora: string = new Date().toISOString(),
): { concluidaEm: string | null } | null {
  if (proximaOrdem === null && jornada.concluidaEm === null) return { concluidaEm: agora }
  if (proximaOrdem !== null && jornada.concluidaEm !== null) return { concluidaEm: null }
  return null
}

/**
 * Separa o histórico dentro de `listJornadas()` — Task 7 (tela de gestão).
 *
 * Deliberadamente NÃO usa `j.arquivadaEm || j.concluidaEm` (o texto do brief
 * original): uma jornada corrente CONCLUÍDA tem `concluidaEm` preenchido e
 * `arquivadaEm === null` ao mesmo tempo (ver getJornadaCorrente em
 * user-db.ts), e esse `||` a puxaria para o histórico enquanto ela ainda
 * aparece como a corrente no topo da tela — a mesma jornada duplicada em
 * dois lugares. Só `arquivadaEm !== null` marca "isto já foi arquivado";
 * é o único predicado consistente com a invariante de "no máximo uma
 * corrente" (criarJornada/atualizarJornada).
 */
export function historicoDeJornadas(todas: Jornada[]): Jornada[] {
  return todas.filter((j) => j.arquivadaEm !== null)
}

/** O patch de "Reiniciar": zera a contagem a partir de agora e reabre se estava concluída. */
export function patchReiniciarJornada(
  agora: string = new Date().toISOString(),
): Pick<Jornada, 'contaDesde' | 'concluidaEm'> {
  return { contaDesde: agora, concluidaEm: null }
}

/** O patch de "Encerrar": arquiva a jornada corrente, sem mexer em `concluidaEm`. */
export function patchEncerrarJornada(
  agora: string = new Date().toISOString(),
): Pick<Jornada, 'arquivadaEm'> {
  return { arquivadaEm: agora }
}

export const ROTULO_SEQUENCIA: Record<string, string> = {
  biblia: 'A Bíblia toda',
  vt: 'Velho Testamento',
  nt: 'Novo Testamento',
}

/**
 * A rota completa do escopo, sem o corte de início — o que o catálogo (passo
 * 1) e `nomePadrao` precisam antes de o leitor escolher onde começar.
 *
 * Mesmo truque de degrade que `rotaDaJornada` já usa para catálogo mudado
 * debaixo de uma jornada antiga: `inicioOrdem: -1` nunca bate em `indexOf`,
 * então o corte vira `slice(0)` — a rota inteira, de propósito.
 */
export function rotaCompletaDoEscopo(
  tipo: JornadaTipo,
  escopo: string,
  indice: PericopeIndex[],
): number[] {
  return rotaDaJornada(
    {
      id: '',
      nome: '',
      tipo,
      escopo,
      inicioOrdem: -1,
      contaDesde: null,
      criadoEm: '',
      atualizadoEm: '',
      arquivadaEm: null,
      concluidaEm: null,
    },
    indice,
  )
}

/** Nome pré-preenchido no passo de confirmação; o leitor pode trocar. */
export function nomePadrao(
  tipo: JornadaTipo,
  escopo: string,
  inicioOrdem: number,
  indice: PericopeIndex[],
): string {
  const base =
    tipo === 'livro'
      ? escopo
      : tipo === 'bloco'
        ? (blocoPorId(escopo)?.nome ?? escopo)
        : (ROTULO_SEQUENCIA[escopo] ?? escopo)

  const rota = rotaCompletaDoEscopo(tipo, escopo, indice)
  if (rota.length === 0 || rota[0] === inicioOrdem) return base.slice(0, LIMITE_NOME)

  const peri = indice.find((p) => p.ordem === inicioOrdem)
  if (!peri) return base.slice(0, LIMITE_NOME)
  return `${base} a partir de ${refLabel(peri)}`.slice(0, LIMITE_NOME)
}

/** Tamanho de um escopo do catálogo: contagem de perícopes e a soma de
 * `minutos` já formatada — minutos abaixo de uma hora (um livro breve como
 * Obadias), horas arredondadas dali para cima (um testamento, a Bíblia). */
export function tamanhoDoEscopo(itens: PericopeIndex[]): { total: number; duracao: string } {
  const minutos = itens.reduce((soma, p) => soma + p.minutos, 0)
  return {
    total: itens.length,
    duracao: minutos < 60 ? `~${minutos} min` : `~${Math.round(minutos / 60)} h`,
  }
}

export type ItemCatalogo = {
  tipo: JornadaTipo
  escopo: string
  nome: string
  total: number
  duracao: string
}

export type Catalogo = {
  curta: ItemCatalogo[]
  media: ItemCatalogo[]
  longa: ItemCatalogo[]
  inteira: ItemCatalogo[]
}

function itemCatalogo(
  tipo: JornadaTipo,
  escopo: string,
  nome: string,
  itens: PericopeIndex[],
): ItemCatalogo {
  return { tipo, escopo, nome, ...tamanhoDoEscopo(itens) }
}

/**
 * O catálogo de escopos do passo 1: quatro grupos, cada item com o tamanho
 * calculado do índice já carregado. Pura — nenhum acesso a
 * `public/data/index.json` nem ao IndexedDB, testável com um índice mínimo
 * em memória, como o resto deste arquivo.
 *
 * Curta e Média percorrem BIBLE_BOOKS/BLOCOS (não o índice) para que os 66
 * livros e os 8 blocos apareçam sempre inteiros, mesmo que um deles não
 * tenha nenhuma perícope no índice recebido — não é o caso do catálogo real,
 * mas evita um card "sumido" se algum dia for.
 */
export function montarCatalogo(indice: PericopeIndex[]): Catalogo {
  const curta = BIBLE_BOOKS.map((b) =>
    itemCatalogo('livro', b.name, b.name, indice.filter((p) => p.livro === b.name)),
  )
  const media = BLOCOS.map((b) => {
    const abbrevs = abbrevsDoBloco(b.id)
    return itemCatalogo('bloco', b.id, b.nome, indice.filter((p) => abbrevs.has(p.abbrev)))
  })
  const longa = (['vt', 'nt'] as const).map((t) =>
    itemCatalogo('sequencia', t, ROTULO_SEQUENCIA[t], indice.filter((p) => testamentOf(p) === t)),
  )
  const inteira = [itemCatalogo('sequencia', 'biblia', ROTULO_SEQUENCIA.biblia, indice)]
  return { curta, media, longa, inteira }
}

export type ModoJornada = 'continuar' | 'reler'

/**
 * Os dois avisos do passo 2, ANTES do botão de criar — nunca depois do fato:
 *
 * - `arquivaAtual`: existe uma jornada corrente que será arquivada.
 * - `escopoJaLido`: modo Continuar e a rota (já cortada no início escolhido)
 *   está toda lida — sem o aviso, a jornada nasceria e a reconciliação da
 *   Home a marcaria concluída no mesmo instante, uma jornada natimorta. Só
 *   se aplica ao modo Continuar: em modo Reler a barra sempre começa em 0
 *   (âncora `contaDesde` no futuro de qualquer conclusão passada), então o
 *   aviso não tem o que dizer.
 */
export function avisosCriacao(
  corrente: Jornada | null,
  modo: ModoJornada,
  rota: number[],
  progressos: Map<number, Progresso>,
): { arquivaAtual: boolean; escopoJaLido: boolean } {
  return {
    arquivaAtual: corrente !== null,
    escopoJaLido: modo === 'continuar' && progressoDaJornada(rota, progressos, null).proximaOrdem === null,
  }
}

export type Track = {
  testament: Testament
  peri: PericopeIndex
  prog: ProgressoJornada
}

/**
 * Jornada sintética por testamento: nunca gravada, existe só para que
 * rotaDaJornada/progressoDaJornada/cursorDaJornada (Task 2) calculem a
 * trilha VT/NT com EXATAMENTE a mesma regra de uma jornada de verdade. Duas
 * implementações separadas do "onde estou / o que falta" é o jeito garantido
 * de os dois estados da Home um dia divergirem.
 */
export function jornadaDoTestamento(testament: Testament, inicioOrdem: number): Jornada {
  return {
    id: '',
    nome: '',
    tipo: 'sequencia',
    escopo: testament,
    inicioOrdem,
    contaDesde: null,
    criadoEm: '',
    atualizadoEm: '',
    arquivadaEm: null,
    concluidaEm: null,
  }
}

/**
 * A lógica das trilhas de hoje, extraída para função pura sobre os `Map`s já
 * carregados — nada aqui consulta o IndexedDB, então o mesmo cálculo serve
 * tanto para montar a tela quanto (mais tarde) para testar sem fake IDB.
 */
export function montarTrilhas(
  all: PericopeIndex[],
  progressos: Map<number, Progresso>,
  posicoes: Map<number, PosicaoLeitura>,
): Track[] {
  const tracks: Track[] = []
  for (const testament of ['vt', 'nt'] as Testament[]) {
    const ordens = ordensDoTestamento(all, testament)
    if (ordens.length === 0) continue
    const sintetica = jornadaDoTestamento(testament, ordens[0])
    const rota = rotaDaJornada(sintetica, all)
    const prog = progressoDaJornada(rota, progressos, null)
    const cursor = cursorDaJornada(rota, progressos, posicoes, null)
    // Trilha inteira concluída: cursorDaJornada devolve null (não há "próxima
    // ordem" a apontar), então o botão "Rever" cai na última perícope da
    // rota — o mesmo destino que a heurística antiga (getProximaOrdemNaSequencia
    // com tudo feito devolvia a última ordem da sequência).
    const ordem = cursor ?? rota[rota.length - 1]
    const peri = all.find((p) => p.ordem === ordem)
    if (!peri) continue
    tracks.push({ testament, peri, prog })
  }
  return tracks
}
