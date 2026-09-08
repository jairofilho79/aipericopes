# Rebranding aiPericopes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a identidade do app de "Perícopes"/verde para "aiPericopes"/âmbar, matar o tema sépia, e fazer a paleta carregar a distinção entre o que a máquina escreveu e o que é Escritura.

**Architecture:** O `app.css` já é quase 100% tokenizado (74 usos de `var(--accent)`), então a troca de paleta é reescrever dois blocos de tokens e nasce um token novo, `--flame`. Um teste novo lê o próprio `app.css`, extrai os tokens e mede contraste — é ele que trava a paleta contra edições futuras. O resto é renomear strings, migrar o tema sépia gravado, e três movimentos de hierarquia na tela de Leitura.

**Tech Stack:** React 19 + TypeScript + Vite, CSS custom properties, vitest + happy-dom, IndexedDB (idb), Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-09-05-rebranding-aipericopes-design.md`

## Global Constraints

- **Textos de UI em pt-BR.** Sem exceção.
- **A marca é `aiPericopes`, sem acento, sempre.** A palavra comum continua `perícope` / `perícopes`, **com** acento, no corpo do texto. `<title>aiPericopes</title>`, mas "a perícope de hoje".
- **`--flame` nunca carrega texto.** Mínimo 3:1 contra fundo. `--accent` carrega texto: mínimo 4,5:1.
- **`--candle: var(--accent)` nos dois temas.** `--candle` colore o título falado, que é texto. Ligá-lo a `--flame` dá 3,42:1 no claro e reprova.
- **Chaves de `localStorage` não mudam:** `pericopes-theme`, `pericopes-reading`, `pericopes-contexto-aberto`, e o evento `pericopes-theme`. Renomear só perderia preferência sem ganhar nada.
- **Não tocar:** tipografia, escalas de leitura (`reading-prefs.ts`), medidas de coluna, o alinhamento palavra-a-palavra da narração.
- Commits pequenos e frequentes, mensagem em pt-BR.
- `npm test` = `vitest run`. `npm run lint` = `oxlint`. `npm run build` = `tsc -b && vite build`.
- Branch de trabalho: **`v2-biblia-livre`**. Outra sessão commita no mesmo repo — sempre `git add` apenas os arquivos da tarefa, nunca `git add -A`.

### Os hexes, uma vez só

| token | claro | escuro |
|---|---|---|
| `--bg` | `#f5f1e8` | `#16130f` |
| `--bg-deep` | `#ebe3d3` | `#0e0c09` |
| `--ink` | `#1c1914` | `#ece6da` |
| `--read-ink` | `#12100e` | `#f5f2eb` |
| `--muted` | `#5f574a` | `#a89f90` |
| `--accent` | `#92500a` | `#f0b357` |
| `--accent-soft` | `#f6e5c8` | `#3a2a12` |
| `--flame` | `#c4780e` | `#ffc46b` |
| `--line` | `#ddd2bd` | `#2e2820` |
| `--paper` | `#fffdf7` | `#1e1a15` |
| `--cta-ink` | `#fffaf0` | `#1a1206` |
| `--glow-a` | `#f5e8cf` | `#2a2113` |
| `--glow-b` | `#f0dfc0` | `#241c10` |
| `--erro` | `#a33b30` | `#e08b80` |
| `--rec` | `#c0392b` (mantém) | `#e4655a` (mantém) |
| `--hl-verde` | `#cfe9c8` (mantém) | `#24452c` (mantém) |
| `--hl-azul` | `#cadff2` (mantém) | `#1f3c58` (mantém) |
| `--hl-rosa` | `#f4d0dd` (mantém) | `#4e2437` (mantém) |

---

### Task 1: A paleta âmbar, travada por teste de contraste

Nasce `--flame`. Nasce `--erro` (que hoje é `#b3564d` hardcoded em dois lugares e **já reprova em contraste nos dois temas**: 4,28:1 no claro e 3,79:1 no escuro). O bloco `[data-theme='sepia']` morre. E nasce o teste que impede alguém de desfazer isso por engano.

**Files:**
- Create: `src/styles/paleta.test.ts`
- Modify: `src/styles/app.css:1-146` (os três blocos de tema + o `@media`)
- Modify: `src/styles/app.css:2402`, `src/styles/app.css:2419` (`#b3564d` → `var(--erro)`)

**Interfaces:**
- Consumes: nada.
- Produces: os tokens `--flame` e `--erro`, consumidos pelas Tasks 3 e 5. O tema `sepia` deixa de existir no CSS, o que a Task 2 completa no TypeScript.

- [ ] **Step 1: Escrever o teste que falha**

O teste lê o `app.css` de verdade, extrai os tokens de cada bloco de tema e mede contraste WCAG. `--line` fica **de fora de propósito**: é fio decorativo e já dá 1,33:1 hoje — exigir 3:1 dele obrigaria a um traço pesado que o desenho nunca teve.

