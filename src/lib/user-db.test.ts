import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { DestaqueCor } from './types'
import {
  applyRemoteAnotacoes,
  applyRemoteDestaques,
  applyRemoteJornadas,
  applyRemotePosicoes,
  applyRemoteProgresso,
  atualizarJornada,
  clearAllUserData,
  clearOutbox,
  clearPosicao,
  criarJornada,
  concluirProgresso,
  countConcluidasNaSequencia,
  deleteAnotacao,
  deleteMeta,
  desmarcarProgresso,
  enqueuePosicao,
  getJornadaCorrente,
  getMeta,
  getPosicao,
  getPosicaoMaisRecente,
  getProgresso,
  listAllPosicoes,
  listAnotacoes,
  listDestaques,
  listJornadas,
  listOutbox,
  removeDestaque,
  saveAnotacao,
  setDestaque,
  setMeta,
  setParaReler,
  setPosicaoLocal,
  setProgresso,
  zerarProgresso,
} from './user-db'
import { LIMITE_NOME, MAX_HISTORICO, MAX_TEXTO } from './sync-limits'

const FUTURE = '2099-01-01T00:00:00.000Z'
const FUTURE_2 = '2099-06-01T00:00:00.000Z'
const PAST = '2000-01-01T00:00:00.000Z'

// NOTE: vitest runs this file in isolation, but the tests below share the
// module-level dbPromise/singleton IndexedDB connection. Each test uses its
// own `ordem`/id range to avoid interference, and outbox-related assertions
// look for the specific item they expect rather than assuming a fresh store.

