import { describe, expect, it } from 'vitest'
import { destinoCanonico } from './canonico'

describe('destinoCanonico', () => {
  it('tira o www e mantém o resto do endereço', () => {
    expect(destinoCanonico('https://www.aipericopes.com/')).toBe('https://aipericopes.com/')
  })

  it('preserva caminho e query', () => {
    // Um link de e-mail de acesso carrega o código na query. Perdê-lo no
    // redirecionamento deixaria a pessoa numa tela de login sem explicação.
    expect(destinoCanonico('https://www.aipericopes.com/leitura/1600?token=abc#v3')).toBe(
      'https://aipericopes.com/leitura/1600?token=abc#v3',
    )
  })

  it('não mexe em quem já está na raiz', () => {
    expect(destinoCanonico('https://aipericopes.com/')).toBeNull()
  })

  it('não mexe no workers.dev', () => {
    expect(destinoCanonico('https://biblia-pericopes.jairofilho79.workers.dev/')).toBeNull()
  })

  it('não confunde host que só começa parecido', () => {
    // `wwwx.` não é `www.`; e um host que CONTÉM www no meio não pode perdê-lo.
    expect(destinoCanonico('https://wwwx.aipericopes.com/')).toBeNull()
    expect(destinoCanonico('https://www.www-teste.com/')).toBe('https://www-teste.com/')
  })

  it('não redireciona para um host que não existe', () => {
    // Sem isto, `www.localhost` viraria `localhost` e o dev local entraria em
    // redirecionamento para um lugar que não serve o app.
    expect(destinoCanonico('http://www.localhost:8787/')).toBeNull()
  })

  it('devolve null para entrada que não é URL', () => {
    expect(destinoCanonico('não é uma url')).toBeNull()
  })
})
