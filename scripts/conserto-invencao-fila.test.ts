import { describe, expect, it } from 'vitest'
import { aplicarConsertos } from './conserto-invencao-fila.ts'

const ACUSADA = 'O éfode de linho era a veste que identificava quem servia como sacerdote.'
const CTX =
  'Nobe era a cidade onde a arca esteve depois de Siló, e é ali que os sacerdotes de Israel moravam quando esta cena acontece. Quem lê precisa saber que Doegue, o edomita, não era israelita, e que servir ao rei estrangeiro não o obrigava a nada diante do santuário.'
const RES = `A cena tem dois tempos. Primeiro o rei pergunta, sentado debaixo da árvore, com a lança na mão; depois manda matar. ${ACUSADA} Doegue é quem obedece, e o número que o texto dá é oitenta e cinco.

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

describe('aplicarConsertos', () => {
  it('troca a frase quando o apoio cita o texto da perícope', () => {
    const p = base() as Record<string, unknown>
    const r = aplicarConsertos(
      p,
      {
        ordem: 1,
        consertos: [
          {
            afirma: ACUSADA,
            veredito: 'troca',
            novo: 'Nesta cena os mortos são sacerdotes, e a roupa que o texto nomeia é o éfode de linho.',
            apoio: '"oitenta e cinco homens que vestiam éfode de linho" — o texto da perícope',
          },
        ],
      },
      entrada,
    )
    expect(r.trocadas).toBe(1)
    expect(String(p.resenha)).toContain('Nesta cena os mortos são sacerdotes')
    expect(String(p.resenha)).not.toContain(ACUSADA)
  })

  it('recusa o apoio que cita o que não está no texto — trocar invenção por invenção', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarConsertos(
        p,
        {
          ordem: 1,
          consertos: [
            {
              afirma: ACUSADA,
              veredito: 'troca',
              novo: 'Nesta cena os mortos são sacerdotes de Nobe, e o texto conta quantos foram.',
              apoio: '"e eram trezentos homens vestidos de linho" — o texto da perícope',
            },
          ],
        },
        entrada,
      ),
    ).toThrow(/não está no texto desta perícope/)
  })

  it('recusa "recusa" sem motivo, porque a recusa é para eu ler', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarConsertos(p, { ordem: 1, consertos: [{ afirma: ACUSADA, veredito: 'recusa' }] }, entrada),
    ).toThrow(/sem motivo/)
  })

  it('aceita a recusa com motivo, e não toca no material', () => {
    const p = base() as Record<string, unknown>
    const r = aplicarConsertos(
      p,
      {
        ordem: 1,
        consertos: [{ afirma: ACUSADA, veredito: 'recusa', motivo: 'o auditor leu outro versículo' }],
      },
      entrada,
    )
    expect(r.recusadas).toHaveLength(1)
    expect(String(p.resenha)).toBe(RES)
  })

  it('recusa a frase acusada que não está em campo nenhum — paráfrase erra o alvo', () => {
    const p = base() as Record<string, unknown>
    expect(() =>
      aplicarConsertos(
        p,
        {
          ordem: 1,
          consertos: [
            { afirma: 'O éfode identificava os sacerdotes.', veredito: 'corta' },
          ],
        },
        entrada,
      ),
    ).toThrow(/não está em campo nenhum/)
  })

  it('corta a frase e limpa o espaço duplo que o corte deixa no meio do parágrafo', () => {
    const p = base() as Record<string, unknown>
    const r = aplicarConsertos(p, { ordem: 1, consertos: [{ afirma: ACUSADA, veredito: 'corta' }] }, entrada)
    expect(r.cortadas).toBe(1)
    expect(String(p.resenha)).not.toMatch(/ {2}/)
  })

  it('devolve a perícope inteira quando um conserto reprova — nada fica pela metade', () => {
    const p = base() as Record<string, unknown>
    const antes = String(p.resenha)
    expect(() =>
      aplicarConsertos(
        p,
        {
          ordem: 1,
          consertos: [
            {
              afirma: ACUSADA,
              veredito: 'troca',
              novo: 'Repare em duas coisas nesta cena.',
              apoio: 'o texto da perícope',
            },
          ],
        },
        entrada,
      ),
    ).toThrow(/anuncia e não paga/)
    expect(String(p.resenha)).toBe(antes)
  })
})