describe('user-db v2 (outbox/meta)', () => {
  it('upgrade to v2 creates outbox and meta stores on a fresh DB', async () => {
    await setProgresso(9001, 'em_andamento')
    const outbox = await listOutbox()
    expect(outbox.some((i) => i.kind === 'progresso' && i.ordem === 9001)).toBe(true)
  })

  it('concluirProgresso writes the progresso row and enqueues a matching outbox item', async () => {
    await concluirProgresso(9002)
    const progresso = await getProgresso(9002)
    expect(progresso).toBeDefined()
    expect(progresso?.status).toBe('concluido')

    const outbox = await listOutbox()
    const item = outbox.find((i) => i.kind === 'progresso' && i.ordem === 9002)
    expect(item).toBeDefined()
    if (item?.kind === 'progresso') {
      expect(item.status).toBe(progresso?.status)
      expect(item.atualizadoEm).toBe(progresso?.atualizadoEm)
    }
  })

  it('saveAnotacao enqueues a non-tombstone outbox item', async () => {
    const note = await saveAnotacao(9003, 'texto original')
    const outbox = await listOutbox()
    const item = outbox.find((i) => i.kind === 'anotacao' && i.nota.id === note.id)
    expect(item).toBeDefined()
    if (item?.kind === 'anotacao') {
      expect(item.apagadoEm).toBeNull()
      expect(item.nota.texto).toBe('texto original')
    }
  })

  it('deleteAnotacao removes the local note and enqueues a tombstone', async () => {
    const note = await saveAnotacao(9004, 'para apagar')
    await deleteAnotacao(note.id)

    const remaining = await listAnotacoes(9004)
    expect(remaining.find((n) => n.id === note.id)).toBeUndefined()

    const outbox = await listOutbox()
    const tombstones = outbox.filter((i) => i.kind === 'anotacao' && i.nota.id === note.id)
    const tombstone = tombstones[tombstones.length - 1]
    expect(tombstone).toBeDefined()
    if (tombstone?.kind === 'anotacao') {
      expect(tombstone.apagadoEm).not.toBeNull()
      // deleteAnotacao stamps both apagadoEm and nota.atualizadoEm from the same "now"
      expect(tombstone.nota.atualizadoEm).toBe(tombstone.apagadoEm)
    }
  })

  it('clearOutbox(upToSeq) removes entries up to seq', async () => {
    const before = await listOutbox()
    expect(before.length).toBeGreaterThan(0)
    const seqs = before.map((i) => i.seq).filter((s): s is number => typeof s === 'number')
    seqs.sort((a, b) => a - b)
    const cutoff = seqs[Math.floor(seqs.length / 2)]

    await clearOutbox(cutoff)

    const after = await listOutbox()
    expect(after.every((i) => (i.seq ?? 0) > cutoff)).toBe(true)
    expect(after.some((i) => (i.seq ?? 0) > cutoff)).toBe(true)
  })

  it('getMeta/setMeta roundtrip', async () => {
    expect(await getMeta('lastSyncSeq')).toBeUndefined()
    await setMeta('lastSyncSeq', '42')
    expect(await getMeta('lastSyncSeq')).toBe('42')
    await setMeta('lastSyncSeq', '43')
    expect(await getMeta('lastSyncSeq')).toBe('43')
  })

  it('applyRemoteProgresso: remote newer wins, local newer survives, outbox untouched', async () => {
    const outboxBefore = await listOutbox()

    await setProgresso(9005, 'nao_iniciado')
    // remote newer wins
    await applyRemoteProgresso([{ pericopeOrdem: 9005, status: 'concluido', atualizadoEm: FUTURE }])
    const afterNewer = await getProgresso(9005)
    expect(afterNewer?.status).toBe('concluido')
    expect(afterNewer?.atualizadoEm).toBe(FUTURE)

    // local newer survives
    await concluirProgresso(9006)
    const localBefore = await getProgresso(9006)
    await applyRemoteProgresso([{ pericopeOrdem: 9006, status: 'nao_iniciado', atualizadoEm: PAST }])
    const afterOlder = await getProgresso(9006)
    expect(afterOlder?.status).toBe('concluido')
    expect(afterOlder?.atualizadoEm).toBe(localBefore?.atualizadoEm)

    const outboxAfter = await listOutbox()
    // applyRemoteProgresso must not enqueue anything (2 setProgresso calls above did enqueue,
    // so compare growth against what those writes alone would produce).
    const progressoOutboxBefore = outboxBefore.filter((i) => i.kind === 'progresso').length
    const progressoOutboxAfter = outboxAfter.filter((i) => i.kind === 'progresso').length
    expect(progressoOutboxAfter).toBe(progressoOutboxBefore + 2)
  })

  it('applyRemoteAnotacoes: tombstone deletes, non-tombstone upserts, older remote ignored, outbox untouched', async () => {
    const outboxBefore = await listOutbox()

    // tombstone deletes local
    const note = await saveAnotacao(9007, 'nota original')
    await applyRemoteAnotacoes([
      {
        id: note.id,
        pericopeOrdem: 9007,
        texto: 'irrelevante',
        criadoEm: note.criadoEm,
        atualizadoEm: FUTURE,
        apagadoEm: FUTURE,
      },
    ])
    expect((await listAnotacoes(9007)).find((n) => n.id === note.id)).toBeUndefined()

    // non-tombstone upserts (no local note yet)
    await applyRemoteAnotacoes([
      {
        id: 'remote-9008',
        pericopeOrdem: 9008,
        texto: 'vindo do servidor',
        criadoEm: PAST,
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
    ])
    const upserted = (await listAnotacoes(9008)).find((n) => n.id === 'remote-9008')
    expect(upserted).toBeDefined()
    expect(upserted?.texto).toBe('vindo do servidor')

    // older remote ignored
    const local = await saveAnotacao(9009, 'texto local mais novo')
    await applyRemoteAnotacoes([
      {
        id: local.id,
        pericopeOrdem: 9009,
        texto: 'texto remoto antigo',
        criadoEm: local.criadoEm,
        atualizadoEm: PAST,
        apagadoEm: null,
      },
    ])
    const stillLocal = (await listAnotacoes(9009)).find((n) => n.id === local.id)
    expect(stillLocal?.texto).toBe('texto local mais novo')

    const outboxAfter = await listOutbox()
    // saveAnotacao was called twice above (9007's note already counted before this block's
    // saveAnotacao calls for 9007/9009); applyRemoteAnotacoes itself must add nothing.
    const anotacaoOutboxBefore = outboxBefore.filter((i) => i.kind === 'anotacao').length
    const anotacaoOutboxAfter = outboxAfter.filter((i) => i.kind === 'anotacao').length
    expect(anotacaoOutboxAfter).toBe(anotacaoOutboxBefore + 2)
  })

  // Sem o corte na escrita, uma nota acima do limite envenenaria o lote inteiro:
  // o servidor rejeita o POST com 400 e o outbox nunca mais é esvaziado.
  it('saveAnotacao corta o texto em MAX_TEXTO (local e no outbox)', async () => {
    const gigante = 'a'.repeat(MAX_TEXTO + 500)
    const note = await saveAnotacao(9010, gigante)

    expect(note.texto).toHaveLength(MAX_TEXTO)
    const salva = (await listAnotacoes(9010)).find((n) => n.id === note.id)
    expect(salva?.texto).toHaveLength(MAX_TEXTO)

    const outbox = await listOutbox()
    const item = outbox.find((i) => i.kind === 'anotacao' && i.nota.id === note.id)
    if (item?.kind === 'anotacao') expect(item.nota.texto).toHaveLength(MAX_TEXTO)
  })

  it('clearAllUserData apaga progresso, anotações e outbox; deleteMeta remove a chave', async () => {
    await concluirProgresso(9011)
    await saveAnotacao(9012, 'some junto')
    await setDestaque(9013, '1:1', 'verde')
    await setMeta('chave-temp', 'x')

    await clearAllUserData()

    expect(await getProgresso(9011)).toBeUndefined()
    expect(await listAnotacoes(9012)).toEqual([])
    expect(await listDestaques(9013)).toEqual([])
    expect(await listOutbox()).toEqual([])
    // meta sobrevive ao wipe dos dados; só sai por deleteMeta
    expect(await getMeta('chave-temp')).toBe('x')
    await deleteMeta('chave-temp')
    expect(await getMeta('chave-temp')).toBeUndefined()
  })
})

describe('user-db v3 (destaques)', () => {
  it('destaque amarelo legado é lido como verde, e não some da tela', async () => {
    // 'verde' saiu da paleta no rebranding, mas está gravado no IndexedDB e
    // no D1 de quem já grifou. Sem normalizar, a classe verse-hl-amarelo fica
    // sem regra no CSS e o grifo desaparece sem ninguém ter apagado nada.
    //
    // O cast existe porque o tipo já não aceita 'verde' — e é exatamente o
    // ponto: o valor vem do banco, não do código, e TypeScript não guarda o
    // que foi gravado ontem.
    await setDestaque(9200, '1:1', 'amarelo' as unknown as DestaqueCor)
    expect((await listDestaques(9200)).map((x) => x.cor)).toEqual(['verde'])
  })

  it('setDestaque grava o destaque e enfileira o outbox na mesma transação', async () => {
    const d = await setDestaque(9101, '1:3', 'verde')
    expect(d?.id).toBe('9101:1:3')
    expect((await listDestaques(9101)).map((x) => x.cor)).toEqual(['verde'])

    const outbox = await listOutbox()
    const item = outbox.find((i) => i.kind === 'destaque' && i.destaque.id === '9101:1:3')
    expect(item).toBeDefined()
    if (item?.kind === 'destaque') {
      expect(item.apagadoEm).toBeNull()
      expect(item.destaque.cor).toBe('verde')
    }
  })

  it('destacar de novo troca a cor e preserva criadoEm', async () => {
    const primeiro = await setDestaque(9102, '2:7', 'verde')
    const segundo = await setDestaque(9102, '2:7', 'rosa')
    expect(segundo?.id).toBe(primeiro?.id)
    expect(segundo?.criadoEm).toBe(primeiro?.criadoEm)
    expect((await listDestaques(9102)).map((x) => x.cor)).toEqual(['rosa'])
  })

  it('removeDestaque apaga o local e enfileira a lápide', async () => {
    const d = await setDestaque(9103, '1:1', 'azul')
    await removeDestaque(d!.id)

    expect(await listDestaques(9103)).toEqual([])
    const outbox = await listOutbox()
    const lapides = outbox.filter((i) => i.kind === 'destaque' && i.destaque.id === d!.id)
    const ultima = lapides[lapides.length - 1]
    expect(ultima).toBeDefined()
    if (ultima?.kind === 'destaque') {
      expect(ultima.apagadoEm).not.toBeNull()
      expect(ultima.destaque.atualizadoEm).toBe(ultima.apagadoEm)
    }
  })

  // parseTexto emite blocos órfãos com ids fora de "capitulo:versiculo"
  // (ex.: "x:1"); o Worker rejeita o outbox inteiro se um item assim chegar
  // lá, então o guard tem que barrar a escrita ANTES do outbox existir.
  it('setDestaque com verseId inválido não escreve nada (nem linha, nem outbox)', async () => {
    const outboxAntes = await listOutbox()

    const resultado = await setDestaque(1, 'x:1', 'verde')

    expect(resultado).toBeNull()
    expect(await listDestaques(1)).toEqual([])
    const outboxDepois = await listOutbox()
    expect(outboxDepois).toEqual(outboxAntes)
  })

  it('applyRemoteDestaques: mais velho é ignorado, mais novo vence, lápide apaga', async () => {
    const local = await setDestaque(9104, '1:2', 'verde')

    await applyRemoteDestaques([{ ...local!, cor: 'verde', atualizadoEm: PAST, apagadoEm: null }])
    expect((await listDestaques(9104)).map((x) => x.cor)).toEqual(['verde'])

    await applyRemoteDestaques([{ ...local!, cor: 'azul', atualizadoEm: FUTURE, apagadoEm: null }])
    expect((await listDestaques(9104)).map((x) => x.cor)).toEqual(['azul'])

    await applyRemoteDestaques([{ ...local!, cor: 'azul', atualizadoEm: FUTURE_2, apagadoEm: FUTURE_2 }])
    expect(await listDestaques(9104)).toEqual([])
  })
})

describe('anotações com vínculo a versículo', () => {
  it('saveAnotacao grava verseRef e a edição preserva criadoEm e o vínculo', async () => {
    const nova = await saveAnotacao(9105, 'nota vinculada', undefined, '1:3-1:7')
    expect(nova.verseRef).toBe('1:3-1:7')

    const editada = await saveAnotacao(9105, 'nota editada', nova.id)
    expect(editada.id).toBe(nova.id)
    expect(editada.criadoEm).toBe(nova.criadoEm)
    expect(editada.verseRef).toBe('1:3-1:7')

    const semVinculo = await saveAnotacao(9105, 'nota editada', nova.id, null)
    expect(semVinculo.verseRef).toBeNull()
  })

  it('anotação sem vínculo tem verseRef null', async () => {
    const nota = await saveAnotacao(9106, 'nota solta')
    expect(nota.verseRef).toBeNull()
  })

  it('listAnotacoes devolve as notas mais recentes primeiro', async () => {
    await applyRemoteAnotacoes([
      {
        id: 'ord-a',
        pericopeOrdem: 9200,
        texto: 'antiga',
        verseRef: null,
        criadoEm: '2026-01-01T00:00:00.000Z',
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
      {
        id: 'ord-b',
        pericopeOrdem: 9200,
        texto: 'nova',
        verseRef: null,
        criadoEm: '2026-06-01T00:00:00.000Z',
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
      {
        id: 'ord-c',
        pericopeOrdem: 9200,
        texto: 'do meio',
        verseRef: null,
        criadoEm: '2026-03-01T00:00:00.000Z',
        atualizadoEm: FUTURE,
        apagadoEm: null,
      },
    ])

    expect((await listAnotacoes(9200)).map((n) => n.id)).toEqual(['ord-b', 'ord-c', 'ord-a'])
  })
})

// O checkpoint de leitura grava fora do padrão "linha + outbox na mesma
// transação" de propósito: os eventos de leitura (seção ativa, versículo
// tocado, item narrado) são frequentes demais para encher o outbox — a linha
// local muda na hora e só o ENQUEUE explícito (ao sair da página) sobe para o
// sync. Perder um enqueue é aceitável; encher o outbox não é.
describe('user-db v4 (posição de leitura)', () => {
  it('setPosicaoLocal grava a linha sem tocar o outbox', async () => {
    const outboxAntes = await listOutbox()

    const pos = await setPosicaoLocal(9301, 'versiculo', '3:16')
    expect(pos?.tipo).toBe('versiculo')
    expect(pos?.ref).toBe('3:16')
    expect(pos?.tempo).toBeNull()

    const salvo = await getPosicao(9301)
    expect(salvo?.ref).toBe('3:16')
    expect(await listOutbox()).toEqual(outboxAntes)
  })

  it('listAllPosicoes devolve o que setPosicaoLocal gravou', async () => {
    const pos = await setPosicaoLocal(9309, 'versiculo', '2:5')
    expect(await listAllPosicoes()).toContainEqual(pos)
  })

  it('setPosicaoLocal aceita seção, parágrafo em prosa e alvo de narração com tempo', async () => {
    expect((await setPosicaoLocal(9302, 'secao', 'resenha'))?.ref).toBe('resenha')
    expect((await setPosicaoLocal(9302, 'secao', 'contexto-2'))?.ref).toBe('contexto-2')
    const narr = await setPosicaoLocal(9302, 'narracao', 'reflexao-1', 123.4)
    expect(narr?.tempo).toBe(123.4)
  })

  // Mesma lógica do guard de setDestaque: um ref fora do vocabulário no
  // outbox faria o Worker rejeitar o lote inteiro com 400 para sempre.
  it('setPosicaoLocal com ref fora do vocabulário não grava nada', async () => {
    expect(await setPosicaoLocal(9303, 'versiculo', 'x:1')).toBeNull()
    expect(await setPosicaoLocal(9303, 'secao', 'qualquer-coisa')).toBeNull()
    expect(await getPosicao(9303)).toBeUndefined()
  })

  it('enqueuePosicao enfileira o estado atual; sem linha, não enfileira nada', async () => {
    await setPosicaoLocal(9304, 'secao', 'texto')
    await enqueuePosicao(9304)
    const outbox = await listOutbox()
    const item = outbox.find((i) => i.kind === 'posicao' && i.posicao.pericopeOrdem === 9304)
    expect(item).toBeDefined()
    if (item?.kind === 'posicao') {
      expect(item.apagadoEm).toBeNull()
      expect(item.posicao.ref).toBe('texto')
    }

    const antes = (await listOutbox()).length
    await enqueuePosicao(9305)
    expect((await listOutbox()).length).toBe(antes)
  })

  it('clearPosicao apaga a linha e enfileira a lápide', async () => {
    await setPosicaoLocal(9306, 'versiculo', '1:1')
    await clearPosicao(9306)

    expect(await getPosicao(9306)).toBeUndefined()
    const outbox = await listOutbox()
    const lapides = outbox.filter(
      (i) => i.kind === 'posicao' && i.posicao.pericopeOrdem === 9306 && i.apagadoEm !== null,
    )
    const ultima = lapides[lapides.length - 1]
    expect(ultima).toBeDefined()
    if (ultima?.kind === 'posicao') {
      expect(ultima.posicao.atualizadoEm).toBe(ultima.apagadoEm)
    }
  })

  it('clearPosicao sem linha não enfileira nada', async () => {
    const antes = (await listOutbox()).length
    await clearPosicao(9307)
    expect((await listOutbox()).length).toBe(antes)
  })

  it('getPosicaoMaisRecente devolve a mais nova dentro das ordens dadas', async () => {
    await applyRemotePosicoes([
      { pericopeOrdem: 9310, tipo: 'secao', ref: 'texto', tempo: null, atualizadoEm: '2099-01-01T00:00:00.000Z', apagadoEm: null },
      { pericopeOrdem: 9311, tipo: 'versiculo', ref: '2:5', tempo: null, atualizadoEm: '2099-03-01T00:00:00.000Z', apagadoEm: null },
      { pericopeOrdem: 9312, tipo: 'secao', ref: 'resenha', tempo: null, atualizadoEm: '2099-02-01T00:00:00.000Z', apagadoEm: null },
    ])

    expect((await getPosicaoMaisRecente([9310, 9311, 9312]))?.pericopeOrdem).toBe(9311)
    // filtro: fora da lista de ordens, a mais nova é outra
    expect((await getPosicaoMaisRecente([9310, 9312]))?.pericopeOrdem).toBe(9312)
    expect(await getPosicaoMaisRecente([9399])).toBeUndefined()
  })

  it('applyRemotePosicoes: LWW e lápides, contando só o que mudou', async () => {
    await setPosicaoLocal(9320, 'versiculo', '1:2')

    // remoto mais velho perde
    expect(
      await applyRemotePosicoes([
        { pericopeOrdem: 9320, tipo: 'secao', ref: 'texto', tempo: null, atualizadoEm: PAST, apagadoEm: null },
      ]),
    ).toBe(0)
    expect((await getPosicao(9320))?.ref).toBe('1:2')

    // remoto mais novo vence
    expect(
      await applyRemotePosicoes([
        { pericopeOrdem: 9320, tipo: 'narracao', ref: 'resenha-0', tempo: 45, atualizadoEm: FUTURE, apagadoEm: null },
      ]),
    ).toBe(1)
    expect((await getPosicao(9320))?.tempo).toBe(45)

    // lápide apaga; reentrega da lápide não conta
    expect(
      await applyRemotePosicoes([
        { pericopeOrdem: 9320, tipo: 'narracao', ref: 'resenha-0', tempo: 45, atualizadoEm: FUTURE_2, apagadoEm: FUTURE_2 },
      ]),
    ).toBe(1)
    expect(await getPosicao(9320)).toBeUndefined()
    expect(
      await applyRemotePosicoes([
        { pericopeOrdem: 9320, tipo: 'narracao', ref: 'resenha-0', tempo: 45, atualizadoEm: '2099-12-01T00:00:00.000Z', apagadoEm: '2099-12-01T00:00:00.000Z' },
      ]),
    ).toBe(0)
  })

  it('clearAllUserData também apaga as posições', async () => {
    await setPosicaoLocal(9330, 'secao', 'texto')
    await clearAllUserData()
    expect(await getPosicao(9330)).toBeUndefined()
  })
})

// A contagem é o que decide se o pull emite o evento de live refresh: sem ela,
// toda rodada de sync (5 em 5 minutos) recarregaria as telas abertas à toa.
// Só conta mutação de verdade — em particular, a lápide reentregue de uma
// linha que já não existe localmente não conta, e o pull do servidor reentrega
// linhas de propósito (o cursor `agora` é generoso).
describe('applyRemote* — contagem de linhas aplicadas', () => {
  it('progresso: conta só o que o LWW deixou entrar', async () => {
    expect(await applyRemoteProgresso([])).toBe(0)
    expect(
      await applyRemoteProgresso([
        { pericopeOrdem: 9101, status: 'concluido', atualizadoEm: FUTURE },
      ]),
    ).toBe(1)
    // reentrega do mesmo timestamp: LWW é estrito (>), então não muda nada
    expect(
      await applyRemoteProgresso([
        { pericopeOrdem: 9101, status: 'concluido', atualizadoEm: FUTURE },
      ]),
    ).toBe(0)
    await concluirProgresso(9102)
    expect(
      await applyRemoteProgresso([
        { pericopeOrdem: 9102, status: 'nao_iniciado', atualizadoEm: PAST },
      ]),
    ).toBe(0)
  })

  it('anotações: upsert conta, lápide de linha existente conta, lápide reentregue não', async () => {
    const nota = await saveAnotacao(9103, 'nota local')
    const lapide = {
      id: nota.id,
      pericopeOrdem: 9103,
      texto: 'irrelevante',
      criadoEm: nota.criadoEm,
      atualizadoEm: FUTURE,
      apagadoEm: FUTURE,
    }
    expect(await applyRemoteAnotacoes([lapide])).toBe(1)
    // mesma lápide de novo: a linha já sumiu, deletar não muda nada
    expect(await applyRemoteAnotacoes([{ ...lapide, atualizadoEm: FUTURE_2 }])).toBe(0)
    expect(
      await applyRemoteAnotacoes([
        {
          id: 'remota-9104',
          pericopeOrdem: 9104,
          texto: 'do servidor',
          criadoEm: PAST,
          atualizadoEm: FUTURE,
          apagadoEm: null,
        },
      ]),
    ).toBe(1)
  })

  it('destaques: mesma regra da lápide reentregue', async () => {
    await setDestaque(9105, '1:1', 'verde')
    const lapide = {
      id: '9105:1:1',
      pericopeOrdem: 9105,
      verseId: '1:1',
      cor: 'verde' as const,
      criadoEm: PAST,
      atualizadoEm: FUTURE,
      apagadoEm: FUTURE,
    }
    expect(await applyRemoteDestaques([lapide])).toBe(1)
    expect(await applyRemoteDestaques([{ ...lapide, atualizadoEm: FUTURE_2 }])).toBe(0)
  })
})

describe('jornadas', () => {
  it('criar grava a jornada e enfileira no outbox na mesma transação', async () => {
    await clearAllUserData()
    const j = await criarJornada({
      nome: 'Evangelhos',
      tipo: 'bloco',
      escopo: 'evangelhos',
      inicioOrdem: 4,
      contaDesde: null,
    })
    expect(j.id).toBeTruthy()
    expect(j.arquivadaEm).toBeNull()
    expect(await listJornadas()).toHaveLength(1)
    const outbox = await listOutbox()
    expect(outbox.filter((i) => i.kind === 'jornada')).toHaveLength(1)
  })

  it('criar uma segunda arquiva a primeira — no máximo uma corrente', async () => {
    await clearAllUserData()
    const primeira = await criarJornada({
      nome: 'Salmos', tipo: 'livro', escopo: 'Salmos', inicioOrdem: 2, contaDesde: null,
    })
    const segunda = await criarJornada({
      nome: 'Mateus', tipo: 'livro', escopo: 'Mateus', inicioOrdem: 4, contaDesde: null,
    })
    const corrente = await getJornadaCorrente()
    expect(corrente?.id).toBe(segunda.id)
    const todas = await listJornadas()
    expect(todas.find((j) => j.id === primeira.id)?.arquivadaEm).not.toBeNull()
    // Duas jornadas + duas lápides de arquivamento não: o arquivamento é um
    // update, então são 3 itens de outbox (criar, arquivar, criar).
    const outbox = (await listOutbox()).filter((i) => i.kind === 'jornada')
    expect(outbox).toHaveLength(3)
  })

  it('criar uma segunda arquiva a primeira mesmo já CONCLUÍDA — não fica pendurada', async () => {
    // Regressão do bug corrigido no ciclo 1: o laço de arquivamento de
    // criarJornada pulava jornadas com concluidaEm !== null, então uma
    // jornada concluída nunca era arquivada ao abrir a próxima — sobrava
    // pendurada, nem arquivada nem escolhida por getJornadaCorrente() (que
    // encontraria duas linhas com arquivadaEm === null).
    await clearAllUserData()
    const primeira = await criarJornada({
      nome: 'Salmos', tipo: 'livro', escopo: 'Salmos', inicioOrdem: 2, contaDesde: null,
    })
    await atualizarJornada(primeira.id, { concluidaEm: FUTURE })
    const segunda = await criarJornada({
      nome: 'Mateus', tipo: 'livro', escopo: 'Mateus', inicioOrdem: 4, contaDesde: null,
    })
    const corrente = await getJornadaCorrente()
    expect(corrente?.id).toBe(segunda.id)
    const todas = await listJornadas()
    const arquivada = todas.find((j) => j.id === primeira.id)
    expect(arquivada?.arquivadaEm).not.toBeNull()
    expect(arquivada?.concluidaEm).not.toBeNull()
  })

  it('getJornadaCorrente devolve a concluída enquanto ela não for arquivada', async () => {
    await clearAllUserData()
    const j = await criarJornada({
      nome: 'VT', tipo: 'sequencia', escopo: 'vt', inicioOrdem: 0, contaDesde: null,
    })
    await atualizarJornada(j.id, { concluidaEm: FUTURE })
    // Concluída, mas ainda a única não arquivada: continua sendo a corrente
    // — é o que permite a Home mostrar "· concluída" e, se uma perícope for
    // desmarcada depois, reabri-la (reconciliacaoDeConclusao).
    const corrente = await getJornadaCorrente()
    expect(corrente?.id).toBe(j.id)
    expect(corrente?.concluidaEm).toBe(FUTURE)
  })

  it('duas correntes vindas do pull (aparelhos diferentes): desempata por atualizadoEm, não por criadoEm', async () => {
    // applyRemoteJornadas é o caminho de pull de verdade — a invariante "no
    // máximo uma corrente" é de escrita (criarJornada), então nada aqui a
    // impede de gravar duas linhas com arquivadaEm null, exatamente o cenário
    // que a spec cobre. criadoEm da 2ª é mais novo, mas atualizadoEm da 1ª é
    // mais novo — se o desempate caísse de volta para criadoEm (a ordem de
    // listJornadas), este teste pegaria a divergência.
    await clearAllUserData()
    const base = {
      tipo: 'livro' as const,
      inicioOrdem: 0,
      contaDesde: null,
      arquivadaEm: null,
      concluidaEm: null,
      apagadoEm: null,
    }
    await applyRemoteJornadas([
      {
        ...base,
        id: 'antiga-mas-editada-por-ultimo',
        nome: 'Salmos',
        escopo: 'Salmos',
        criadoEm: PAST,
        atualizadoEm: FUTURE_2,
      },
      {
        ...base,
        id: 'nova-mas-nao-tocada-depois',
        nome: 'Mateus',
        escopo: 'Mateus',
        criadoEm: FUTURE,
        atualizadoEm: FUTURE,
      },
    ])
    const corrente = await getJornadaCorrente()
    expect(corrente?.id).toBe('antiga-mas-editada-por-ultimo')
  })

  it('trunca o nome em LIMITE_NOME', async () => {
    await clearAllUserData()
    const j = await criarJornada({
      nome: 'x'.repeat(LIMITE_NOME + 50),
      tipo: 'sequencia', escopo: 'vt', inicioOrdem: 0, contaDesde: null,
    })
    expect(j.nome).toHaveLength(LIMITE_NOME)
  })

  it('atualizarJornada mexe no campo e enfileira', async () => {
    await clearAllUserData()
    const j = await criarJornada({
      nome: 'VT', tipo: 'sequencia', escopo: 'vt', inicioOrdem: 0, contaDesde: null,
    })
    const antes = j.atualizadoEm
    const nova = await atualizarJornada(j.id, { contaDesde: FUTURE })
    expect(nova?.contaDesde).toBe(FUTURE)
    expect(nova!.atualizadoEm >= antes).toBe(true)
  })

  it('applyRemoteJornadas respeita o LWW e conta só o que mudou', async () => {
    await clearAllUserData()
    const j = await criarJornada({
      nome: 'VT', tipo: 'sequencia', escopo: 'vt', inicioOrdem: 0, contaDesde: null,
    })
    // Remota mais VELHA perde e não conta.
    const velha = { ...j, nome: 'Velha', atualizadoEm: '2000-01-01T00:00:00.000Z', apagadoEm: null }
    expect(await applyRemoteJornadas([velha])).toBe(0)
    // Remota mais NOVA ganha.
    const nova = { ...j, nome: 'Nova', atualizadoEm: FUTURE, apagadoEm: null }
    expect(await applyRemoteJornadas([nova])).toBe(1)
    expect((await listJornadas())[0].nome).toBe('Nova')
  })

  it('lápide remota apaga; lápide de linha inexistente não conta', async () => {
    await clearAllUserData()
    const j = await criarJornada({
      nome: 'VT', tipo: 'sequencia', escopo: 'vt', inicioOrdem: 0, contaDesde: null,
    })
    expect(await applyRemoteJornadas([{ ...j, atualizadoEm: FUTURE, apagadoEm: FUTURE }])).toBe(1)
    expect(await listJornadas()).toHaveLength(0)
    // Reentrega de lápide é rotina no pull — não pode acordar as telas de novo.
    expect(await applyRemoteJornadas([{ ...j, atualizadoEm: FUTURE, apagadoEm: FUTURE }])).toBe(0)
  })

  it('clearAllUserData limpa as jornadas', async () => {
    await criarJornada({
      nome: 'VT', tipo: 'sequencia', escopo: 'vt', inicioOrdem: 0, contaDesde: null,
    })
    await clearAllUserData()
    expect(await listJornadas()).toHaveLength(0)
  })
})

describe('progresso: historico e paraReler', () => {
  it('linha nova nasce com historico vazio e paraReler false', async () => {
    await setProgresso(9300, 'em_andamento')
    const p = await getProgresso(9300)
    expect(p?.historico).toEqual([])
    expect(p?.paraReler).toBe(false)
  })

  it('setProgresso PRESERVA historico e paraReler da linha existente', async () => {
    // É a garantia central do modelo: mudar de status nunca apaga o fato.
    await concluirProgresso(9301)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', {
      ...(await getProgresso(9301))!,
      historico: ['2026-01-10T12:00:00.000Z'],
      paraReler: true,
    })
    d.close()

    await setProgresso(9301, 'nao_iniciado')
    const p = await getProgresso(9301)
    expect(p?.status).toBe('nao_iniciado')
    expect(p?.historico).toEqual(['2026-01-10T12:00:00.000Z'])
    expect(p?.paraReler).toBe(true)
  })

  it('applyRemoteProgresso PRESERVA historico e paraReler locais ao aplicar o pull', async () => {
    // O payload remoto ainda não carrega historico/paraReler (migration do D1 é
    // tarefa futura); o pull não pode esvaziar o que já está aqui.
    await setProgresso(9302, 'em_andamento')
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', {
      ...(await getProgresso(9302))!,
      historico: ['2026-02-01T00:00:00.000Z', '2026-01-10T12:00:00.000Z'],
      paraReler: true,
    })
    d.close()

    await applyRemoteProgresso([{ pericopeOrdem: 9302, status: 'concluido', atualizadoEm: FUTURE }])
    const p = await getProgresso(9302)
    // LWW ainda vale para status: o remoto mais novo venceu.
    expect(p?.status).toBe('concluido')
    expect(p?.historico).toEqual(['2026-02-01T00:00:00.000Z', '2026-01-10T12:00:00.000Z'])
    expect(p?.paraReler).toBe(true)
  })

  it('MAX_HISTORICO é 50', () => {
    expect(MAX_HISTORICO).toBe(50)
  })
})

