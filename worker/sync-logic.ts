export type PushProgresso = {
  pericopeOrdem: number
  status: 'nao_iniciado' | 'em_andamento' | 'concluido'
  atualizadoEm: string
  historico: string[]
  paraReler: boolean
}

export type PushAnotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  verseRef: string | null
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}

export type PushDestaque = {
  id: string
  pericopeOrdem: number
  verseId: string
  cor: 'amarelo' | 'verde' | 'azul' | 'rosa'
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
}

export type PushPosicao = {
  pericopeOrdem: number
  tipo: 'secao' | 'versiculo' | 'narracao'
  ref: string
  tempo: number | null
  atualizadoEm: string
  apagadoEm: string | null
}

export type PushJornada = {
  id: string
  nome: string
  tipo: 'sequencia' | 'bloco' | 'livro'
  escopo: string
  inicioOrdem: number
  contaDesde: string | null
  criadoEm: string
  atualizadoEm: string
  arquivadaEm: string | null
  concluidaEm: string | null
  apagadoEm: string | null
}

const STATUS = new Set(['nao_iniciado', 'em_andamento', 'concluido'])
const CORES = new Set(['amarelo', 'verde', 'azul', 'rosa'])
// "capitulo:versiculo" — o mesmo formato do TextoBlock.id no cliente.
const VERSE_ID = /^\d+:\d+$/
const POSICAO_TIPOS = new Set(['secao', 'versiculo', 'narracao'])
const JORNADA_TIPOS = new Set(['sequencia', 'bloco', 'livro'])
// Cópia de LIMITE_NOME em src/lib/sync-limits.ts (o Worker não importa de src/),
// mesma convenção já usada para MAX_ITENS e MAX_TEXTO logo abaixo.
const MAX_NOME = 120
// Nome de livro é o escopo mais longo ("1 Tessalonicenses"); o teto só barra abuso.
const MAX_ESCOPO = 64
// Cópia de POSICAO_REF_RE em src/lib/user-db.ts (o Worker não importa de
// src/) — o vocabulário de ids que a Leitura põe no DOM. Mudar um exige
// mudar o outro.
const POSICAO_REF =
  /^(?:\d+:\d+|(?:contexto|resenha|reflexao)-\d+|contexto|texto|resenha|reflexao|titulo|referencia|cabecalho-(?:contexto|texto|resenha|reflexoes)|cap-\d+)$/
// Teto folgado do `tempo` (segundos de áudio): nenhuma narração real passa
// disso; barra só o absurdo, como MAX_CORPO.
const MAX_TEMPO_S = 86_400
// Cópia deliberada dos limites de src/lib/sync-limits.ts: o Worker não pode
// importar de src/ (tsconfig/bundle separados). Mantenha os dois em sincronia.
// MAX_ITENS vale para as cinco listas (progresso/anotacoes/destaques/posicoes/jornadas).
const MAX_ITENS = 500
const MAX_TEXTO = 20_000
// Cópia de MAX_HISTORICO em src/lib/sync-limits.ts.
export const MAX_HISTORICO = 50

/**
 * Upsert de `progresso`, com duas políticas de merge simultâneas na mesma
 * linha: `status`/`para_reler` seguem last-write-wins por `atualizado_em`
 * (estado — vira nos dois sentidos); `historico` é um conjunto que só
 * cresce, mesclado por UNIÃO e recalculado FORA da guarda do LWW.
 *
 * A união tem que escapar da guarda por causa deste cenário: aparelho A
 * conclui uma perícope offline em T2; aparelho B desmarca em T3 > T2 e
 * sincroniza primeiro; o lote de A chega depois e perde o LWW — se a união
 * estivesse dentro do CASE, a conclusão de A seria descartada para sempre.
 *
 * O `WHERE` usa `EXISTS (... NOT IN ...)` e não `excluded.historico <>
 * progresso.historico`: com `<>`, um cliente velho que sempre envia
 * `historico: '[]'` faria a cláusula disparar toda vez que `progresso.historico`
 * não é vazio — mesmo sem nada de novo para gravar —, avançando `server_em`
 * a cada push e fazendo a linha ser reentregue em todo pull, para sempre.
 * `EXISTS` com `json_each` sobre um array vazio não produz linha nenhuma,
 * então fica `false` incondicionalmente quando não há nada novo em
 * `excluded.historico`, e o `WHERE` cai só no LWW puro.
 *
 * Extraída para cá (em vez de inline em index.ts) para que o teste em
 * upsert-progresso.test.ts rode o SQL de verdade, não uma cópia dele.
 */
