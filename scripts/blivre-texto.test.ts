import { describe, it, expect } from 'vitest'
import { removerColchetes } from './blivre-texto.ts'

describe('removerColchetes', () => {
  it('devolve intacto o versículo que não tem colchete', () => {
    const t = 'O SENHOR é meu pastor, nada me faltará.'
    expect(removerColchetes(t)).toBe(t)
  })

  it('tira os colchetes e mantém a palavra suprida', () => {
    expect(removerColchetes('Deus [é] nosso refúgio e força')).toBe('Deus é nosso refúgio e força')
  })

  it('cola o sufixo hifenizado na palavra anterior', () => {
    // PSA 20:9 — "Salva [-nos] ,SENHOR!"
    expect(removerColchetes('Salva [-nos] ,SENHOR!')).toBe('Salva-nos, SENHOR!')
    // PSA 135:1 — "louvai [-o] vós"
    expect(removerColchetes('louvai [-o] vós, servos do SENHOR')).toBe(
      'louvai-o vós, servos do SENHOR',
    )
  })

  it('tira o espaço que sobra antes da pontuação', () => {
    // LEV 24:5
    expect(removerColchetes('cada torta será de dois décimos [de efa] .')).toBe(
      'cada torta será de dois décimos de efa.',
    )
    // 1CH 4:13
    expect(removerColchetes('Os filhos de Otniel: Hatate [e Meonotai] .')).toBe(
      'Os filhos de Otniel: Hatate e Meonotai.',
    )
  })

  it('funciona com o colchete abrindo o versículo', () => {
    // DEU 32:4
    expect(removerColchetes('[Ele é] a Rocha, sua obra é perfeita')).toBe(
      'Ele é a Rocha, sua obra é perfeita',
    )
  })

  it('preserva a pontuação que estava DENTRO do colchete', () => {
    // PSA 25:13
    expect(removerColchetes('sua semente [isto é, sua descendência] possuirá a terra')).toBe(
      'sua semente isto é, sua descendência possuirá a terra',
    )
  })

  it('trata mais de um colchete no mesmo versículo', () => {
    expect(removerColchetes('Olha [para mim, e] ouve-me; ilumina [os] meus olhos')).toBe(
      'Olha para mim, e ouve-me; ilumina os meus olhos',
    )
  })

  it('não deixa espaço duplo nem sobra nas pontas', () => {
    expect(removerColchetes('  Agradecei ao SENHOR, porque sua bondade [dura] para sempre.  ')).toBe(
      'Agradecei ao SENHOR, porque sua bondade dura para sempre.',
    )
  })
})

describe('removerColchetes — colchete colado numa palavra', () => {
  it('abre espaço quando o colchete gruda duas palavras', () => {
    // Ag 2:16 no fonte: "conseguiam[apenas] dez".
    expect(removerColchetes('conseguiam[apenas] dez')).toBe('conseguiam apenas dez')
    expect(removerColchetes('holocaustos[conforme] o número')).toBe('holocaustos conforme o número')
    expect(removerColchetes('pois[o SENHOR] estende')).toBe('pois o SENHOR estende')
    expect(removerColchetes('E no[dia] seguinte')).toBe('E no dia seguinte')
  })

  it('NÃO abre espaço antes de próclise: "mataram[-no]" é "mataram-no"', () => {
    expect(removerColchetes('pegando dele, mataram[-no] , e lançaram[-no] fora')).toBe(
      'pegando dele, mataram-no, e lançaram-no fora',
    )
    expect(removerColchetes('ouviram[-lhe] dizer')).toBe('ouviram-lhe dizer')
  })

  it('não duplica o espaço quando o fonte já traz um dentro do colchete', () => {
    expect(removerColchetes('tudo quanto ele[ antes] possuía.')).toBe('tudo quanto ele antes possuía.')
    expect(removerColchetes('não haverá[mais ] lembrança')).toBe('não haverá mais lembrança')
  })

  it('o caso comum, com o colchete solto, continua igual', () => {
    expect(removerColchetes('havia [vasos] mas')).toBe('havia vasos mas')
  })
})

