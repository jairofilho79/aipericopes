import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  dirs,
  criarDirs,
  montarEntrada,
  referencia,
  pendentes,
  travar,
  destravar,
  soltarTravasOrfas,
  espalharPorLivro,
  montarLote,
  conferirSaidas,
  devolverReprovadas,
  type Dirs,
  type Bruta,
} from './reenriquecimento.ts'

/** Lista válida de palavras do trecho — toda resenha tem de fechar com uma. */
const LISTA_OK = [
  '- Abismo, aqui, é a massa de água sem fundo que cobria tudo antes da luz.',
  '- Desordenada e vazia descreve terreno sem forma e sem ninguém morando nele.',
].join('\n')

const bruta = (o: Partial<Bruta> = {}): Bruta => ({
  ordem: 1,
  livro: 'Gênesis',
  abbrev: 'Gn',
  capitulo_inicio: 1,
  versiculo_inicio: 1,
  capitulo_fim: 2,
  versiculo_fim: 3,
  texto: 'Capítulo 1\n1 No princípio criou Deus os céus e a terra.',
  titulo_en: 'The Creation',
  ...o,
})

describe('referencia', () => {
  it('versículo único', () => {
    expect(referencia(bruta({ capitulo_fim: 1, versiculo_fim: 1 }))).toBe('Gn 1:1')
  })
  it('dentro de um capítulo', () => {
    expect(referencia(bruta({ capitulo_fim: 1, versiculo_fim: 5 }))).toBe('Gn 1:1-5')
  })
  it('atravessando capítulos', () => {
    expect(referencia(bruta())).toBe('Gn 1:1—2:3')
  })
})

describe('montarEntrada', () => {
  it('leva o título provisório em inglês das antigas, e o rótulo de corte das novas', () => {
    expect(montarEntrada(bruta({ ordem: 42 })).titulo_provisorio).toBe('The Creation')
    expect(
      montarEntrada(bruta({ ordem: 3000, titulo_en: undefined, titulo_provisorio: 'Caim e Abel' }))
        .titulo_provisorio,
    ).toBe('Caim e Abel')
  })

  it('NUNCA carrega material anterior — nem o das antigas, nem o das novas', () => {
    for (const ordem of [42, 3000]) {
      const e = montarEntrada(bruta({ ordem })) as Record<string, unknown>
      expect(e.material_anterior).toBeUndefined()
      expect(Object.keys(e).sort()).toEqual(
        ['abbrev', 'livro', 'ordem', 'referencia', 'texto', 'titulo_provisorio'].sort(),
      )
    }
  })

  it('carrega o sobrescrito quando existe — ele é texto bíblico da própria perícope', () => {
    expect(montarEntrada(bruta({ sobrescrito: 'Salmo de Davi' })).sobrescrito).toBe('Salmo de Davi')
  })
})