describe('concluirProgresso', () => {
  it('anexa uma data ao histórico e marca concluido', async () => {
    await concluirProgresso(9310)
    const p = await getProgresso(9310)
    expect(p?.status).toBe('concluido')
    expect(p?.historico).toHaveLength(1)
    expect(p?.historico[0]).toBe(p?.atualizadoEm)
  })

  it('reler acrescenta uma SEGUNDA data, mais nova primeiro', async () => {
    await concluirProgresso(9311)
    const primeira = (await getProgresso(9311))!.historico[0]
    await new Promise((r) => setTimeout(r, 2))
    await concluirProgresso(9311)
    const p = await getProgresso(9311)
    expect(p?.historico).toHaveLength(2)
    expect(p?.historico[1]).toBe(primeira)
    expect(p!.historico[0] > p!.historico[1]).toBe(true)
  })

  it('concluir limpa o pin de releitura: a releitura aconteceu', async () => {
    await setProgresso(9312, 'em_andamento')
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9312))!, paraReler: true })
    d.close()
    await concluirProgresso(9312)
    expect((await getProgresso(9312))?.paraReler).toBe(false)
  })

  it('respeita MAX_HISTORICO, descartando a mais antiga', async () => {
    const cheio = Array.from({ length: MAX_HISTORICO }, (_, i) =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    ).reverse()
    await setProgresso(9313, 'em_andamento')
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9313))!, historico: cheio })
    d.close()

    await concluirProgresso(9313)
    const p = await getProgresso(9313)
    expect(p?.historico).toHaveLength(MAX_HISTORICO)
    expect(p?.historico).not.toContain('2020-01-01T00:00:00.000Z')
  })
})