export const UPSERT_PROGRESSO = `INSERT INTO progresso (user_id, pericope_ordem, status, historico, para_reler, atualizado_em, server_em)
 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
 ON CONFLICT(user_id, pericope_ordem) DO UPDATE SET
   status     = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                     THEN excluded.status     ELSE progresso.status     END,
   para_reler = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                     THEN excluded.para_reler ELSE progresso.para_reler END,
   atualizado_em = MAX(excluded.atualizado_em, progresso.atualizado_em),
   historico = (SELECT json_group_array(d) FROM (
                  SELECT value AS d FROM json_each(excluded.historico)
                  UNION
                  SELECT value AS d FROM json_each(progresso.historico)
                  ORDER BY d DESC LIMIT ${MAX_HISTORICO})),
   server_em = excluded.server_em
 WHERE excluded.atualizado_em > progresso.atualizado_em
    OR EXISTS (SELECT 1 FROM json_each(excluded.historico)
               WHERE value NOT IN (SELECT value FROM json_each(progresso.historico)))`

/**
 * Teto do corpo bruto do POST /api/sync, em bytes.
 *
 * Não é o limite apertado — o aperto de verdade são MAX_ITENS e MAX_TEXTO,
 * checados depois do parse. O papel deste teto é barrar o absurdo (um corpo
 * de centenas de MB) antes de gastar CPU desserializando, e ele NUNCA pode
 * rejeitar um payload legal: o cliente trata a rejeição como determinística e
 * abandona o lote (src/lib/sync.ts), então um teto apertado demais viraria
 * perda silenciosa de anotação.
 *
 * Pior caso legal: 500 anotações × 20.000 unidades UTF-16 de texto, cada
 * unidade custando até 3 bytes em UTF-8 (~30 MB), mais ~0,3 MB de ids,
 * timestamps e nomes de campo das três listas. 32 MiB cobre isso com folga e
 * ainda corta bem abaixo do teto de corpo do próprio Workers.
 */
export const MAX_CORPO = 32 * 1024 * 1024

/**
 * Teto do corpo em dois estágios: `contentLength` é o header (quando presente,
 * barra antes de bufferizar) e `tamanho` é o comprimento do corpo já lido —
 * rede de segurança para o corpo chunked, que chega sem o header.
 *
 * `tamanho` vem em unidades UTF-16 e MAX_CORPO em bytes: como um caractere
 * nunca ocupa menos bytes em UTF-8 do que unidades em UTF-16, a comparação erra
 * sempre para o lado permissivo — que é o lado certo aqui.
 */
export function corpoExcedeLimite(
  contentLength: string | null | undefined,
  tamanho?: number,
): boolean {
  const declarado = contentLength == null ? Number.NaN : Number(contentLength)
  if (Number.isFinite(declarado) && declarado > MAX_CORPO) return true
  return tamanho !== undefined && tamanho > MAX_CORPO
}

const ISO_CANONICAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
// "c:v" ou "c:v-c:v" cabem folgado; o limite existe só para barrar abuso.
const MAX_VERSE_REF = 32

// Ordem da perícope: inteiro seguro e não-negativo (o dado real vai de 0 a
// 2646). Sem isto passavam `1.5` e `1e308`, que viram linha inalcançável pelo
// cliente — ele só consulta por ordens inteiras vindas do pericopes.json.
function isOrdem(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
}

function isIso(v: unknown): v is string {
  return typeof v === 'string' && ISO_CANONICAL.test(v) && !Number.isNaN(Date.parse(v))
}

function validProgresso(v: unknown): v is Omit<PushProgresso, 'historico' | 'paraReler'> & {
  historico?: unknown
  paraReler?: unknown
} {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    isOrdem(p.pericopeOrdem) &&
    typeof p.status === 'string' &&
    STATUS.has(p.status) &&
    isIso(p.atualizadoEm) &&
    // Ausentes = cliente ainda não atualizado, aceito (mesma tolerância que
    // `destaques`/`posicoes` já têm em parseSyncPush).
    (p.historico === undefined ||
      (Array.isArray(p.historico) && p.historico.length <= MAX_HISTORICO && p.historico.every(isIso))) &&
    (p.paraReler === undefined || typeof p.paraReler === 'boolean')
  )
}

function validAnotacao(v: unknown): v is Omit<PushAnotacao, 'verseRef'> & { verseRef?: unknown } {
  if (typeof v !== 'object' || v === null) return false
  const a = v as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    a.id.length > 0 &&
    a.id.length <= 64 &&
    isOrdem(a.pericopeOrdem) &&
    typeof a.texto === 'string' &&
    a.texto.length <= MAX_TEXTO &&
    (a.verseRef === undefined ||
      a.verseRef === null ||
      (typeof a.verseRef === 'string' && a.verseRef.length <= MAX_VERSE_REF)) &&
    isIso(a.criadoEm) &&
    isIso(a.atualizadoEm) &&
    (a.apagadoEm === null || isIso(a.apagadoEm))
  )
}