describe('fila em disco', () => {
  let base: string
  let d: Dirs

  const semear = (ordem: number, extra: Partial<Bruta> = {}) => {
    writeFileSync(
      join(d.entrada, `${ordem}.json`),
      JSON.stringify(montarEntrada(bruta({ ordem, ...extra }))),
    )
  }

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('pendente é o que tem entrada, não tem saída e não está travado', () => {
    semear(1)
    semear(2)
    semear(3)
    writeFileSync(join(d.saida, '2.json'), '{}')
    travar(d, 3)
    expect(pendentes(d)).toEqual([1])
  })

  it('travar é atômico: o segundo pedido da mesma ordem recebe false', () => {
    semear(1)
    expect(travar(d, 1)).toBe(true)
    expect(travar(d, 1)).toBe(false)
    destravar(d, 1)
    expect(travar(d, 1)).toBe(true)
  })

  it('solta só as travas órfãs — a que tem saída é trabalho terminado, não abandonado', () => {
    semear(1)
    semear(2)
    travar(d, 1)
    travar(d, 2)
    writeFileSync(join(d.saida, '2.json'), '{}')
    expect(soltarTravasOrfas(d, 0)).toEqual([1])
    expect(existsSync(join(d.travas, '2'))).toBe(true)
    expect(pendentes(d)).toEqual([1])
  })

  it('trava recente NÃO é órfã: é subagent vivo, e soltá-la faz dois escreverem a mesma perícope', () => {
    semear(1)
    travar(d, 1)
    // Com o padrão de 30 min, uma trava criada agora não é tocada.
    expect(soltarTravasOrfas(d)).toEqual([])
    expect(existsSync(join(d.travas, '1'))).toBe(true)
    expect(pendentes(d)).toEqual([])
  })

  it('trava velha o bastante é solta', () => {
    semear(1)
    travar(d, 1)
    const antiga = new Date(Date.now() - 60 * 60 * 1000)
    utimesSync(join(d.travas, '1'), antiga, antiga)
    expect(soltarTravasOrfas(d)).toEqual([1])
    expect(pendentes(d)).toEqual([1])
  })

  it('espalha por livro em vez de pegar as n primeiras', () => {
    for (const o of [1, 2, 3]) semear(o, { abbrev: 'Gn' })
    for (const o of [10, 11]) semear(o, { abbrev: 'Sl' })
    semear(20, { abbrev: 'Rm' })
    expect(espalharPorLivro(d, pendentes(d), 3)).toEqual([1, 10, 20])
  })

  it('espalhar não estoura quando n é maior do que o disponível', () => {
    semear(1, { abbrev: 'Gn' })
    semear(2, { abbrev: 'Sl' })
    expect(espalharPorLivro(d, pendentes(d), 10)).toEqual([1, 2])
  })

  it('montar lote trava as ordens e grava o arquivo que o subagent lê', () => {
    semear(1)
    semear(2)
    const lote = montarLote(d, [1, 2], 'l1')!
    expect(lote.ordens).toEqual([1, 2])
    expect(pendentes(d)).toEqual([])
    const conteudo = JSON.parse(readFileSync(lote.arquivo, 'utf8'))
    expect(conteudo.entradas).toHaveLength(2)
    expect(conteudo.entradas[0].texto).toContain('No princípio')
  })

  it('lote ignora ordem já travada por outro e devolve só o que conseguiu', () => {
    semear(1)
    semear(2)
    travar(d, 1)
    expect(montarLote(d, [1, 2], 'l1')!.ordens).toEqual([2])
  })

  it('lote devolve null quando não sobrou nada para travar', () => {
    semear(1)
    travar(d, 1)
    expect(montarLote(d, [1], 'l1')).toBeNull()
  })
})

