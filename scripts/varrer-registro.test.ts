import { describe, it, expect } from 'vitest'
import { ABSOLVIDAS, varrer } from './varrer-registro.ts'

const material = (extra: Record<string, unknown>) => ({
  ordem: 1,
  titulo_pericope_pt: 'Um título digno',
  contexto_historico_literario: 'Prosa em registro correto sobre a passagem.',
  resenha: 'Prosa em registro correto sobre a passagem.',
  perguntas_reflexao: ['Uma pergunta.', 'Outra pergunta.'],
  topicos_pregar: 'Linha de raciocínio\n- a **um**',
  ...extra,
})

describe('varrer', () => {
  it('não acha nada em material bem escrito', () => {
    expect(varrer(material({}))).toEqual([])
  })

  it('pega o animal do sacrifício reduzido a "bicho" — caso real de Levítico 1', () => {
    const r = varrer(material({ resenha: 'Ela mesma põe a mão na cabeça do bicho.' }))
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toMatch(/bicho/)
    expect(r[0].campo).toBe('resenha')
  })

  it('pega as quatro construções que um subagent corrigiu sozinho', () => {
    for (const frase of [
      'o bicho do mato que fugia',
      'o texto não maquia o custo do erro',
      'não se trata de chutar um culpado',
      'e ali ele descontou a mão no servo',
    ]) {
      expect(varrer(material({ resenha: frase })).length).toBeGreaterThan(0)
    }
  })

  it('varre também o título e as perguntas, não só a prosa', () => {
    expect(varrer(material({ titulo_pericope_pt: 'A treta de Caim' }))[0].campo).toBe('titulo_pericope_pt')
    expect(varrer(material({ perguntas_reflexao: ['Você já deu um jeito assim?', 'E daí?'] }))[0].campo).toBe(
      'perguntas_reflexao',
    )
  })

  it('devolve o trecho em volta, para dar para julgar sem abrir o arquivo', () => {
    const r = varrer(material({ resenha: 'Antes disso tudo, ele resolveu calar a boca do acusador ali.' }))
    expect(r[0].trecho).toContain('calar a boca')
    expect(r[0].trecho).toContain('acusador')
  })

  it('não confunde gíria com o texto bíblico: "de boa farinha" e "boa velhice" passam', () => {
    expect(varrer(material({ resenha: 'Manda preparar três medidas de boa farinha para os visitantes.' }))).toEqual([])
    expect(varrer(material({ resenha: 'O texto chama isso de boa velhice, e não de sobrevida.' }))).toEqual([])
  })

  it('mas pega "de boa" quando é gíria mesmo — fechando a oração', () => {
    expect(varrer(material({ resenha: 'Ele seguiu de boa, sem pensar duas vezes.' })).length).toBe(1)
  })

  it('a lista cresce com a produção: as quatro que a rodada 3 revelou', () => {
    for (const frase of [
      'o detalhe passou batido para quem lê rápido',
      'o texto fala do bolso antes de falar do coração',
      'a cena termina sem graça, como quem desiste',
      'ali ele falhou feio diante do povo',
    ]) {
      expect(varrer(material({ resenha: frase })).length).toBeGreaterThan(0)
    }
  })

  it('e as duas que a rodada 4 revelou', () => {
    expect(varrer(material({ resenha: 'É assim que a gente lê o capítulo hoje.' })).length).toBe(1)
    // Casa duas vezes de propósito: "tem essa cara" e "cara de" são padrões
    // distintos, e a frase tem os dois.
    expect(varrer(material({ resenha: 'O trecho tem essa cara de lista, mas não é.' })).length).toBe(2)
  })

  it('acha mais de uma suspeita no mesmo campo', () => {
    expect(varrer(material({ resenha: 'A galera fez uma treta e ninguém deu um jeito.' })).length).toBeGreaterThanOrEqual(2)
  })
})

describe('o que a varredura NÃO pode marcar', () => {
  // Terceira vez que a varredura marca Escritura como gíria: "de boa vontade"
  // (Mc 12:37), "três medidas de boa farinha" (Gn 18) e agora "Estás doido"
  // (Ec 2:2). O conserto por caso não escala — a citação inteira sai da varredura.
  it('não marca nada dentro de aspas, porque ali é o texto bíblico falando', () => {
    for (const frase of [
      'Ele descarta rápido: "Eu disse ao riso: Estás doido".',
      'A multidão o ouvia “de boa vontade”, diz o texto.',
      'A visita traz "três medidas de boa farinha" para os hóspedes.',
    ]) {
      expect(varrer(material({ resenha: frase }))).toEqual([])
    }
  })

  it('não marca "a gente" quando gente é substantivo, e marca quando é "nós"', () => {
    for (const noun of [
      'a mensagem chega a gente que jamais entraria numa reunião cristã',
      'a gente de lá falava com um sotaque diferente',
      'o povo da terra é a gente comum de Judá, fora do palácio',
      'se a cidade tem gente boa dentro, a gente boa segura a sentença',
    ]) {
      expect(varrer(material({ resenha: noun }))).toEqual([])
    }
    for (const pronome of [
      'termina onde a gente para de falar',
      'as passagens que a gente toma quando quer encurtar',
    ]) {
      expect(varrer(material({ resenha: pronome })).map((s) => s.motivo)).toContain(
        '"a gente" no lugar de "nós"',
      )
    }
  })

  it('não marca "piada" quando o material está justamente negando o humor', () => {
    for (const frase of [
      'Zombador, aqui, não é quem faz piada: é quem já decidiu que nada tem valor.',
      'O texto o descreve com respeito, sem piada e sem desespero.',
      'Ciúme aparece aqui com peso, e não como piada.',
    ]) {
      expect(varrer(material({ resenha: frase }))).toEqual([])
    }
    expect(varrer(material({ resenha: 'A agressão vem primeiro e a piada vem depois.' }))).toHaveLength(1)
  })

  it('não marca "de boa" depois de verbo de nomear', () => {
    expect(varrer(material({ resenha: 'É a morte que um israelita chamaria de boa.' }))).toEqual([])
    expect(varrer(material({ resenha: 'O profeta ficou de boa.' }))).toHaveLength(1)
  })
})

describe('ABSOLVIDAS', () => {
  it('cala a marca no par perícope+campo já julgado', () => {
    const absolvida = [...ABSOLVIDAS][0]
    const [ordem, campo] = absolvida.split(':')
    const material = { ordem: Number(ordem), [campo]: 'isso tem cara de coisa' }
    expect(varrer(material)).toEqual([])
  })

  it('não cala a mesma marca noutra perícope', () => {
    const [, campo] = [...ABSOLVIDAS][0].split(':')
    expect(varrer({ ordem: 999999, [campo]: 'isso tem cara de coisa' }).length).toBeGreaterThan(0)
  })
})