function validDestaque(v: unknown): v is PushDestaque {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return (
    typeof d.id === 'string' &&
    d.id.length <= 64 &&
    isOrdem(d.pericopeOrdem) &&
    typeof d.verseId === 'string' &&
    VERSE_ID.test(d.verseId) &&
    typeof d.cor === 'string' &&
    CORES.has(d.cor) &&
    isIso(d.criadoEm) &&
    isIso(d.atualizadoEm) &&
    (d.apagadoEm === null || isIso(d.apagadoEm)) &&
    // Por último, com as partes já validadas: o id TEM que ser o derivado de
    // (pericopeOrdem, verseId) — o mesmo que destaqueId() monta no cliente.
    // A Leitura pinta o versículo pelo verseId mas remove pelo id derivado;
    // um id divergente vira destaque que o usuário não consegue apagar, e que
    // o pull seguinte traz de volta.
    d.id === `${d.pericopeOrdem}:${d.verseId}`
  )
}

function validPosicao(v: unknown): v is PushPosicao {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    isOrdem(p.pericopeOrdem) &&
    typeof p.tipo === 'string' &&
    POSICAO_TIPOS.has(p.tipo) &&
    typeof p.ref === 'string' &&
    POSICAO_REF.test(p.ref) &&
    (p.tempo === null ||
      (typeof p.tempo === 'number' &&
        Number.isFinite(p.tempo) &&
        p.tempo >= 0 &&
        p.tempo <= MAX_TEMPO_S)) &&
    isIso(p.atualizadoEm) &&
    (p.apagadoEm === null || isIso(p.apagadoEm))
  )
}

/** null ou ISO canônico — os quatro campos de estado da jornada. */
function isIsoOuNulo(v: unknown): v is string | null {
  return v === null || isIso(v)
}

function validJornada(v: unknown): v is PushJornada {
  if (typeof v !== 'object' || v === null) return false
  const j = v as Record<string, unknown>
  return (
    typeof j.id === 'string' &&
    j.id.length > 0 &&
    j.id.length <= 64 &&
    typeof j.nome === 'string' &&
    j.nome.length <= MAX_NOME &&
    typeof j.tipo === 'string' &&
    JORNADA_TIPOS.has(j.tipo) &&
    typeof j.escopo === 'string' &&
    j.escopo.length > 0 &&
    j.escopo.length <= MAX_ESCOPO &&
    isOrdem(j.inicioOrdem) &&
    isIsoOuNulo(j.contaDesde) &&
    isIso(j.criadoEm) &&
    isIso(j.atualizadoEm) &&
    isIsoOuNulo(j.arquivadaEm) &&
    isIsoOuNulo(j.concluidaEm) &&
    isIsoOuNulo(j.apagadoEm)
  )
}

/**
 * Tamanho de página do pull (GET /api/sync), por entidade. Cada query busca
 * TAMANHO_PAGINA_PULL + 1 linhas: a linha extra é só pra provar que existe
 * mais sem precisar de uma segunda query. Na esmagadora maioria dos pulls
 * (histórico normal de um usuário) nenhuma entidade chega perto disso — a
 * página cabe tudo numa resposta só, igual hoje. Só destaques (uma linha por
 * versículo destacado) tem volume real; alguns milhares cobrem um usuário
 * extremo com folga e ainda mantêm a resposta num tamanho saudável.
 */
export const TAMANHO_PAGINA_PULL = 2000

/** Uma linha do pull, na parte que paginarPull precisa: o carimbo do servidor. */
export type LinhaPull = { serverEm: string }

/** As listas do pull, pelo nome. */
export type EntidadePull = 'progresso' | 'anotacoes' | 'destaques' | 'posicoes' | 'jornadas'

export type ResultadoPaginacaoPull<
  P extends LinhaPull,
  A extends LinhaPull,
  D extends LinhaPull,
  O extends LinhaPull,
  J extends LinhaPull,
