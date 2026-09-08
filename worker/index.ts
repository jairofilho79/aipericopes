import { Hono } from 'hono'
import { cabecalhoContentRange, chaveAudio } from './audio'
import { createAuth } from './auth'
import {
  TAMANHO_PAGINA_PULL,
  UPSERT_PROGRESSO,
  corpoExcedeLimite,
  paginarPull,
  parseSyncPush,
} from './sync-logic'
import {
  MAX_BYTES,
  MODELO,
  decidirCota,
  diaUtc,
  montarInput,
  paraBase64,
  parseDuracao,
  proximaMeiaNoiteUtc,
  tipoAudioAceito,
} from './transcrever'
import {
  MODELO as MODELO_REVISAO,
  decidirCota as decidirCotaRevisao,
  limparSaida,
  montarInput as montarInputRevisao,
  parseTexto,
} from './revisar'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

// O better-auth responde `{ success: true }` ao pedido de OTP mesmo quando o
// envio do e-mail estourou — ele engole a exceção no próprio logger. Sem esta
// tradução, uma falha de envio chega ao usuário como "código enviado" e ele
// espera para sempre por um e-mail que nunca saiu.
app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  // Um `createAuth` por requisição (é assim que a rota sempre funcionou), então
  // esta variável é privada desta requisição — não há corrida entre pedidos.
  let falhaEnvio: unknown = null
  const auth = createAuth(c.env, (err) => {
    falhaEnvio = err
  })
  const res = await auth.handler(c.req.raw)
  // Só reescreve uma resposta de sucesso: se o better-auth já sinalizou algo
  // (rate limit, e-mail inválido), o motivo dele é mais específico que o nosso.
  if (falhaEnvio !== null && res.ok) {
    console.error('[otp] envio falhou', falhaEnvio)
    return c.json({ erro: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' }, 502)
  }
  return res
})

async function requireUserId(c: { env: Env; req: { raw: Request } }): Promise<string | null> {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session?.user.id ?? null
}

function parseJson(bruto: string): unknown {
  try {
    return JSON.parse(bruto)
  } catch {
    return null
  }
}

/** Remove `serverEm` de uma linha antes dela ir pro cliente: o cursor dele é o `agora`/boundary opaco. */
function despirServerEm<T extends { serverEm: string }>(linha: T): Omit<T, 'serverEm'> {
  const { serverEm: _serverEm, ...resto } = linha
  return resto
}

/**
 * D1 devolve `historico` como TEXT e `para_reler` como 0/1. O cliente espera
 * `string[]` e `boolean` — a conversão é aqui, não lá, para o formato do
 * protocolo ser o mesmo do tipo `Progresso`.
 */
function hidratarProgresso<T extends { historico: unknown; paraReler: unknown }>(linha: T) {
  let historico: string[] = []
  try {
    const bruto: unknown = JSON.parse(String(linha.historico ?? '[]'))
    if (Array.isArray(bruto)) historico = bruto.filter((d): d is string => typeof d === 'string')
  } catch {
    // Linha corrompida vira histórico vazio em vez de derrubar o pull inteiro.
  }
  return { ...linha, historico, paraReler: Boolean(linha.paraReler) }
}

// Linhas como saem do SELECT (camelCase pelos AS). `serverEm` é interno: sai
// da linha em despirServerEm antes de virar JSON.
type LinhaProgresso = {
  pericopeOrdem: number
  status: string
  historico: unknown
  paraReler: unknown
  atualizadoEm: string
  serverEm: string
}
type LinhaAnotacao = {
  id: string
  pericopeOrdem: number
  texto: string
  verseRef: string | null
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
  serverEm: string
}
type LinhaDestaque = {
  id: string
  pericopeOrdem: number
  verseId: string
  cor: string
  criadoEm: string
  atualizadoEm: string
  apagadoEm: string | null
  serverEm: string
}
type LinhaPosicao = {
  pericopeOrdem: number
  tipo: string
  ref: string
  tempo: number | null
  atualizadoEm: string
  apagadoEm: string | null
  serverEm: string
}
type LinhaJornada = {
  id: string
  nome: string
  tipo: string
  escopo: string
  inicioOrdem: number
  contaDesde: string | null
  criadoEm: string
  atualizadoEm: string
  arquivadaEm: string | null
  concluidaEm: string | null
  apagadoEm: string | null
  serverEm: string
}

