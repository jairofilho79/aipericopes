import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import {
  corrigirVersiculo,
  DUPLICADAS,
  PARENTESES_ORFAOS,
  CORRECOES,
  SUBSCRICOES,
  OMISSOES,
  PONTO_FINAL_PERDIDO,
} from './blivre-correcoes.ts'

describe('corrigirVersiculo — palavra duplicada', () => {
  it('remove a segunda ocorrência e o espaço que sobra', () => {
    expect(corrigirVersiculo('JOB', 13, 11, 'E o temor dele não cairá sobre sobre vós?')).toBe(
      'E o temor dele não cairá sobre vós?',
    )
  })

  it('preserva a caixa da primeira ocorrência', () => {
    expect(corrigirVersiculo('ISA', 1, 25, 'E tornarei minha minha mão contra ti')).toBe(
      'E tornarei minha mão contra ti',
    )
  })

  it('lança quando a duplicata não está mais lá — a fonte mudou', () => {
    expect(() => corrigirVersiculo('JOB', 13, 11, 'E o temor dele não cairá sobre vós?')).toThrow(
      /JOB 13:11/,
    )
  })

  it('não toca em versículo sem correção registrada', () => {
    const t = 'No princípio criou Deus os céus e a terra.'
    expect(corrigirVersiculo('GEN', 1, 1, t)).toBe(t)
  })
})

describe('corrigirVersiculo — parêntese órfão', () => {
  it('remove o fecha-parênteses que não tem abertura', () => {
    expect(
      corrigirVersiculo('NUM', 15, 38, 'dize-lhes que se façam franjas) nos arremates'),
    ).toBe('dize-lhes que se façam franjas nos arremates')
  })

  it('remove também o espaço que sobra antes dele', () => {
    expect(corrigirVersiculo('EZE', 22, 10, 'Descobriram a nudez do pai ) em ti')).toBe(
      'Descobriram a nudez do pai em ti',
    )
  })

  it('lança quando não há parêntese para remover', () => {
    expect(() => corrigirVersiculo('NUM', 15, 38, 'sem parenteses aqui')).toThrow(/NUM 15:38/)
  })
})

describe('corrigirVersiculo — correções conferidas uma a uma', () => {
  it('devolve ao Salmo 125 o sobrescrito que a fonte perdeu', () => {
    const r = corrigirVersiculo('PSA', 125, 1, 'Os que confiam no SENHOR são como o monte de Sião')
    expect(r).toBe('Cântico dos degraus:Os que confiam no SENHOR são como o monte de Sião')
  })

  it('conserta "Samo" para "Salmo" no sobrescrito do Salmo 80', () => {
    const r = corrigirVersiculo('PSA', 80, 1, 'Para o regente. Samo de Asafe:Ó Pastor de Israel')
    expect(r).toBe('Para o regente. Salmo de Asafe:Ó Pastor de Israel')
  })

  it('devolve o "som" do Salmo 150 — a KJV e a Almeida 1911 concordam', () => {
    const r = corrigirVersiculo('PSA', 150, 3, 'Louvai-o com com de trombeta; louvai-o com lira e harpa.')
    expect(r).toBe('Louvai-o com som de trombeta; louvai-o com lira e harpa.')
  })

  it('faz a crase em Êxodo 2:19', () => {
    expect(corrigirVersiculo('EXO', 2, 19, 'e deu de beber as as ovelhas.')).toBe(
      'e deu de beber às ovelhas.',
    )
  })

  it('restaura a frase que falta em 1Sm 20:42', () => {
    const r = corrigirVersiculo(
      '1SA',
      20,
      42,
      'entre minha descendência e a tua descendência para sempre.',
    )
    expect(r).toBe(
      'entre minha descendência e a tua descendência para sempre. Então Davi se levantou e se foi; e Jônatas entrou na cidade.',
    )
  })
})