describe('portão de qualidade', () => {
  let base: string
  let d: Dirs

  const TEXTO =
    'Capítulo 1\n1 No princípio criou Deus os céus e a terra.\n2 E a terra estava desordenada e vazia, e as trevas estavam sobre a face do abismo.'

  const material = (extra: Record<string, unknown> = {}) => ({
    ordem: 1,
    titulo_pericope_pt: 'A criação',
    contexto_historico_literario:
      'O princípio criou abismo trevas desordenada vazia. '.repeat(6),
    resenha:
      'A terra estava desordenada e vazia, e as trevas cobriam o abismo. '.repeat(6) +
      '\n\n' +
      LISTA_OK,
    perguntas_reflexao: ['p1', 'p2'],
    topicos_pregar:
      'Linha de raciocínio\n- um **a**\n- dois **b**\n- três **c**\n- quatro **d**\n- cinco **e**\n\nMensagens a levar\n- seis **f**\n- sete **g**\n- oito **h**\n- nove **i**',
    ...extra,
  })

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(
      join(d.entrada, '1.json'),
      JSON.stringify(montarEntrada(bruta({ ordem: 1, texto: TEXTO }))),
    )
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const julgar = (m: unknown) => {
    writeFileSync(join(d.saida, '1.json'), JSON.stringify(m))
    return conferirSaidas(d, [1])[0]
  }

  it('aprova material bem formado', () => {
    expect(julgar(material()).problemas).toEqual([])
  })

  it('reprova tópicos com bullets de menos', () => {
    const v = julgar(material({ topicos_pregar: 'Linha de raciocínio\n- só um **a**\n\nMensagens a levar\n- outro **b**' }))
    expect(v.ok).toBe(false)
    expect(v.problemas.join(' ')).toMatch(/linha de raciocínio = 1/)
  })

  it('reprova material genérico, que não fala DESTE trecho', () => {
    const v = julgar(
      material({
        contexto_historico_literario: 'Palavras completamente alheias sobre outros assuntos. '.repeat(6),
        resenha: 'Nenhuma relação com aquilo tratado adiante nestas linhas soltas. '.repeat(6),
      }),
    )
    expect(v.problemas.join(' ')).toMatch(/palavras em comum/)
  })

  it('avisa quando a citação não está no texto — é aqui que a NAA sobrevivente aparece', () => {
    const v = julgar(
      material({
        resenha: 'Ele disse: "Haja luz, e houve luz agora". ' + material().resenha,
      }),
    )
    expect(v.avisos.join(' ')).toMatch(/citação fora do texto/)
  })

  it('não avisa quando a citação está mesmo no texto', () => {
    const v = julgar(
      material({
        resenha: 'O texto diz "criou Deus os céus e a terra". ' + material().resenha,
      }),
    )
    expect(v.avisos).toEqual([])
  })

  it('reprova JSON inválido sem derrubar a rodada', () => {
    writeFileSync(join(d.saida, '1.json'), '{ isto não é json')
    expect(conferirSaidas(d, [1])[0].problemas[0]).toMatch(/JSON inválido/)
  })

  it('reprova quando o subagent simplesmente não escreveu', () => {
    expect(conferirSaidas(d, [1])[0].problemas).toEqual(['sem saída'])
  })

  it('reprovada volta para a fila: saída apagada, trava devolvida, motivo registrado', () => {
    travar(d, 1)
    const v = julgar(material({ perguntas_reflexao: ['só uma'] }))
    expect(devolverReprovadas(d, [v])).toBe(1)
    expect(existsSync(join(d.saida, '1.json'))).toBe(false)
    expect(pendentes(d)).toEqual([1])
    expect(readFileSync(d.rejeitados, 'utf8')).toMatch(/perguntas = 1/)
  })

  it('aprovada não é mexida: nem apaga a saída, nem solta a trava', () => {
    travar(d, 1)
    const v = julgar(material())
    expect(devolverReprovadas(d, [v])).toBe(0)
    expect(existsSync(join(d.saida, '1.json'))).toBe(true)
    expect(existsSync(join(d.travas, '1'))).toBe(true)
  })
})

describe('portão — o sobrescrito é texto bíblico', () => {
  let base: string
  let d: Dirs

  const TEXTO = 'Capítulo 3\n1 SENHOR, como se multiplicam os meus adversários!'
  const SOBRESCRITO = 'Salmo de Davi, quando ele fugia da presença de seu filho Absalão'

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(
      join(d.entrada, '1.json'),
      JSON.stringify(
        montarEntrada(bruta({ ordem: 1, abbrev: 'Sl', texto: TEXTO, sobrescrito: SOBRESCRITO })),
      ),
    )
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('citar a epígrafe do salmo não é citação inventada — ela só é exibida à parte', () => {
    const ctx =
      `A inscrição diz "${SOBRESCRITO}". ` +
      'Multiplicam adversários SENHOR Davi Absalão presença fugia filho. '.repeat(4)
    writeFileSync(
      join(d.saida, '1.json'),
      JSON.stringify({
        ordem: 1,
        titulo_pericope_pt: 'Dormir no meio do golpe',
        contexto_historico_literario: ctx,
        resenha:
          'Adversários que se multiplicam contra Davi enquanto ele foge de Absalão. '.repeat(5) +
          '\n\n- Selá é uma marca musical antiga cujo sentido exato se perdeu.' +
          '\n- Escudo, aqui, é a proteção que cobre o corpo inteiro em combate.',
        perguntas_reflexao: ['p1', 'p2'],
        topicos_pregar:
          'Linha de raciocínio\n- a **um**\n- b **dois**\n- c **três**\n- d **quatro**\n- e **cinco**\n\nMensagens a levar\n- f **seis**\n- g **sete**\n- h **oito**\n- i **nove**',
      }),
    )
    const v = conferirSaidas(d, [1])[0]
    expect(v.problemas).toEqual([])
    expect(v.avisos).toEqual([])
  })
})