// A parte comum das duas formas de ler cada entidade: a página (`server_em >
// since`, com LIMIT) e o fechamento de grupo (`server_em = cursor`, sem
// LIMIT). Ficam juntas de propósito — a lista de colunas tem que ser a mesma
// nas duas, senão o fechamento devolveria linhas com formato diferente.
const SELECT_PROGRESSO = `SELECT pericope_ordem AS pericopeOrdem, status, historico,
          para_reler AS paraReler, atualizado_em AS atualizadoEm, server_em AS serverEm
   FROM progresso WHERE user_id = ?1`
const SELECT_ANOTACOES = `SELECT id, pericope_ordem AS pericopeOrdem, texto, verse_ref AS verseRef,
          criado_em AS criadoEm, atualizado_em AS atualizadoEm, apagado_em AS apagadoEm,
          server_em AS serverEm
   FROM anotacoes WHERE user_id = ?1`
const SELECT_DESTAQUES = `SELECT id, pericope_ordem AS pericopeOrdem, verse_id AS verseId, cor,
          criado_em AS criadoEm, atualizado_em AS atualizadoEm, apagado_em AS apagadoEm,
          server_em AS serverEm
   FROM destaques WHERE user_id = ?1`
const SELECT_POSICOES = `SELECT pericope_ordem AS pericopeOrdem, tipo, ref, tempo,
          atualizado_em AS atualizadoEm, apagado_em AS apagadoEm,
          server_em AS serverEm
   FROM posicao_leitura WHERE user_id = ?1`
const SELECT_JORNADAS = `SELECT id, nome, tipo, escopo,
          inicio_ordem AS inicioOrdem, conta_desde AS contaDesde,
          criado_em AS criadoEm, atualizado_em AS atualizadoEm,
          arquivada_em AS arquivadaEm, concluida_em AS concluidaEm,
          apagado_em AS apagadoEm,
          server_em AS serverEm
   FROM jornada WHERE user_id = ?1`

/**
 * Busca a página de uma entidade: n+1 linhas, a extra só pra provar que há
 * mais sem uma segunda query. ORDER BY server_em é o que torna o corte de
 * paginarPull válido — ele assume as listas já vêm nessa ordem.
 */
async function buscarPagina<T>(
  db: D1Database,
  select: string,
  userId: string,
  since: string,
): Promise<T[]> {
  const { results } = await db
    .prepare(`${select} AND server_em > ?2 ORDER BY server_em LIMIT ?3`)
    .bind(userId, since, TAMANHO_PAGINA_PULL + 1)
    .all<T>()
  return results
}

/**
 * Fecha um grupo de `server_em` que a página cortou ao meio: busca TODAS as
 * linhas daquele instante, sem LIMIT.
 *
 * Sem isto o cursor avançaria para um `server_em` do qual só a fatia buscada
 * foi entregue, e a próxima página — que consulta `server_em > cursor` —
 * nunca mais visitaria o resto: perda permanente. paginarPull avisa em quais
 * entidades isso pode ter acontecido (`gruposIncompletos`); é sempre o caso
 * raro de um único instante com mais linhas que a página inteira, então esta
 * query extra praticamente nunca roda.
 */
async function fecharGrupo<T>(
  db: D1Database,
  select: string,
  userId: string,
  serverEm: string,
): Promise<T[]> {
  const { results } = await db
    .prepare(`${select} AND server_em = ?2 ORDER BY server_em`)
    .bind(userId, serverEm)
    .all<T>()
  return results
}

