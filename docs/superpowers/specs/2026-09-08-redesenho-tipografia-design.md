# Redesenho de tipografia: Cormorant Garamond + EB Garamond (2026-09-08)

O app troca as três fontes atuais — Fraunces, Source Serif 4, DM Sans — por
duas: Cormorant Garamond nos títulos, EB Garamond em tudo o mais. O app deixa
de ter qualquer fonte sem-serifa na interface. Nenhuma cor muda.

## O estado de hoje

Três tokens de família em `src/styles/app.css:65-67`:

```css
--font-display: 'Fraunces Variable', Georgia, serif;
--font-body: 'Source Serif 4 Variable', Georgia, serif;
--font-ui: 'DM Sans Variable', system-ui, sans-serif;
```

Mais o fallback de leitura em `app.css:69`: `--read-font: 'Source Serif 4
Variable', Georgia, serif;` — o valor que vale antes de qualquer preferência
do usuário existir.

Cinco pacotes Fontsource em `package.json:40-44`:
`@fontsource-variable/dm-sans`, `.../fraunces`, `.../literata`,
`.../source-sans-3`, `.../source-serif-4`. Todos importados em
`src/main.tsx:5-9`:

```ts
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/dm-sans'
```

Literata, Source Serif 4 e Fraunces entram por `/opsz.css` porque as três têm
eixo variável `opsz`; Source Sans 3 e DM Sans entram puros porque não têm.

`src/lib/reading-prefs.ts` define as três opções de fonte de leitura
(`FONT_OPTIONS`, linhas 30-34):

```ts
export const FONT_OPTIONS: { id: ReadingFont; label: string; stack: string }[] = [
  { id: 'serif', label: 'Serif', stack: "'Source Serif 4 Variable', Georgia, serif" },
  { id: 'literata', label: 'Literata', stack: "'Literata Variable', Georgia, serif" },
  { id: 'sans', label: 'Sans', stack: "'Source Sans 3 Variable', 'DM Sans Variable', system-ui, sans-serif" },
]
```

E a escala de tamanho (`SIZE_STEPS`, linha 18): `[0.95, 1.05, 1.15, 1.28, 1.42,
1.58]` rem, com `DEFAULTS.sizeStep = 2` (linha 37) — hoje 1.15rem, 18,4px na
raiz de 16px que o projeto não sobrescreve (`html` só tem `overflow-x: clip`,
`app.css:156-158`).

`index.html:12-47` tem um script inline que roda antes do bundle e duplica,
de propósito (comentário na linha 27-28), os mesmos três pedaços: o mapa de
fontes (linhas 31-35), os `SIZE_STEPS` (linha 29) e os `LEADING_STEPS`
(linha 37). Se um lado muda e o outro não, a tela pisca no valor errado até o
React montar.

`src/components/LeituraPrefs.tsx` não hard-codeia nome de fonte nenhum — lê
`FONT_OPTIONS` e `SIZE_STEPS` por import e desenha os botões `A−`/`A+` e os
três de fonte a partir daí. **Este arquivo não precisa de nenhuma edição.**

Os componentes com `font-family: var(--font-display)` (títulos), 12
ocorrências (`app.css:237, 254, 330, 340, 546, 1103, 2056, 2073, 2162, 2244,
2867, 2890`), e `var(--font-ui)`, ~50 ocorrências, herdam a nova fonte
automaticamente pelo token — sem editar cada seletor.

Versões conferidas no npm nesta sessão:

| pacote | versão |
|---|---|
| `@fontsource-variable/cormorant-garamond` | 5.3.0 |
| `@fontsource-variable/eb-garamond` | 5.3.0 |

Ambos existem como variável — não precisa cair para o pacote estático. Baixei
os dois pacotes (`npm pack --dry-run` e extração local, sem instalar no
projeto) para conferir os eixos reais:

- **Cormorant Garamond Variable**: eixo `wght` 300–700, sem `opsz`. Pacote
  default (`index.css` = `wght.css`) só tem o estilo normal; itálico mora em
  `wght-italic.css`, que este projeto não importa hoje (nem importa itálico de
  nenhuma fonte atual).
- **EB Garamond Variable**: eixo `wght` 400–800, sem `opsz`. Mesmo padrão:
  default = só normal, itálico separado e não importado.

## Decisões de partida

Tomadas com o dono antes desta spec, não reabertas aqui:

1. Saem do app: Fraunces, Source Serif 4, DM Sans. Entram Cormorant Garamond
   (títulos) e EB Garamond (corpo e interface). Sem sem-serifa na interface.