Criar `src/styles/paleta.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./app.css', import.meta.url)), 'utf8')

/**
 * A paleta é a marca, e a marca é acessibilidade: quem trocar um hex aqui
 * descobre no `npm test`, não no olho de quem lê.
 *
 * `--line` está fora das asserções DE PROPÓSITO: é fio decorativo (1,33:1 já
 * na paleta verde) e não é fronteira de componente. Exigir 3:1 dele trocaria
 * o fio por um traço que o desenho nunca teve.
 */
function tokensDoBloco(cabecalho: string): Record<string, string> {
  const i = css.indexOf(cabecalho)
  if (i < 0) throw new Error(`bloco não encontrado no app.css: ${cabecalho}`)
  const corpo = css.slice(i, css.indexOf('}', i))
  const tokens: Record<string, string> = {}
  for (const [, nome, valor] of corpo.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[nome] = valor.toLowerCase()
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

// Pares que carregam TEXTO: 4,5:1.
const TEXTO = [
  ['ink', 'bg'],
  ['ink', 'paper'],
  ['read-ink', 'paper'],
  ['muted', 'bg'],
  ['muted', 'paper'],
  ['accent', 'bg'],
  ['accent', 'paper'],
  ['accent', 'accent-soft'],
  ['cta-ink', 'accent'],
  ['erro', 'bg'],
  ['erro', 'paper'],
] as const

// Pares que são LUZ, nunca texto: 3:1.
const LUZ = [
  ['flame', 'bg'],
  ['flame', 'paper'],
] as const

describe('paleta', () => {
  it('o tema sépia não existe mais no CSS', () => {
    expect(css).not.toContain("[data-theme='sepia']")
    expect(css).not.toContain('--hl-amarelo')
  })

  for (const [nome, cabecalho] of Object.entries(TEMAS)) {
    describe(nome, () => {
      const t = tokensDoBloco(cabecalho)

      it('define todos os tokens de cor da marca', () => {
        for (const chave of ['bg', 'paper', 'ink', 'read-ink', 'muted', 'accent', 'accent-soft', 'flame', 'erro', 'cta-ink']) {
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/styles/paleta.test.ts`
Expected: FAIL — `[data-theme='sepia']` ainda existe, `--flame` e `--erro` não existem, e `--accent` verde reprova em vários pares.

- [ ] **Step 3: Reescrever os blocos de tema**

Substituir integralmente da linha 1 até o fim do bloco `@media (prefers-color-scheme: dark)` (hoje linha 146) por:

```css
:root,
[data-theme='light'] {
  --bg: #f5f1e8;
  --bg-deep: #ebe3d3;
  --ink: #1c1914;
  --read-ink: #12100e;
  /* ponytail: subtle glyph lift for long-form reading */
  --read-shadow: 0 1px 0 rgb(18 16 14 / 0.1);
  --muted: #5f574a;
  /* ── os dois âmbares ──
     `--accent` é o âmbar QUEIMADO: tudo que carrega texto (links, CTA, foco,
     cabeçalhos). Precisa de 4,5:1.
     `--flame` é o âmbar VIVO: tudo que é luz e nunca texto (barra de
     progresso, a chama da marca). Precisa de 3:1 — e sobre papel quase branco
     o âmbar vivo original (#d98613) dava só 2,53:1, por isso este é mais
     fundo. Ver src/styles/paleta.test.ts: mexeu aqui, o teste cobra. */
  --accent: #92500a;
  --accent-soft: #f6e5c8;
  --flame: #c4780e;
  --line: #ddd2bd;
  --paper: #fffdf7;
  --cta-ink: #fffaf0;
  --erro: #a33b30;
  --glow-a: #f5e8cf;
  --glow-b: #f0dfc0;
  --focus-bg: color-mix(in srgb, var(--accent) 14%, var(--paper));
  --focus-line: color-mix(in srgb, var(--accent) 45%, var(--line));
  --hl-verde: #cfe9c8;
  --hl-azul: #cadff2;
  --hl-rosa: #f4d0dd;
  /* ── realce da narração ──
     `--candle` é a cor do tema no realce: a barra na borda do trecho em fala,
     a barra sob a palavra atual e a cor do TÍTULO FALADO.

     É por causa do título falado que `--candle` é `--accent` e não `--flame`:
     título é texto, e `--flame` reprovaria em contraste. Não troque.

     `--candle-fundo` é o véu chapado atrás do trecho.

     `--candle-luz-pct` é a luz branca que sobe na palavra atual, e no tema
     CLARO ela é 0: sobre papel quase branco o branco não tem para onde
     brilhar — ele só desfazia o véu. Aqui a palavra é marcada só pela barra
     embaixo dela. A luz sobrou onde funciona: no tema escuro. */
  --candle: var(--accent);
  --candle-fundo: color-mix(in srgb, var(--candle) 15%, transparent);
  --candle-luz-pct: 0%;
  /* gravando: o vermelho do microfone aberto. */
  --rec: #c0392b;
  --radius: 12px;
  --font-display: 'Fraunces Variable', Georgia, serif;
  --font-body: 'Source Serif 4 Variable', Georgia, serif;
  --font-ui: 'DM Sans Variable', system-ui, sans-serif;
  --read-size: 1.15rem;
  --read-font: 'Source Serif 4 Variable', Georgia, serif;
  --measure: 38rem;
  /* shared page wash — keep body + sticky header in sync */
  --page-bg:
    radial-gradient(1200px 600px at 10% -10%, var(--glow-a) 0%, transparent 55%),
    radial-gradient(900px 500px at 100% 0%, var(--glow-b) 0%, transparent 50%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-deep) 35%, transparent), transparent 28rem),
    var(--bg);
  color-scheme: light;
}

[data-theme='dark'] {
  --bg: #16130f;
  --bg-deep: #0e0c09;
  --ink: #ece6da;
  --read-ink: #f5f2eb;
  --read-shadow: 0 1px 0 rgb(0 0 0 / 0.28), 0 -1px 0 rgb(255 255 255 / 0.1);
  --muted: #a89f90;
  --accent: #f0b357;
  --accent-soft: #3a2a12;
  --flame: #ffc46b;
  --line: #2e2820;
  --paper: #1e1a15;
  --cta-ink: #1a1206;
  --erro: #e08b80;
  --glow-a: #2a2113;
  --glow-b: #241c10;
  --focus-bg: color-mix(in srgb, var(--accent) 18%, var(--paper));
  --focus-line: color-mix(in srgb, var(--accent) 40%, var(--line));
  --hl-verde: #24452c;
  --hl-azul: #1f3c58;
  --hl-rosa: #4e2437;
  /* no escuro o véu CLAREIA em vez de escurecer, e por isso basta pouco. */
  --candle: var(--accent);
  --candle-fundo: color-mix(in srgb, var(--candle) 8%, transparent);
  /* só aqui a luz existe: branco sobre papel escuro é luz de verdade. */
  --candle-luz-pct: 22%;
  /* no escuro o vermelho sobe um tom, senão afunda no papel. */
  --rec: #e4655a;
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #16130f;
    --bg-deep: #0e0c09;
    --ink: #ece6da;
    --read-ink: #f5f2eb;
    --read-shadow: 0 1px 0 rgb(0 0 0 / 0.28), 0 -1px 0 rgb(255 255 255 / 0.1);
    --muted: #a89f90;
    --accent: #f0b357;
    --accent-soft: #3a2a12;
    --flame: #ffc46b;
    --line: #2e2820;
    --paper: #1e1a15;
    --cta-ink: #1a1206;
    --erro: #e08b80;
    --glow-a: #2a2113;
    --glow-b: #241c10;
    --focus-bg: color-mix(in srgb, var(--accent) 18%, var(--paper));
    --focus-line: color-mix(in srgb, var(--accent) 40%, var(--line));
    --hl-verde: #24452c;
    --hl-azul: #1f3c58;
    --hl-rosa: #4e2437;
    --candle: var(--accent);
    --candle-fundo: color-mix(in srgb, var(--candle) 8%, transparent);
    --candle-luz-pct: 22%;
    --rec: #e4655a;
    color-scheme: dark;
  }
}
```

