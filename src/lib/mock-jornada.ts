import type { Jornada, PericopeIndex, Progresso } from './types'
import { progressoDaJornada, rotaDaJornada, type ProgressoJornada } from './jornadas'

/** Dados fake só para `/jornada?mock=1` em DEV — zero IndexedDB. */
export function estadoMockJornada(indice: PericopeIndex[]): {
  progressos: Map<number, Progresso>
  corrente: Jornada
  progCorrente: ProgressoJornada
  historico: { jornada: Jornada; prog: ProgressoJornada }[]
} {
  const agora = '2026-09-09T12:00:00.000Z'
  const jonasOrdens = indice.filter((p) => p.livro === 'Jonas').map((p) => p.ordem)
  const ruteOrdens = indice.filter((p) => p.livro === 'Rute').map((p) => p.ordem)
  if (!jonasOrdens.length || !ruteOrdens.length) {
    throw new Error('mock-jornada: Rute/Jonas ausentes no índice')
  }

  const progressos = new Map<number, Progresso>()
  for (const ordem of jonasOrdens.slice(0, 3)) {
    progressos.set(ordem, {
      pericopeOrdem: ordem,
      status: 'concluido',
      historico: [agora],
      paraReler: false,
      atualizadoEm: agora,
    })
  }

  const corrente: Jornada = {
    id: 'mock-jonas',
    nome: 'Mock · Jonas',
    tipo: 'livro',
    escopo: 'Jonas',
    inicioOrdem: jonasOrdens[0]!,
    contaDesde: null,
    criadoEm: agora,
    atualizadoEm: agora,
    arquivadaEm: null,
    concluidaEm: null,
  }

  const arquivada: Jornada = {
    id: 'mock-rute',
    nome: 'Mock · Rute',
    tipo: 'livro',
    escopo: 'Rute',
    inicioOrdem: ruteOrdens[0]!,
    contaDesde: null,
    criadoEm: '2026-08-01T12:00:00.000Z',
    atualizadoEm: '2026-08-15T12:00:00.000Z',
    arquivadaEm: '2026-08-15T12:00:00.000Z',
    concluidaEm: null,
  }

  return {
    progressos,
    corrente,
    progCorrente: progressoDaJornada(rotaDaJornada(corrente, indice), progressos, null),
    historico: [
      {
        jornada: arquivada,
        prog: progressoDaJornada(rotaDaJornada(arquivada, indice), progressos, null),
      },
    ],
  }
}