2. Os três tokens de família continuam com os mesmos nomes, só muda o valor.
3. As três chaves de fonte de leitura (`serif`/`literata`/`sans`) continuam
   existindo. `serif` passa a apontar para EB Garamond (era Source Serif 4).
   `literata` continua Literata. `sans` continua Source Sans 3 — fica por
   acessibilidade, não é para sair.
4. Cormorant e EB Garamond têm altura-x menor que Source Serif 4: a escala de
   leitura sobe um degrau, de `[0.95, 1.05, 1.15, 1.28, 1.42, 1.58]` para algo
   como `[1.02, 1.12, 1.22, 1.36, 1.50, 1.66]`, mantendo o índice padrão 2
   (~19,5px). Valor a conferir lado a lado antes de fechar.
5. Rampa de título (Cormorant Garamond): h1 de perícope 39px/300/entrelinha
   1,05; h1 de página 38–41px/300; h2 de card 27px/500; rótulo de capítulo
   15px (leitura de referência no tamanho padrão — continua relativo a
   `--read-size`, como hoje, não um px fixo) /600, `letter-spacing: 0.1em`,
   caixa alta. O peso 300 nos corpos grandes é deliberado.
6. Rampa de leitura (EB Garamond): escritura e prosa em `var(--read-size)` com
   entrelinha 1,72; reflexões acompanham `var(--read-size)` (17,5px é a
   leitura de referência no tamanho padrão, não um px fixo) com entrelinha
   1,62; referência e metadados 14,5px/1,5; rótulo de seção 11,5px/600 caixa
   alta, `letter-spacing: 0.19em`, cor `--accent`.
7. Botões e chips em EB Garamond peso 600, nunca caixa alta. Só rótulos de
   seção e abas da barra de seções usam caixa alta espaçada.
8. ~~Capitular na primeira letra de cada capítulo.~~ **Revogada em 09/09 depois
   de ver rodando**: a letra grande em âmbar rouba a atenção do versículo que
   ela deveria abrir, e o número do versículo seguinte fica encostado nela. Não
   há capitular no app; a seção "Capitular" adiante fica como registro do que
   foi tentado e por quê.
9. `font-optical-sizing: auto` perde função — nenhuma das duas fontes novas
   tem eixo `opsz`.
10. Nenhuma cor muda. Nenhum hex é tocado por esta spec.

## Pacotes e imports

`package.json`:

```diff
- "@fontsource-variable/dm-sans": "^5.3.0",
- "@fontsource-variable/fraunces": "^5.3.0",
+ "@fontsource-variable/cormorant-garamond": "^5.3.0",
+ "@fontsource-variable/eb-garamond": "^5.3.0",
  "@fontsource-variable/literata": "^5.3.0",
  "@fontsource-variable/source-sans-3": "^5.3.0",
- "@fontsource-variable/source-serif-4": "^5.3.0",
```

Source Serif 4 sai por completo: as únicas quatro referências a ele no repo
(`app.css:66`, `app.css:69`, `reading-prefs.ts:31`, `index.html:32`) são
exatamente as que a chave `serif` está migrando para EB Garamond. Depois da
migração, nada mais usa Source Serif 4.

`src/main.tsx:5-9` — de:

```ts
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/dm-sans'
```

para:

```ts
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource-variable/eb-garamond'
```

Sem `/opsz.css` nas duas novas — confirmado acima, nenhuma tem esse eixo, e
importar um arquivo que não existe no pacote quebra o build. Literata mantém
`/opsz.css` (ainda tem o eixo, ainda é opção de leitura).

## Os tokens

`app.css:65-69`, de:

```css
--font-display: 'Fraunces Variable', Georgia, serif;
--font-body: 'Source Serif 4 Variable', Georgia, serif;
--font-ui: 'DM Sans Variable', system-ui, sans-serif;
--read-size: 1.15rem;
--read-font: 'Source Serif 4 Variable', Georgia, serif;
```

para:

```css
--font-display: 'Cormorant Garamond Variable', Georgia, 'Times New Roman', serif;
--font-body: 'EB Garamond Variable', Georgia, 'Times New Roman', serif;
--font-ui: 'EB Garamond Variable', Georgia, 'Times New Roman', serif;
--read-size: 1.22rem; /* acompanha o novo SIZE_STEPS[2], ver seção seguinte */
--read-font: 'EB Garamond Variable', Georgia, 'Times New Roman', serif;
```

