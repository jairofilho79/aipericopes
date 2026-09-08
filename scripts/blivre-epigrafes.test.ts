import { describe, it, expect } from 'vitest'
import { separarEpigrafe, EXCECOES, SEM_SOBRESCRITO } from './blivre-epigrafes.ts'

describe('separarEpigrafe — sobrescritos dos Salmos', () => {
  it('separa o sobrescrito curto', () => {
    const r = separarEpigrafe('PSA', 23, 1, 'Salmo de Davi:O SENHOR é meu pastor, nada me faltará.')
    expect(r.epigrafe).toBe('Salmo de Davi')
    expect(r.tipo).toBe('sobrescrito')
    expect(r.texto).toBe('O SENHOR é meu pastor, nada me faltará.')
  })

  it('não confunde o dois-pontos DE DENTRO do sobrescrito com o fim dele', () => {
    // Sl 52:1 — "…contou a Saul, dizendo: Davi veio à casa de Aimeleque:Por que…"
    // O primeiro ':' tem espaço depois; o que fecha o sobrescrito vem colado.
    const r = separarEpigrafe(
      'PSA',
      52,
      1,
      'Instrução de Davi, quando Doegue contou a Saul, dizendo: Davi veio à casa de Aimeleque:Por que tu te orgulhas no mal?',
    )
    expect(r.epigrafe).toBe(
      'Instrução de Davi, quando Doegue contou a Saul, dizendo: Davi veio à casa de Aimeleque',
    )
    expect(r.texto).toBe('Por que tu te orgulhas no mal?')
  })

  it('aceita ponto final dentro do sobrescrito', () => {
    // Sl 18:1 — "Para o regente. Do servo do SENHOR… Ele disse:Eu te amarei…"
    const r = separarEpigrafe('PSA', 18, 1, 'Para o regente. Do servo do SENHOR. Ele disse:Eu te amarei, SENHOR.')
    expect(r.epigrafe).toBe('Para o regente. Do servo do SENHOR. Ele disse')
    expect(r.texto).toBe('Eu te amarei, SENHOR.')
  })

  it('deixa intacto o salmo que não tem sobrescrito', () => {
    const t = 'Bem-aventurado o homem que não anda no conselho dos maus'
    const r = separarEpigrafe('PSA', 1, 1, t)
    expect(r.epigrafe).toBeUndefined()
    expect(r.texto).toBe(t)
  })

  it('a letra do acróstico é rótulo, não sobrescrito — nem no versículo 1', () => {
    // Se "Álefe" virasse sobrescrito, o Salmo 119 abriria com ela no topo e as
    // outras 21 letras ficariam no meio do texto. Ela é par de "Bete".
    const r = separarEpigrafe('PSA', 119, 1, '[Álefe] :Bem-aventurados são os puros')
    expect(r.tipo).toBe('rotulo')
  })

  it('usa a tabela de exceções onde a fonte esqueceu o dois-pontos', () => {
    // Sl 72:1 vem "Para SalomãoDeus, dá teus juízos ao rei" — sem separador nenhum.
    const r = separarEpigrafe('PSA', 72, 1, 'Para SalomãoDeus, dá teus juízos ao rei, e tua justiça ao filho do rei.')
    expect(r.epigrafe).toBe('Para Salomão')
    expect(r.texto).toBe('Deus, dá teus juízos ao rei, e tua justiça ao filho do rei.')
  })

  it('lança se a exceção não casar mais com a fonte', () => {
    expect(() => separarEpigrafe('PSA', 72, 1, 'Outro texto qualquer')).toThrow(/PSA 72:1/)
  })
})

describe('separarEpigrafe — rótulos estruturais', () => {
  it('separa a letra do acróstico no Salmo 119', () => {
    const r = separarEpigrafe('PSA', 119, 9, '[Bete] : Com que um rapaz purificará o seu caminho?')
    expect(r.epigrafe).toBe('Bete')
    expect(r.tipo).toBe('rotulo')
    expect(r.texto).toBe('Com que um rapaz purificará o seu caminho?')
  })

  it('separa o marcador de locutor em Cantares', () => {
    const r = separarEpigrafe('SOL', 1, 2, '[Ela]  : Beije-me ele com os beijos de sua boca')
    expect(r.epigrafe).toBe('Ela')
    expect(r.tipo).toBe('rotulo')
    expect(r.texto).toBe('Beije-me ele com os beijos de sua boca')
  })

  it('NÃO trata atribuição de fala suprida como rótulo', () => {
    // Jó 21:19 — "[Vós dizeis] : Deus guarda…" é palavra suprida, não estrutura.
    const t = '[Vós dizeis] : Deus guarda a maldade para os filhos dele'
    const r = separarEpigrafe('JOB', 21, 19, t)
    expect(r.epigrafe).toBeUndefined()
    expect(r.texto).toBe(t)
  })

  it('NÃO trata colchete sem dois-pontos como rótulo, nem em Cantares', () => {
    // Ct 2:6 — "[Esteja] sua mão esquerda…" é palavra suprida.
    const t = '[Esteja] sua mão esquerda abaixo de minha cabeça'
    const r = separarEpigrafe('SOL', 2, 6, t)
    expect(r.epigrafe).toBeUndefined()
    expect(r.texto).toBe(t)
  })
})

describe('separarEpigrafe — fronteiras', () => {
  it('só procura sobrescrito no versículo 1', () => {
    const t = 'Ele respondeu:Vinde a mim'
    const r = separarEpigrafe('PSA', 23, 2, t)
    expect(r.epigrafe).toBeUndefined()
    expect(r.texto).toBe(t)
  })

  it('separa o título de seção em Provérbios e as revelações de Isaías', () => {
    expect(separarEpigrafe('PRO', 10, 1, 'Provérbios de Salomão:O filho sábio alegra ao pai').epigrafe).toBe(
      'Provérbios de Salomão',
    )
    expect(separarEpigrafe('ISA', 23, 1, 'Revelação sobre Tiro:Uivai, navios de Társis').epigrafe).toBe(
      'Revelação sobre Tiro',
    )
  })

  it('ignora dois-pontos colado em livro que não tem sobrescrito', () => {
    // Só Salmos, Provérbios e Isaías trazem sobrescrito nesta fonte. Em Gênesis
    // um ':' colado é prosa, não estrutura — e não pode virar epígrafe.
    const t = 'E das pessoas, dezesseis mil:)'
    const r = separarEpigrafe('GEN', 1, 1, t)
    expect(r.epigrafe).toBeUndefined()
    expect(r.texto).toBe(t)
  })
})

describe('tabelas', () => {
  it('a exceção conhecida é o Salmo 72', () => {
    expect(Object.keys(EXCECOES)).toEqual(['PSA 72:1'])
  })

  it('não há buraco de sobrescrito sem solução — o Sl 125 foi devolvido em blivre-correcoes', () => {
    expect(SEM_SOBRESCRITO).toEqual([])
  })
})