describe('portão — parágrafo que a leitura descartaria em silêncio', () => {
  let base: string
  let d: Dirs

  const TEXTO =
    'Capítulo 1\n1 No princípio criou Deus os céus e a terra.\n2 E a terra estava desordenada e vazia, e as trevas estavam sobre a face do abismo.'
  // Enchimento DIFERENTE por campo: repetir o mesmo texto nos dois dispara,
  // com razão, a checagem de repetição entre contexto e resenha.
  const C = 'Princípio criou Deus céus terra desordenada vazia abismo. '.repeat(3)
  const R = 'Trevas movia águas separou luz chamou tarde manhã dia. '.repeat(3)

  const material = (contexto: string, resenha: string) => ({
    ordem: 1,
    titulo_pericope_pt: 'A criação',
    contexto_historico_literario: contexto,
    resenha,
    perguntas_reflexao: ['p1', 'p2'],
    topicos_pregar:
      'Linha de raciocínio\n- a **um**\n- b **dois**\n- c **três**\n- d **quatro**\n- e **cinco**\n\nMensagens a levar\n- f **seis**\n- g **sete**\n- h **oito**\n- i **nove**',
  })

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(
      join(d.entrada, '1.json'),
      JSON.stringify(montarEntrada(bruta({ ordem: 1, texto: TEXTO }))),
    )
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const julgar = (c: string, r: string) => {
    writeFileSync(join(d.saida, '1.json'), JSON.stringify(material(c, r)))
    return conferirSaidas(d, [1])[0]
  }

  it('aceita a resenha com o quarto parágrafo — o das palavras do trecho', () => {
    expect(julgar([C, C].join('\n\n'), [R, R, R, LISTA_OK].join('\n\n')).problemas).toEqual([])
  })

  it('reprova o quinto parágrafo da resenha, que nunca chegaria à tela nem ao áudio', () => {
    const v = julgar([C, C].join('\n\n'), [R, R, R, R, LISTA_OK].join('\n\n'))
    expect(v.problemas.join(' ')).toMatch(/resenha com 5 parágrafos/)
  })

  it('reprova o terceiro parágrafo do contexto pelo mesmo motivo', () => {
    const v = julgar([C, C, C].join('\n\n'), [R, R, LISTA_OK].join('\n\n'))
    expect(v.problemas.join(' ')).toMatch(/contexto com 3 parágrafos/)
  })
})

describe('portão — repetição entre campos da cadeia', () => {
  let base: string
  let d: Dirs

  const TEXTO =
    'Capítulo 3\n1 SENHOR, como se multiplicam meus adversários! Muitos se levantam contra mim.\n2 Muitos dizem de minha alma: Não há salvação para ele em Deus.'
  const ENCHE_C = 'Adversários levantam multiplicam salvação alma SENHOR trono fuga. '
  const ENCHE_R = 'Muitos dizem contra ele naquela noite escura de Jerusalém antiga. '

  const material = (contexto: string, resenha: string) => ({
    ordem: 1,
    titulo_pericope_pt: 'Dormir no meio do golpe',
    contexto_historico_literario: contexto,
    resenha,
    perguntas_reflexao: ['p1', 'p2'],
    topicos_pregar:
      'Linha de raciocínio\n- a **um**\n- b **dois**\n- c **três**\n- d **quatro**\n- e **cinco**\n\nMensagens a levar\n- f **seis**\n- g **sete**\n- h **oito**\n- i **nove**',
  })

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(
      join(d.entrada, '1.json'),
      JSON.stringify(montarEntrada(bruta({ ordem: 1, abbrev: 'Sl', texto: TEXTO }))),
    )
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const julgar = (c: string, r: string) => {
    writeFileSync(join(d.saida, '1.json'), JSON.stringify(material(c, r)))
    return conferirSaidas(d, [1])[0]
  }

  it('reprova quando a resenha repete uma frase inteira do contexto', () => {
    const frase =
      'Absalão era o filho de Davi que tomou o trono do pai e o obrigou a fugir de Jerusalém a pé.'
    const v = julgar(
      frase + ' ' + ENCHE_C.repeat(3),
      ENCHE_R.repeat(3) + ' ' + frase + ' ' + ENCHE_R.repeat(2) + '\n\n' + LISTA_OK,
    )
    expect(v.ok).toBe(false)
    expect(v.problemas.join(' ')).toMatch(/resenha repete o contexto/)
  })

  it('não reprova quando os dois citam o MESMO versículo — Escritura repete de direito', () => {
    const citacao = '"Muitos dizem de minha alma: Não há salvação para ele em Deus"'
    const v = julgar(
      ENCHE_C.repeat(3) + ' O salmo abre assim: ' + citacao + '.',
      ENCHE_R.repeat(3) + ' A acusação volta: ' + citacao + '. ' + ENCHE_R.repeat(2) + '\n\n' + LISTA_OK,
    )
    expect(v.problemas).toEqual([])
  })

  it('não reprova coincidência curta de vocabulário', () => {
    const v = julgar(
      'Davi foge de Jerusalém enquanto os adversários se multiplicam. ' + ENCHE_C.repeat(3),
      'Os adversários se multiplicam, e o salmo conta como ele dormiu. ' +
        ENCHE_R.repeat(3) +
        '\n\n' +
        LISTA_OK,
    )
    expect(v.problemas).toEqual([])
  })
})