app.get('/api/sync', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return c.json({ error: 'não autenticado' }, 401)
  const since = c.req.query('since') ?? ''
  // `agora` é gerado ANTES dos SELECTs de propósito: uma linha gravada entre
  // este instante e a resposta tem server_em >= agora e entra no próximo pull.
  // Reentregar uma linha é inofensivo — applyRemote* é idempotente via LWW.
  const agora = new Date().toISOString()
  const paginado = paginarPull(
    {
      progresso: await buscarPagina<LinhaProgresso>(c.env.DB, SELECT_PROGRESSO, userId, since),
      anotacoes: await buscarPagina<LinhaAnotacao>(c.env.DB, SELECT_ANOTACOES, userId, since),
      destaques: await buscarPagina<LinhaDestaque>(c.env.DB, SELECT_DESTAQUES, userId, since),
      posicoes: await buscarPagina<LinhaPosicao>(c.env.DB, SELECT_POSICOES, userId, since),
      jornadas: await buscarPagina<LinhaJornada>(c.env.DB, SELECT_JORNADAS, userId, since),
    },
    TAMANHO_PAGINA_PULL,
  )

  // Fechamento dos grupos que a janela pode ter partido ao meio (ver
  // fecharGrupo). Substitui a lista, não concatena: paginarPull só marca a
  // entidade quando TODAS as linhas buscadas dela empatam no cursor, então
  // não há nada abaixo dele para preservar.
  const cortado = paginado.cursor
  let progresso = paginado.progresso
  let anotacoes = paginado.anotacoes
  let destaques = paginado.destaques
  let posicoes = paginado.posicoes
  let jornadas = paginado.jornadas
  if (cortado !== null) {
    for (const entidade of paginado.gruposIncompletos) {
      if (entidade === 'progresso') {
        progresso = await fecharGrupo<LinhaProgresso>(c.env.DB, SELECT_PROGRESSO, userId, cortado)
      } else if (entidade === 'anotacoes') {
        anotacoes = await fecharGrupo<LinhaAnotacao>(c.env.DB, SELECT_ANOTACOES, userId, cortado)
      } else if (entidade === 'destaques') {
        destaques = await fecharGrupo<LinhaDestaque>(c.env.DB, SELECT_DESTAQUES, userId, cortado)
      } else if (entidade === 'posicoes') {
        posicoes = await fecharGrupo<LinhaPosicao>(c.env.DB, SELECT_POSICOES, userId, cortado)
      } else if (entidade === 'jornadas') {
        jornadas = await fecharGrupo<LinhaJornada>(c.env.DB, SELECT_JORNADAS, userId, cortado)
      } else {
        // Exaustividade de propósito: um `else` catch-all aqui já causou um
        // apontamento de revisão (jornadas herdou o papel de posicoes sem
        // querer). Se EntidadePull ganhar um nome novo (a próxima entidade,
        // dias_leitura) sem um ramo dedicado, este `never` vira ERRO DE
        // COMPILAÇÃO em vez de perda de dados silenciosa: a nova entidade
        // cairia aqui, o grupo dela nunca seria fechado, e jornadas seria
        // sobrescrita com o conteúdo errado.
        const _exaustivo: never = entidade
        throw new Error(`grupo incompleto de entidade desconhecida: ${String(_exaustivo)}`)
      }
    }
  }

  return c.json({
    progresso: progresso.map((l) => despirServerEm(hidratarProgresso(l))),
    anotacoes: anotacoes.map(despirServerEm),
    destaques: destaques.map(despirServerEm),
    posicoes: posicoes.map(despirServerEm),
    jornadas: jornadas.map(despirServerEm),
    // Sem truncamento (o caminho de longe mais comum): cursor é `agora`,
    // exatamente como antes desta funcionalidade existir. Com truncamento, o
    // cursor é a fronteira computada por paginarPull — nunca `agora`, porque
    // linhas gravadas depois do corte ainda não foram nem buscadas.
    agora: paginado.cursor ?? agora,
    ...(paginado.maisDados ? { maisDados: true } : {}),
  })
})

