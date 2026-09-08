import { describe, expect, it } from 'vitest'
import { validarMaterial } from './validar-material.ts'

describe('apontar para a forma da letra', () => {
  const base = {
    ordem: 1,
    titulo_pericope_pt: 'A vara que virou serpente',
    contexto_historico_literario:
      'Moisés está o mais longe possível do palácio onde cresceu, cuidando das ovelhas do sogro, e o trabalho o leva para o lado de lá do deserto. Quem lê precisa saber que aquele monte já é chamado de monte de Deus antes de qualquer coisa acontecer ali.',
    resenha:
      'O fogo chama a atenção porque não gasta o arbusto, e Moisés desvia do caminho para entender. Só então Deus fala com ele, e o primeiro aviso é sobre distância: tirar os calçados, porque aquele chão ficou santo por causa de quem está ali, e não por ser um monte especial.\n\n- Uma sarça é um arbusto baixo e cheio de espinhos, do tipo que seca no deserto.\n- Horebe é o nome que este livro dá ao monte onde a cena acontece.',
    perguntas_reflexao: ['E você?', 'E agora?'],
    topicos_pregar:
      'Linha de raciocínio\n- **um**\n- **dois**\n- **três**\n- **quatro**\n- **cinco**\n\nMensagens a levar\n- **seis**\n- **sete**\n- **oito**\n- **nove**',
  }
  const entrada = {
    texto:
      'e apareceu-lhe o anjo do SENHOR em uma chama de fogo no meio de uma sarça e ele olhou e eis que a sarça ardia em fogo e a sarça não se consumia e Moisés disse me virarei e verei esta grande visão porque a sarça não se queima e chamou Deus do meio da sarça e disse tira teus calçados de teus pés porque o lugar em que tu estás terra santa é e disse eu sou o Deus de teu pai Deus de Abraão Deus de Isaque e Deus de Jacó em Horebe monte de Deus',
  }

  it('reprova a caixa alta apontada na tela, que o ouvinte não vê', () => {
    const m = { ...base, resenha: base.resenha.replace('Só então', 'A resposta vem em letras maiúsculas, e só então') }
    expect(validarMaterial(entrada, m, JSON.stringify(m)).problemas.join(' ')).toMatch(
      /forma da letra/,
    )
  })

  it('reprova "na tela", porque este app tem uma e o leitor está olhando para ela', () => {
    const m = { ...base, topicos_pregar: base.topicos_pregar.replace('**nove**', '**nove** que não se completa na tela') }
    expect(validarMaterial(entrada, m, JSON.stringify(m)).problemas.join(' ')).toMatch(
      /forma da letra/,
    )
  })

  it('deixa passar o colchete que é gancho de metal, e o aparte entre parênteses', () => {
    // A varredura larga achou 63 e 55 eram legítimos como estes dois. O portão
    // estreito existe para não trocar um falso negativo por 55 falsos positivos.
    const m = {
      ...base,
      resenha: base.resenha.replace(
        'Só então',
        'Os colchetes de ouro prendem uma cortina na outra, e o narrador conta isso entre parênteses. Só então',
      ),
    }
    expect(validarMaterial(entrada, m, JSON.stringify(m)).problemas).toEqual([])
  })
})