describe('portão — a lista de palavras que fecha a resenha', () => {
  let base: string
  let d: Dirs

  const TEXTO =
    'Capítulo 1\n1 No princípio criou Deus os céus e a terra.\n2 E a terra estava desordenada e vazia, e as trevas estavam sobre a face do abismo.'
  const C = 'Princípio criou Deus céus terra desordenada abismo vazio. '.repeat(4)
  const R = 'Trevas movia águas separou luz chamou tarde manhã dia. '.repeat(4)
  const LISTA = [
    '- Abismo, aqui, é a massa de água sem fundo que cobria tudo antes da luz.',
    '- Desordenada e vazia traduz duas palavras que descrevem terreno sem forma e sem ninguém.',
  ].join('\n')

  const material = (resenha: string) => ({
    ordem: 1,
    titulo_pericope_pt: 'A criação',
    contexto_historico_literario: C,
    resenha,
    perguntas_reflexao: ['p1', 'p2'],
    topicos_pregar:
      'Linha de raciocínio\n- a **um**\n- b **dois**\n- c **três**\n- d **quatro**\n- e **cinco**\n\nMensagens a levar\n- f **seis**\n- g **sete**\n- h **oito**\n- i **nove**',
  })

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(
      join(d.entrada, '1.json'),
      JSON.stringify(montarEntrada(bruta({ ordem: 1, texto: TEXTO }))),
    )
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const julgar = (resenha: string) => {
    writeFileSync(join(d.saida, '1.json'), JSON.stringify(material(resenha)))
    return conferirSaidas(d, [1])[0]
  }

  it('aprova a resenha que fecha com a lista', () => {
    expect(julgar([R, R, R, LISTA].join('\n\n')).problemas).toEqual([])
  })

  it('reprova quando as palavras vêm emendadas em prosa — era o pedido do dono', () => {
    const emendado =
      'Duas palavras do trecho: abismo é a massa de água sem fundo; desordenada e vazia descreve terreno sem forma.'
    const v = julgar([R, R, R, emendado].join('\n\n'))
    expect(v.problemas.join(' ')).toMatch(/resenha não fecha com a lista/)
  })

  it('reprova quando a lista tem um item só — não vale gastar um parágrafo com um', () => {
    const v = julgar([R, R, R, '- Abismo é a massa de água sem fundo que cobria tudo.'].join('\n\n'))
    expect(v.problemas.join(' ')).toMatch(/1 item/)
  })

  it('reprova mais de 4 itens', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => `- Palavra número ${i} explicada numa frase inteira.`).join('\n')
    const v = julgar([R, R, R, cinco].join('\n\n'))
    expect(v.problemas.join(' ')).toMatch(/5 itens/)
  })

  it('reprova item que é verbete e não frase — sem ponto final', () => {
    const verbete = ['- Abismo: massa de água sem fundo', '- Trevas: escuridão total'].join('\n')
    const v = julgar([R, R, R, verbete].join('\n\n'))
    expect(v.problemas.join(' ')).toMatch(/não termina em frase/)
  })
})