describe('colchete com pedaço de palavra, não com palavra', () => {
  // Achados varrendo o corpus: o app estava servindo "com igo", "palavra s" e
  // "n um dia de sábado" — texto quebrado na tela e na narração.
  it('fecha a palavra anterior quando o pedaço é o fim dela', () => {
    expect(removerColchetes('desçam com [igo] , e se houver')).toBe('desçam comigo, e se houver')
    expect(removerColchetes('a questão é de palavra [s] , e de nomes')).toBe(
      'a questão é de palavras, e de nomes',
    )
    expect(removerColchetes('do interior dele [s] sai')).toBe('do interior deles sai')
  })

  it('abre a palavra seguinte quando o pedaço é o começo dela', () => {
    expect(removerColchetes('ao entrarem na sinagoga [n] um dia de sábado')).toBe(
      'ao entrarem na sinagoga num dia de sábado',
    )
    expect(removerColchetes('e [n] o [dia] seguinte a Rodes')).toBe('e no dia seguinte a Rodes')
    expect(removerColchetes('dá-nos sempre [d] este pão')).toBe('dá-nos sempre deste pão')
  })

  it('não mexe no colchete que traz palavra de verdade — são 673 no corpus', () => {
    expect(removerColchetes('Deus [é] nosso refúgio')).toBe('Deus é nosso refúgio')
    expect(removerColchetes('e [o] porei sobre eles')).toBe('e o porei sobre eles')
    expect(removerColchetes('não [a] leves sozinho')).toBe('não a leves sozinho')
    expect(removerColchetes('obras, [ó] Senhor')).toBe('obras, ó Senhor')
  })
})

describe('nota do tradutor entre colchetes', () => {
  // O app servia "o que é completo, Ou: perfeito então o que é em parte" — e
  // a narração lia o aparato crítico em voz alta. São dois casos no corpus.
  it('some inteira, com a pontuação que sobra na frente', () => {
    expect(removerColchetes('Mas quando vier o [que é] completo,[Ou: perfeito] então o que é em parte')).toBe(
      'Mas quando vier o que é completo, então o que é em parte',
    )
  })

  it('pega também a forma minúscula', () => {
    expect(removerColchetes('Os presbíteros [ou: anciãos] que lideram bem')).toBe(
      'Os presbíteros que lideram bem',
    )
  })

  it('não confunde com colchete de palavra suprida', () => {
    expect(removerColchetes('Deus [é] nosso refúgio')).toBe('Deus é nosso refúgio')
    expect(removerColchetes('e [o] porei sobre eles')).toBe('e o porei sobre eles')
  })
})

describe('letra solta antes do colchete', () => {
  // O espelho do caso anterior: aqui o pedaço fica FORA e a palavra dentro.
  // O app servia "d esta geração", "n esta visão", "D este tal". São dez.
  it('junta a contração', () => {
    expect(removerColchetes('aguentei com desgosto d [esta] geração')).toBe(
      'aguentei com desgosto desta geração',
    )
    expect(removerColchetes('eu vi os cavalos n [esta] visão')).toBe('eu vi os cavalos nesta visão')
    expect(removerColchetes('D [este] tal eu me orgulharei')).toBe('Deste tal eu me orgulharei')
    expect(removerColchetes('aos mensageiros d [aquela] nação')).toBe('aos mensageiros daquela nação')
  })

  it('não junta as letras que são palavras de verdade', () => {
    expect(removerColchetes('Deus [é] nosso refúgio')).toBe('Deus é nosso refúgio')
    expect(removerColchetes('e [o] porei sobre eles')).toBe('e o porei sobre eles')
    expect(removerColchetes('não [a] leves sozinho')).toBe('não a leves sozinho')
  })

  it('não estraga a letra que faz parte de uma palavra', () => {
    expect(removerColchetes('a fé [que] salva')).toBe('a fé que salva')
  })
})