Note que o seletor do `@media` perdeu `:not([data-theme='sepia'])` — o tema não existe mais.

- [ ] **Step 4: Tokenizar os dois `#b3564d`**

Em `.entrar-erro` (hoje l. 2402) e `.nav-conta-erro` (hoje l. 2419), trocar `color: #b3564d;` por `color: var(--erro);` nos dois.

O terceiro hexe solto do `app.css`, o `color: #fff` de `.ditar-botao.gravando` (l. 1850), **fica como está**: é texto branco sobre o vermelho de gravação, não tem nada a ver com a marca, e tokenizá-lo só acrescentaria indireção.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/styles/paleta.test.ts`
Expected: PASS — 26 asserções de contraste + as duas de sépia/amarelo.

Run: `grep -c '#b3564d' src/styles/app.css`
Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css src/styles/paleta.test.ts
git commit -m "feat: a paleta âmbar, com o contraste travado por teste

Dois âmbares, e a distinção é o coração do sistema: --accent é o queimado
que carrega texto (4,5:1), --flame é o vivo que só é luz (3:1). O âmbar
vivo original (#d98613) dava 2,53:1 sobre papel claro e foi rebaixado para
#c4780e — a mesma física que o comentário do --candle-luz-pct já descrevia.

--candle fica em --accent nos dois temas porque ele colore o título falado,
que é texto. Está escrito no CSS para ninguém 'otimizar' de volta.

O escuro deixa de ser azul-carvão e vira carvão quente: é a sala onde a vela
faz sentido, e absorve o sépia que morre.

De quebra, --erro nasce: o #b3564d hardcoded reprovava em contraste nos DOIS
temas hoje (4,28:1 no claro, 3,79:1 no escuro)."
```

---

### Task 2: O sépia morre, e quem estava nele acorda no claro

O risco real: `getStoredTheme()` hoje devolve `null` para valor desconhecido, o que vira preferência `'system'`, o que vira `matchMedia`. Tirar `'sepia'` da lista sem mais nada faz **quem escolheu um tema claro acordar no escuro**. A migração tem de ser explícita, e nos dois lugares — o `index.html` roda antes de qualquer bundle.

**Files:**
- Modify: `src/lib/theme.ts:3-8`, `src/lib/theme.ts:11-17`
- Modify: `src/lib/theme.test.ts:21-26`, `src/lib/theme.test.ts:54`
- Modify: `src/components/PerfilMenu.tsx:10-15`
- Modify: `index.html:16`

**Interfaces:**
- Consumes: nada da Task 1 (independentes; a ordem só evita um estado intermediário feio).
- Produces: `type Theme = 'light' | 'dark'`. `getStoredTheme()` passa a mapear o legado `'sepia'` para `'light'` sem reescrever o storage.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/theme.test.ts`, **substituir** o caso `setThemePref("sepia") grava, aplica e vira a preferência` (l. 21-26) por estes dois:

```ts
  it('tema sépia gravado vira claro, e não segue o sistema', () => {
    // Sépia era um tema CLARO. Cair no 'system' faria quem escolheu papel
    // bege acordar no escuro se o sistema estivesse escuro.
    localStorage.setItem('pericopes-theme', 'sepia')
    expect(getStoredTheme()).toBe('light')
    expect(getThemePref()).toBe('light')
    expect(resolveTheme()).toBe('light')
  })

  it('sépia migrado não é confundido com lixo desconhecido', () => {
    localStorage.setItem('pericopes-theme', 'roxo')
    expect(getThemePref()).toBe('system')
    localStorage.setItem('pericopes-theme', 'sepia')
    expect(getThemePref()).toBe('light')
  })
```

E no caso `trocar de tema gravado sobrescreve o anterior` (l. 54), trocar `setThemePref('sepia')` por `setThemePref('light')`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL — `getStoredTheme()` devolve `null` para `'sepia'`, então `getThemePref()` dá `'system'`, não `'light'`.

- [ ] **Step 3: Implementar a migração em `theme.ts`**

Substituir as linhas 3-17 de `src/lib/theme.ts` por:

```ts
export type Theme = 'light' | 'dark'

/** Preferência armazenada; 'system' = nenhuma chave gravada. */
export type ThemePref = Theme | 'system'

const TEMAS: Theme[] = ['light', 'dark']