describe('corrigirVersiculo — subscrição de escriba', () => {
  it('tira a nota de copista colada no fim da carta', () => {
    const r = corrigirVersiculo('EPH', 6, 24, 'A graça [seja] com todos. Amém![Escrita de Roma para os efésios, e enviada por Tíquico]')
    expect(r).toBe('A graça [seja] com todos. Amém!')
  })

  it('funciona com parênteses e com o ponto solto depois do colchete', () => {
    expect(corrigirVersiculo('COL', 4, 18, 'A graça convosco. Amém (Escrita de Roma aos colossenses.)')).toBe(
      'A graça convosco. Amém',
    )
    expect(corrigirVersiculo('1TI', 6, 21, 'A graça contigo. Amém. [A primeira carta a Timóteo foi escrita de Laodiceia] .')).toBe(
      'A graça contigo. Amém.',
    )
  })

  it('não se confunde com parêntese DENTRO da subscrição', () => {
    const r = corrigirVersiculo('2TI', 4, 22, 'A graça convosco. Amém.[A segunda carta a Timóteo (o primeiro bispo) foi escrita em Roma]')
    expect(r).toBe('A graça convosco. Amém.')
  })

  // O texto aqui é o de verdade, com o `Cirsto` que a fonte traz: Fm 1:25 tem
  // subscrição E erro de digitação, e as duas correções se aplicam ao mesmo
  // versículo. Um fixture idealizado escondia essa combinação.
  it('preserva os colchetes editoriais do corpo — quem os tira é removerColchetes', () => {
    const r = corrigirVersiculo(
      'PHM',
      1,
      25,
      'A graça de nosso Senhor Jesus Cirsto [seja] com vosso espírito. Amém! [Escrita em Roma para Filemom]',
    )
    expect(r).toBe('A graça de nosso Senhor Jesus Cristo [seja] com vosso espírito. Amém!')
  })

  it('lança se a subscrição não estiver mais lá', () => {
    expect(() => corrigirVersiculo('EPH', 6, 24, 'A graça com todos. Amém!')).toThrow(/EPH 6:24/)
  })
})

describe('corrigirVersiculo — frase omitida, restaurada das testemunhas', () => {
  it('devolve o dízimo de Abraão a Melquisedeque', () => {
    const r = corrigirVersiculo('GEN', 14, 20, 'E bendito seja o Deus altíssimo, que entregou teus inimigos em tua mão.')
    expect(r).toBe(
      'E bendito seja o Deus altíssimo, que entregou teus inimigos em tua mão. E deu-lhe o dízimo de tudo.',
    )
  })

  it('devolve a segunda negação de Pedro', () => {
    const r = corrigirVersiculo('LUK', 22, 58, 'E pouco depois, outro o viu, e disse: Também tu és um deles.')
    expect(r).toBe(
      'E pouco depois, outro o viu, e disse: Também tu és um deles. Porém Pedro disse: Homem, não sou.',
    )
  })

  it('restaura no MEIO do versículo quando é lá que falta', () => {
    const r = corrigirVersiculo('2CH', 12, 1, 'E quando Roboão havia confirmado o reino, deixou a lei do SENHOR, e com ele todo Israel.')
    expect(r).toBe(
      'E quando Roboão havia confirmado o reino, e havendo-se fortalecido, deixou a lei do SENHOR, e com ele todo Israel.',
    )
  })
})

describe('as tabelas', () => {
  it('toda correção manual tem motivo escrito com a testemunha', () => {
    for (const c of CORRECOES) {
      expect(c.motivo.length, c.ref).toBeGreaterThan(50)
      expect(c.motivo, c.ref).toMatch(/KJV|Almeida 1911|a própria fonte/i)
    }
  })

  // CORRECOES PODE repetir uma referência — Lc 4:40 tem dois defeitos na mesma
  // linha —, mas cada tabela vale por si, e um mesmo versículo em duas tabelas
  // diferentes é engano de digitação, não intenção.
  it('nenhuma referência aparece em duas tabelas diferentes', () => {
    const porTabela = [
      DUPLICADAS.map(([r]) => r),
      PARENTESES_ORFAOS,
      [...new Set(CORRECOES.map((c) => c.ref))],
    ]
    const todas = porTabela.flat()
    expect(new Set(todas).size).toBe(todas.length)
  })

  it('receitas que dividem a mesma referência mexem em trechos diferentes', () => {
    const porRef = new Map<string, string[]>()
    for (const c of CORRECOES) porRef.set(c.ref, [...(porRef.get(c.ref) ?? []), c.de])
    for (const [ref, des] of porRef) {
      if (des.length === 1) continue
      // Uma contida na outra faria a segunda troca cair dentro do texto que a
      // primeira já reescreveu — e o guard só acusaria isso em produção.
      for (const a of des) {
        for (const b of des) {
          if (a !== b) expect(a.includes(b), `${ref}: "${a}" contém "${b}"`).toBe(false)
        }
      }
      expect(new Set(des).size, ref).toBe(des.length)
    }
  })

  it('o tamanho das tabelas está travado', () => {
    expect(DUPLICADAS).toHaveLength(49)
    expect(PARENTESES_ORFAOS).toHaveLength(11)
    expect(CORRECOES).toHaveLength(583) // 424 + 154 da rede de padrões + 5 do corretor ortográfico
    expect(SUBSCRICOES).toHaveLength(14)
    expect(OMISSOES).toHaveLength(51)
    expect(PONTO_FINAL_PERDIDO).toHaveLength(23)
  })

  it('toda omissão restaurada diz de onde veio a frase', () => {
    for (const o of OMISSOES) {
      expect(o.motivo.length, o.ref).toBeGreaterThan(30)
      expect(o.para.length, o.ref).toBeGreaterThan(o.de.length)
    }
  })
})