app.post('/api/sync', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return c.json({ error: 'não autenticado' }, 401)
  if (corpoExcedeLimite(c.req.header('content-length'))) {
    return c.json({ error: 'corpo grande demais' }, 413)
  }
  // Lê como texto para medir o corpo antes de desserializar: um corpo chunked
  // chega sem Content-Length e escaparia do estágio acima. Falha de leitura
  // vira string vazia, que o JSON.parse rejeita e cai no 400 de sempre.
  const bruto = await c.req.text().catch(() => '')
  if (corpoExcedeLimite(null, bruto.length)) {
    return c.json({ error: 'corpo grande demais' }, 413)
  }
  const parsed = parseSyncPush(parseJson(bruto))
  if (!parsed) return c.json({ error: 'payload inválido' }, 400)

  // Um único carimbo de servidor para o lote inteiro: é o que alimenta o
  // cursor do pull (server_em), enquanto atualizado_em (relógio do cliente)
  // segue sendo a chave do LWW.
  const serverEm = new Date().toISOString()
  const stmts = [
    ...parsed.progresso.map((p) =>
      c.env.DB.prepare(UPSERT_PROGRESSO).bind(
        userId,
        p.pericopeOrdem,
        p.status,
        JSON.stringify(p.historico),
        p.paraReler ? 1 : 0,
        p.atualizadoEm,
        serverEm,
      ),
    ),
    ...parsed.anotacoes.map((a) =>
      c.env.DB.prepare(
        `INSERT INTO anotacoes (id, user_id, pericope_ordem, texto, verse_ref, criado_em, atualizado_em, apagado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(user_id, id) DO UPDATE SET
           texto = excluded.texto, verse_ref = excluded.verse_ref,
           atualizado_em = excluded.atualizado_em,
           apagado_em = excluded.apagado_em, server_em = excluded.server_em
         WHERE excluded.atualizado_em > anotacoes.atualizado_em`,
      ).bind(
        a.id,
        userId,
        a.pericopeOrdem,
        a.texto,
        a.verseRef,
        a.criadoEm,
        a.atualizadoEm,
        a.apagadoEm,
        serverEm,
      ),
    ),
    ...parsed.destaques.map((d) =>
      c.env.DB.prepare(
        `INSERT INTO destaques (user_id, id, pericope_ordem, verse_id, cor, criado_em, atualizado_em, apagado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(user_id, id) DO UPDATE SET
           cor = excluded.cor, atualizado_em = excluded.atualizado_em,
           apagado_em = excluded.apagado_em, server_em = excluded.server_em
         WHERE excluded.atualizado_em > destaques.atualizado_em`,
      ).bind(
        userId,
        d.id,
        d.pericopeOrdem,
        d.verseId,
        d.cor,
        d.criadoEm,
        d.atualizadoEm,
        d.apagadoEm,
        serverEm,
      ),
    ),
    ...parsed.posicoes.map((p) =>
      c.env.DB.prepare(
        `INSERT INTO posicao_leitura (user_id, pericope_ordem, tipo, ref, tempo, atualizado_em, apagado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(user_id, pericope_ordem) DO UPDATE SET
           tipo = excluded.tipo, ref = excluded.ref, tempo = excluded.tempo,
           atualizado_em = excluded.atualizado_em,
           apagado_em = excluded.apagado_em, server_em = excluded.server_em
         WHERE excluded.atualizado_em > posicao_leitura.atualizado_em`,
      ).bind(userId, p.pericopeOrdem, p.tipo, p.ref, p.tempo, p.atualizadoEm, p.apagadoEm, serverEm),
    ),
    ...parsed.jornadas.map((j) =>
      c.env.DB.prepare(
        `INSERT INTO jornada (user_id, id, nome, tipo, escopo, inicio_ordem, conta_desde,
                              criado_em, atualizado_em, arquivada_em, concluida_em,
                              apagado_em, server_em)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(user_id, id) DO UPDATE SET
           nome = excluded.nome, tipo = excluded.tipo, escopo = excluded.escopo,
           inicio_ordem = excluded.inicio_ordem, conta_desde = excluded.conta_desde,
           atualizado_em = excluded.atualizado_em, arquivada_em = excluded.arquivada_em,
           concluida_em = excluded.concluida_em, apagado_em = excluded.apagado_em,
           server_em = excluded.server_em
         WHERE excluded.atualizado_em > jornada.atualizado_em`,
      ).bind(
        userId, j.id, j.nome, j.tipo, j.escopo, j.inicioOrdem, j.contaDesde,
        j.criadoEm, j.atualizadoEm, j.arquivadaEm, j.concluidaEm, j.apagadoEm, serverEm,
      ),
    ),
  ]
  if (stmts.length) await c.env.DB.batch(stmts)
  return c.json({ ok: true, agora: serverEm })
})

