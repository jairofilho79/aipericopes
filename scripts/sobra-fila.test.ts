import { describe, expect, it } from 'vitest'
import { aplicarSobra } from './sobra-fila.ts'

const CTX =
  'Nobe era a cidade onde a arca esteve depois de Siló, e é ali que os sacerdotes de Israel moravam quando esta cena acontece. Quem lê precisa saber que Doegue, o edomita, não era israelita, e que servir ao rei estrangeiro não o obrigava a nada diante do santuário.'
const RES = `A cena tem dois tempos. Primeiro o rei pergunta, sentado debaixo da árvore com a lança na mão; depois manda matar, e quem obedece é o estrangeiro. O número que o texto dá é oitenta e cinco, e ele não é arredondado por acaso.

O relato não comenta o que fez. Ele conta e segue, e é o silêncio que pesa: ninguém em Israel levanta a voz, e a cidade dos sacerdotes some do livro a partir daqui, sem epitáfio nenhum.

- Éfode é uma peça de roupa presa ao corpo, ligada ao serviço diante de Deus.
- Nobe é a cidade dos sacerdotes, e some do relato depois deste episódio.`

const base = () => ({
  ordem: 1,
  titulo_pericope_pt: 'Doegue e os sacerdotes de Nobe',
  contexto_historico_literario: CTX,
  resenha: RES,
  perguntas_reflexao: ['E você?', 'E agora?'],
  topicos_pregar:
    'Linha de raciocínio\n- **um**\n- **dois**\n- **três**\n- **quatro**\n- **cinco**\n\nMensagens a levar\n- **seis**\n- **sete**\n- **oito**\n- **nove**',
})
const entrada = {
  texto:
    'E Saul estava em Gibeá debaixo de um arvoredo com sua lança na mão e Doegue o edomita matou naquele dia oitenta e cinco homens que vestiam éfode de linho e a Nobe cidade dos sacerdotes passou ao fio da espada e escapou um dos filhos de Aimeleque cujo nome era Abiatar e fugiu para Davi',
}

describe('aplicarSobra', () => {
  it('aceita a frase acrescentada dentro do parágrafo que já existia', () => {
    const p = base() as Record<string, unknown>
    aplicarSobra(
      p,
      {
        ordem: 1,
        campo: 'resenha',
        novo: RES.replace(
          'sem epitáfio nenhum.',
          'sem epitáfio nenhum. Um escapa: Abiatar, filho de Aimeleque, foge e chega até Davi.',
        ),
        apoio: '"escapou um dos filhos de Aimeleque cujo nome era Abiatar" — o texto da perícope',
      },
      entrada,
    )
    expect(String(p.resenha)).toContain('Abiatar')
  })

  it('recusa o parágrafo a mais, porque a leitura descarta o que passa do teto', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarSobra(
        p,
        {
          ordem: 1,
          campo: 'resenha',
          novo: `${RES}\n\n- Abiatar é o filho de Aimeleque que escapa e chega a Davi.`,
          apoio: '"escapou um dos filhos de Aimeleque cujo nome era Abiatar" — o texto',
        },
        entrada,
      ),
    ).toThrow(/parágrafos/)
  })

  it('recusa o apoio que cita o que não está no texto — é aqui que a invenção nasce', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarSobra(
        p,
        {
          ordem: 1,
          campo: 'resenha',
          novo: RES.replace(
            'sem epitáfio nenhum.',
            'sem epitáfio nenhum. Um escapa: Abiatar foge levando a arca consigo.',
          ),
          apoio: '"e levou consigo a arca de Deus" — o texto da perícope',
        },
        entrada,
      ),
    ).toThrow(/não está no texto desta perícope/)
  })

  it('recusa acrescentar sem apoio nenhum', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarSobra(
        p,
        { ordem: 1, campo: 'resenha', novo: `${RES} Um escapa e foge para Davi.`, apoio: '' },
        entrada,
      ),
    ).toThrow(/sem apoio/)
  })

  it('recusa o campo que inchou — cobrir a sobra é apertar o frouxo', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarSobra(
        p,
        {
          ordem: 1,
          campo: 'resenha',
          novo: RES.replace(
            'sem epitáfio nenhum.',
            `sem epitáfio nenhum. ${'Um escapa: Abiatar, filho de Aimeleque, foge e chega até Davi. '.repeat(6)}`,
          ),
          apoio: '"escapou um dos filhos de Aimeleque cujo nome era Abiatar" — o texto',
        },
        entrada,
      ),
    ).toThrow(/cresceu/)
  })

  it('recusa encolher, porque sobra não se cobre cortando', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarSobra(
        p,
        {
          ordem: 1,
          campo: 'resenha',
          novo: RES.replace('O relato não comenta o que fez. Ele conta e segue, e é o silêncio que pesa: ninguém em Israel levanta a voz, e a cidade dos sacerdotes some do livro a partir daqui, sem epitáfio nenhum.', 'Abiatar escapa.'),
          apoio: '"escapou um dos filhos de Aimeleque cujo nome era Abiatar" — o texto',
        },
        entrada,
      ),
    ).toThrow(/encolheu/)
  })
})