**Atenção ao nome exato da família.** A decisão do dono escreveu
`'Cormorant Garamond'` e `'EB Garamond'`, sem o sufixo. Os `@font-face` que o
pacote *variável* do Fontsource registra chamam-se `'Cormorant Garamond
Variable'` e `'EB Garamond Variable'` — é assim que todo token e toda entrada
de `FONT_OPTIONS` já fazem hoje (`'Source Serif 4 Variable'`, `'Literata
Variable'`, `'Source Sans 3 Variable'`, `'DM Sans Variable'`). Sem o sufixo, o
nome no CSS não bate com nenhum `@font-face` carregado, a fonte nunca
resolve, e o app cai silenciosamente no Georgia do fallback — sem erro, sem
aviso, com a interface inteira "certa" na inspeção do código e errada na
tela. Esta spec fecha com o sufixo, seguindo o padrão já estabelecido no
arquivo.

`--font-body` e `--font-ui` recebem o mesmo valor (`'EB Garamond Variable'`),
igual já acontecia hoje entre `--font-body` (Source Serif 4) e nada mais — a
diferença nova é que agora os dois tokens de fato coincidem.

## SIZE_STEPS e o índice padrão

`reading-prefs.ts:18`, de `[0.95, 1.05, 1.15, 1.28, 1.42, 1.58]` para
`[1.02, 1.12, 1.22, 1.36, 1.50, 1.66]`. Em px (raiz 16px):

| índice | hoje | proposto |
|---|---|---|
| 0 | 15,2px | 16,3px |
| 1 | 16,8px | 17,9px |
| 2 (padrão) | 18,4px | **19,5px** |
| 3 | 20,5px | 21,8px |
| 4 | 22,7px | 24,0px |
| 5 | 25,3px | 26,6px |

`DEFAULTS.sizeStep` continua `2` — não muda o índice, muda o que o índice
vale. **Valor a conferir lado a lado** (mesmo parágrafo, Source Serif 4 em
18,4px ao lado de EB Garamond em 19,5px) antes de fechar; a tabela acima é
ponto de partida, não veredito.

`index.html:29` tem a cópia espelhada — mesmo array, mesma edição.

### Entrelinha da escritura e da prosa: o degrau que a decisão dá sem tocar `LEADING_STEPS`

A decisão de partida 6 fixa **1,72** como entrelinha de escritura/prosa. Hoje
esse valor não é uma constante solta — é `LEADING_STEPS[1]` (`reading-
prefs.ts:21`, valor `1.65`), porque `DEFAULTS.leadingStep = 1` (linha 40) e é
esse índice que o app aplica de fábrica, tanto pelo bundle quanto pelo script
inline. O fallback do `var()` no CSS (`var(--read-leading, 1.65)`, quatro
ocorrências: `app.css:1094` em `.texto-biblico`, `1601` em `.corrido`, `1728`
em `.prose` e `1740` em `.perguntas`) só vale se a custom property nunca for
definida — o que não
acontece em uso normal, já que tanto `index.html` quanto `applyReadingPrefs`
sempre a definem antes da primeira pintura.

Para 1,72 valer de fato como padrão, a edição mínima é trocar só o item do
meio do array — `LEADING_STEPS[1]`: `1.65` → `1.72`, ficando `[1.5, 1.72, 1.8,
1.95]` — e os quatro fallbacks de `1.65` para `1.72`, para os dois lados
concordarem mesmo no caso teórico de a custom property faltar. Os outros três
degraus (1,5 / 1,8 / 1,95) não têm número novo na decisão e ficam como estão.
**Isto não está coberto literalmente pela decisão 4 (que fala só de
`SIZE_STEPS`)** — é a leitura mais direta de "entrelinha 1,72" combinada com
"o índice padrão continua o mesmo", registrada aqui para não inventar no
código sem deixar rastro. Mesma cópia espelhada em `index.html:37-38`.

### O teste que quebra junto — `src/lib/reading-prefs.test.ts`

Esta é a única mudança da spec que derruba a suíte:
`src/lib/reading-prefs.test.ts:65` afirma o valor aplicado de
`--read-leading` letra por letra, e o valor é o do índice padrão:

```ts
expect(document.documentElement.style.getPropertyValue('--read-leading')).toBe('1.65')
```

Com `LEADING_STEPS[1]` indo para `1.72`, `setReadingMeasure('larga')` passa a
aplicar `1.72` e a asserção **falha**. A correção é trocar a string esperada
para `'1.72'` — nada mais no arquivo depende do valor (as outras asserções do
mesmo `it` são sobre `--read-measure` e sobre o índice, não sobre o número da
entrelinha; `bumpReadingLeading` só testa índices e as travas das pontas, que
não mudam).