> = {
  progresso: P[]
  anotacoes: A[]
  destaques: D[]
  posicoes: O[]
  jornadas: J[]
  /**
   * `null` quando nenhuma entidade estourou: o chamador usa `agora` (o
   * instante gerado antes dos SELECTs) como cursor, exatamente como antes
   * desta funcionalidade existir. Uma string é o limite de truncamento — ver
   * `maisDados`.
   */
  cursor: string | null
  /** true quando o cliente precisa pedir a próxima página imediatamente. */
  maisDados: boolean
  /**
   * Entidades cuja lista devolvida aqui pode ser só um PEDAÇO do grupo de
   * `cursor` — a janela buscada acabou dentro do grupo, e daqui não dá pra
   * saber quantas linhas dele ficaram de fora.
   *
   * O chamador é OBRIGADO a fechar cada um desses grupos antes de responder:
   * rebuscar a entidade com `WHERE user_id = ? AND server_em = cursor` (sem
   * LIMIT) e usar o resultado no lugar da lista daqui. Ignorar isto perde
   * linha em silêncio, porque o cursor avança para `cursor` e a próxima
   * página consulta `server_em > cursor` — o grupo nunca mais é visitado.
   *
   * Substituir (e não concatenar) é correto porque esta lista só entra aqui
   * quando TODAS as linhas buscadas da entidade empatam em `cursor`: não há
   * nenhuma linha abaixo dele para preservar.
   *
   * Vazio no caso normal, que é a esmagadora maioria dos pulls.
   */
  gruposIncompletos: EntidadePull[]
}

/**
 * Acha, para UMA entidade que estourou (chegaram n+1 linhas, ordenadas por
 * server_em ascendente), o server_em da última linha que pode ser entregue
 * sem partir um grupo de mesmo server_em ao meio.
 *
 * Um POST grava todas as linhas do lote com o MESMO server_em (index.ts —
 * `serverEm` é carimbado uma vez por lote). Corte no meio de um grupo faria o
 * cliente avançar o cursor por cima de linhas irmãs que nunca foram
 * entregues — perda silenciosa. Por isso o corte anda de trás pra frente
 * descartando linhas que empatam com a última buscada (a "sonda", a
 * (n+1)-ésima): não dá pra saber, só com essa janela, se o grupo dela some
 * além do que buscamos.
 *
 * Se TODAS as n+1 linhas empatarem — um grupo maior que a página inteira —
 * não sobra corte possível sem ficar parado (cursor == since, o cliente
 * giraria pedindo a mesma página pra sempre). O único jeito de avançar é
 * entregar o grupo INTEIRO e passar por cima dele; mas o grupo inteiro não
 * está nesta janela, e a janela não sabe quanto dele sobrou de fora. Por
 * isso o retorno marca `grupoIncompleto`: o limite é o server_em do grupo, e
 * o chamador tem que rebuscar o grupo completo (`WHERE server_em = limite`,
 * sem LIMIT) antes de responder. Sem essa rebusca o cursor avançaria por
 * cima de linhas nunca entregues — e a próxima query, `server_em > cursor`,
 * jamais voltaria a elas: perda permanente.
 *
 * A rebusca é barata e limitada na prática: um POST carimba no máximo
 * MAX_ITENS = 500 linhas por lista com o mesmo server_em, então só POSTs
 * concorrentes no mesmíssimo milissegundo empilham mais que isso.
 */
function limiteDaEntidadeEstourada(linhas: readonly LinhaPull[]): {
  limite: string
  grupoIncompleto: boolean
} {
  const maiorServerEm = linhas[linhas.length - 1].serverEm
  let corte = linhas.length
  while (corte > 0 && linhas[corte - 1].serverEm === maiorServerEm) corte--
  return corte > 0
    ? { limite: linhas[corte - 1].serverEm, grupoIncompleto: false }
    : { limite: maiorServerEm, grupoIncompleto: true }
}

/**
 * Decide se a resposta do pull precisa ser truncada e, se sim, onde.
 *
 * Pré-condição (garantida pelo chamador via `WHERE server_em > since ORDER
 * BY server_em LIMIT n+1`): cada lista tem no máximo n+1 linhas, já
 * ordenadas ascendentemente por server_em, e toda linha tem server_em >
 * since. É essa pré-condição que garante que o cursor devolvido aqui SEMPRE
 * avança em relação a since — nunca fica parado.
 *
 * Sem estouro em nenhuma lista: devolve tudo como veio, cursor null (o
 * chamador usa `agora`) — o caminho de hoje, intacto.
 *
 * Com estouro em uma ou mais listas: o cursor final é o MÍNIMO das
 * fronteiras individuais (nenhuma entidade pode avançar além do ponto que
 * outra ainda não alcançou), e toda linha de toda entidade com server_em
 * acima desse mínimo é descartada — inclusive de entidades que não
 * estouraram por si só. Essas linhas voltam sozinhas na próxima página,
 * porque o próximo pull consulta server_em > cursor.
 *
 * INVARIANTE: o cursor nunca avança por cima de um server_em cujas linhas não
 * foram todas entregues. Nos cortes normais isso sai de graça — a janela
 * enxerga o fim do grupo (é ele que faz o corte existir). No caso do grupo
 * maior que a janela, quem fecha o buraco é `gruposIncompletos`, que o
 * chamador PRECISA honrar.
 */
