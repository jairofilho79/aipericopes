/**
 * Handlers e lógica de negócio das funcionalidades de IA (BYOK):
 * - Explicação rápida (com cache/reaproveitamento da salva e streaming SSE)
 * - Histórico de explicações
 * - Conversas e mensagens com histórico persistido e streaming SSE
 */

import type { Context } from 'hono'
import type { Env } from './env.d'
import { decifrarChave } from './ia-cripto'
import type { ProvedorId } from './ia-provedores'
import { ErroIa, chamarIaStream } from './ia-stream'

const SEM_CACHE = { 'cache-control': 'no-store' }

export type DadosChaveDecifrada = {
  provedor: ProvedorId
  modelo: string
  chave: string
  contaId: string | null
}

export async function recuperarChaveUsuario(
  db: D1Database,
  secret: string | undefined,
  userId: string,
): Promise<DadosChaveDecifrada | null> {
  if (!secret) return null

  const linha = await db
    .prepare(
      `SELECT provedor, modelo, conta_id AS contaId, chave_cifrada AS chaveCifrada, iv
       FROM ia_chave WHERE user_id = ?1`,
    )
    .bind(userId)
    .first<{
      provedor: ProvedorId
      modelo: string
      contaId: string | null
      chaveCifrada: string
      iv: string
    }>()

  if (!linha) return null

  try {
    const chave = await decifrarChave(secret, userId, linha.chaveCifrada, linha.iv)
    return {
      provedor: linha.provedor,
      modelo: linha.modelo,
      chave,
      contaId: linha.contaId,
    }
  } catch (err) {
    console.error('[ia] erro ao decifrar chave do usuário', err)
    return null
  }
}

export function formatarRefVersos(
  capIni: number,
  verIni: number,
  capFim: number,
  verFim: number,
): string {
  if (capIni === capFim) {
    return verIni === verFim ? `${capIni}:${verIni}` : `${capIni}:${verIni}-${verFim}`
  }
  return `${capIni}:${verIni} - ${capFim}:${verFim}`
}

export function montarPromptExplicacao(params: {
  livro: string
  capituloInicio: number
  versiculoInicio: number
  capituloFim: number
  versiculoFim: number
  trechoTexto: string
}): { system: string; user: string } {
  const ref = formatarRefVersos(
    params.capituloInicio,
    params.versiculoInicio,
    params.capituloFim,
    params.versiculoFim,
  )

  const system =
    'Você é um assistente de estudos bíblicos acolhedor, claro e fiel às Escrituras em português do Brasil. ' +
    'Suas explicações são acessíveis a leitores leigos, mantendo rigor e respeito ao texto sagrado. ' +
    'Evite polêmicas denominacionais desnecessárias e responda exclusivamente sobre o trecho bíblico selecionado.'

  const user =
    `Você receberá um trecho bíblico selecionado de ${params.livro} ${ref}:\n\n` +
    `"""\n${params.trechoTexto.trim()}\n"""\n\n` +
    'Por favor, forneça uma explicação simples e estruturada contendo exatamente as três seções abaixo em formato Markdown:\n\n' +
    '### Contexto\n' +
    'Uma explicação simplificada sobre o contexto histórico e literário deste trecho específico (quem fala, para quem ou o cenário em que ocorre).\n\n' +
    '### Resenha\n' +
    'Uma síntese explicativa e clara sobre o que este trecho selecionado diz e o que acontece nele.\n\n' +
    '### Reflexão\n' +
    'Uma reflexão prática e edificante para o dia a dia, baseada exclusivamente no que foi selecionado.'

  return { system, user }
}

/**
 * POST /api/ia/explicar
 * Se gerarNova !== true e já houver explicação salva para o mesmo trecho, retorna JSON com { salva: true, explicacao }.
 * Caso contrário, inicia streaming SSE da nova explicação e salva no D1 no término bem-sucedido.
 */