`src/lib/reading-prefs.test.ts` entra, portanto, na lista de arquivos
alterados desta spec — é o único arquivo de teste tocado.

## Rampa de título (Cormorant Garamond)

### h1 de perícope

Novo seletor `.leitura h1` — o título da perícope (`Leitura.tsx:828`) é a
única coisa renderizada como `<h1>` dentro de `<article className="leitura">`
(`Leitura.tsx:821`), então o seletor não pede nenhuma classe nova em JSX:

```css
.leitura h1 {
  font-weight: 300;
  font-size: 2.4375rem; /* 39px */
  line-height: 1.05;
  letter-spacing: 0;
}
```

`letter-spacing: 0` some da regra genérica (`-0.02em`) — negativo foi ajuste
para o Fraunces em peso 700; em peso 300 aperta o desenho da letra em vez de
compactar. Não é número que o dono deu; é consequência técnica de trocar o
peso, registrada para checar visualmente, não para reabrir a decisão.

### h1 de página

A regra genérica `h1` (`app.css:329-336`), usada por `Entrar.tsx:73`,
`Ajustes.tsx:103`, `Home.tsx:114,156`, `Jornada.tsx:394,407`, `Sobre.tsx:30`:

```css
h1 {
  font-weight: 300;
  font-size: clamp(2.375rem, 4vw, 2.5625rem); /* 38–41px */
  line-height: 1.15; /* inalterado — a decisão só fixa peso e tamanho aqui */
  letter-spacing: 0;
  margin: 0 0 0.35rem;
  text-wrap: balance;
}
```

`.leitura h1` tem especificidade maior (`0,1,1` contra `0,0,1`) e vence a
regra genérica sem `!important`.

### h2 de card

"Card" aqui é literal: só dois lugares têm chrome de cartão (fundo, borda,
`border-radius`, padding) **e** um `<h2>` dentro — `.jornada-card`
(`app.css:2442-2448`, usado em `Home.tsx:128`) e `.track-card`
(`app.css:461-466`, usado em `Home.tsx:175`). Os `<h2>` de `Leitura.tsx`
(Contexto/Texto/Resenha/Reflexões) vivem em `.block.block-plain`, que o
comentário da própria regra descreve como "surface only, no card chrome"
(`app.css:618-624`) — não são card, ficam de fora. `.vale-reler h2`
(`app.css:507`) também não tem chrome — fica de fora.

`.track-card h2` já existe e só tinha `font-size` (`app.css:468-471`);
`.jornada-card h2` não existe, herda hoje da regra `h2` genérica. Consolidar
os dois num bloco novo:

```css
.jornada-card h2,
.track-card h2 {
  font-size: 1.6875rem; /* 27px */
  font-weight: 500;
  margin: 0.15rem 0 0.35rem;
}
```

A regra `.track-card h2` existente (linhas 468-471) é substituída por este
bloco; nada mais muda em `.jornada-card`.

O `h2` genérico (`app.css:339-343`) — usado pelas seções de Leitura, por
`Jornada.tsx` ("Escolha um escopo", "Confirme sua jornada"), por `.vale-reler
h2` — **não muda de número**, só de fonte via token. Fica em 1,2rem, peso
padrão do navegador (bold, já que a regra não declara `font-weight`).

### Rótulo de capítulo

`.cap-label` (`app.css:1102-1109`), hoje `font-size: 0.95em` — em `em`,
relativo ao `font-size` do ancestral, que é `var(--read-size)`: o rótulo de
capítulo escala junto com o controle A−/A+ hoje, e **continua escalando** —
é prosa de leitura tanto quanto o texto que anuncia, não chrome de
interface. O "15px" da decisão 5 é a leitura de referência no índice padrão
novo (`var(--read-size)` = 1,22rem × 0,95em ≈ 15,3px), não um valor fixo em
px. Só peso, espaçamento, caixa e cor mudam:

```css
.cap-label {
  font-size: 0.95em; /* inalterado — continua relativo a var(--read-size) */
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 1.1rem 0 0.45rem;
}
```

`.cap-label:first-child` (linha 1111) não muda.

## Rampa de leitura (EB Garamond)

**Critério para quem implementar, para não ter que adivinhar caso a caso:**
tudo que é **prosa de leitura** — escritura, contexto, resenha, reflexões,
tópicos, as palavras do trecho — escala com `var(--read-size)`, porque a
tipografia de leitura vale para toda prosa, não só o texto bíblico (é o que
as specs de UX de leitura já registram). Só **chrome de interface** — rótulo
de seção, referência, metadados, botões, chips, abas — pode ter tamanho fixo
em px. Nenhum item da rampa abaixo fixa um tamanho de prosa em px.

