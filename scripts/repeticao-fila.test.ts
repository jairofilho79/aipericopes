import { describe, expect, it } from 'vitest'
import { aplicarVeredito, trechoRepetido } from './repeticao-fila.ts'

/** Material mínimo que passa no portão do `validar-material`, para os testes
 *  poderem falar só do que ESTA fila decide. */
const CTX =
  'Otniel é o primeiro juiz do livro, e a história dele é a mais curta e a mais limpa de todas: sem diálogo, sem cena e sem defeito. O narrador conta assim de propósito, porque está montando aqui a forma que vai repetir muitas vezes adiante, e quer que o leitor a reconheça depois sem precisar de aviso nenhum.'
const RES =
  'A cena tem cinco passos, e vale contá-los devagar. O opressor vem da Mesopotâmia, ou seja, de bem longe, muito além dos vizinhos de Canaã, e o povo levou oito anos debaixo dele antes de gritar por socorro. A conta final é desproporcional de propósito: oito anos de domínio dão em quarenta anos de descanso, e o trecho termina do jeito mais seco possível.\n\n- Otniel é o irmão menor de Calebe, e o texto o apresenta pela família antes de dizer qualquer outra coisa.\n- Julgar Israel, aqui, é arrumar o povo por dentro, e vem antes de sair à batalha contra quem está fora.'

const base = () => ({
  ordem: 1,
  titulo_pericope_pt: 'Otniel, o primeiro libertador',
  contexto_historico_literario: CTX,
  resenha: RES,
  perguntas_reflexao: ['E você?', 'E agora?'],
  topicos_pregar:
    'Linha de raciocínio\n- **um**\n- **dois**\n- **três**\n- **quatro**\n- **cinco**\n\nMensagens a levar\n- **seis**\n- **sete**\n- **oito**\n- **nove**',
})
const entrada = {
  texto: 'Otniel filho de Quenaz irmão menor de Calebe julgou Israel e saiu à batalha contra o rei da Mesopotâmia e a terra descansou quarenta anos e Otniel morreu',
}

describe('trechoRepetido', () => {
  it('devolve o trecho literal que os dois campos compartilham', () => {
    expect(trechoRepetido('o povo grita por socorro e Deus levanta alguém', 'antes: o povo grita por socorro e Deus levanta um libertador')).toBe(
      'o povo grita por socorro e Deus levanta',
    )
  })

  it('ignora o que está entre aspas, porque Escritura repetida é legítima', () => {
    // As duas frases só compartilham a citação; sem `semAspas` isto acusaria.
    expect(
      trechoRepetido('Ele diz "o espírito do SENHOR foi sobre ele" antes de agir', 'A frase "o espírito do SENHOR foi sobre ele" abre a cena'),
    ).not.toContain('espírito')
  })
})

describe('aplicarVeredito', () => {
  it('aceita o conserto que tira a duplicata e mantém a explicação', () => {
    const p = base() as Record<string, unknown>
    p.contexto_historico_literario = `${CTX} A cena tem cinco passos, e vale contá-los devagar.`
    aplicarVeredito(
      p,
      {
        ordem: 1,
        campo: 'contexto_historico_literario',
        novo: CTX,
      },
      entrada,
    )
    expect(String(p.contexto_historico_literario)).toBe(CTX)
  })

  it('recusa quando a repetição continua lá', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarVeredito(
        p,
        {
          ordem: 1,
          campo: 'contexto_historico_literario',
          novo: `${CTX} Aqui o opressor vem da Mesopotâmia, ou seja, de bem longe, muito além dos vizinhos de Canaã.`,
        },
        entrada,
      ),
    ).toThrow(/ainda repete/)
  })

  it('recusa esvaziar o campo — é a saída preguiçosa', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarVeredito(p, { ordem: 1, campo: 'contexto_historico_literario', novo: 'Otniel julga.' }, entrada),
    ).toThrow(/encolheu/)
  })

  it('recusa quando o conserto traz de volta a frase que anuncia e não paga', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarVeredito(
        p,
        {
          ordem: 1,
          campo: 'contexto_historico_literario',
  novo: `${CTX} Repare em duas coisas ao ler.`,
        },
        entrada,
      ),
    ).toThrow(/anuncia e não paga/)
  })

  it('recusa a convenção que o TTS lê errado, porque o campo é o mesmo na tela e no áudio', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarVeredito(
        p,
        {
          ordem: 1,
          campo: 'contexto_historico_literario',
          novo: `${CTX} O livro conta isso logo depois de 1 Reis, bem depressa.`,
        },
        entrada,
      ),
    ).toThrow(/escreva por extenso/)
  })

  it('recusa o campo devolvido igual', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarVeredito(
        p,
        { ordem: 1, campo: 'contexto_historico_literario', novo: String(p.contexto_historico_literario) },
        entrada,
      ),
    ).toThrow(/voltou igual/)
  })
})