export function paginarPull<
  P extends LinhaPull,
  A extends LinhaPull,
  D extends LinhaPull,
  O extends LinhaPull,
  J extends LinhaPull,
>(
  listas: { progresso: P[]; anotacoes: A[]; destaques: D[]; posicoes: O[]; jornadas: J[] },
  n: number,
): ResultadoPaginacaoPull<P, A, D, O, J> {
  const fronteiras = (
    [
      { nome: 'progresso', linhas: listas.progresso as LinhaPull[] },
      { nome: 'anotacoes', linhas: listas.anotacoes as LinhaPull[] },
      { nome: 'destaques', linhas: listas.destaques as LinhaPull[] },
      { nome: 'posicoes', linhas: listas.posicoes as LinhaPull[] },
      { nome: 'jornadas', linhas: listas.jornadas as LinhaPull[] },
    ] satisfies { nome: EntidadePull; linhas: LinhaPull[] }[]
  )
    .filter(({ linhas }) => linhas.length > n)
    .map(({ nome, linhas }) => ({ nome, ...limiteDaEntidadeEstourada(linhas) }))

  if (fronteiras.length === 0) {
    return { ...listas, cursor: null, maisDados: false, gruposIncompletos: [] }
  }

  const cursor = fronteiras.reduce(
    (menor, atual) => (atual.limite < menor ? atual.limite : menor),
    fronteiras[0].limite,
  )
  const cortar = <T extends LinhaPull>(linhas: T[]): T[] =>
    linhas.filter((l) => l.serverEm <= cursor)

  return {
    progresso: cortar(listas.progresso),
    anotacoes: cortar(listas.anotacoes),
    destaques: cortar(listas.destaques),
    posicoes: cortar(listas.posicoes),
    jornadas: cortar(listas.jornadas),
    cursor,
    maisDados: true,
    // Só a entidade que empatou tudo E cuja fronteira virou o cursor tem
    // grupo em aberto. Se a fronteira dela perdeu para um mínimo menor, as
    // linhas dela foram cortadas fora por inteiro e voltam na próxima página.
    // As demais entidades enxergam o fim do grupo do cursor dentro da própria
    // janela (ela vai além dele), então já vieram completas.
    gruposIncompletos: fronteiras
      .filter((f) => f.grupoIncompleto && f.limite === cursor)
      .map((f) => f.nome),
  }
}

export function parseSyncPush(body: unknown): {
  progresso: PushProgresso[]
  anotacoes: PushAnotacao[]
  destaques: PushDestaque[]
  posicoes: PushPosicao[]
  jornadas: PushJornada[]
} | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const progresso = b.progresso ?? []
  const anotacoes = b.anotacoes ?? []
  // Corpo sem `destaques`/`posicoes`/`jornadas` é aceito como lista vazia: um
  // cliente ainda não atualizado continua sincronizando as entidades que conhece.
  const destaques = b.destaques ?? []
  const posicoes = b.posicoes ?? []
  const jornadas = b.jornadas ?? []
  if (
    !Array.isArray(progresso) ||
    !Array.isArray(anotacoes) ||
    !Array.isArray(destaques) ||
    !Array.isArray(posicoes) ||
    !Array.isArray(jornadas)
  ) {
    return null
  }
  if (
    progresso.length > MAX_ITENS ||
    anotacoes.length > MAX_ITENS ||
    destaques.length > MAX_ITENS ||
    posicoes.length > MAX_ITENS ||
    jornadas.length > MAX_ITENS
  ) {
    return null
  }
  if (
    !progresso.every(validProgresso) ||
    !anotacoes.every(validAnotacao) ||
    !destaques.every(validDestaque) ||
    !posicoes.every(validPosicao) ||
    !jornadas.every(validJornada)
  ) {
    return null
  }
  return {
    progresso: progresso.map((p) => ({
      ...p,
      historico: Array.isArray(p.historico) ? (p.historico as string[]) : [],
      paraReler: p.paraReler === true,
    })),
    anotacoes: anotacoes.map((a) => ({
      ...a,
      verseRef: typeof a.verseRef === 'string' ? a.verseRef : null,
    })),
    destaques,
    posicoes,
    jornadas,
  }
}