export async function handleExplicar(
  c: Context<{ Bindings: Env }>,
  userId: string,
): Promise<Response> {
  const corpo = (await c.req.json().catch(() => null)) as {
    pericopeOrdem?: unknown
    livro?: unknown
    capituloInicio?: unknown
    versiculoInicio?: unknown
    capituloFim?: unknown
    versiculoFim?: unknown
    versiculos?: unknown
    trechoTexto?: unknown
    gerarNova?: unknown
  } | null

  if (
    !corpo ||
    typeof corpo.pericopeOrdem !== 'number' ||
    typeof corpo.livro !== 'string' ||
    typeof corpo.capituloInicio !== 'number' ||
    typeof corpo.versiculoInicio !== 'number' ||
    typeof corpo.capituloFim !== 'number' ||
    typeof corpo.versiculoFim !== 'number' ||
    !Array.isArray(corpo.versiculos) ||
    typeof corpo.trechoTexto !== 'string'
  ) {
    return c.json({ erro: 'Dados da passagem inválidos' }, 400, SEM_CACHE)
  }

  const {
    pericopeOrdem,
    livro,
    capituloInicio,
    versiculoInicio,
    capituloFim,
    versiculoFim,
    versiculos,
    trechoTexto,
    gerarNova,
  } = corpo

  const versiculosJson = JSON.stringify(versiculos)

  // 1. Se não pediu explicitamente para gerar nova, busca se já tem salva
  if (!gerarNova) {
    const salva = await c.env.DB.prepare(
      `SELECT id, pericope_ordem AS pericopeOrdem, livro, capitulo_inicio AS capituloInicio,
              versiculo_inicio AS versiculoInicio, capitulo_fim AS capituloFim, versiculo_fim AS versiculoFim,
              versiculos_json AS versiculosJson, trecho_texto AS trechoTexto, prompt, resposta,
              provedor, modelo, criado_em AS criadoEm
       FROM ia_explicacao
       WHERE user_id = ?1 AND pericope_ordem = ?2 AND versiculos_json = ?3 AND apagado_em IS NULL
       ORDER BY criado_em DESC LIMIT 1`,
    )
      .bind(userId, pericopeOrdem, versiculosJson)
      .first<{
        id: string
        pericopeOrdem: number
        livro: string
        capituloInicio: number
        versiculoInicio: number
        capituloFim: number
        versiculoFim: number
        versiculosJson: string
        trechoTexto: string
        prompt: string
        resposta: string
        provedor: string
        modelo: string
        criadoEm: string
      }>()

    if (salva) {
      return c.json(
        {
          salva: true,
          explicacao: {
            ...salva,
            versiculos: JSON.parse(salva.versiculosJson),
          },
        },
        200,
        SEM_CACHE,
      )
    }
  }

  // 2. Precisa gerar nova: recupera chave
  const chaveInfo = await recuperarChaveUsuario(c.env.DB, c.env.AI_KEY_SECRET, userId)
  if (!chaveInfo) {
    return c.json(
      { erro: 'Chave de IA não cadastrada ou segredo mestre não configurado' },
      400,
      SEM_CACHE,
    )
  }

  const { system, user } = montarPromptExplicacao({
    livro,
    capituloInicio,
    versiculoInicio,
    capituloFim,
    versiculoFim,
    trechoTexto,
  })

  // 3. Monta stream SSE
  const enc = new TextEncoder()
  const db = c.env.DB

  const stream = new ReadableStream({
    async start(controller) {
      let respostaCompleta = ''
      try {
        const gen = chamarIaStream({
          provedor: chaveInfo.provedor,
          modelo: chaveInfo.modelo,
          chave: chaveInfo.chave,
          contaId: chaveInfo.contaId,
          mensagens: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        })

        for await (const token of gen) {
          respostaCompleta += token
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ tipo: 'token', conteudo: token })}\n\n`),
          )
        }

        // Concluído com sucesso: grava no banco!
        const id = crypto.randomUUID()
        const agora = new Date().toISOString()

        await db
          .prepare(
            `INSERT INTO ia_explicacao (
               id, user_id, pericope_ordem, livro, capitulo_inicio, versiculo_inicio,
               capitulo_fim, versiculo_fim, versiculos_json, trecho_texto, prompt,
               resposta, provedor, modelo, criado_em
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
          )
          .bind(
            id,
            userId,
            pericopeOrdem,
            livro,
            capituloInicio,
            versiculoInicio,
            capituloFim,
            versiculoFim,
            versiculosJson,
            trechoTexto,
            user,
            respostaCompleta,
            chaveInfo.provedor,
            chaveInfo.modelo,
            agora,
          )
          .run()

        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              tipo: 'fim',
              id,
              resposta: respostaCompleta,
              criadoEm: agora,
            })}\n\n`,
          ),
        )
      } catch (err) {
        console.error('[ia] erro durante geracao da explicacao', err)
        const msg =
          err instanceof ErroIa ? err.mensagemAmigavel : 'Falha ao processar com a IA. Tente de novo.'
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ tipo: 'erro', mensagem: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}

/** GET /api/ia/explicacoes - Lista explicações do usuário */
export async function handleListarExplicacoes(
  c: Context<{ Bindings: Env }>,
  userId: string,
): Promise<Response> {
  const linhas = await c.env.DB.prepare(
    `SELECT id, pericope_ordem AS pericopeOrdem, livro, capitulo_inicio AS capituloInicio,
            versiculo_inicio AS versiculoInicio, capitulo_fim AS capituloFim, versiculo_fim AS versiculoFim,
            versiculos_json AS versiculosJson, trecho_texto AS trechoTexto, resposta,
            provedor, modelo, criado_em AS criadoEm
     FROM ia_explicacao
     WHERE user_id = ?1 AND apagado_em IS NULL
     ORDER BY criado_em DESC
     LIMIT 100`,
  )
    .bind(userId)
    .all<{
      id: string
      pericopeOrdem: number
      livro: string
      capituloInicio: number
      versiculoInicio: number
      capituloFim: number
      versiculoFim: number
      versiculosJson: string
      trechoTexto: string
      resposta: string
      provedor: string
      modelo: string
      criadoEm: string
    }>()

  const explicacoes = (linhas.results ?? []).map((l) => ({
    ...l,
    versiculos: JSON.parse(l.versiculosJson),
  }))

  return c.json({ explicacoes }, 200, SEM_CACHE)
}

/** GET /api/ia/explicacoes/:id - Detalhes de uma explicação */
export async function handleObterExplicacao(
  c: Context<{ Bindings: Env }>,
  userId: string,
  id: string,
): Promise<Response> {
  const linha = await c.env.DB.prepare(
    `SELECT id, pericope_ordem AS pericopeOrdem, livro, capitulo_inicio AS capituloInicio,
            versiculo_inicio AS versiculoInicio, capitulo_fim AS capituloFim, versiculo_fim AS versiculoFim,
            versiculos_json AS versiculosJson, trecho_texto AS trechoTexto, prompt, resposta,
            provedor, modelo, criado_em AS criadoEm
     FROM ia_explicacao
     WHERE id = ?1 AND user_id = ?2 AND apagado_em IS NULL`,
  )
    .bind(id, userId)
    .first<{
      id: string
      pericopeOrdem: number
      livro: string
      capituloInicio: number
      versiculoInicio: number
      capituloFim: number
      versiculoFim: number
      versiculosJson: string
      trechoTexto: string
      prompt: string
      resposta: string
      provedor: string
      modelo: string
      criadoEm: string
    }>()

  if (!linha) return c.json({ error: 'não encontrado' }, 404, SEM_CACHE)

  return c.json(
    {
      explicacao: {
        ...linha,
        versiculos: JSON.parse(linha.versiculosJson),
      },
    },
    200,
    SEM_CACHE,
  )
}

/** DELETE /api/ia/explicacoes/:id - Soft delete */
export async function handleApagarExplicacao(
  c: Context<{ Bindings: Env }>,
  userId: string,
  id: string,
): Promise<Response> {
  const agora = new Date().toISOString()
  await c.env.DB.prepare(
    `UPDATE ia_explicacao SET apagado_em = ?1 WHERE id = ?2 AND user_id = ?3`,
  )
    .bind(agora, id, userId)
    .run()

  return c.json({ ok: true }, 200, SEM_CACHE)
}

/** POST /api/ia/conversas - Cria conversa (avulsa, por seleção ou continuada de explicação) */
export async function handleCriarConversa(
  c: Context<{ Bindings: Env }>,
  userId: string,
): Promise<Response> {
  const corpo = (await c.req.json().catch(() => null)) as {
    titulo?: unknown
    escopo?: unknown
    explicacaoId?: unknown
    contextoFlags?: unknown
    pericopeOrdem?: unknown
    livro?: unknown
    capituloInicio?: unknown
    versiculoInicio?: unknown
    capituloFim?: unknown
    versiculoFim?: unknown
  } | null

  const id = crypto.randomUUID()
  const agora = new Date().toISOString()

  let titulo = typeof corpo?.titulo === 'string' && corpo.titulo.trim() ? corpo.titulo.trim() : ''
  const escopo =
    corpo?.escopo === 'selecao' || corpo?.escopo === 'pericope' ? corpo.escopo : 'avulsa'
  const explicacaoId = typeof corpo?.explicacaoId === 'string' ? corpo.explicacaoId : null
  const contextoFlags = Array.isArray(corpo?.contextoFlags) ? JSON.stringify(corpo.contextoFlags) : null
  const pericopeOrdem = typeof corpo?.pericopeOrdem === 'number' ? corpo.pericopeOrdem : null
  const livro = typeof corpo?.livro === 'string' ? corpo.livro : null
  const capituloInicio = typeof corpo?.capituloInicio === 'number' ? corpo.capituloInicio : null
  const versiculoInicio = typeof corpo?.versiculoInicio === 'number' ? corpo.versiculoInicio : null
  const capituloFim = typeof corpo?.capituloFim === 'number' ? corpo.capituloFim : null
  const versiculoFim = typeof corpo?.versiculoFim === 'number' ? corpo.versiculoFim : null

  // Se veio de uma explicação existente, herda dados e semeia histórico
  let explicacaoOrigem: {
    trechoTexto: string
    resposta: string
    livro: string
    capituloInicio: number
    versiculoInicio: number
    capituloFim: number
    versiculoFim: number
    pericopeOrdem: number
  } | null = null

  if (explicacaoId) {
    const exp = await c.env.DB.prepare(
      `SELECT trecho_texto AS trechoTexto, resposta, livro, capitulo_inicio AS capituloInicio,
              versiculo_inicio AS versiculoInicio, capitulo_fim AS capituloFim,
              versiculo_fim AS versiculoFim, pericope_ordem AS pericopeOrdem
       FROM ia_explicacao WHERE id = ?1 AND user_id = ?2 AND apagado_em IS NULL`,
    )
      .bind(explicacaoId, userId)
      .first<{
        trechoTexto: string
        resposta: string
        livro: string
        capituloInicio: number
        versiculoInicio: number
        capituloFim: number
        versiculoFim: number
        pericopeOrdem: number
      }>()
    if (exp) explicacaoOrigem = exp
  }

  if (!titulo) {
    if (explicacaoOrigem) {
      const ref = formatarRefVersos(
        explicacaoOrigem.capituloInicio,
        explicacaoOrigem.versiculoInicio,
        explicacaoOrigem.capituloFim,
        explicacaoOrigem.versiculoFim,
      )
      titulo = `Conversa sobre ${explicacaoOrigem.livro} ${ref}`
    } else if (livro && capituloInicio && versiculoInicio) {
      const ref = formatarRefVersos(
        capituloInicio,
        versiculoInicio,
        capituloFim ?? capituloInicio,
        versiculoFim ?? versiculoInicio,
      )
      titulo = `Conversa sobre ${livro} ${ref}`
    } else {
      titulo = 'Conversa sobre a Bíblia'
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO ia_conversa (
       id, user_id, titulo, escopo, explicacao_id, contexto_flags,
       pericope_ordem, livro, capitulo_inicio, versiculo_inicio,
       capitulo_fim, versiculo_fim, criado_em, atualizado_em
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
  )
    .bind(
      id,
      userId,
      titulo,
      escopo,
      explicacaoId,
      contextoFlags,
      explicacaoOrigem?.pericopeOrdem ?? pericopeOrdem,
      explicacaoOrigem?.livro ?? livro,
      explicacaoOrigem?.capituloInicio ?? capituloInicio,
      explicacaoOrigem?.versiculoInicio ?? versiculoInicio,
      explicacaoOrigem?.capituloFim ?? capituloFim,
      explicacaoOrigem?.versiculoFim ?? versiculoFim,
      agora,
    )
    .run()

  // Se tem explicação de origem, insere a pergunta e a explicação como primeira mensagem
  if (explicacaoOrigem) {
    const msgUser = crypto.randomUUID()
    const msgIa = crypto.randomUUID()
    const ref = formatarRefVersos(
      explicacaoOrigem.capituloInicio,
      explicacaoOrigem.versiculoInicio,
      explicacaoOrigem.capituloFim,
      explicacaoOrigem.versiculoFim,
    )

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO ia_mensagem (id, conversa_id, user_id, papel, conteudo, criado_em)
         VALUES (?1, ?2, ?3, 'user', ?4, ?5)`,
      ).bind(
        msgUser,
        id,
        userId,
        `Gostaria de uma explicação sobre ${explicacaoOrigem.livro} ${ref}`,
        agora,
      ),
      c.env.DB.prepare(
        `INSERT INTO ia_mensagem (id, conversa_id, user_id, papel, conteudo, criado_em)
         VALUES (?1, ?2, ?3, 'assistant', ?4, ?5)`,
      ).bind(msgIa, id, userId, explicacaoOrigem.resposta, agora),
    ])
  }

  return c.json(
    {
      conversa: {
        id,
        titulo,
        escopo,
        explicacaoId,
        criadoEm: agora,
        atualizadoEm: agora,
      },
    },
    201,
    SEM_CACHE,
  )
}