describe('portão — perícope curta não pode ser reprovada por ser curta', () => {
  let base: string
  let d: Dirs

  /** Monta uma resenha válida: 3 parágrafos de prosa + a lista das palavras. */
  const resenhaCom = (p1: string, p2: string, p3: string, itens: string[]) =>
    [p1, p2, p3, itens.map((i) => `- ${i}`).join('\n')].join('\n\n')

  const TOPICOS =
    'Linha de raciocínio\n- a **um**\n- b **dois**\n- c **três**\n- d **quatro**\n- e **cinco**\n\nMensagens a levar\n- f **seis**\n- g **sete**\n- h **oito**\n- i **nove**'

  const material = (contexto: string, resenha: string) => ({
    ordem: 1,
    titulo_pericope_pt: 'Um título digno',
    contexto_historico_literario: contexto,
    resenha,
    perguntas_reflexao: ['p1', 'p2'],
    topicos_pregar: TOPICOS,
  })

  const semear = (texto: string) => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(
      join(d.entrada, '1.json'),
      JSON.stringify(montarEntrada(bruta({ ordem: 1, texto }))),
    )
  }
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const julgar = (m: unknown) => {
    writeFileSync(join(d.saida, '1.json'), JSON.stringify(m))
    return conferirSaidas(d, [1])[0]
  }

  it('aprova a perícope de um versículo — o texto dela não TEM 5 palavras para dividir', () => {
    // 1Sm 25:1 inteiro: oito palavras de conteúdo no texto todo.
    semear(
      'Capítulo 25\n1 E morreu Samuel, e juntou-se todo Israel, e o choraram, e o sepultaram em sua casa em Ramá. E levantou-se Davi, e se foi ao deserto de Parã.',
    )
    const v = julgar(
      material(
        'Samuel foi o último juiz de Israel e o profeta por quem a palavra chegava ao povo e ao palácio. A morte dele cabe num versículo só, encaixado entre dois capítulos em que Davi decide sozinho o que fazer com quem lhe fez mal. Quem tinha autoridade para corrigir o rei acabou de sair de cena.',
        resenhaCom(
          'A frase tem quatro verbos para Samuel e um só para Davi: Israel se junta, chora e sepulta.',
          'O último verbo vira as costas para o funeral e desce para o deserto, longe de todos.',
          'Uma frase curta tira duas coisas do lugar: o povo perde o profeta e o rei perde quem ouvia.',
          [
            'Ramá era a cidade dele, e foi de lá que julgou o povo durante anos.',
            'Sepultar em sua casa quer dizer enterrar no terreno da própria família.',
          ],
        ),
      ),
    )
    expect(v.problemas).toEqual([])
  })

  it('a perícope mais curta do catálogo tem 4 palavras de conteúdo, e ainda assim é aprovável', () => {
    semear('Capítulo 1\n1 Palavras do Pregador, filho de Davi, rei em Jerusalém.')
    const v = julgar(
      material(
        'O livro abre com uma credencial em vez de um argumento: quem fala se apresenta pelo cargo e pela linhagem antes de dizer qualquer coisa sobre a vida. Guardar isso ajuda, porque o resto do livro vai passar páginas desmontando exatamente o que essa apresentação promete.',
        resenhaCom(
          'O Pregador abre dizendo apenas quem é, e nada mais do que isso.',
          'Um título assim carrega autoridade e distância ao mesmo tempo, e o resto do livro vive de contestá-lo.',
          'A frase inteira é uma apresentação, e ela prepara a queda que vem em seguida.',
          [
            'Pregador traduz a palavra de quem fala diante de uma assembleia reunida.',
            'Jerusalém era onde o rei julgava, e não apenas onde ele morava.',
          ],
        ),
      ),
    )
    expect(v.problemas).toEqual([])
  })

  it('mas material realmente genérico continua reprovando, mesmo em trecho curto', () => {
    semear('Capítulo 25\n1 E morreu Samuel, e juntou-se todo Israel, e o choraram em Ramá.')
    const v = julgar(
      material(
        'Considerações amplas sobre assuntos inteiramente alheios ao que vem depois destas linhas soltas, seguidas de outras ponderações igualmente distantes de qualquer coisa concreta que alguém pudesse encontrar adiante lendo com atenção.',
        resenhaCom(
          'Reflexões genéricas sobre temas distantes daquilo que a passagem trata.',
          'Outras considerações igualmente desligadas do parágrafo anterior e do seguinte.',
          'Mais frases vagas que caberiam praticamente em qualquer passagem escrita.',
          [
            'Alguma explicação inventada que não corresponde a nada do trecho.',
            'Outra explicação igualmente desligada daquilo que a passagem afirma.',
          ],
        ),
      ),
    )
    expect(v.problemas.join(' ')).toMatch(/palavras em comum/)
  })
})