describe('as correções achadas lendo e por varredura', () => {
  // Cada `de` tem de casar com a fonte de verdade, senão `corrigirVersiculo`
  // lança em produção. Este teste é o guarda disso: se a Bíblia Livre publicar
  // uma revisão, ele quebra aqui e não no build.
  const VPL = 'data/bliv-tr_vpl.txt'
  const TEM_VPL = existsSync(VPL)
  const porRef = new Map<string, string>()
  if (TEM_VPL) {
    for (const l of readFileSync(VPL, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
      const m = /^(\S+ \d+:\d+)\s+(.*)$/.exec(l)
      if (m) porRef.set(m[1], m[2])
    }
  }

  const NOVAS = [
    'LUK 14:11', 'LUK 21:18', 'LUK 20:46', 'ACT 4:32', 'ACT 17:24', 'ACT 25:12',
    'PHM 1:25', 'REV 2:24', 'REV 6:1', 'REV 6:5', 'REV 6:15', '2TI 2:16',
    'HEB 11:34', 'EPH 5:31', 'AMO 9:14', 'HOS 1:1',
  ]

  it('estão todas registradas', () => {
    const refs = new Set(CORRECOES.map((c) => c.ref))
    for (const r of NOVAS) expect(refs, r).toContain(r)
  })

  it.skipIf(!TEM_VPL)('o trecho `de` de cada uma existe na fonte, palavra por palavra', () => {
    for (const c of CORRECOES.filter((x) => NOVAS.includes(x.ref))) {
      const texto = porRef.get(c.ref)
      expect(texto, `versículo ausente: ${c.ref}`).toBeDefined()
      expect(texto!.includes(c.de), `${c.ref}: não achei "${c.de}"`).toBe(true)
    }
  })

  it.skipIf(!TEM_VPL)('aplicar deixa o versículo certo, e o defeito some', () => {
    for (const c of CORRECOES.filter((x) => NOVAS.includes(x.ref))) {
      const [cod, cv] = c.ref.split(' ')
      const [cap, ver] = cv.split(':').map(Number)
      const saida = corrigirVersiculo(cod, cap, ver, porRef.get(c.ref)!)
      expect(saida, `${c.ref} não aplicou`).toContain(c.para)
    }
  })

  // A única que acrescenta palavras. A frase restaurada não é invenção minha:
  // é a redação da própria Bíblia Livre em Lc 18:14 e Mt 23:12.
  it('Lc 14:11 volta a dar desfechos opostos às duas metades da frase', () => {
    const c = CORRECOES.find((x) => x.ref === 'LUK 14:11')!
    expect(c.de).not.toContain('será humilhado')
    expect(c.para).toContain('exaltar a si mesmo será humilhado')
    expect(c.para).toContain('humilhar a si mesmo será exaltado')
  })
})

describe('dois defeitos no mesmo versículo', () => {
  it('aplica as duas receitas, e não só a última', () => {
    const duas = CORRECOES.filter((c) => c.ref === 'LUK 4:40')
    expect(duas.length, 'Lc 4:40 devia ter duas receitas').toBe(2)
    const bruto =
      'Quando o sol estava se pondo, troxeram-lhe todos os que estavam enfermos de varias doenças. Ele punha as mãos sobre cada um deles e os curava.'
    const saida = corrigirVersiculo('LUK', 4, 40, bruto)
    expect(saida).toContain('trouxeram-lhe')
    expect(saida).toContain('várias doenças')
  })
})

describe('ponto final perdido', () => {
  it('põe o ponto onde a frase acaba', () => {
    expect(corrigirVersiculo('PSA', 48, 4, 'e eles juntamente passaram')).toBe(
      'e eles juntamente passaram.',
    )
  })

  it('estoura se o versículo já veio pontuado — sinal de que a fonte mudou', () => {
    expect(() => corrigirVersiculo('PSA', 48, 4, 'e eles juntamente passaram.')).toThrow(
      /já termina pontuado/,
    )
  })

  // Os sete cuja frase continua no versículo seguinte NÃO entram na tabela.
  it('não toca em Gl 1:15, cuja frase continua no versículo seguinte', () => {
    const bruto = 'Mas quando Deus ( que me separou ) se agradou'
    expect(corrigirVersiculo('GAL', 1, 15, bruto)).toBe(bruto)
  })

  it('a tabela e as outras não se sobrepõem', () => {
    const outras = new Set([...DUPLICADAS.map(([r]) => r), ...PARENTESES_ORFAOS, ...SUBSCRICOES])
    const dobradas = PONTO_FINAL_PERDIDO.filter((r) => outras.has(r))
    expect(dobradas, `em duas tabelas: ${dobradas.join(', ')}`).toEqual([])
  })
})