/** GET /api/ia/conversas - Lista conversas do usuário */
export async function handleListarConversas(
  c: Context<{ Bindings: Env }>,
  userId: string,
): Promise<Response> {
  const linhas = await c.env.DB.prepare(
    `SELECT id, titulo, escopo, explicacao_id AS explicacaoId,
            pericope_ordem AS pericopeOrdem, livro, capitulo_inicio AS capituloInicio,
            versiculo_inicio AS versiculoInicio, capitulo_fim AS capituloFim,
            versiculo_fim AS versiculoFim, criado_em AS criadoEm, atualizado_em AS atualizadoEm
     FROM ia_conversa
     WHERE user_id = ?1 AND apagado_em IS NULL
     ORDER BY atualizado_em DESC
     LIMIT 50`,
  )
    .bind(userId)
    .all()

  return c.json({ conversas: linhas.results ?? [] }, 200, SEM_CACHE)
}

/** GET /api/ia/conversas/:id - Detalhes da conversa e mensagens */
export async function handleObterConversa(
  c: Context<{ Bindings: Env }>,
  userId: string,
  id: string,
): Promise<Response> {
  const conversa = await c.env.DB.prepare(
    `SELECT c.id, c.titulo, c.escopo, c.explicacao_id AS explicacaoId, c.contexto_flags AS contextoFlags,
            c.pericope_ordem AS pericopeOrdem, c.livro, c.capitulo_inicio AS capituloInicio,
            c.versiculo_inicio AS versiculoInicio, c.capitulo_fim AS capituloFim,
            c.versiculo_fim AS versiculoFim, c.criado_em AS criadoEm, c.atualizado_em AS atualizadoEm,
            e.trecho_texto AS trechoTexto
     FROM ia_conversa c
     LEFT JOIN ia_explicacao e ON e.id = c.explicacao_id
     WHERE c.id = ?1 AND c.user_id = ?2 AND c.apagado_em IS NULL`,
  )
    .bind(id, userId)
    .first()

  if (!conversa) return c.json({ error: 'não encontrado' }, 404, SEM_CACHE)

  const msgs = await c.env.DB.prepare(
    `SELECT id, papel, conteudo, criado_em AS criadoEm
     FROM ia_mensagem
     WHERE conversa_id = ?1 AND user_id = ?2
     ORDER BY criado_em ASC`,
  )
    .bind(id, userId)
    .all()

  return c.json(
    {
      conversa,
      mensagens: msgs.results ?? [],
    },
    200,
    SEM_CACHE,
  )
}

