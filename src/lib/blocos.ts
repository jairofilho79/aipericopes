import { BIBLE_BOOKS, type BibleSection } from './bible-books'

/**
 * Blocos do cânon: o degrau "médio" da escada de jornadas, entre um livro e
 * um testamento inteiro.
 *
 * DERIVADO de BIBLE_BOOKS[].section, não transcrito. A taxonomia já existe e
 * é versionada; copiar 66 abbrevs para cá seria duplicar dado — e era a
 * cópia que criava o risco de trocar `Jó` (o livro) por `Jo` (João), que
 * diferem só pelo acento e não produziriam erro nenhum, só uma rota
 * silenciosamente errada.
 *
 * Os blocos PARTICIONAM as sections: cada uma é reivindicada por exatamente
 * um bloco, e a cobertura dos 66 livros sai de graça disso. As duas sections
 * de um livro só (`História` = Atos, `Apocalipse`) se juntam a vizinhas
 * naturais em vez de virarem blocos "médios" de um livro.
 */
export type Bloco = {
  id: string
  nome: string
  sections: readonly BibleSection[]
}

export const BLOCOS: readonly Bloco[] = [
  { id: 'pentateuco', nome: 'Pentateuco', sections: ['Pentateuco'] },
  { id: 'historicos', nome: 'Históricos', sections: ['Históricos'] },
  { id: 'poeticos', nome: 'Poéticos e Sabedoria', sections: ['Poesia'] },
  { id: 'profetas-maiores', nome: 'Profetas Maiores', sections: ['Profetas Maiores'] },
  { id: 'profetas-menores', nome: 'Profetas Menores', sections: ['Profetas Menores'] },
  { id: 'evangelhos', nome: 'Evangelhos', sections: ['Evangelhos'] },
  { id: 'paulo', nome: 'Atos e as Cartas de Paulo', sections: ['História', 'Cartas de Paulo'] },
  {
    id: 'hebreus-apocalipse',
    nome: 'Hebreus a Apocalipse',
    sections: ['Cartas Gerais', 'Apocalipse'],
  },
]

const POR_ID = new Map(BLOCOS.map((b) => [b.id, b]))

const ABBREVS_POR_ID = new Map<string, ReadonlySet<string>>(
  BLOCOS.map((b) => [
    b.id,
    new Set(BIBLE_BOOKS.filter((l) => b.sections.includes(l.section)).map((l) => l.abbrev)),
  ]),
)

const VAZIO: ReadonlySet<string> = new Set()

export function blocoPorId(id: string): Bloco | undefined {
  return POR_ID.get(id)
}

/**
 * ReadonlySet e não Set: o conjunto é calculado uma vez e compartilhado entre
 * chamadas, então devolvê-lo mutável convidaria um consumidor a corromper o
 * bloco para todo mundo. Conjunto vazio para id desconhecido — rota vazia é
 * melhor que exceção na render.
 */
export function abbrevsDoBloco(id: string): ReadonlySet<string> {
  return ABBREVS_POR_ID.get(id) ?? VAZIO
}