### Escritura e prosa

`.texto-biblico` (`app.css:1091-1099`) e `.prose` (`app.css:1724-1731`) já
usam `font-size: var(--read-size)` e `line-height: var(--read-leading,
1.65)`. Só o fallback muda, para `1.72` (seção acima) — o valor de fato
aplicado já vem de `LEADING_STEPS[1]`.

### Reflexões

`.perguntas` (`app.css:1733-1742`), hoje:

```css
.perguntas {
  font-size: calc(var(--read-size) * 0.96);
  line-height: var(--read-leading, 1.65);
}
```

Correção sobre a primeira versão desta spec: Reflexões são leitura de
primeira classe, tanto quanto Escritura, Contexto e Resenha — a régua A−/A+
tem que valer para as quatro. `font-size` **não muda**, continua
`calc(var(--read-size) * 0.96)`. Só a entrelinha deixa de seguir o controle
de espaçamento do usuário e passa a um valor fixo:

```css
.perguntas {
  font-size: calc(var(--read-size) * 0.96); /* inalterado */
  line-height: 1.62; /* fixo — não mais var(--read-leading) */
}
```

O "17,5px" da decisão 6 é a leitura de referência com o `--read-size` no
índice padrão de **hoje**, antes desta spec (1,15rem × 0,96 ≈ 17,7px). Com o
`SIZE_STEPS` novo (seção acima), o mesmo cálculo no índice padrão novo dá
1,22rem × 0,96 ≈ 18,7px — maior, porque é exatamente isso que a decisão 4
pede: a régua toda sobe um degrau, e Reflexões sobe junto por ser prosa de
leitura. O número "17,5px" nunca aparece literal no CSS.

### Referência e metadados

`.ref, .muted` (`app.css:345-350`), hoje `font-size: 0.95rem` sem
`line-height` próprio (herda o `1.55` do `body`, `app.css:163`):

```css
.ref,
.muted {
  font-size: 0.90625rem; /* 14.5px */
  line-height: 1.5;
}
```

Afeta `.ref-row .ref` (`app.css:733-737`, sem `font-size` próprio, herda
daqui) e todo uso solto de `.muted`. Outros textos pequenos do app
(`.streak`, `.badge`, `.notes-tab`, abas de `Explorar`) não são "referência e
metadados" no sentido da decisão — ficam com o número que já têm, só trocam
de fonte pelo token.

### Rótulo de seção

A decisão nomeia um único padrão (11,5px/600/caixa alta/`0.19em`/`--accent`)
para o que a decisão 7 chama de "rótulos de seção". No CSS de hoje esse
padrão não é uma classe só — é uma família de pequenos rótulos em caixa alta
espalhados pelo app, com números e cores que já divergem entre si:

| seletor | linha | cor hoje | tamanho hoje |
|---|---|---|---|
| `.eyebrow` | `app.css:320` | `--accent` | 0,75rem |
| `.track-label` | `app.css:473` | `--accent` | 0,75rem |
| `.narracao-rotulo` | `app.css:1165` | `--muted` | 0,72rem |
| `.perfil-secao` | `app.css:2743` | `--muted` | 0,72rem |
| `.jornada-grupo h3` | `app.css:2539` | `--muted` | 0,8rem |
| `.secao-h` / `.section-h` | `app.css:2078, 2895, 2936` | `--muted` | 0,75–0,8rem |
| `.palavras-titulo` | `app.css:2962` | `--accent` | 0,72rem |

Esta spec fecha o alvo só para `.eyebrow` (`app.css:320-327`) — é o único que
já é acento, já é caixa alta e já é literalmente usado como "chamada de
seção" antes de um título (`Home.tsx:113,155`, o "Estudo de hoje" antes do
h1):

```css
.eyebrow {
  font-size: 0.71875rem; /* 11.5px */
  font-weight: 600;
  letter-spacing: 0.19em;
}
```

Os outros seis seletores da tabela **não mudam de número nesta spec** — cor
`--muted` é uma escolha deliberada de hierarquia (rótulo secundário, não
título de seção), e decisão 10 já veda mexer em cor. Se a intenção do dono
for unificar todos os sete numa família visual só, isso é uma decisão nova,
fora do escopo desta spec — registrado aqui para não passar batido.

## Botões e chips: peso 600, nunca caixa alta — e a exceção das abas