describe('desmarcarProgresso', () => {
  it('volta a nao_iniciado preservando o histórico', async () => {
    await concluirProgresso(9330)
    const antes = (await getProgresso(9330))!.historico
    await desmarcarProgresso(9330)
    const p = await getProgresso(9330)
    expect(p?.status).toBe('nao_iniciado')
    expect(p?.historico).toEqual(antes)
  })

  it('limpa o pin de releitura', async () => {
    await concluirProgresso(9331)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9331))!, paraReler: true })
    d.close()
    await desmarcarProgresso(9331)
    expect((await getProgresso(9331))?.paraReler).toBe(false)
  })

  it('enfileira no outbox', async () => {
    await concluirProgresso(9332)
    await desmarcarProgresso(9332)
    const item = (await listOutbox())
      .filter((i) => i.kind === 'progresso' && i.ordem === 9332)
      .at(-1)
    expect(item && item.kind === 'progresso' && item.status).toBe('nao_iniciado')
  })
})

describe('zerarProgresso', () => {
  it('zera as concluídas e as em andamento, preservando o histórico', async () => {
    await concluirProgresso(9340)
    await setProgresso(9341, 'em_andamento')
    const hist = (await getProgresso(9340))!.historico
    const n = await zerarProgresso([9340, 9341])
    expect(n).toBe(2)
    expect((await getProgresso(9340))?.status).toBe('nao_iniciado')
    expect((await getProgresso(9340))?.historico).toEqual(hist)
    expect((await getProgresso(9341))?.status).toBe('nao_iniciado')
  })

  it('SÓ escreve o que muda', async () => {
    // Sem o filtro, "zerar tudo" enfileiraria 2646 itens para mudar 32.
    await concluirProgresso(9350)
    await zerarProgresso([9350])
    const antes = (await listOutbox()).length
    const n = await zerarProgresso([9350, 9351, 9352, 9353])
    expect(n).toBe(0)
    expect((await listOutbox()).length).toBe(antes)
  })

  it('apaga a posição das ordens zeradas, com lápide', async () => {
    // Sem isto, zerar o AT e voltar à Home devolve o leitor ao meio de Isaías:
    // Home.tsx prefere o checkpoint mais recente à primeira não-concluída.
    await setProgresso(9360, 'em_andamento')
    await setPosicaoLocal(9360, 'versiculo', '3:16')
    await zerarProgresso([9360])
    expect(await getPosicao(9360)).toBeUndefined()
    const lapide = (await listOutbox()).find(
      (i) => i.kind === 'posicao' && i.posicao.pericopeOrdem === 9360 && i.apagadoEm !== null,
    )
    expect(lapide).toBeDefined()
  })

  it('apaga checkpoint órfão mesmo com o progresso já em repouso', async () => {
    // Reproduz a corrida que sobra um checkpoint sem progresso "em andamento"
    // por trás: LWW remoto zerando o status sem tocar `posicoes`, ou
    // concluirProgresso correndo com o clearPosicao separado de Leitura.tsx.
    // Sem isto, o "Continuar" devolve o leitor ao meio do que ele acabou de
    // zerar — a mesma falha que a lápide da posição existe para prevenir.
    await setPosicaoLocal(9362, 'versiculo', '1:1')
    const n = await zerarProgresso([9362])
    expect(n).toBe(0)
    expect(await getPosicao(9362)).toBeUndefined()
    const lapide = (await listOutbox()).find(
      (i) => i.kind === 'posicao' && i.posicao.pericopeOrdem === 9362 && i.apagadoEm !== null,
    )
    expect(lapide).toBeDefined()
  })

  it('linha nao_iniciado mas pinada NÃO está em repouso: zera escrevendo e limpa o pin', async () => {
    // `emRepouso` é `anterior.status === 'nao_iniciado' && !anterior.paraReler`:
    // uma linha nao_iniciado E pinada não conta como repouso, então esta
    // continua sendo escrita mesmo sem status para mudar — só para apagar o
    // pin. Antes de setParaReler existir, este estado era irreproduzível.
    await setParaReler(9363, true)
    expect((await getProgresso(9363))?.status).toBe('nao_iniciado')
    const antes = (await listOutbox()).length

    const n = await zerarProgresso([9363])

    expect(n).toBe(1)
    expect((await getProgresso(9363))?.paraReler).toBe(false)
    expect((await listOutbox()).length).toBeGreaterThan(antes)
  })
})

