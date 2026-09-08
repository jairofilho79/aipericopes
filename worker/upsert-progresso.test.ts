/// <reference types="node" />
// Testa o SQL DE VERDADE do upsert de `progresso` (worker/sync-logic.ts,
// UPSERT_PROGRESSO), rodado contra um SQLite em memória via node:sqlite —
// não uma cópia do texto do statement. Ver o comentário de UPSERT_PROGRESSO
// para o porquê das duas políticas de merge (LWW para status/para_reler,
// união de conjuntos para historico, fora da guarda do LWW).
//
// Schema replicado de migrations/0002_sync.sql + 0003_server_em.sql +
// 0010_progresso_historico.sql (só as colunas — sem a FK para "user", que o
// statement não usa).
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UPSERT_PROGRESSO } from './sync-logic'

type LinhaProgresso = {
  status: string
  atualizado_em: string
  historico: string
  para_reler: number
  server_em: string
}

let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE progresso (
      user_id TEXT NOT NULL,
      pericope_ordem INTEGER NOT NULL,
      status TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      server_em TEXT NOT NULL DEFAULT '',
      historico TEXT NOT NULL DEFAULT '[]',
      para_reler INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, pericope_ordem)
    );
  `)
})

afterEach(() => {
  db.close()
})

type Estado = {
  status: string
  atualizadoEm: string
  historico: string[]
  paraReler: boolean
  serverEm: string
}

/** Grava a linha inicial direto (sem passar pelo upsert) — o estado "já guardado". */
function semear(estado: Estado): void {
  db.prepare(
    `INSERT INTO progresso (user_id, pericope_ordem, status, atualizado_em, historico, para_reler, server_em)
     VALUES ('u1', 1, ?1, ?2, ?3, ?4, ?5)`,
  ).run(estado.status, estado.atualizadoEm, JSON.stringify(estado.historico), estado.paraReler ? 1 : 0, estado.serverEm)
}

/** Roda o UPSERT_PROGRESSO de verdade com o payload de um push. */
function empurrar(payload: Estado): void {
  db.prepare(UPSERT_PROGRESSO).run(
    'u1',
    1,
    payload.status,
    JSON.stringify(payload.historico),
    payload.paraReler ? 1 : 0,
    payload.atualizadoEm,
    payload.serverEm,
  )
}

function ler(): LinhaProgresso {
  return db
    .prepare(
      `SELECT status, atualizado_em, historico, para_reler, server_em
       FROM progresso WHERE user_id = 'u1' AND pericope_ordem = 1`,
    )
    .get() as LinhaProgresso
}

function historicoDe(linha: LinhaProgresso): string[] {
  return JSON.parse(linha.historico) as string[]
}

const T_ANTIGO_2 = '2026-08-01T00:00:00.000Z'
const T_ANTIGO_1 = '2026-08-10T00:00:00.000Z'
const T_MEIO = '2026-08-15T00:00:00.000Z'
const T_NOVO_1 = '2026-08-20T00:00:00.000Z'
const T_NOVO_2 = '2026-08-25T00:00:00.000Z'
const S_INICIAL = '2026-08-20T10:00:00.000Z'
const S_PUSH = '2026-09-01T00:00:00.000Z'

describe('UPSERT_PROGRESSO — merge de status/para_reler (LWW) e historico (união)', () => {
  it('payload que perde o LWW ainda contribui seu histórico para a união', () => {
    // Linha guardada é mais nova: nao_iniciado, atualizado_em recente, com histórico.
    semear({
      status: 'nao_iniciado',
      atualizadoEm: T_NOVO_1,
      historico: [T_MEIO],
      paraReler: false,
      serverEm: S_INICIAL,
    })
    // Payload chega mais velho, mas carrega uma conclusão feita offline.
    empurrar({
      status: 'concluido',
      atualizadoEm: T_ANTIGO_1,
      historico: [T_ANTIGO_1],
      paraReler: false,
      serverEm: S_PUSH,
    })
    const linha = ler()
    expect(linha.status).toBe('nao_iniciado')
    expect(linha.para_reler).toBe(0)
    // As duas entradas sobrevivem, mais nova primeiro — mesmo com o status
    // do lote mais velho tendo sido descartado pelo LWW.
    expect(historicoDe(linha)).toEqual([T_MEIO, T_ANTIGO_1])
  })

  it('payload que vence o LWW faz merge do histórico em vez de substituí-lo', () => {
    semear({
      status: 'em_andamento',
      atualizadoEm: T_ANTIGO_1,
      historico: [T_ANTIGO_2],
      paraReler: false,
      serverEm: S_INICIAL,
    })
    empurrar({
      status: 'concluido',
      atualizadoEm: T_NOVO_2,
      historico: [T_NOVO_2],
      paraReler: true,
      serverEm: S_PUSH,
    })
    const linha = ler()
    expect(linha.status).toBe('concluido')
    expect(linha.para_reler).toBe(1)
    expect(historicoDe(linha)).toEqual([T_NOVO_2, T_ANTIGO_2])
  })

  it('cliente velho (sem historico, "[]") que perde o LWW é um no-op completo, inclusive server_em', () => {
    semear({
      status: 'concluido',
      atualizadoEm: T_NOVO_1,
      historico: [T_MEIO],
      paraReler: false,
      serverEm: S_INICIAL,
    })
    empurrar({
      status: 'em_andamento',
      atualizadoEm: T_ANTIGO_1,
      historico: [],
      paraReler: false,
      serverEm: S_PUSH,
    })
    const linha = ler()
    // Byte-idêntico ao estado semeado — nada mudou, nem server_em.
    expect(linha).toEqual({
      status: 'concluido',
      atualizado_em: T_NOVO_1,
      historico: JSON.stringify([T_MEIO]),
      para_reler: 0,
      server_em: S_INICIAL,
    })
  })

  it('cliente velho que vence o LWW atualiza status mas deixa o historico intacto', () => {
    semear({
      status: 'nao_iniciado',
      atualizadoEm: T_ANTIGO_1,
      historico: [T_ANTIGO_2],
      paraReler: false,
      serverEm: S_INICIAL,
    })
    empurrar({
      status: 'concluido',
      atualizadoEm: T_NOVO_1,
      historico: [],
      paraReler: true,
      serverEm: S_PUSH,
    })
    const linha = ler()
    expect(linha.status).toBe('concluido')
    expect(linha.para_reler).toBe(1)
    expect(linha.server_em).toBe(S_PUSH)
    expect(historicoDe(linha)).toEqual([T_ANTIGO_2])
  })

  it('teto de 50: histórico guardado cheio + entrada nova mantém 50, descarta a mais antiga, mais nova primeiro', () => {
    // 50 entradas, uma por dia, já mais-nova-primeiro (dia 50 .. dia 1).
    const cheio = Array.from({ length: 50 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 50 - i)).toISOString(),
    )
    semear({
      status: 'concluido',
      atualizadoEm: cheio[0],
      historico: cheio,
      paraReler: false,
      serverEm: S_INICIAL,
    })
    const novaEntrada = new Date(Date.UTC(2026, 0, 51)).toISOString()
    empurrar({
      status: 'concluido',
      atualizadoEm: novaEntrada,
      historico: [novaEntrada],
      paraReler: false,
      serverEm: S_PUSH,
    })
    const linha = ler()
    const resultado = historicoDe(linha)
    expect(resultado).toHaveLength(50)
    expect(resultado[0]).toBe(novaEntrada)
    // A mais antiga do conjunto original (dia 1) foi descartada pelo LIMIT 50.
    expect(resultado).not.toContain(cheio[49])
    // Continua estritamente decrescente (mais nova primeiro).
    expect(resultado).toEqual([...resultado].sort().reverse())
  })

  it('entrada duplicada não duplica no array (união é um conjunto)', () => {
    semear({
      status: 'em_andamento',
      atualizadoEm: T_ANTIGO_1,
      historico: [T_ANTIGO_2],
      paraReler: false,
      serverEm: S_INICIAL,
    })
    empurrar({
      status: 'concluido',
      atualizadoEm: T_NOVO_1,
      historico: [T_ANTIGO_2], // mesma entrada que já existe na linha guardada
      paraReler: true,
      serverEm: S_PUSH,
    })
    const linha = ler()
    expect(linha.status).toBe('concluido')
    expect(historicoDe(linha)).toEqual([T_ANTIGO_2])
  })
})