Nenhum botão ou chip do app usa `text-transform: uppercase` hoje (conferido:
os únicos nove seletores com `uppercase` no arquivo são rótulos, não
controles). A decisão 7 é uma trava, não uma remoção: **continua** assim, e
os três que hoje não têm peso 600 explícito ganham:

```css
.ghost,
button.ghost {
  font-weight: 600; /* app.css:604-616 não tinha */
}

.chip-filtro {
  font-weight: 600; /* app.css:2913-2924 só o .active tinha */
}
```

(`.chip-filtro.active`, linha 2925, já tem `font-weight: 600` — fica
redundante, não precisa remover.)

### Abas da barra de seções — a exceção

A segunda exceção da decisão 7 ("abas da barra inferior") é o controle
segmentado Contexto/Texto/Resenha/Reflexão/Notas, sticky logo abaixo do
header (`.section-chips-row` + `.section-chip`, `app.css:882-909`) — descrito
na spec anterior (`2026-09-03-chrome-header-perfil-design.md`, seção "A barra
de chips") como a barra que fica *abaixo* do header, não uma barra no rodapé
da tela. Sinalizo a identificação porque a frase não é literal em nenhum
seletor do código; é a única barra de abas do app, e é ela que se opõe aos
botões/chips comuns na decisão.

```css
.section-chip {
  font-weight: 600; /* era 500 */
  text-transform: uppercase;
  letter-spacing: 0.06em; /* mais estreito que o rótulo de seção (0.19em):
                              é controle clicável, não rótulo passivo — precisa
                              caber cinco abas numa grade de quatro colunas
                              sem quebrar linha em 375px */
}
```

Tamanho (`font-size: 0.78rem`, linha 904) fica como está. O valor de
`letter-spacing` acima **não vem da decisão** — ela só diz que a barra "usa
caixa alta espaçada", sem número. Proposta a conferir visualmente junto com
o resto, testando especificamente em 375px (a barra é uma grade de 4
colunas, `.section-chips-row`, `app.css:882-891`, e "Reflexão" é o rótulo
mais longo).

## Capitular

> **Revogada.** Foi implementada, vista rodando e removida no mesmo dia — ver a
> decisão 8. O que segue vale como registro: o pseudo-elemento não funciona
> aqui, e quem tentar de novo cai no mesmo problema do número de versículo.

Ornamento novo, sem equivalente hoje. Alvo: a primeira letra do texto de
cada capítulo dentro de `.texto-biblico`.

### O problema do número de versículo

Cada versículo é `<sup class="verse-num">N</sup><span class="verse-text">
texto</span>` dentro de um `<button>` (`Leitura.tsx:951-952` no layout
"corrido", linhas 980-981 no layout "blocos"). Um `::first-letter` aplicado
ao contêiner do parágrafo ou do botão pega o `N` do `<sup>`, não a letra do
texto — exatamente o defeito que a decisão 8 pede para evitar. A correção é
mirar o `::first-letter` direto no `<span class="verse-text">`, nunca no
elemento que contém o `<sup>` antes dele.

### Os dois layouts de leitura

`prefs.layout` (`reading-prefs.ts:5`) tem dois modos e cada um estrutura o
DOM diferente (`Leitura.tsx:930-984`):

- **Corrido**: cada capítulo é uma `<div class="corrido-group">` com um
  `<h3 class="cap-label">` e um único `<p class="corrido">` que contém todos
  os `<button class="verse-inline">` do capítulo em sequência
  (`Leitura.tsx:934-957`). O primeiro filho-elemento do `<p>` é sempre o
  primeiro `<button>` do capítulo.
- **Blocos**: `<h3 class="cap-label">` e `<button class="verse">` são irmãos
  diretos dentro de `.texto-biblico`, alternando conforme o capítulo muda
  (`Leitura.tsx:958-984`). O primeiro verso de um capítulo é sempre o
  `.verse` que vem logo depois do `.cap-label` daquele capítulo.

```css
.texto-biblico .corrido > .verse-inline:first-child .verse-text::first-letter,
.texto-biblico .cap-label + .verse .verse-text::first-letter {
  font-family: var(--font-display);
  font-size: 3.5em;
  line-height: 0.8;
  float: left;
  font-weight: 500;
  color: var(--accent);
}
```

Isto dá capitular em **cada** capítulo da perícope, não só no primeiro —
condizente com "a primeira letra de cada capítulo" na decisão 8. O
`.sobrescrito` do salmo (`Leitura.tsx:923-929`, `app.css:1079-1090`) não
entra: é um `<p>` fora de `.texto-biblico`, renderizado antes dele.

### O risco que só se vê ao vivo

`TextoFalado` (`Leitura.tsx:69-88`) só quebra o texto em `<span data-w>` por
palavra **quando o trecho está sendo narrado** (`if (!ativo) return
<>{texto}</>`, linha 69) — no repouso, `.verse-text` é texto puro e o
`::first-letter` funciona sem ambiguidade. Se o primeiro versículo de um
capítulo for justamente o que está em fala no momento, `.verse-text` passa a
ter um `<span data-w="0">` como primeiro filho, e a capitular depende de o
motor do navegador atravessar dois níveis de aninhamento (`.verse-text` →
`span[data-w]` → texto) em vez de um. Não deu para testar sem navegador
nesta sessão. **Verificar ao vivo**: abrir uma perícope, deixar a narração
alcançar o primeiro versículo de um capítulo, e olhar se a capitular
continua no lugar. Se quebrar, a correção fica para a implementação (ex.:
`.verse-text > [data-w]:first-child::first-letter` como seletor adicional) —
não é motivo para adiar esta spec, é item do checklist abaixo.

## `font-optical-sizing: auto`

Hoje em `.texto-biblico, .prose, .perguntas` (`app.css:1016-1022`). Nem
Cormorant Garamond Variable nem EB Garamond Variable têm eixo `opsz`
(confirmado extraindo os dois pacotes: só arquivos `wght`/`wght-italic`,
nenhum `opsz`) — a propriedade fica **inócua**: o navegador a lê, não tem o
que ajustar, e não muda nada no glifo. Não quebra nada ficando. Recomendo
remover por limpeza (é uma linha morta depois desta troca), mas isto não é
obrigatório para o redesenho funcionar — sinalizado como decisão de
implementação, não de design.

## localStorage: o que acontece com o que já está salvo

Nenhuma migração é necessária. A chave (`pericopes-reading`) e o formato
(`ReadingPrefs`) não mudam — `sizeStep` continua um índice 0-5, `font`
continua `'serif' | 'literata' | 'sans'`, `leadingStep` continua um índice
0-3. `getReadingPrefs()` (`reading-prefs.ts:44-69`) só valida que o índice
salvo está dentro do tamanho do array atual; como os arrays continuam com o
mesmo número de posições, todo valor salvo hoje continua válido amanhã.

O que muda é *o que cada índice significa*, na próxima vez que
`applyReadingPrefs` rodar (ou o script inline de `index.html` na próxima
carga):

- Quem salvou `sizeStep: 0` (menor) lia 15,2px; passa a ler 16,3px — o
  "menor" continua sendo o menor da escala, só que a escala inteira subiu um
  degrau (decisão 4).
- Quem salvou `font: 'serif'` lia Source Serif 4; passa a ler EB Garamond
  Variable, sem aviso, sem escolha — é a decisão 3 em ação. `'literata'` e
  `'sans'` continuam apontando para as mesmas fontes de sempre.
- `leadingStep` e `measure` não mudam de significado nesta spec.

Nada precisa zerar preferência nenhuma; a próxima renderização já aplica os
novos valores por trás dos mesmos índices salvos.

## O que muda no script inline de `index.html`

Três blocos espelhados (comentário nas linhas 27-28 avisa: mudou lá, muda
aqui):

1. Linha 29 — `steps`: mesmo array novo de `SIZE_STEPS`.
2. Linhas 31-35 — `fonts`: `serif` passa a `"'EB Garamond Variable', Georgia,
   'Times New Roman', serif"`; a entrada `sans` perde a referência a `'DM
   Sans Variable'` (fica só `"'Source Sans 3 Variable', system-ui,
   sans-serif"` — a fonte está saindo do projeto, a referência morta não
   quebra nada hoje porque o navegador simplesmente pula para o próximo nome
   da lista, mas fica falsa).
3. Linha 37 — `leadings`: `[1.5, 1.72, 1.8, 1.95]`, mesmo ajuste da seção
   "Entrelinha" acima.

Nada na lógica do script muda — só os três literais.

## `reading-prefs.ts`: a mesma referência morta

`FONT_OPTIONS[2].stack` (linha 33) tem o mesmo `'DM Sans Variable'` solto no
fallback do `sans`. Mesma correção: tira a referência, sobra `"'Source Sans 3
Variable', system-ui, sans-serif"`.

## Checklist de verificação visual

1. Abrir uma perícope e comparar o título (h1) e os quatro cabeçalhos de
   seção (Contexto/Texto/Resenha/Reflexões) — a fonte trocou, o peso 300 do
   h1 não pode parecer fraco/apagado no tamanho real da tela.
2. No mesmo texto, alternar as três fontes de leitura (Serif/Literata/Sans)
   pelo Perfil e comparar o tamanho aparente — é o teste lado a lado que a
   decisão 4 pede antes de fechar o `SIZE_STEPS` novo.
3. Rolar até a virada de capítulo: a capitular precisa cair na primeira
   LETRA, nunca no número do versículo, nos dois layouts (Corrido e Blocos,
   trocar pelo Perfil).
4. Deixar a narração alcançar o primeiro versículo de um capítulo e olhar se
   a capitular sobrevive (risco descrito acima).
5. Home: comparar o h2 dentro do card de jornada e dentro dos cards de
   trilha (Velho/Novo Testamento) — os dois têm que ficar iguais entre si
   (27px/500) e visivelmente diferentes do h2 "Vale reler" logo abaixo, que
   não é card e não muda.
6. Abrir o Perfil (`Aa`) em 375px: os botões de fonte e a barra de abas
   Contexto/Texto/Resenha/Reflexão/Notas não podem quebrar linha nem
   apertar demais com o `letter-spacing` novo.
7. Comparar `.eyebrow` ("Estudo de hoje" na Home) com um rótulo que
   **não** mudou (`.narracao-rotulo`, no player de narração) — os dois vão
   ficar com tamanho/peso diferentes de propósito; checar que a diferença
   lê como hierarquia, não como inconsistência.
8. Testar `.sobrescrito` (itálico de epígrafe de salmo, ex.: Salmo 3) — vai
   sair em itálico sintético do navegador, igual sai hoje com Source Serif
   4; não é regressão desta spec, mas vale olhar uma vez.
9. Fora da tela: `npm test` (a asserção de `--read-leading` em
   `reading-prefs.test.ts` precisa ter sido atualizada para `'1.72'`, senão
   quebra aqui), `npx tsc -b`, `npx oxlint` e `npm run build` passam.

## Fora do escopo

- **Cor.** Nenhum hex muda (decisão 10). `--accent`, `--accent-soft`,
  `--muted` etc. seguem exatamente como estão.
- **A marca (`.brand`, `.brand-wordmark`, `app.css:233-256`).** Usa
  `--font-display` e herda Cormorant Garamond automaticamente pelo token,
  mas a decisão não dá número novo para ela — peso 700/600 e
  `letter-spacing: -0.02em` ficam como estão. Se o logotipo não ficar bem em
  Cormorant, é uma decisão à parte.
- **Itálico de verdade.** As duas fontes novas têm itálico variável
  (`wght-italic.css`) que este pacote não importa — mesma situação de hoje
  com Source Serif 4. Importar itálico de verdade para `.sobrescrito` é
  melhoria possível, não desta spec.
- **Unificar a família de "rótulos de seção".** Seis dos sete candidatos
  (tabela acima) mantêm seus números atuais; só `.eyebrow` muda. Uma
  padronização visual entre os sete é decisão nova.
- **Qualquer coisa em `App.tsx` ou no chrome do header.** Esta spec não
  toca navegação, menu Perfil ou popover — só tipografia.
- **`LEADING_STEPS[0]`, `[2]`, `[3]`** (1,5 / 1,8 / 1,95). Só o índice
  padrão (`[1]`) muda, e mesmo assim por inferência da decisão 6, não por
  número explícito dela.

## Riscos

1. **Nome da família sem o sufixo "Variable".** Já é o ponto mais fácil de
   errar nesta spec — decisão 2 escreve `'Cormorant Garamond'`/`'EB
   Garamond'`, o pacote registra `'Cormorant Garamond Variable'`/`'EB
   Garamond Variable'`. Errar isso não quebra o build; quebra a fonte em
   silêncio, e só aparece olhando a tela, não o código.
2. **`SIZE_STEPS` e `LEADING_STEPS[1]` são valores a confiar, não a
   verificar.** Ninguém neste ambiente tem navegador para medir altura-x ao
   vivo; os números desta spec são ponto de partida coerente com a decisão
   4, não medição.
3. **A capitular sob narração ativa** (seção "Capitular" acima) depende de
   comportamento de `::first-letter` que só se confirma num navegador real.
4. **Reflexões e rótulo de capítulo perdem a entrelinha ajustável.** Os dois
   continuam escalando com `--read-size` (corrigido — ver seções acima), mas
   a entrelinha de Reflexões vira fixa em 1,62 e para de seguir o controle de
   espaçamento do Perfil; é o único ponto da rampa de leitura onde o usuário
   perde um grau de ajuste, e vale conferir se isso incomoda na prática.