// Ditado das anotações: o áudio gravado no navegador vira texto pelo Workers
// AI (whisper). Só para quem está logado — é o que permite cobrar a cota por
// usuário. A ordem das checagens vai do mais barato ao mais caro: sessão,
// headers, tamanho, cota (uma query) e só então o modelo.
app.post('/api/transcrever', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return c.json({ error: 'não autenticado' }, 401)
  if (!tipoAudioAceito(c.req.header('content-type'))) {
    return c.json({ erro: 'Formato de áudio não suportado' }, 415)
  }
  const declarado = Number(c.req.header('content-length'))
  if (Number.isFinite(declarado) && declarado > MAX_BYTES) {
    return c.json({ erro: 'Áudio grande demais' }, 413)
  }
  const duracao = parseDuracao(c.req.header('x-duracao-segundos'))
  if (duracao === null) return c.json({ erro: 'Duração inválida' }, 400)
  // Rede de segurança para o corpo chunked, que chega sem Content-Length.
  const audio = await c.req.arrayBuffer().catch(() => new ArrayBuffer(0))
  if (audio.byteLength > MAX_BYTES) return c.json({ erro: 'Áudio grande demais' }, 413)

  const agora = new Date()
  const dia = diaUtc(agora)
  // Uma query só para as duas cotas: a linha do usuário e a soma do dia.
  const uso = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN user_id = ?1 THEN segundos END), 0) AS usuario,
            COALESCE(SUM(segundos), 0) AS total
     FROM transcricao_uso WHERE dia = ?2`,
  )
    .bind(userId, dia)
    .first<{ usuario: number; total: number }>()
  const decisao = decidirCota({
    usoUsuario: uso?.usuario ?? 0,
    usoGlobal: uso?.total ?? 0,
    duracao,
  })
  if (decisao === 'usuario') {
    return c.json({ erro: 'Cota diária de ditado esgotada', voltaEm: proximaMeiaNoiteUtc(agora) }, 429)
  }
  if (decisao === 'global') {
    return c.json({ erro: 'Ditado indisponível hoje', voltaEm: proximaMeiaNoiteUtc(agora) }, 503)
  }

  let texto: string
  try {
    const saida: unknown = await c.env.AI.run(MODELO, montarInput(paraBase64(audio)))
    const t = (saida as { text?: unknown } | null)?.text
    if (typeof t !== 'string') throw new Error('resposta do modelo sem `text`')
    texto = t.trim()
  } catch (err) {
    console.error('[transcrever]', err)
    return c.json({ erro: 'Não foi possível transcrever' }, 502)
  }

  // Cobra só o que foi de fato transcrito: uma falha do modelo não come cota.
  // A janela entre a leitura da cota e esta gravação deixa dois pedidos
  // simultâneos passarem um pouco do teto — irrelevante para estes números.
  await c.env.DB.prepare(
    `INSERT INTO transcricao_uso (user_id, dia, segundos) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id, dia) DO UPDATE SET segundos = segundos + excluded.segundos`,
  )
    .bind(userId, dia, duracao)
    .run()
  return c.json({ texto })
})

// Revisão do ditado nativo: o texto que o reconhecedor do aparelho despejou
// sem pontuação volta pontuado e capitalizado por um modelo de texto pequeno
// (Workers AI). Mesma receita do /api/transcrever: só logado, cota por
// usuário e teto global, cobrados em caracteres. Se o modelo falhar ou
// devolver algo suspeito, 502 — o cliente fica com o texto que já tem.
app.post('/api/revisar-ditado', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return c.json({ error: 'não autenticado' }, 401)
  const texto = parseTexto(parseJson(await c.req.text().catch(() => '')))
  if (texto === null) return c.json({ erro: 'Texto inválido' }, 400)

  const agora = new Date()
  const dia = diaUtc(agora)
  const uso = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN user_id = ?1 THEN caracteres END), 0) AS usuario,
            COALESCE(SUM(caracteres), 0) AS total
     FROM revisao_uso WHERE dia = ?2`,
  )
    .bind(userId, dia)
    .first<{ usuario: number; total: number }>()
  const decisao = decidirCotaRevisao({
    usoUsuario: uso?.usuario ?? 0,
    usoGlobal: uso?.total ?? 0,
    caracteres: texto.length,
  })
  if (decisao === 'usuario') {
    return c.json({ erro: 'Cota diária de revisão esgotada', voltaEm: proximaMeiaNoiteUtc(agora) }, 429)
  }
  if (decisao === 'global') {
    return c.json({ erro: 'Revisão indisponível hoje', voltaEm: proximaMeiaNoiteUtc(agora) }, 503)
  }

  let revisado: string | null
  try {
    const saida: unknown = await c.env.AI.run(MODELO_REVISAO, montarInputRevisao(texto))
    revisado = limparSaida(saida, texto)
  } catch (err) {
    console.error('[revisar-ditado]', err)
    revisado = null
  }
  if (revisado === null) return c.json({ erro: 'Não foi possível revisar' }, 502)

  // Cobra só o que foi de fato revisado: falha do modelo não come cota.
  await c.env.DB.prepare(
    `INSERT INTO revisao_uso (user_id, dia, caracteres) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id, dia) DO UPDATE SET caracteres = caracteres + excluded.caracteres`,
  )
    .bind(userId, dia, texto.length)
    .run()
  return c.json({ texto: revisado })
})