/**
 * O sépia foi aposentado no rebranding para aiPericopes: ele já era, na
 * prática, o tema âmbar, e manter os dois era oferecer uma escolha que não
 * escolhia nada.
 *
 * A migração é EXPLÍCITA para 'light' e não pode virar `null`: sépia era um
 * tema CLARO, e cair no ramo de valor desconhecido levaria a preferência para
 * 'system' — quem escolheu papel bege acordaria no escuro. O storage não é
 * reescrito; a próxima escolha do usuário sobrescreve sozinha.
 *
 * DUPLICAÇÃO DELIBERADA: o script inline de index.html faz o mesmo mapa antes
 * de qualquer bundle. Mudou aqui, mude lá.
 */
function migrar(v: string | null): Theme | null {
  if (v === 'sepia') return 'light'
  return TEMAS.includes(v as Theme) ? (v as Theme) : null
}

export function getStoredTheme(): Theme | null {
  try {
    return migrar(localStorage.getItem(KEY))
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Tirar o sépia do menu e do script inline**

Em `src/components/PerfilMenu.tsx`, remover a linha `{ id: 'sepia', label: 'Sépia' },` da constante `TEMAS` (l. 13).

Em `index.html`, substituir a linha 16:

```js
          if (t !== 'light' && t !== 'dark' && t !== 'sepia') {
```

por:

```js
          // DUPLICAÇÃO DELIBERADA de src/lib/theme.ts: sépia foi aposentado e
          // migra para 'light'. Não deixe cair no ramo do matchMedia abaixo —
          // sépia era um tema CLARO. Mudou lá, mude aqui.
          if (t === 'sepia') t = 'light'
          if (t !== 'light' && t !== 'dark') {
```

- [ ] **Step 6: Verificar que o sépia sumiu de todo lado**

Run: `grep -rn "sepia\|Sépia" src index.html vite.config.ts`
Expected: só as ocorrências dentro de comentários explicando a migração (`theme.ts`, `index.html`) e os testes de migração.

Run: `npm test && npm run lint`
Expected: PASS nos dois.

- [ ] **Step 7: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts src/components/PerfilMenu.tsx index.html
git commit -m "feat: o sépia morre, e quem estava nele acorda no claro

Sépia já era o tema âmbar (--accent: #8a5a2b sobre papel bege): com a marca
virando âmbar, manter os dois era oferecer uma escolha que não escolhia nada.

A parte que quase passou batido: getStoredTheme devolve null para valor
desconhecido, e null vira preferência 'system', que vira matchMedia. Tirar
'sepia' da lista sem mais nada faria quem escolheu um tema CLARO acordar no
escuro. A migração é explícita para 'light', e nos DOIS lugares — o script
inline do index.html roda antes de qualquer bundle."
```

---

### Task 3: O grifo amarelo sai da paleta

Era o único caso de âmbar **permanente** sobre a Escritura, aplicado por humano — furava a regra da marca no lugar onde ela mais importa. Mas `DestaqueCor` é dado **persistido e sincronizado** (IndexedDB + D1): registros com `'amarelo'` existem, e apagar só o CSS faria o destaque sumir em silêncio. A migração é no ponto de leitura.

**Files:**
- Modify: `src/lib/types.ts:78`
- Modify: `src/lib/user-db.ts:385-387` (`listDestaques`)
- Modify: `src/lib/user-db.test.ts` (fixtures com `'amarelo'`)
- Modify: `src/lib/sync.test.ts:493`
- Modify: `src/components/VerseActions.tsx:4-9`
- Modify: `src/styles/app.css` (regras `.verse-hl-amarelo` e `.hl-amarelo`)

**Interfaces:**
- Consumes: `--hl-amarelo` foi removido do CSS na Task 1; este é o par TypeScript daquela remoção.
- Produces: `type DestaqueCor = 'verde' | 'azul' | 'rosa'`. `listDestaques(ordem)` continua devolvendo `Promise<Destaque[]>`, agora com `cor` já normalizada.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/lib/user-db.test.ts`, dentro do describe que já exercita destaques:

```ts
  it('destaque amarelo legado é lido como verde, e não some da tela', async () => {
    // 'amarelo' saiu da paleta no rebranding, mas está gravado no IndexedDB e
    // no D1 de quem já grifou. Sem normalizar, `verse-hl-amarelo` deixa de ter
    // regra no CSS e o grifo desaparece sem aviso.
    //
    // O cast existe porque o tipo já não aceita 'amarelo' — é exatamente o
    // ponto: o valor vem do banco, não do código, e TypeScript não guarda o
    // que foi gravado ontem.
    await setDestaque(9200, '1:1', 'amarelo' as unknown as DestaqueCor)
    const lidos = await listDestaques(9200)
    expect(lidos.map((d) => d.cor)).toEqual(['verde'])
  })
```

Conferir que `DestaqueCor` está entre os imports de tipo do arquivo de teste;
se não estiver, adicionar `import type { DestaqueCor } from './types'`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/user-db.test.ts -t "amarelo legado"`
Expected: FAIL — recebe `['amarelo']`, esperava `['verde']`.

- [ ] **Step 3: Normalizar na leitura**

Em `src/lib/user-db.ts`, substituir `listDestaques` (l. 385-387) por:

```ts
/**
 * O grifo amarelo saiu da paleta no rebranding para aiPericopes: era o único
 * âmbar PERMANENTE sobre a Escritura, e a regra da marca é que só o âmbar
 * transitório (a narração passando) a toca.
 *
 * Mas a cor é dado persistido e sincronizado: quem já grifou de amarelo tem
 * registros no IndexedDB e no D1. Sem este mapa, `verse-hl-amarelo` fica sem
 * regra no CSS e o grifo some da tela sem ninguém apagar nada. O registro não
 * é reescrito — regrifar sobrescreve sozinho.
 */
function corVigente(cor: DestaqueCor | 'amarelo'): DestaqueCor {
  return cor === 'amarelo' ? 'verde' : cor
}

export async function listDestaques(ordem: number): Promise<Destaque[]> {
  const linhas = await (await db()).getAllFromIndex('destaques', 'by-pericope', ordem)
  return linhas.map((d) => ({ ...d, cor: corVigente(d.cor) }))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/user-db.test.ts -t "amarelo legado"`
Expected: PASS

- [ ] **Step 5: Encolher o tipo e a UI**

Em `src/lib/types.ts:78`:

```ts
/** 'amarelo' saiu no rebranding; ver corVigente() em user-db.ts para o legado. */
export type DestaqueCor = 'verde' | 'azul' | 'rosa'
```

Em `src/components/VerseActions.tsx`, remover `{ id: 'amarelo', label: 'Amarelo' },` da constante `CORES` (l. 5).

Em `src/styles/app.css`, remover as duas regras:

```css
.verse.verse-hl-amarelo,
.verse-inline.verse-hl-amarelo {
  background: var(--hl-amarelo);
}
```

```css
.hl-amarelo {
  background: var(--hl-amarelo);
}
```

- [ ] **Step 6: Consertar os fixtures que usam 'amarelo'**

Trocar `'amarelo'` por `'verde'` nas fixtures de `src/lib/user-db.test.ts` (l. 240, 242, 249, 282, 291, 294, 543, 548) e `src/lib/sync.test.ts:493` — **menos** no teste novo do Step 1, que precisa do valor legado.

- [ ] **Step 7: Verificar tudo**

Run: `npm test`
Expected: PASS (inclusive `src/styles/paleta.test.ts`, que já cobra a ausência de `--hl-amarelo`).

Run: `npm run build`
Expected: PASS — `tsc -b` prova que nenhum consumidor de `DestaqueCor` ficou com `'amarelo'`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/user-db.ts src/lib/user-db.test.ts src/lib/sync.test.ts src/components/VerseActions.tsx src/styles/app.css
git commit -m "feat: o grifo amarelo sai da paleta

Era o único âmbar PERMANENTE sobre a Escritura, e aplicado por humano — a
regra da marca é que só o âmbar transitório (a narração passando) a toca.

A cor é dado persistido e sincronizado, então apagar só o CSS faria o grifo
de quem já usou amarelo sumir em silêncio: verse-hl-amarelo ficaria sem
regra e o versículo renderizaria sem fundo. A migração é no ponto de
leitura, em listDestaques, e não reescreve o registro."
```

---

### Task 4: O nome

**Files:**
- Modify: `index.html:9`, `index.html:11`, `index.html:12`
- Modify: `vite.config.ts:108-112`
- Modify: `src/App.tsx:48-56`
- Modify: `worker/email.ts:12`, `worker/email.ts:15`, `worker/email.ts:16`, `worker/email.ts:36`
- Modify: `worker/auth.test.ts:14`
- Modify: `wrangler.jsonc` (`vars.EMAIL_FROM`) — ver `docs/kickoff-dominio-e-email.md`
- Modify: `README.md:1-3`

**Interfaces:**
- Consumes: `--accent` claro (`#92500a`) e `--ink` (`#1c1914`) da Task 1, usados literalmente no HTML do e-mail (que não tem CSS custom properties).
- Produces: a classe `.brand-wordmark` e `.brand-ai`, consumidas por nada mais.

- [ ] **Step 1: Metadados do documento**

Em `index.html`:
- l. 9: `<meta name="theme-color" content="#92500a" />`
- l. 11: `<title>aiPericopes</title>`
- l. 12: `<meta name="description" content="Estudo bíblico por perícopes. O texto é a Bíblia Livre; o material e a narração são de IA, e isso está dito." />`

Em `vite.config.ts`, o bloco `manifest` (l. 108-112):

```ts
          name: 'aiPericopes — Estudo Bíblico',
          short_name: 'aiPericopes',
          description:
            'Estudo bíblico por perícopes. O texto é a Bíblia Livre; o material e a narração são de IA, e isso está dito.',
          theme_color: '#92500a',
          background_color: '#f5f1e8',
```

(A `description` anterior dizia "NAA" e estava desatualizada desde a refundação na Bíblia Livre.)

- [ ] **Step 2: O wordmark no header**

Em `src/App.tsx`, substituir o conteúdo do `<NavLink to="/" className="brand">` (l. 48-56) por:

```tsx
        <NavLink to="/" className="brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}brand/logo.png`}
            alt=""
            width={32}
            height={32}
          />
          {/* O wordmark executa a tese sozinho: a máquina é a cor, o texto é a
              tinta. Um <span> por parte porque só o "ai" recebe o âmbar. */}
          <span className="brand-wordmark">
            <span className="brand-ai">ai</span>Pericopes
          </span>
        </NavLink>
```

Adicionar ao `src/styles/app.css`, logo depois da regra `.brand-mark` existente:

```css
.brand-wordmark {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* "ai" é a única parte da marca que a máquina assina. */
.brand-ai {
  color: var(--accent);
}
```

- [ ] **Step 3: O e-mail de login**

Em `worker/email.ts`, trocar as três ocorrências. O HTML do e-mail não tem custom properties, então os hexes vão literais:

- l. 12: `'<h2 style="color:#92500a">aiPericopes</h2>',`
- l. 15: `` `<p><a href="${link}" style="display:inline-block;background:#92500a;color:#fffaf0;padding:0.7rem 1.2rem;border-radius:8px;text-decoration:none">Entrar no aiPericopes</a></p>`, ``
- l. 36: `` subject: `${otp} é o seu código — aiPericopes`, ``

Em `worker/auth.test.ts:14`, trocar `EMAIL_FROM: 'Perícopes <onboarding@resend.dev>'` por `EMAIL_FROM: 'aiPericopes <onboarding@resend.dev>'`.

- [ ] **Step 4: O README**

Trocar o título e a primeira linha (l. 1-3) por:

```markdown
# aiPericopes — estudo bíblico por perícopes (PWA offline)

App de leitura por **perícopes** (unidades narrativas), com texto da **Bíblia
Livre** (CC BY 3.0 BR), contexto e material de estudo escritos por modelo de
linguagem, narração por voz de IA e anotações locais.
```

- [ ] **Step 5: Verificar**

Run: `grep -rn "Perícopes" src worker index.html vite.config.ts wrangler.jsonc README.md`

**`wrangler.jsonc` estava faltando nesta lista** e o kickoff do domínio pegou: sem ele o grep passa verde enquanto `EMAIL_FROM` ainda diz "Perícopes" — o nome do remetente na caixa de entrada de quem pede o código, ou seja, o lugar mais visível de todos.
Expected: nenhuma ocorrência da MARCA. (Ocorrências da palavra comum — "por perícopes", "as perícopes" — são corretas e ficam.)

Run: `npm test && npm run lint && npm run typecheck:worker && npm run build`
Expected: PASS nos quatro.

- [ ] **Step 6: Commit**

```bash
git add index.html vite.config.ts src/App.tsx src/styles/app.css worker/email.ts worker/auth.test.ts README.md
git commit -m "feat: o app se chama aiPericopes

A marca é aiPericopes, sem acento; a palavra comum continua perícope, com
acento, no corpo do texto. O wordmark executa a tese sozinho: 'ai' em âmbar,
'Pericopes' em tinta — a máquina é a cor, o texto é a tinta.

De quebra, a description do manifest para de mentir: dizia 'Bíblia NAA',
desatualizada desde a refundação na Bíblia Livre."
```

---

### Task 5: Os cabeçalhos, e a chama onde já era a metáfora

A Escritura se marca pela **ausência** da marca. Todos os `<h2>` de seção ficam âmbar (é a voz do app); só o `#texto` volta para a tinta de leitura.

A implementação passa por um token, e não por `color:` direto no `#texto`, por um motivo de especificidade: `#texto` é id (1,0,0) e atropelaria `.leitura h2.heading-speaking` (0,2,1), **matando o realce da narração naquele cabeçalho**.

**Files:**
- Modify: `src/styles/app.css:1014-1016` (`.leitura > .block-plain > h2`)
- Modify: `src/styles/app.css:2335-2340` (`.book-progress-fill`)
- Modify: `src/pages/Home.tsx` (as duas ocorrências do emoji `🔥`)
- Modify: `src/styles/app.css:351-360` (`.streak`)
- Modify: `src/components/SectionChips.tsx:7`
- Modify: `src/pages/Leitura.tsx:913-915`

**Interfaces:**
- Consumes: `--accent`, `--flame`, `--read-ink` da Task 1.
- Produces: o token `--cabecalho`, escopado por seção.

**Já resolvido pela Task 1, nada a fazer:** `.narracao-mini:focus-visible`, o anel de foco e o chip de seção ativa já usam `var(--accent)` — viraram âmbar sozinhos quando o token mudou. O spec os lista; eles não geram trabalho.

- [ ] **Step 1: Cabeçalhos — âmbar por padrão, tinta na Escritura**

Em `src/styles/app.css`, substituir a regra `.leitura > .block-plain > h2` (l. 1014-1016) por:

```css
/* Âmbar é a voz do app; a Escritura é a exceção, e se marca pela AUSÊNCIA
   da marca. A exceção vai por token e não por `color` no #texto de propósito:
   #texto é id (1,0,0) e atropelaria `.leitura h2.heading-speaking` (0,2,1),
   matando o realce da narração justamente neste cabeçalho. */
.leitura > .block-plain > h2 {
  color: var(--cabecalho, var(--accent));
  text-shadow: var(--read-shadow);
}

#texto {
  --cabecalho: var(--read-ink);
}
```

- [ ] **Step 2: A chama assume a barra de progresso**

Em `src/styles/app.css:2335-2340`:

```css
.book-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  /* o progresso é a chama subindo: --flame, não --accent. Não carrega texto,
     então os 3:1 bastam. */
  background: var(--flame);
}
```

- [ ] **Step 3: O emoji do streak vira chama desenhada**

Em `src/pages/Home.tsx`, substituir **as duas** ocorrências de:

```tsx
              <span aria-hidden>🔥</span>{' '}
```

por:

```tsx
              <span className="streak-chama" aria-hidden />{' '}
```

E adicionar ao `src/styles/app.css`, depois de `.streak-recorde`:

```css
/* Era um emoji 🔥: o único elemento não-desenhado da Home, e renderizava
   diferente em cada sistema. Agora é a chama da marca, na cor da marca. */
.streak-chama {
  display: inline-block;
  width: 0.85em;
  height: 1em;
  vertical-align: -0.12em;
  background: var(--flame);
  -webkit-mask: var(--chama-svg) center / contain no-repeat;
  mask: var(--chama-svg) center / contain no-repeat;
}
```

E declarar o desenho junto dos outros tokens, no bloco `:root, [data-theme='light']` (a máscara é a mesma nos dois temas; só a cor muda):

```css
  --chama-svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'%3E%3Cpath d='M10 0C10 6 4 7.5 4 14a6 6 0 0 0 12 0c0-3-1.5-5-3-6.5 0 2-1 3-2 3s-1.5-1-1.5-2.5C9.5 5 10 3 10 0z'/%3E%3C/svg%3E");
```

- [ ] **Step 4: Um nome só por coisa**

Em `src/components/SectionChips.tsx:7`, trocar `{ id: 'texto', label: 'Texto Bíblico' },` por `{ id: 'texto', label: 'Texto' },`.

Em `src/pages/Leitura.tsx`, o `<h2>` da seção `#texto` (l. 913-915) passa a dizer só `Texto`:

```tsx
        <h2 className={tituloClass('', 'cabecalho-texto') || undefined} data-fala-id="cabecalho-texto">
          Texto
        </h2>
```

**Atenção:** o crédito obrigatório da Bíblia Livre **não estava aqui** — ele mora na página `Sobre` por exigência de licença (CC BY 3.0 BR §4b). Este `<h2>` era rótulo de seção, não atribuição, e a atribuição continua intacta lá.

**Atenção 2:** `data-fala-id="cabecalho-texto"` **não muda**. Ele é a chave do manifesto de narração; renomear quebraria o realce da seção em silêncio.

- [ ] **Step 5: Verificar**

Run: `npm test && npm run lint && npm run build`
Expected: PASS nos três.

Run: `grep -rn "Texto Bíblico\|🔥" src`
Expected: nenhuma ocorrência.

Run: `grep -n 'data-fala-id="cabecalho-texto"' src/pages/Leitura.tsx`
Expected: uma ocorrência, intacta.

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css src/pages/Home.tsx src/pages/Leitura.tsx src/components/SectionChips.tsx
git commit -m "feat: a Escritura se marca pela ausência da marca

Todo <h2> de seção fica âmbar, que é a voz do app; só o #texto volta para a
tinta de leitura. A exceção vai por token (--cabecalho) e não por color no
#texto: id é 1,0,0 e atropelaria .leitura h2.heading-speaking, matando o
realce da narração justamente naquele cabeçalho.

A barra de progresso vira --flame: o progresso é a chama subindo.

E o 🔥 do streak vira chama desenhada — era o único elemento não-desenhado
da Home e renderizava diferente em cada sistema.

'Texto Bíblico' no chip e 'Texto (Bíblia Livre)' no h2 viram 'Texto' nos
dois. O crédito da licença não estava aqui: mora na página Sobre, intacto.
data-fala-id não muda — é chave do manifesto de narração."
```

---

### Task 6: "Conversar" sai do porão

Hoje a porta para a IA é a **terceira aba** de um bloco no fim da página, chamada **"Contexto"** — nome que colide com a seção "Contexto" do topo da mesma página, significando outra coisa. Num app chamado aiPericopes, esse não é o lugar dela.

**Files:**
- Modify: `src/pages/Leitura.tsx:61` (tipo `NotesTab`), `src/pages/Leitura.tsx:1035-1053` (lista de abas), `src/pages/Leitura.tsx:1145-1152` (corpo da aba `contexto`), e o bloco `.actions` logo abaixo
- Modify: `src/styles/app.css` (regra `.conversar-bloco`)

**Interfaces:**
- Consumes: `promptConversa(p)` de `src/lib/contexto-ia.ts`, assinatura inalterada: `(p: Pericope) => string`. E o handler `copyContexto` que já existe em `Leitura.tsx`.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Tirar a aba**

Em `src/pages/Leitura.tsx`, na lista de abas, remover a entrada `['contexto', 'Contexto'],`, deixando:

```tsx
            [
              ['anotacoes', 'Anotações'],
              ['topicos', 'Tópicos'],
            ] as const
```

E remover o bloco `{tab === 'contexto' && ( ... )}` inteiro daquele lugar.

Na linha 61, encolher o tipo:

```ts
type NotesTab = 'anotacoes' | 'topicos'
```

E o `aria-label` do `role="tablist"`, que hoje diz `"Anotações, tópicos e contexto"`, passa a `"Anotações e tópicos"`.

`tsc -b` é quem prova que não sobrou resto: os dois `setTab('anotacoes')` (l. 623, 743) e o `useState<NotesTab>('anotacoes')` (l. 153) continuam válidos, e o `{tab === 'contexto' && ...}` (l. 1145) vira erro de tipo se alguém esquecer de remover.

- [ ] **Step 2: Pôr a conversa junto da decisão de seguir em frente**

Ainda em `src/pages/Leitura.tsx`, logo **antes** do `<div className="actions">`, inserir:

```tsx
        {/* A porta para a IA era a terceira aba deste bloco, chamada
            "Contexto" — mesmo nome da seção histórico-literária lá em cima,
            significando outra coisa. Num app chamado aiPericopes ela não mora
            no porão, e mora aqui e não no topo porque conversar é o que se faz
            DEPOIS de ler: no alto competiria com a leitura. */}
        <div className="conversar-bloco">
          <p className="muted">
            Leve este trecho para uma conversa com IA: o texto abaixo já vem pronto para colar.
          </p>
          <pre className="contexto-ia-text">{promptConversa(p)}</pre>
          <button type="button" className="ghost copy-btn" onClick={copyContexto}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
```

- [ ] **Step 3: Estilo**

Adicionar ao `src/styles/app.css`, perto das regras `.contexto-ia`:

```css
.conversar-bloco {
  display: grid;
  gap: 0.5rem;
  justify-items: start;
  margin: 1.25rem 0 0;
  padding-top: 1.25rem;
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}
```

Se a regra `.contexto-ia` tiver ficado sem uso depois da remoção da aba, apagá-la.

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: PASS — `tsc -b` confirma que nenhum resto de `tab === 'contexto'` sobrou.

Run: `npm test && npm run lint`
Expected: PASS.

Run: `grep -n "'Contexto'" src/pages/Leitura.tsx`
Expected: só a seção histórico-literária do topo. Um "Contexto" na tela, não dois.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Leitura.tsx src/styles/app.css
git commit -m "feat: a conversa com IA sai do porão

Era a terceira aba de um bloco no fim da página, chamada 'Contexto' — o mesmo
nome da seção histórico-literária do topo, significando outra coisa. Duas
coisas diferentes com um nome só, na tela ao mesmo tempo.

Vira bloco próprio junto das ações de conclusão. Ali e não no topo porque
conversar é o que se faz DEPOIS de ler: no alto competiria com a leitura."
```

---

### Task 7: O favicon, e a página Sobre conta a regra

O `favicon.svg` é o único arquivo de arte que é **código** — dá para escrever agora. Os rasterizados (`favicon.png`, `favicon.ico`, `apple-touch-icon.png`, `pwa-*.png`, `brand/logo*.png`) dependem da logo que o dono vai gerar fora, e **ficam para uma tarefa posterior**.

**Files:**
- Modify: `public/favicon.svg`
- Modify: `src/pages/Sobre.tsx`
- Modify: `src/pages/Sobre.test.tsx`

**Interfaces:**
- Consumes: os hexes da Task 1.
- Produces: nada.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/pages/Sobre.test.tsx`, adicionar:

```ts
  it('explica de onde vem o âmbar e o que ele significa', () => {
    const txt = container.textContent ?? ''
    expect(txt).toContain('âmbar')
    // A regra tem de estar dita, não só aplicada.
    expect(txt).toMatch(/Escritura/)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/pages/Sobre.test.tsx -t "de onde vem o âmbar"`
Expected: FAIL — a página ainda não fala da marca.

- [ ] **Step 3: A seção nova na página Sobre**

Em `src/pages/Sobre.tsx`, adicionar como **última** seção do `<section className="ajustes">`:

```tsx
      <h2>A cor</h2>
      <p className="muted ajustes-credito">
        O âmbar deste app não é enfeite: ele marca onde a máquina entrou. Os títulos das
        seções, os controles e o realce que acompanha a narração são âmbar porque são a voz
        do app. O texto bíblico não é — ele fica em tinta, sem cor da marca, e é essa
        ausência que o distingue de tudo o mais que você lê aqui.
      </p>
      <p className="muted ajustes-credito">
        A única exceção é passageira: enquanto a narração lê, o âmbar percorre o versículo e
        vai embora atrás dela. É a máquina em ação, não uma marca no texto.
      </p>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/pages/Sobre.test.tsx`
Expected: PASS

- [ ] **Step 5: O favicon**

Substituir `public/favicon.svg` inteiro por:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="14" fill="#f5f1e8"/>
  <!-- "ai" em tinta, e o pingo do i é a chama: a marca da máquina é uma luz
       pequena sobre o texto. -->
  <path d="M13 46V32a9 9 0 0 1 18 0v14" stroke="#1c1914" stroke-width="5" stroke-linecap="round"/>
  <path d="M31 39H13" stroke="#1c1914" stroke-width="5" stroke-linecap="round"/>
  <path d="M45 46V30" stroke="#1c1914" stroke-width="5" stroke-linecap="round"/>
  <path d="M45 10c0 5-5 6-5 10a5 5 0 0 0 10 0c0-2.5-1.2-4.2-2.5-5.4 0 1.7-.8 2.5-1.7 2.5s-1.2-.8-1.2-2.1C44.6 13.5 45 12.5 45 10z" fill="#c4780e"/>
</svg>
```

- [ ] **Step 6: Verificar no olho**

Run: `npm run dev`

Abrir `http://localhost:5173`, e conferir:
1. A aba do navegador mostra a chama âmbar, legível no tamanho de favicon.
2. Trocar entre Claro e Escuro no menu Perfil — só duas opções, e nenhuma tela quebra.
3. Na Leitura, o `<h2>` "Texto" está em tinta e os outros (`Contexto`, `Resenha`, `Reflexões`) em âmbar.
4. Com narração, o cabeçalho falado acende — inclusive o "Texto", que é o caso que a especificidade poderia ter matado.

- [ ] **Step 7: Commit**

```bash
git add public/favicon.svg src/pages/Sobre.tsx src/pages/Sobre.test.tsx
git commit -m "feat: o favicon vira a lamparina, e a página Sobre conta a regra

O pingo do i é a chama: a marca da máquina é uma luz pequena sobre o texto,
e sobrevive a 16px. O mark antigo já tinha a chama âmbar — só que dentro de
um livro sobre fundo verde. O verde era a capa; o âmbar sempre foi a luz.

A página Sobre passa a dizer o que a cor significa. A divulgação de IA
deixa de ser só um parágrafo e vira coisa que se enxerga, sem rótulo no
tocador — cor não é rótulo, e a decisão de 'ouvir primeiro, saber depois'
continua de pé."
```

---

## Depois deste plano

Bloqueado na logo que o dono vai gerar fora:

- Rasterizar `favicon.png` (64), `apple-touch-icon.png` (180), `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png` (com margem de 20%), `favicon.ico`, `brand/logo.png` e `brand/logo-master.png`.

Vindo de `docs/kickoff-dominio-e-email.md`, e **deliberadamente fora deste plano**:

- **`APP_URL` continua no `workers.dev`.** Ela alimenta o `baseURL` do better-auth, os `trustedOrigins` e o link dentro do e-mail de login. Trocar exige que o Worker atenda no domínio novo primeiro (custom domain ou route na Cloudflare) — senão o botão "Entrar" do e-mail passa a apontar para o vazio. É a última peça, não a primeira.
- **Não renomear** o Worker (`biblia-pericopes`), o D1 nem o bucket R2: são identidade de infraestrutura, ninguém os vê, e renomear significa recriar recurso e migrar as chaves de áudio que custaram caro.

**Para quem for gerar a narração nova (Sessão 5):** o cabeçalho falado da seção do texto era `"Texto Bíblico."` nos manifestos antigos, e a tela agora diz **"Texto"**. Os manifestos velhos vão ser todos descartados, então não há nada a consertar — mas a regravação tem de falar **"Texto."**, senão a voz diz uma coisa e a tela mostra outra. Nome de seção é interface.

Backlog registrado no spec:

- **Perguntar no versículo**, no instante da dúvida — `VerseActions.tsx` já existe. É feature nova, não rebranding.
- **`--rec` vizinho do âmbar**: `#c0392b` / `#e4655a` ao lado de `--flame`. Julgar com a paleta no ar.
- **Recalibrar `--candle-fundo` e `--candle-luz-pct`** contra o carvão quente `#16130f` — foram calibrados contra o azul `#12151a`. Na tela, não no papel.
- **`--line` a 1,3:1** é fio decorativo e ficou fora do teste de contraste; mas ele também desenha a borda de `.hl-swatch`, que é controle. Pré-existente à paleta âmbar, não regressão.