describe('setParaReler', () => {
  it('liga e desliga o pin sem tocar em status nem histórico', async () => {
    await concluirProgresso(9380)
    const antes = await getProgresso(9380)
    await setParaReler(9380, true)
    const ligado = await getProgresso(9380)
    expect(ligado?.paraReler).toBe(true)
    expect(ligado?.status).toBe('concluido')
    expect(ligado?.historico).toEqual(antes?.historico)

    await setParaReler(9380, false)
    expect((await getProgresso(9380))?.paraReler).toBe(false)
  })
})

describe('countConcluidasNaSequencia', () => {
  it('conta só as concluídas das ordens pedidas', async () => {
    await concluirProgresso(9370)
    await setProgresso(9371, 'em_andamento')
    expect(await countConcluidasNaSequencia([9370, 9371, 9372])).toBe(1)
  })
})

describe('applyRemoteProgresso: merge híbrido', () => {
  it('une os históricos mesmo quando o LWW local vence', async () => {
    // Aparelho A concluiu offline em T2; B desmarcou em T3 > T2 e sincronizou
    // primeiro. O status de B vence, e a conclusão de A NÃO pode se perder.
    await setProgresso(9320, 'nao_iniciado')
    const local = await getProgresso(9320)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...local!, historico: ['2026-08-03T00:00:00.000Z'] })
    d.close()

    await applyRemoteProgresso([
      {
        pericopeOrdem: 9320,
        status: 'concluido',
        historico: ['2026-08-01T00:00:00.000Z'],
        paraReler: false,
        atualizadoEm: PAST,
      },
    ])
    const p = await getProgresso(9320)
    expect(p?.status).toBe('nao_iniciado') // LWW local venceu
    expect(p?.historico).toEqual(['2026-08-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z'])
  })

  it('conta como aplicada quando SÓ a união mudou', async () => {
    await concluirProgresso(9321)
    const n = await applyRemoteProgresso([
      {
        pericopeOrdem: 9321,
        status: 'concluido',
        historico: ['2019-01-01T00:00:00.000Z'],
        paraReler: false,
        atualizadoEm: PAST,
      },
    ])
    // Sem isto o live refresh perderia uma releitura vinda de outro aparelho.
    expect(n).toBe(1)
    expect((await getProgresso(9321))?.historico).toContain('2019-01-01T00:00:00.000Z')
  })

  it('tolera payload sem os campos novos (servidor/cliente antigo)', async () => {
    await setProgresso(9322, 'nao_iniciado')
    await applyRemoteProgresso([
      { pericopeOrdem: 9322, status: 'concluido', atualizadoEm: FUTURE },
    ])
    const p = await getProgresso(9322)
    expect(p?.status).toBe('concluido')
    expect(Array.isArray(p?.historico)).toBe(true)
  })

  // Regressão: um remoto MAIS VELHO com paraReler:true não pode reviver um pin
  // que o local (mais novo) já tirou — LWW vale para paraReler mesmo quando o
  // campo vem presente e explícito no payload.
  it('remoto mais velho com paraReler:true não revive um pin que o local já tirou', async () => {
    await concluirProgresso(9323)
    const local = await getProgresso(9323)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...local!, paraReler: false })
    d.close()

    await applyRemoteProgresso([
      {
        pericopeOrdem: 9323,
        status: 'concluido',
        historico: [],
        paraReler: true,
        atualizadoEm: PAST,
      },
    ])
    expect((await getProgresso(9323))?.paraReler).toBe(false)
  })

  // Regressão: com o histórico local já no teto de MAX_HISTORICO, uma entrada
  // nova troca o conteúdo (expulsa a mais antiga) sem mudar o TAMANHO do
  // array — uma comparação só de length não detectaria a mudança.
  it('conta como aplicada quando a união muda de conteúdo mesmo com o histórico no teto', async () => {
    const cheio = Array.from({ length: MAX_HISTORICO }, (_, i) =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    ).reverse()
    await concluirProgresso(9324)
    const d = await (await import('idb')).openDB('biblia-pericopes')
    await d.put('progresso', { ...(await getProgresso(9324))!, historico: cheio })
    d.close()

    const nova = '2026-08-01T00:00:00.000Z'
    const n = await applyRemoteProgresso([
      {
        pericopeOrdem: 9324,
        status: 'concluido',
        historico: [nova],
        paraReler: false,
        atualizadoEm: PAST, // remoto perde o LWW: só a união pode justificar a contagem
      },
    ])
    expect(n).toBe(1)
    const p = await getProgresso(9324)
    expect(p?.historico).toHaveLength(MAX_HISTORICO)
    expect(p?.historico[0]).toBe(nova)
    expect(p?.historico).not.toContain('2020-01-01T00:00:00.000Z')
  })
})
