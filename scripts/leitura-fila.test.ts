import { describe, expect, it } from 'vitest'
import { conferirAchado, ehDivida, montarDossie, textoDoCampo, type Dossie } from './leitura-fila.ts'

const dossie = (extra: Partial<Dossie> = {}): Dossie =>
  ({
    ordem: 1,
    abbrev: 'Gn',
    livro: 'Gênesis',
    ref: 'Gênesis 1:1-5',
    texto: 'No princípio criou Deus os céus e a terra.',
    titulo_pericope_pt: 'O primeiro dia',
    contexto_historico_literario: 'Guarde isso ao ler: a luz vem antes do sol.',
    resenha: 'A ordem importa. A luz aparece no dia um; o sol, no dia quatro.',
    perguntas_reflexao: ['O que muda se a luz não vem do sol?', 'Onde mais isso aparece?'],
    topicos_pregar: '**Um** ponto',
    ...extra,
  }) as Dossie

describe('conferirAchado', () => {
  it('aceita corte cuja frase está no campo, byte a byte', () => {
    const p = conferirAchado(dossie(), {
      ordem: 1,
      corta: [{ campo: 'resenha', frase: 'A ordem importa.', porque: 'não carrega fato' }],
    })
    expect(p).toEqual([])
  })

  it('recusa corte parafraseado, mesmo que quase igual', () => {
    // O "quase" é o ponto: aceitar aproximação faria o corte levar a frase
    // vizinha junto, e ninguém releria para descobrir.
    const p = conferirAchado(dossie(), {
      ordem: 1,
      corta: [{ campo: 'resenha', frase: 'a ordem importa', porque: 'x' }],
    })
    expect(p).toHaveLength(1)
    expect(p[0]).toContain('não está em resenha')
  })

  it('procura a citação dentro de campo que é lista', () => {
    expect(textoDoCampo(dossie(), 'perguntas_reflexao')).toContain('Onde mais isso aparece?')
    const p = conferirAchado(dossie(), {
      ordem: 1,
      corta: [{ campo: 'perguntas_reflexao', frase: 'Onde mais isso aparece?', porque: 'vaga' }],
    })
    expect(p).toEqual([])
  })

  it('recusa dívida sem âncora', () => {
    const p = conferirAchado(dossie(), {
      ordem: 1,
      faltou: [{ campo: 'resenha', forca: 'divida', o_que: 'era costume da época' }],
    })
    expect(p[0]).toContain('sem âncora')
  })

  it('recusa dívida que não declara a força', () => {
    const p = conferirAchado(dossie(), {
      ordem: 1,
      faltou: [{ campo: 'resenha', o_que: 'x', ancora: 'Gn 1:14' }],
    })
    expect(p[0]).toContain('forca')
  })

  it('aceita as duas grafias de dívida e distingue de enriquecimento', () => {
    expect(ehDivida({ campo: 'resenha', forca: 'dívida' })).toBe(true)
    expect(ehDivida({ campo: 'resenha', forca: 'divida' })).toBe(true)
    expect(ehDivida({ campo: 'resenha', forca: 'enriquecimento' })).toBe(false)
  })

  it('recusa campo que não existe, em qualquer das duas listas', () => {
    const p = conferirAchado(dossie(), {
      ordem: 1,
      corta: [{ campo: 'introducao', frase: 'x', porque: 'y' }],
      faltou: [{ campo: 'conclusao', forca: 'divida', o_que: 'x', ancora: 'Gn 1:1' }],
    })
    expect(p).toHaveLength(2)
  })

  it('achado vazio passa — lista vazia é resposta válida', () => {
    expect(conferirAchado(dossie(), { ordem: 1 })).toEqual([])
  })
})

describe('montarDossie', () => {
  it('escreve a faixa com os dois capítulos quando a perícope atravessa', () => {
    const d = montarDossie({
      ordem: 9, abbrev: 'Pv', livro: 'Provérbios', texto: 't',
      capitulo_inicio: 22, versiculo_inicio: 17, capitulo_fim: 24, versiculo_fim: 22,
    })
    expect(d.ref).toBe('Provérbios 22:17-24:22')
  })

  it('escreve a faixa curta quando começa e termina no mesmo capítulo', () => {
    const d = montarDossie({
      ordem: 1, abbrev: 'Gn', livro: 'Gênesis', texto: 't',
      capitulo_inicio: 1, versiculo_inicio: 1, capitulo_fim: 1, versiculo_fim: 5,
    })
    expect(d.ref).toBe('Gênesis 1:1-5')
  })
})