/** DELETE /api/ia/conversas/:id - Soft delete */
export async function handleApagarConversa(
  c: Context<{ Bindings: Env }>,
  userId: string,
  id: string,
): Promise<Response> {
  const agora = new Date().toISOString()
  await c.env.DB.prepare(`UPDATE ia_conversa SET apagado_em = ?1 WHERE id = ?2 AND user_id = ?3`)
    .bind(agora, id, userId)
    .run()

  return c.json({ ok: true }, 200, SEM_CACHE)
}

/**
 * POST /api/ia/conversas/:id/mensagens
 * Envia uma mensagem no chat, processa com IA via streaming SSE.
 * Salva a pergunta do usuário e a resposta da IA JUNTAS somente após sucesso total.
 */
export async function handleEnviarMensagemConversa(
  c: Context<{ Bindings: Env }>,
  userId: string,
  conversaId: string,
): Promise<Response> {
  const conversa = await c.env.DB.prepare(
    `SELECT id, titulo, pericope_ordem AS pericopeOrdem, livro, capitulo_inicio AS capituloInicio,
            versiculo_inicio AS versiculoInicio, capitulo_fim AS capituloFim, versiculo_fim AS versiculoFim
     FROM ia_conversa
     WHERE id = ?1 AND user_id = ?2 AND apagado_em IS NULL`,
  )
    .bind(conversaId, userId)
    .first<{
      id: string
      titulo: string
      pericopeOrdem: number | null
      livro: string | null
      capituloInicio: number | null
      versiculoInicio: number | null
      capituloFim: number | null
      versiculoFim: number | null
    }>()

  if (!conversa) return c.json({ error: 'conversa não encontrada' }, 404, SEM_CACHE)

  const corpo = (await c.req.json().catch(() => null)) as {
    conteudo?: unknown
    contextoApoio?: unknown
  } | null

  if (!corpo || typeof corpo.conteudo !== 'string' || !corpo.conteudo.trim()) {
    return c.json({ erro: 'Mensagem vazia' }, 400, SEM_CACHE)
  }

  const novaPergunta = corpo.conteudo.trim()
  const contextoApoio = typeof corpo.contextoApoio === 'string' ? corpo.contextoApoio : ''

  const chaveInfo = await recuperarChaveUsuario(c.env.DB, c.env.AI_KEY_SECRET, userId)
  if (!chaveInfo) {
    return c.json({ erro: 'Chave de IA não cadastrada' }, 400, SEM_CACHE)
  }

  // Busca histórico de mensagens da conversa
  const historico = await c.env.DB.prepare(
    `SELECT papel, conteudo
     FROM ia_mensagem
     WHERE conversa_id = ?1 AND user_id = ?2
     ORDER BY criado_em ASC
     LIMIT 50`,
  )
    .bind(conversaId, userId)
    .all<{ papel: 'user' | 'assistant'; conteudo: string }>()

  const mensagensParaIa: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  let systemPrompt =
    'Você é um assistente de estudos bíblicos acolhedor, reflexivo e instrutivo, dialogando com um leitor da Bíblia em português do Brasil. ' +
    'Seja claro, respeitoso e evite polêmicas denominacionais desnecessárias.'

  if (conversa.livro && conversa.capituloInicio && conversa.versiculoInicio) {
    const ref = formatarRefVersos(
      conversa.capituloInicio,
      conversa.versiculoInicio,
      conversa.capituloFim ?? conversa.capituloInicio,
      conversa.versiculoFim ?? conversa.versiculoInicio,
    )
    systemPrompt += ` Esta conversa tem como base o texto bíblico de ${conversa.livro} ${ref}.`
  }

  if (contextoApoio) {
    systemPrompt += `\n\nMaterial de apoio da perícope:\n${contextoApoio}`
  }

  mensagensParaIa.push({ role: 'system', content: systemPrompt })

  for (const m of historico.results ?? []) {
    mensagensParaIa.push({
      role: m.papel === 'user' ? 'user' : 'assistant',
      content: m.conteudo,
    })
  }

  mensagensParaIa.push({ role: 'user', content: novaPergunta })

  const enc = new TextEncoder()
  const db = c.env.DB

  const stream = new ReadableStream({
    async start(controller) {
      let respostaCompleta = ''
      try {
        const gen = chamarIaStream({
          provedor: chaveInfo.provedor,
          modelo: chaveInfo.modelo,
          chave: chaveInfo.chave,
          contaId: chaveInfo.contaId,
          mensagens: mensagensParaIa,
        })

        for await (const token of gen) {
          respostaCompleta += token
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ tipo: 'token', conteudo: token })}\n\n`),
          )
        }

        // Sucesso total: grava ambas as mensagens no D1 em batch
        const idMsgUser = crypto.randomUUID()
        const idMsgIa = crypto.randomUUID()
        const agora = new Date().toISOString()

        await db.batch([
          db
            .prepare(
              `INSERT INTO ia_mensagem (id, conversa_id, user_id, papel, conteudo, criado_em)
               VALUES (?1, ?2, ?3, 'user', ?4, ?5)`,
            )
            .bind(idMsgUser, conversaId, userId, novaPergunta, agora),
          db
            .prepare(
              `INSERT INTO ia_mensagem (id, conversa_id, user_id, papel, conteudo, modelo, criado_em)
               VALUES (?1, ?2, ?3, 'assistant', ?4, ?5, ?6)`,
            )
            .bind(idMsgIa, conversaId, userId, respostaCompleta, chaveInfo.modelo, agora),
          db
            .prepare(`UPDATE ia_conversa SET atualizado_em = ?1 WHERE id = ?2`)
            .bind(agora, conversaId),
        ])

        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              tipo: 'fim',
              idPergunta: idMsgUser,
              idResposta: idMsgIa,
              resposta: respostaCompleta,
              criadoEm: agora,
            })}\n\n`,
          ),
        )
      } catch (err) {
        console.error('[ia] erro durante mensagem na conversa', err)
        const msg =
          err instanceof ErroIa ? err.mensagemAmigavel : 'Falha ao processar com a IA. Tente de novo.'
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ tipo: 'erro', mensagem: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
