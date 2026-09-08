import { describe, it, expect } from 'vitest'
import { colisoes, palavrasDoTitulo } from './titulos-colididos.ts'

const t = (ordem: number, titulo: string) => ({ ordem, titulo })

describe('palavrasDoTitulo', () => {
  it('tira acento, pontuação e as palavras que não significam nada', () => {
    expect(palavrasDoTitulo('O pacto que Deus fez sozinho')).toEqual(['pacto', 'deus', 'fez', 'sozinho'])
  })

  it('preposição não é palavra de conteúdo — "para" fazia dois títulos colidirem à toa', () => {
    expect(palavrasDoTitulo('Sete dias para fazer um sacerdote')).not.toContain('para')
    expect(palavrasDoTitulo('Sete dias depois que para')).toEqual(['sete', 'dias'])
  })

  it('a mesma palavra com e sem acento é a mesma palavra', () => {
    expect(palavrasDoTitulo('A bênção')).toEqual(palavrasDoTitulo('A bencao'))
  })
})

describe('colisoes', () => {
  it('acha o par real que apareceu na produção', () => {
    const r = colisoes([
      t(7, 'O pacto que Deus fez sozinho'),
      t(17, 'O pacto que Deus assina sozinho'),
      t(12, 'A ordem sem endereço'),
    ])
    expect(r).toHaveLength(1)
    expect([r[0].a.ordem, r[0].b.ordem]).toEqual([7, 17])
    expect(r[0].comuns.sort()).toEqual(['deus', 'pacto', 'sozinho'])
  })

  it('uma palavra em comum é coincidência, não colisão', () => {
    expect(colisoes([t(1, 'A casa de Deus'), t(2, 'O silêncio de Deus')])).toEqual([])
  })

  it('título repetido em cheio vem marcado e vem primeiro', () => {
    const r = colisoes([
      t(1, 'O pacto que Deus fez sozinho'),
      t(2, 'O pacto que Deus assina sozinho'),
      t(3, 'O pacto que Deus fez sozinho'),
    ])
    expect(r[0].identicos).toBe(true)
    expect([r[0].a.ordem, r[0].b.ordem]).toEqual([1, 3])
  })

  it('força mede proporção, não contagem: título curto colide mais fácil', () => {
    const [curto] = colisoes([t(1, 'A cerca branca'), t(2, 'A cerca branca e a porta colorida')])
    expect(curto.forca).toBe(1)
    // Dividem duas palavras, mas cada título carrega muitas outras: de longe
    // não são o mesmo título.
    const [longo] = colisoes([
      t(3, 'O sangue derramado fechou a aliança no monte alto'),
      t(4, 'A aliança escrita com sangue sobre a casa inteira'),
    ])
    expect(longo.comuns.sort()).toEqual(['alianca', 'sangue'])
    expect(longo.forca).toBeLessThan(0.5)
  })

  it('título idêntico tem força 1 e vem na frente', () => {
    const r = colisoes([
      t(1, 'A cerca branca e a porta colorida'),
      t(2, 'O poço que virou juramento e sinal'),
      t(3, 'A cerca branca e a porta colorida'),
    ])
    expect(r[0].identicos).toBe(true)
    expect(r[0].forca).toBe(1)
  })

  it('catálogo sem colisão devolve lista vazia', () => {
    expect(colisoes([t(1, 'A escada e a pedra de Betel'), t(2, 'Esaú vende a primogenitura')])).toEqual([])
  })

  it('o mínimo é ajustável — três palavras filtra os pares fracos', () => {
    const titulos = [t(1, 'O poço que virou juramento'), t(2, 'O juramento e o sinal no poço')]
    expect(colisoes(titulos, 2)).toHaveLength(1)
    expect(colisoes(titulos, 3)).toHaveLength(0)
  })
})