describe('ponto final colado na frase seguinte', () => {
  // São 66 no corpus, e vinham sendo servidas assim. Vários deles já estavam
  // catalogados um a um como defeito da fonte; é uma regra só.
  it('abre o espaço quando vem MAIÚSCULA depois', () => {
    expect(removerColchetes('mas sim para salvá-las.E foram para outra aldeia.')).toBe(
      'mas sim para salvá-las. E foram para outra aldeia.',
    )
    expect(removerColchetes('amarra as tuas sandálias.E ele fez assim.')).toBe(
      'amarra as tuas sandálias. E ele fez assim.',
    )
  })

  it('não mexe onde o ponto já tem espaço', () => {
    expect(removerColchetes('primeira frase. Segunda frase.')).toBe('primeira frase. Segunda frase.')
  })

  // A forma perigosa não existe no corpus, e a regra não a inventa.
  it('não separa ponto seguido de minúscula', () => {
    expect(removerColchetes('etc.algo assim')).toBe('etc.algo assim')
  })
})

describe('parêntese folgado', () => {
  it('fecha o espaço por dentro dos dois lados', () => {
    expect(removerColchetes('Deus ( que me separou ) se agradou')).toBe(
      'Deus (que me separou) se agradou',
    )
  })

  it('não mexe no parêntese que já está justo', () => {
    expect(removerColchetes('o Cântico do Arco (está no livro de Jasher).')).toBe(
      'o Cântico do Arco (está no livro de Jasher).',
    )
  })

  it('não come o espaço de fora', () => {
    expect(removerColchetes('a lei (de Moisés) e os profetas')).toBe(
      'a lei (de Moisés) e os profetas',
    )
  })
})

describe('hífen com espaço depois', () => {
  it('junta a ênclise partida', () => {
    expect(removerColchetes('e dize- lhes: Subo')).toBe('e dize-lhes: Subo')
  })

  it('junta a ênclise partida que ainda está entre colchetes', () => {
    expect(removerColchetes('envolveu- [a] em si')).toBe('envolveu-a em si')
  })

  it('junta o composto', () => {
    expect(removerColchetes('o Deus Todo- Poderoso')).toBe('o Deus Todo-Poderoso')
  })

  it('não toca no travessão, que leva espaço de propósito', () => {
    expect(removerColchetes('a cidade — a que Davi tomou — caiu')).toBe(
      'a cidade — a que Davi tomou — caiu',
    )
  })
})

describe('hífen com espaço antes, do lado de fora do colchete', () => {
  it('junta a ênclise que o colchete fechou cedo demais', () => {
    // Jó 10:3 e Sl 139:6, os dois únicos do corpus.
    expect(removerColchetes('[Parece] -te bem que [me] oprimas')).toBe(
      'Parece-te bem que me oprimas',
    )
    expect(removerColchetes('tão alto que não posso [alcançá] -lo.')).toBe(
      'tão alto que não posso alcançá-lo.',
    )
  })

  it('não junta o travessão que o colchete deixou antes', () => {
    expect(removerColchetes('a cidade [de Davi] — a que ele tomou')).toBe(
      'a cidade de Davi — a que ele tomou',
    )
  })
})

describe('hífen solto e hífen com espaço na mesma linha', () => {
  it('junta a ênclise que o colchete abriu com espaço por dentro', () => {
    // Lc 19:27 traz as duas formas lado a lado: `trazei [- os]` e `matai [-os]`.
    expect(removerColchetes('trazei [- os] aqui, e matai [-os] diante de mim.')).toBe(
      'trazei-os aqui, e matai-os diante de mim.',
    )
  })
})

describe('ponto colado no parêntese', () => {
  it('separa o Selá do fim do salmo', () => {
    expect(removerColchetes('para ele em Deus.(Selá)')).toBe('para ele em Deus. (Selá)')
  })

  it('não abre espaço em parêntese que já vem depois de espaço', () => {
    expect(removerColchetes('o profeta (a quem Deus enviou) falou')).toBe(
      'o profeta (a quem Deus enviou) falou',
    )
  })
})

describe('parêntese que fecha colado na palavra seguinte', () => {
  it('abre o espaço depois do Selá', () => {
    expect(removerColchetes('dos tempos. (Selá)Porque eles')).toBe(
      'dos tempos. (Selá) Porque eles',
    )
  })

  it('não mexe no parêntese seguido de espaço', () => {
    expect(removerColchetes('a lei (de Moisés) e os profetas')).toBe(
      'a lei (de Moisés) e os profetas',
    )
  })
})
