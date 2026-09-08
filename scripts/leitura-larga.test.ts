import { describe, expect, it } from 'vitest'
import { aplicarLeitura } from './leitura-larga.ts'

const CTX =
  'Nobe era a cidade onde a arca esteve depois de Siló, e é ali que os sacerdotes de Israel moravam quando esta cena acontece. Quem lê precisa saber que Doegue, o edomita, não era israelita, e que servir ao rei estrangeiro não o obrigava a nada diante do santuário.'
const ERRADA = 'A cena acontece numa sala, porque assim se fazia.'
const RES = `A cena tem dois tempos. Primeiro o rei pergunta, sentado debaixo da árvore com a lança na mão; depois manda matar, e quem obedece é o estrangeiro. ${ERRADA} O número que o texto dá é oitenta e cinco, e ele não é arredondado por acaso.

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
    'E Saul estava em Gibeá debaixo de um arvoredo com sua lança na mão e Doegue o edomita matou naquele dia oitenta e cinco homens que vestiam éfode de linho e a Nobe cidade dos sacerdotes passou ao fio da espada',
}

describe('aplicarLeitura', () => {
  it('corta a causa inventada e limpa o espaço que o corte deixa', () => {
    const p = base() as Record<string, unknown>
    const r = aplicarLeitura(
      p,
      { ordem: 1, achados: [{ campo: 'resenha', tipo: 'nao-sustenta', frase: ERRADA, veredito: 'corta', porque: 'o texto não diz onde' }] },
      entrada,
    )
    expect(r.cortes).toBe(1)
    expect(String(p.resenha)).not.toContain('numa sala')
    expect(String(p.resenha)).not.toMatch(/ {2}/)
  })

  it('deixa passar o hedge que cresce poucos caracteres, sem exigir apoio', () => {
    // "sempre" → "costumava" cresce 2 bytes e não afirma nada de novo. A
    // primeira versão do portão recusou seis consertos legítimos assim.
    const p = base() as Record<string, unknown>
    aplicarLeitura(
      p,
      { ordem: 1, achados: [{ campo: 'resenha', tipo: 'nao-sustenta', frase: ERRADA, veredito: 'troca', novo: 'A cena acontece diante do rei, e o texto não diz onde.', porque: 'hedge' }] },
      entrada,
    )
    expect(String(p.resenha)).toContain('o texto não diz onde')
  })

  it('exige apoio quando a troca acrescenta uma oração inteira', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarLeitura(
        p,
        { ordem: 1, achados: [{ campo: 'resenha', tipo: 'nao-sustenta', frase: ERRADA, veredito: 'troca', novo: 'A cena acontece diante do rei, sentado debaixo da árvore com a lança na mão, e o texto não diz mais nada sobre o lugar em que tudo isso se passou naquele dia.', porque: 'x' }] },
        entrada,
      ),
    ).toThrow(/não declara apoio/)
  })

  it('recusa o apoio que cita o que não está no texto', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarLeitura(
        p,
        { ordem: 1, achados: [{ campo: 'resenha', tipo: 'nao-sustenta', frase: ERRADA, veredito: 'troca', novo: 'A cena acontece no pátio do palácio de Gibeá, e o texto conta que havia guardas de pé em volta do rei durante toda a conversa.', apoio: '"e os guardas estavam de pé em volta" — o texto', porque: 'x' }] },
        entrada,
      ),
    ).toThrow(/não está no texto desta perícope/)
  })

  it('desfaz a perícope INTEIRA quando um achado do meio reprova', () => {
    // O bug que isto tranca: um `throw` no terceiro achado deixava os dois
    // primeiros aplicados, e o portão do material nunca rodava em cima disso.
    const p = base() as Record<string, unknown>
    const antes = String(p.resenha)
    expect(() =>
      aplicarLeitura(
        p,
        {
          ordem: 1,
          achados: [
            { campo: 'resenha', tipo: 'nao-sustenta', frase: ERRADA, veredito: 'corta', porque: 'ok' },
            { campo: 'resenha', tipo: 'repeticao', frase: 'esta frase não existe no material', veredito: 'corta', porque: 'x' },
          ],
        },
        entrada,
      ),
    ).toThrow(/a frase não está/)
    expect(String(p.resenha)).toBe(antes)
  })

  it('recusa esvaziar o campo — o defeito some e a explicação vai junto', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarLeitura(
        p,
        { ordem: 1, achados: [{ campo: 'contexto_historico_literario', tipo: 'enrolacao', frase: CTX.slice(0, 200), veredito: 'corta', porque: 'x' }] },
        entrada,
      ),
    ).toThrow(/encolheu/)
  })
})