// Narração pré-gerada (R2). Pública como o texto que ela narra; imutável por
// chave (regenerar uma voz ganha outro prefixo), então o cache pode ser eterno.
app.on(['GET', 'HEAD'], '/api/audio/*', async (c) => {
  const chave = chaveAudio(c.req.path.replace('/api/audio/', ''))
  if (!chave) return c.json({ error: 'não encontrado' }, 404)
  const cabecalhos = new Headers({
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable',
  })
  if (c.req.method === 'HEAD') {
    const meta = await c.env.AUDIO.head(chave)
    if (!meta) return c.json({ error: 'não encontrado' }, 404)
    meta.writeHttpMetadata(cabecalhos)
    cabecalhos.set('content-length', String(meta.size))
    return new Response(null, { headers: cabecalhos })
  }
  const obj = await c.env.AUDIO.get(chave, { range: c.req.raw.headers })
  if (!obj) return c.json({ error: 'não encontrado' }, 404)
  obj.writeHttpMetadata(cabecalhos)
  const contentRange = cabecalhoContentRange(obj.range, obj.size)
  if (contentRange) cabecalhos.set('content-range', contentRange)
  return new Response(obj.body, { status: contentRange ? 206 : 200, headers: cabecalhos })
})

app.notFound((c) => c.json({ error: 'não encontrado' }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'erro interno' }, 500)
})

export default app
