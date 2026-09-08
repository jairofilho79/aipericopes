import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Mora em scripts/ e não em src/ por dois motivos que se somam: o
 * `tsconfig.app` trava `types: ["vite/client"]`, então `node:fs` não
 * typechecaria lá; e o vitest stuba import de CSS, o que faz `?raw` devolver
 * string vazia. `scripts/` é onde este repo já põe teste que lê arquivo de
 * disco — ver scripts/blivre-correcoes.test.ts.
 */
const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')

/**
 * A paleta é a marca, e a marca é acessibilidade: quem trocar um hex aqui
 * descobre no `npm test`, não no olho de quem lê.
 *
 * `--line` está fora das asserções DE PROPÓSITO: é fio decorativo (1,33:1 já
 * na paleta verde de antes) e não é fronteira de componente. Exigir 3:1 dele
 * trocaria o fio por um traço que o desenho nunca teve.
 */
function tokensDoBloco(cabecalho: string): Record<string, string> {
  const i = css.indexOf(cabecalho)
  if (i < 0) throw new Error(`bloco não encontrado no app.css: ${cabecalho}`)
  const corpo = css.slice(i, css.indexOf('}', i))
  const tokens: Record<string, string> = {}
  const apelidos: Record<string, string> = {}
  for (const [, nome, valor] of corpo.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6}|var\(--[\w-]+\))\s*;/g)) {
    const ref = valor.match(/^var\(--([\w-]+)\)$/)
    if (ref) apelidos[nome] = ref[1]
    else tokens[nome] = valor.toLowerCase()
  }
  // Uma volta de indireção basta, e é a que o CSS usa: `--cta-bg: var(--accent)`
  // e `--candle: var(--accent)` dizem a INTENÇÃO ("no escuro a superfície cheia
  // é o próprio acento") melhor do que o hex repetido diria.
  for (const [nome, alvo] of Object.entries(apelidos)) {
    if (tokens[alvo]) tokens[nome] = tokens[alvo]
  }
  return tokens
}

function canal(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

const TEMAS = {
  claro: ":root,\n[data-theme='light'] {",
  escuro: "[data-theme='dark'] {",
}

/** Pares que carregam TEXTO: 4,5:1. */
const TEXTO = [
  ['ink', 'bg'],
  ['ink', 'paper'],
  ['read-ink', 'paper'],
  ['muted', 'bg'],
  ['muted', 'paper'],
  ['accent', 'bg'],
  ['accent', 'paper'],
  ['accent', 'accent-soft'],
  // A superfície cheia da marca: no claro --cta-bg é âmbar VIVO e a letra é
  // escura; no escuro --cta-bg é o próprio --accent. Os dois temas usam a
  // mesma receita, e é este par que garante que ela seja legível.
  ['cta-ink', 'cta-bg'],
  ['erro', 'bg'],
  ['erro', 'paper'],
] as const

/** Pares que são LUZ, nunca texto: 3:1. */
const LUZ = [
  ['flame', 'bg'],
  ['flame', 'paper'],
] as const

const OBRIGATORIOS = [
  'bg',
  'paper',
  'ink',
  'read-ink',
  'muted',
  'accent',
  'accent-soft',
  'flame',
  'erro',
  'cta-bg',
  'cta-ink',
]

describe('paleta', () => {
  it('o tema sépia não existe mais no CSS', () => {
    expect(css).not.toContain("[data-theme='sepia']")
    expect(css).not.toContain('--hl-amarelo')
  })

  for (const [nome, cabecalho] of Object.entries(TEMAS)) {
    describe(nome, () => {
      const t = tokensDoBloco(cabecalho)

      it('define todos os tokens de cor da marca', () => {
        for (const chave of OBRIGATORIOS) {
          expect(t, `--${chave} faltando no tema ${nome}`).toHaveProperty(chave)
        }
      })

      for (const [a, b] of TEXTO) {
        it(`--${a} sobre --${b} passa em texto (4,5:1)`, () => {
          expect(contraste(t[a], t[b])).toBeGreaterThanOrEqual(4.5)
        })
      }

      for (const [a, b] of LUZ) {
        it(`--${a} sobre --${b} passa em elemento não-textual (3:1)`, () => {
          expect(contraste(t[a], t[b])).toBeGreaterThanOrEqual(3)
        })
      }
    })
  }
})