describe('portão — referência em convenção bibliográfica é conhecimento tácito', () => {
  let base: string
  let d: Dirs

  const TEXTO =
    'Capítulo 1\n1 No princípio criou Deus os céus e a terra.\n2 E a terra estava desordenada e vazia, e as trevas estavam sobre a face do abismo.'
  // Frases distintas por seção: repetir o mesmo enchimento dispara, com razão,
  // a checagem de repetição entre contexto e resenha.
  const C = (n: number) =>
    `Parágrafo ${n} do contexto: o princípio, o abismo coberto e a terra ainda vazia antes de qualquer luz aparecer sobre ela.`
  const P = (n: number) =>
    `Trecho ${n} da resenha: as trevas cobriam tudo, e o Espírito se movia sobre as águas enquanto nada tinha forma.`
  const LISTA = ['- Abismo é a massa de água sem fundo que cobria tudo.', '- Trevas é a escuridão completa antes da luz.'].join('\n')

  const material = (contexto: string, resenha: string) => ({
    ordem: 1,
    titulo_pericope_pt: 'A criação',
    contexto_historico_literario: contexto,
    resenha,
    perguntas_reflexao: ['p1', 'p2'],
    topicos_pregar:
      'Linha de raciocínio\n- a **um**\n- b **dois**\n- c **três**\n- d **quatro**\n- e **cinco**\n\nMensagens a levar\n- f **seis**\n- g **sete**\n- h **oito**\n- i **nove**',
  })

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reenriq-'))
    d = dirs(base)
    criarDirs(d)
    writeFileSync(join(d.entrada, '1.json'), JSON.stringify(montarEntrada(bruta({ ordem: 1, texto: TEXTO }))))
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const julgar = (contexto: string, resenha: string) => {
    writeFileSync(join(d.saida, '1.json'), JSON.stringify(material(contexto, resenha)))
    return conferirSaidas(d, [1])[0]
  }

  const ctxOk = [C(1), C(2)].join('\n\n')
  const resOk = [P(3), P(4), P(5), LISTA].join('\n\n')

  it('aprova o material que não usa a convenção', () => {
    expect(julgar(ctxOk, resOk).problemas).toEqual([])
  })

  it('reprova "2 Reis 14" — a voz lê "dois Reis" e o leitor precisa saber a convenção', () => {
    const v = julgar([C(1), 'Como conta 2 Reis 14, o profeta veio de Gate-Hefer.'].join('\n\n'), resOk)
    expect(v.problemas.join(' ')).toMatch(/2 Reis/)
  })

  it('reprova nas duas seções, contexto e resenha', () => {
    expect(julgar([C(1), 'Ver 1 Samuel aqui neste ponto da leitura.'].join('\n\n'), resOk).ok).toBe(false)
    expect(julgar(ctxOk, [P(3), 'Ver 1 Coríntios aqui.', P(5), LISTA].join('\n\n')).ok).toBe(false)
  })

  it('reprova capítulo:versículo, que a voz pode ler como hora', () => {
    const v = julgar([C(1), 'A frase aparece em 8:15 e volta depois, no fim.'].join('\n\n'), resOk)
    expect(v.problemas.join(' ')).toMatch(/8:15/)
  })

  it('reprova algarismo romano depois de nome, que a voz lê como cardinal', () => {
    const v = julgar([C(1), 'Foi quando Jeroboão II assumiu o trono do norte.'].join('\n\n'), resOk)
    expect(v.problemas.join(' ')).toMatch(/Jeroboão II/)
  })

  it('aceita a forma por extenso, que serve à tela e à voz', () => {
    const bom = [C(1), 'Como conta o segundo livro dos Reis, o profeta veio de Gate-Hefer, e isso muda a leitura da cena inteira.'].join('\n\n')
    expect(julgar(bom, resOk).problemas).toEqual([])
  })

  it('não confunde numeral que não é referência de livro', () => {
    const v = julgar([C(1), 'Foram 2 homens, e o segundo trouxe 3 cordeiros para o altar naquela mesma manhã de festa.'].join('\n\n'), resOk)
    expect(v.problemas).toEqual([])
  })
})
