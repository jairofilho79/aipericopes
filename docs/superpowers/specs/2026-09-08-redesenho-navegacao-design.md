# Navegação principal: barra de abas embaixo, Perfil vira página (2026-09-08)

Esta spec reverte parcialmente a `2026-09-03-chrome-header-perfil-design.md`: o
menu `Perfil` deixa de ser popover e vira rota. O motivo não é estético — é que
a divulgação obrigatória (voz de IA, licença CC BY do texto bíblico) ficou a
dois toques de distância dentro de um popover, e um desses toques num alvo
pequeno. Uma rota própria não tem esse problema: chega-se a ela, fica-se nela,
lê-se.

Junto com essa reversão, a navegação principal desce para uma barra de abas
fixa no rodapé, e a Leitura ganha um topo contextual no lugar do breadcrumb.

Coordena com duas fases paralelas já em rascunho neste worktree:
`2026-09-08-redesenho-narracao-toque-design.md` (a doca de narração, que passa
a ocupar o rodapé da Leitura no lugar da barra de abas) e
`2026-09-08-redesenho-marca-design.md` (troca os arquivos de marca, mas não
mexe em navegação). Ver "Fronteiras com specs paralelas" no fim.

## O estado de hoje

O header inteiro mora em `Shell` (`src/App.tsx:17-89`). Ele renderiza, sempre,
um `<header className="top">` com a marca (`App.tsx:47-63`) e uma `<nav>`
(`App.tsx:65-72`) de três itens — `Jornada`, `Explorar`, `PerfilMenu` — mais o
auto-ocultar:

```ts
// App.tsx:19-21
const [perfilAberto, setPerfilAberto] = useState(false)
const headerHidden = useHideOnScroll(pathname.startsWith('/leitura/') && !perfilAberto)
```

`useHideOnScroll` (`src/lib/use-hide-on-scroll.ts:7-36`) é um hook genérico:
esconde ao rolar para baixo além de 80px, mostra ao rolar 4px para cima. Hoje
só é chamado uma vez, em `Shell`, e só faz algo em `/leitura/*` — o
`perfilAberto` existe só para travar o auto-ocultar enquanto o popover está
aberto (`App.tsx:20,71`), porque rolar não fecha um popover, e o header
sumiria levando o menu junto.

`PerfilMenu` (`src/components/PerfilMenu.tsx`, 164 linhas) é um `<button
aria-haspopup="dialog">` (`PerfilMenu.tsx:70-79`) sobre `usePopover()`
(`src/lib/use-popover.ts:29`, foco preso, Escape, clique fora — testado em
`use-popover.test.ts`). O popover mostra, nesta ordem: Tema (`TEMAS`,
`PerfilMenu.tsx:10-14,88-106`), a seção Leitura só quando
`mostrarPrefsDeLeitura(pathname)` é verdadeiro (`src/lib/perfil-secoes.ts:5-7`,
`PerfilMenu.tsx:108-113`), um separador, `Ajustes`, `Sobre`
(`PerfilMenu.tsx:117-128`) e por fim `Entrar` ou `Sair`
(`PerfilMenu.tsx:130-159`) — nunca o gatilho da nav, que mostra sempre
"Perfil", logado ou não (`PerfilMenu.tsx:21-29`).

`LeituraPrefs` (`src/components/LeituraPrefs.tsx`, 111 linhas) é só os cinco
controles de tipografia (tamanho, fonte, layout, entrelinha, medida), sem
casca própria — lê de `useReadingPrefs()` (`src/lib/use-reading-prefs.ts:13`) e
chama os `setReading*` de `src/lib/reading-prefs.ts` direto. `PerfilMenu` o
consome como seção; nada mais no repositório o usa hoje.

Na Leitura (`src/pages/Leitura.tsx:1246` linhas), o cabeçalho da perícope é:

```tsx
// Leitura.tsx:822-837
<article className="leitura" ref={rootRef}>
  <p className="crumb">
    <Link to="/">Hoje</Link> · {testamentLabel(testamentOf(p))} ·{' '}
    <Link to={`/explorar?livro=${encodeURIComponent(p.livro)}`}>{p.livro}</Link>
  </p>
  <h1 ...>{p.titulo_pericope_pt}</h1>
  <div className="ref-row">
    <p ...>{refLabel(p)} · <span className="ref-min">~{minutos} min</span></p>
  </div>
  <SectionChips ... />
```

`.ref-row` já não tem setas nem `Aa` — a spec de 2026-09-03 tirou os dois
(`.ref-nav`/`.ref-arrow` foram removidas); sobrou só a referência e a
estimativa de minutos (`app.css:721-737`, comentário confirma). O que ainda
existe e não foi tocado então é o `<p className="crumb">` (`Leitura.tsx:824`),
com o breadcrumb "Hoje · Testamento · Livro".

Em CSS, `.top` (`app.css:183-205`) é `position: sticky; top: 0; z-index: 5`,
com `transition: transform 0.25s` e a classe `.top-hidden` que aplica
`translateY(-100%)` (`app.css:207-213`). No celular é grid de duas linhas —
marca na linha 1, `<nav>` (`grid-column: 1/-1`) na linha 2
(`app.css:183-198,265-274`); a `@media (min-width: 640px)` (`app.css:302-314`)
funde as duas numa só, marca à esquerda e nav à direita. `.brand`
(`app.css:233-243`) encolhe dentro da Leitura via `.shell:has(.leitura)
.brand` (`app.css:229-231`), e o próprio `.top` ganha padding menor lá
(`app.css:225-227`) — os dois só existem porque hoje o **mesmo** elemento
`.top` serve tanto a Home/Explorar/Jornada quanto a Leitura.

Um detalhe estrutural que não pode ser perdido na hora de reformar tudo isto:
`SectionChips.tsx:43` faz `document.querySelector<HTMLElement>('.top')` para
medir a altura do header em `--top-h`, e `.section-chips` (única consumidora
de `SectionChips`, só existe na Leitura) usa esse valor para colar logo abaixo
(`app.css:852-861`). Qualquer elemento novo que substitua o `.top` da Leitura
**precisa continuar se chamando `.top`**, ou essa medição quebra.

`.shell` (`app.css:174-181`) tem hoje um `padding-bottom: calc(3rem +
env(safe-area-inset-bottom, 0px))` fixo, igual em toda rota. `.perfil-wrap`,
`.perfil-pop`, `.perfil-item`, `.perfil-secao`, `.perfil-sep`,
`.top nav .perfil-btn` (`app.css:2709-2804`) e `.readmenu-pop`
(`app.css:743-756`) são hoje consumidos só por `PerfilMenu.tsx` — confirmado
por busca no repositório.

## O que reverte da spec de 2026-09-03, e o que fica

**Reverte:**

1. O popover `Perfil` deixa de existir. Vira rota `/perfil`.
2. `Hoje` volta para a navegação principal como item explícito — a spec de
   2026-09-03 o tinha tirado porque a marca já cobre `/` e cinco itens não
   cabiam a 360px (`2026-09-03-chrome-header-perfil-design.md`, "Decisões de
   partida" item 1). Essa restrição de largura era do celular; a barra de
   abas desta spec é um layout novo, com `Hoje` como uma das quatro abas — a
   razão de tirá-lo não se aplica mais.
3. O `Aa` volta a abrir direto na Leitura, num toque, como fazia antes de
   2026-09-03 (`ReadingMenu`, hoje `LeituraPrefs`). A diferença para o estado
   pré-2026-09-03 é só o nome do componente e a casa da tipografia fora da
   Leitura (que passa a viver também em `/perfil`, não só no popover).

**Fica:**

1. "Concentrar tema, preferências de leitura e conta num lugar só" — a tese
   central de 2026-09-03 — continua de pé. Só o container muda: de popover
   para página.
2. As setas `←`/`→` continuam fora do `.ref-row` (o pager do rodapé e o swipe
   já cobrem; `use-keyboard-nav.ts` cobre teclado).
3. `ReadingMenu` → `LeituraPrefs`, sem casca própria, reaproveitado por dois
   consumidores agora (a página `/perfil` e o popover do `Aa`) em vez de um.
4. `reading-prefs.ts`/`useReadingPrefs()` (o `EventTarget` de módulo que
   sincroniza quem edita a tipografia com quem a lê) — intocado, os dois
   consumidores novos usam o mesmo hook.
5. A opacidade opaca de `.section-chips` (`app.css:852-861`) — já é `var(--paper)` sem `color-mix`, o defeito daquela spec já foi corrigido, nada a fazer aqui.

## Decisões de partida

Tomadas com o dono antes desta spec, não reabertas aqui:

1. A navegação principal desce para uma barra inferior fixa de quatro abas:
   `Hoje` (`/`), `Explorar` (`/explorar`), `Jornada` (`/jornada`), `Perfil`
   (`/perfil`). Ícones de traço 21px desenhados inline + rótulo em caixa alta
   espaçada, 11,5px. Altura mínima de 62px por aba, mais
   `env(safe-area-inset-bottom)`. Aba ativa em `--accent` com um traço de
   18×2px sob o rótulo.
2. O popover Perfil deixa de existir. Vira a rota `/perfil`, que absorve tema,
   preferências de leitura, conta e os links para `/ajustes` e `/sobre`.
3. Na Leitura a barra inferior some (a doca da narração ocupa o rodapé) e o
   topo vira contextual, uma linha só: `‹ [Livro]` · `N de M` centralizado ·
   `Aa` · Perfil. Alvo mínimo de 46px em cada controle.
4. O `Aa` abre as preferências de leitura em um toque, direto.
5. O breadcrumb da Leitura sai: `‹ [Livro]` cobre voltar ao livro, e a linha
   de referência abaixo do título já diz onde o leitor está.
6. `useHideOnScroll` continua valendo para o topo da Leitura. A doca da
   narração NÃO se esconde enquanto há áudio tocando.
7. A marca fica no topo só na Home e nas telas de lista; some do topo da
   Leitura.
8. Nada de cor muda.

## O desenho

### A barra de abas (celular, < 640px)

Novo componente `src/components/BarraAbas.tsx`, renderizado dentro de
`<header className="top">` como hoje `<nav>` é — mas com CSS que a arranca do
fluxo do header e a fixa no rodapé da viewport:

```css
@media (max-width: 639.98px) {
  .top nav.tab-bar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    top: auto;
    z-index: 5; /* mesma stacking context do .top, que já a contém */
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    background: var(--page-bg); /* opaco — não repetir o vazamento que a
      spec de 2026-09-03 corrigiu em .section-chips */
    border-top: 1px solid var(--line);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

Um item da barra é `<NavLink to="/explorar" className="tab">`, com dentro:
ícone (svg, 21×21, `stroke="currentColor"`, `fill="none"`, `strokeWidth:
1.75`), rótulo, e um indicador:

```tsx
<NavLink to="/explorar" className="tab">
  <IconeExplorar />
  <span className="tab-rotulo">Explorar</span>
  <span className="tab-indicador" aria-hidden />
</NavLink>
```

```css
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-height: 62px;
  color: var(--muted);
}

.tab-rotulo {
  /* mesma receita de .perfil-secao (app.css:2743-2751): reaproveitar, não
     inventar uma segunda escala de caixa-alta no mesmo app */
  font-family: var(--font-ui);
  font-size: 0.72rem; /* ~11,5px em raiz de 16px */
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tab-indicador {
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: transparent;
}

.tab.active {
  color: var(--accent);
}

.tab.active .tab-indicador {
  background: var(--accent);
}

.tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -3px; /* interno, para não cortar na borda do rodapé */
}
```

`.active` é a classe que o `NavLink` do React Router já aplica sozinho quando
a rota bate — é o mesmo mecanismo que `.top nav a.active` (`app.css:285-288`)
já usa hoje, sem função nova para escrever. `aria-current="page"` também é
automático do `NavLink`, sem código extra.

`to="/"` no item `Hoje` não precisa de prop `end`: no React Router 7 (`^7.18.2`,
`package.json:51`), `"/"` como `to` só casa a raiz exata por construção da
própria lib — verificado, não é um risco a mitigar.

Com o `<nav>` virando `position: fixed`, ele sai da grade do `.top` e o
header no celular volta a ser **uma linha só** (só a marca) — a segunda linha
que hoje existe (`app.css:183-198`) some por conta própria, porque um item
`position: fixed`/`absolute` não ocupa trilha de grid. O bloco
`@media (max-width: 379.98px) { .top nav { ... } }` (`app.css:295-298`) fica
órfão (ajustava `gap`/`font-size` de uma nav que já não está inline ali
embaixo de 380px) e sai; a parte de `.brand` no mesmo bloco (`app.css:291-293`)
fica.

### A mesma barra em ≥ 640px: vira nav no topo

Ponto de corte: **640px**, o mesmo breakpoint que o resto do app já usa
(`app.css:302,788,834`) — não um novo.

```css
@media (min-width: 640px) {
  .top nav.tab-bar {
    position: static; /* volta a participar do grid do .top */
    /* .top já tem, a partir daqui, grid-template-columns: auto minmax(0,1fr)
       e .top nav { grid-column: 2; justify-content: flex-end } — app.css:302-314,
       intocado */
  }

  .tab {
    flex-direction: row;
    gap: 0.35rem;
    min-height: 2.5rem; /* volta ao .top nav a de hoje, app.css:276-283 */
  }

  .tab svg {
    display: none; /* ícone só faz sentido na barra compacta */
  }

  .tab-rotulo {
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: normal;
    text-transform: none;
  }

  .tab-indicador {
    display: none; /* a cor do texto já marca o ativo, como .top nav a.active hoje */
  }
}
```

Em telas largas os quatro itens — `Hoje`, `Explorar`, `Jornada`, `Perfil` —
aparecem como texto simples ao lado da marca, sem ícone, exatamente como a
nav de hoje se parece, só que com um item a mais (`Hoje` volta, ver reversão
acima).

### Os quatro ícones

`src/components/icones-nav.tsx` (novo arquivo), reaproveitado por
`BarraAbas.tsx` e por `LeituraTopo.tsx` (o botão Perfil da Leitura usa o
mesmo ícone de pessoa). Seguem o padrão de traço que o resto do app já usa
para SVG inline (`IconePlay`/`IconePausa`, `NarracaoPlayer.tsx:398-411`, e o
ícone de `DitarBotao.tsx:440`), só que com `stroke` em vez de `fill`, porque
"traço" é decisão de partida:

- **Hoje** — casa (contorno de telhado + parede + porta).
- **Explorar** — bússola.
- **Jornada** — trilha: uma linha curva com um marcador na ponta.
- **Perfil** — silhueta de cabeça e ombros.

```tsx
export function IconeHoje() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden focusable="false">
      {/* path da casa */}
    </svg>
  )
}
```

O desenho exato dos quatro `path` fica para a implementação; a única restrição
de design é: `viewBox="0 0 24 24"`, 21×21, traço 1,75, `currentColor` (herda
`.tab`'s `color`, então a troca para `--accent` no estado ativo já vem de
graça, sem CSS por ícone).

### O topo contextual da Leitura

Novo componente `src/components/LeituraTopo.tsx`. Substitui o `<p
className="crumb">` (`Leitura.tsx:824-827`); o `<h1>` e o `.ref-row` que vêm
depois **não mudam** — a linha de referência abaixo do título já cumpre o
que o breadcrumb cumpria (decisão 5).

```tsx
<LeituraTopo livro={p.livro} posicao={posNoLivro} />
<h1 ...>{p.titulo_pericope_pt}</h1>
<div className="ref-row">...</div>
```

Anatomia, uma linha, três zonas via grid (`grid-template-columns: 1fr auto
1fr`, para "N de M" ficar centralizado de verdade, independente do tamanho do
nome do livro à esquerda):

```
[‹ João          ]      [3 de 12]      [        Aa  👤]
   zona esquerda           centro            zona direita
```

- **Esquerda** — `<Link to="/explorar?livro=...">‹ João</Link>`, o mesmo
  destino que o crumb de hoje já usa (`Leitura.tsx:826`). O `‹` é
  `aria-hidden`; o link carrega `aria-label={\`Voltar para ${livro}\`}`,
  porque um chevron isolado não é confiável em leitor de tela. Min-height
  46px, padding horizontal para o texto não ficar espremido contra a borda.
- **Centro** — `N de M`: a posição da perícope corrente dentro do **livro**
  (não do total da Bíblia nem do testamento). `var(--muted)`, ~0,8rem,
  discreto — decoração, não CTA.
- **Direita** — dois botões de 46×46px: `Aa` (abre o popover de tipografia,
  ver abaixo) e um ícone de pessoa linkando para `/perfil`
  (`aria-label="Perfil"`).

```css
.top.leitura-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
  /* position: sticky, top: 0, z-index: 5, background, transition — herdados
     de .top (app.css:183-205); só o miolo (grid/conteúdo) é novo. */
}

.leitura-top-voltar,
.leitura-top-aa,
.leitura-top-perfil {
  min-height: 46px;
}

.leitura-top-aa,
.leitura-top-perfil {
  min-width: 46px;
}

.leitura-top-pos {
  justify-self: center;
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  white-space: nowrap;
}
```

`LeituraTopo` chama `useHideOnScroll(true)` — sempre habilitado, porque o
componente só é montado dentro da Leitura — e aplica `top leitura-top${hidden
? ' top-hidden' : ''}` na classe do elemento raiz. `Shell` deixa de chamar
`useHideOnScroll`; `perfilAberto` também sai de `Shell` inteiro, porque não
existe mais popover no header para travar o auto-ocultar.

`Shell` não renderiza `<header className="top">` (o de marca+barra de abas)
em `/leitura/*`. Como a barra de abas está dentro desse header, ela some da
Leitura de graça, sem condicional própria — é a mesma causa que faz a marca
sumir de lá (decisão 7).

**N de M** — nova função pura em `src/lib/content.ts`, ao lado de
`ordensDoTestamento` (`content.ts:83-85`), mesmo padrão:

```ts
export function posicaoNoLivro(
  all: PericopeIndex[],
  livro: string,
  ordem: number,
): { n: number; m: number } | null {
  const doLivro = all.filter((p) => p.livro === livro)
  const i = doLivro.findIndex((p) => p.ordem === ordem)
  return i === -1 ? null : { n: i + 1, m: doLivro.length }
}
```

`Leitura.tsx` já carrega `all` via `loadIndex()` dentro do efeito que monta
`prev`/`next` (`Leitura.tsx:271,283-284`) — o cálculo entra ali, num
`useState` novo (`posNoLivro`), sem fetch adicional. Teste em
`content.test.ts`, seguindo o padrão dos testes vizinhos de
`ordensDoTestamento`/`anteriorNoTestamento` — índice sintético, sem tocar
`index.json`.

### O `Aa`: popover reaproveitado, não uma página

O `Aa` da Leitura abre um popover pequeno com `LeituraPrefs`, sobre a mesma
infraestrutura `usePopover()` que hoje serve `PerfilMenu` — ela não morre com
o popover do Perfil, muda de dono:

```tsx
function LeituraTopoAa() {
  const { open, toggle, close, rootRef, btnRef, popRef } = usePopover()
  return (
    <span className="leitura-top-aa-wrap" ref={rootRef}>
      <button ref={btnRef} type="button" className="leitura-top-aa"
        aria-expanded={open} aria-haspopup="dialog" aria-label="Preferências de leitura"
        onClick={toggle}>
        Aa
      </button>
      {open && (
        <div className="readmenu-pop pop-tipografia" ref={popRef}
          role="dialog" aria-modal="true" aria-label="Preferências de leitura">
          <LeituraPrefs />
        </div>
      )}
    </span>
  )
}
```

`.readmenu-pop` (`app.css:743-756`) não muda. `.perfil-pop`
(`app.css:2735-2741`, min-width 260px, max-height, overflow-y, o comentário
sobre a linha "Serif/Literata/Sans" quebrando em 230px — `app.css:2727-2734`)
é **renomeada** para `.pop-tipografia`: o motivo de existir (a linha de
fontes precisa de 260px, não 230) é o mesmo, só que agora aplicado ao popover
do `Aa`, não ao do Perfil. `.perfil-wrap` (`app.css:2722-2725`, o
`position: relative` que ancora o popover à direita do gatilho) vira
`.leitura-top-aa-wrap`, mesma regra.

Isto é, na prática, o retorno do `ReadingMenu` pré-2026-09-03 — mesmo popover,
mesmo botão de um toque só —, só que o componente interno chama-se
`LeituraPrefs` e é o mesmo arquivo que a página `/perfil` também usa.

### A página `/perfil`

Novo `src/pages/Perfil.tsx`, rota adicionada em `App.tsx`. Absorve o que
`PerfilMenu.tsx` tinha, sem o condicional de contexto — como é página própria,
não precisa decidir "estou na Leitura?" para mostrar tipografia:

| Seção | Conteúdo | Origem |
|---|---|---|
| Tema | Sistema / Claro / Escuro | `TEMAS`, `PerfilMenu.tsx:10-14`, sem mudança |
| Leitura | os cinco controles de `LeituraPrefs` | sempre visível agora — `mostrarPrefsDeLeitura` não existe mais |
| Ajustes | link para `/ajustes` | `PerfilMenu.tsx:117-119` |
| Sobre | link para `/sobre` | `PerfilMenu.tsx:126-128`, comentário sobre a divulgação migra junto |
| Conta | e-mail (se logado), `Entrar`/`Sair`, `erroSaida` `role="status"` | `PerfilMenu.tsx:130-159`, lógica de `sair()` intacta |

Markup em bloco, não em popover: `<section className="ajustes">` — a mesma
classe que `Ajustes.tsx:102` e `Sobre.tsx:29` já usam, para as três telas
combinarem sem CSS novo de layout de página. Dentro dela, os itens reaproveitam
`.perfil-item`/`.perfil-secao`/`.perfil-sep` (`app.css:2743-2757`) como estão —
essas três regras não têm nada de "popover" nelas (são só linha, rótulo de
seção, separador); só `.perfil-wrap`/`.perfil-pop`/`.top nav .perfil-btn`
(posicionamento e gatilho de popover) morrem.

```tsx
export default function Perfil() {
  const { data: session } = authClient.useSession()
  // ...pref de tema, sair() — mesma lógica de PerfilMenu.tsx:34-66
  return (
    <section className="ajustes">
      <h1>Perfil</h1>

      <p className="perfil-secao">Tema</p>
      <div className="readmenu-row" role="group" aria-label="Tema">...</div>

      <p className="perfil-secao">Leitura</p>
      <LeituraPrefs />

      <div className="perfil-sep" role="separator" />

      <Link className="perfil-item" to="/ajustes">Ajustes</Link>
      <Link className="perfil-item" to="/sobre">Sobre</Link>

      {session ? (
        <>
          <button className="perfil-item" onClick={...}>Sair</button>
          <span className="nav-conta-erro" role="status" aria-live="polite">{erroSaida}</span>
        </>
      ) : (
        <Link className="perfil-item" to="/entrar">Entrar</Link>
      )}
    </section>
  )
}
```

Sem `useEffect` de tema por evento (`pericopes-theme`, `PerfilMenu.tsx:44-47`)
— como não há mais um popover que pode ficar aberto enquanto o tema muda por
outro caminho, o estado inicial de `getThemePref()` no `useState` já basta;
mantém-se o listener só se a implementação achar um caso real de
dessincronia (não previsto).

### `PerfilMenu.tsx`: o que sobra, o que muda de casa, o que morre

- **Morre**: `PerfilMenu.tsx`, `PerfilMenu.test.tsx`, `src/lib/perfil-secoes.ts`
  e `perfil-secoes.test.ts` (a função `mostrarPrefsDeLeitura` fica sem
  chamador — a página `/perfil` mostra Leitura sempre, e o popover do `Aa` só
  existe dentro da Leitura por construção, sem precisar perguntar).
- **Sobrevive, sem mudança**: `use-popover.ts`/`use-popover.test.ts`
  (`alvoDoTab`, foco preso, Escape) — dono novo é o popover do `Aa`.
  `LeituraPrefs.tsx` — dois consumidores agora em vez de um.
- **Sobrevive, renomeado**: `.perfil-pop` → `.pop-tipografia`, `.perfil-wrap`
  → `.leitura-top-aa-wrap` (ver seção do `Aa` acima).
- **Sobrevive, reaproveitado sem mudança de CSS**: `.perfil-item`,
  `.perfil-secao`, `.perfil-sep`, `.nav-conta-erro`, `.readmenu-pop`,
  `.readmenu-row`, `.read-tool` — a página `/perfil` os usa como estão.
- **Morre de vez**: `.top nav .perfil-btn`/`.perfil-btn[aria-expanded]`
  (`app.css:2790-2804`) — não há mais gatilho de popover na nav.

### `env(safe-area-inset-bottom)`

Três lugares:

1. `.top nav.tab-bar` (mobile) — `padding-bottom: env(safe-area-inset-bottom,
   0px)`, mesmo padrão que `.verse-actions` já usa
   (`app.css:1663-1665`).
2. `.shell` — o `padding-bottom: calc(3rem + env(safe-area-inset-bottom,
   0px))` de hoje (`app.css:178-180`) é universal; passa a ter uma variante
   para as rotas que têm barra de abas embaixo:

   ```css
   .shell:not(:has(.leitura)) {
     padding-bottom: calc(62px + 1rem + env(safe-area-inset-bottom, 0px));
   }
   ```

   62px é a altura da barra; 1rem é respiro; `.shell:has(.leitura)` mantém o
   valor de hoje como piso — a spec da doca de narração é quem decide o
   padding-bottom final daquele caso (ver "Fronteiras" abaixo).
3. `.leitura-top` herda `padding-top: calc(0.85rem +
   env(safe-area-inset-top, 0px))` de `.top` sem mudança — não há
   `safe-area-inset-bottom` no topo da Leitura, só no rodapé (barra de abas
   ou doca, conforme a rota).

### Acessibilidade

- `NavLink` já entrega `aria-current="page"` no item ativo, sem código
  adicional — verificado no comportamento padrão do React Router 7.
- Cada aba tem rótulo visível (o `.tab-rotulo`); nenhuma depende só do ícone.
- `<nav className="tab-bar" aria-label="Navegação principal">` — landmark
  nomeado, para distinguir de outros `<nav>` da página (não há outro hoje,
  mas nomear custa nada e evita ambiguidade se um aparecer).
- Ordem de tab (teclado): marca → as quatro abas → conteúdo da página, mesmo
  a barra estando visualmente embaixo. É uma troca deliberada, não um
  descuido: mover a barra para depois de `<main>` no DOM resolveria a ordem
  mas quebraria a fusão com a nav de desktop (que depende do grid existente
  de `.top`, `app.css:302-314`) sem reescrever a posição via `position: fixed`
  também em ≥640px — mais risco que o problema que resolveria. É o mesmo
  padrão que barras de abas de apps web grandes (Gmail, X) usam. Não há
  "pular para o conteúdo" no app hoje; não é desta spec introduzir um.
- `LeituraTopo`: `‹ Livro` tem `aria-label` explícito (acima); `Aa` tem
  `aria-label="Preferências de leitura"` (não só o texto visível "Aa", que
  soletrado por leitor de tela não diz nada); o botão de Perfil tem
  `aria-label="Perfil"`.
- O popover do `Aa` mantém `role="dialog"`, `aria-modal="true"`,
  `aria-label`, foco preso e Escape — nada muda no contrato de
  `usePopover()`.
- `Perfil` como página não precisa de foco management de popover (Escape,
  Tab preso): é uma rota como qualquer outra, o foco vai para onde a
  navegação já leva (a região seria o `<h1>`, se o app tiver esse padrão em
  outras páginas — conferir `Ajustes.tsx`/`Sobre.tsx` por consistência, que
  hoje não fazem foco explícito no `<h1>` ao montar).

## Arquivos a criar / alterar / apagar

**Criar:**
- `src/pages/Perfil.tsx`
- `src/components/BarraAbas.tsx`
- `src/components/LeituraTopo.tsx`
- `src/components/icones-nav.tsx` (ou inline em `BarraAbas.tsx` +
  reexportado — decisão de implementação)
- `src/pages/Perfil.test.tsx` (mesmo padrão de `PerfilMenu.test.tsx`: mock de
  `react-router-dom`, `auth-client`, `sync`, render direto via `createRoot`)
- `src/components/LeituraTopo.test.tsx`, se sobrar lógica não-trivial fora de
  `posicaoNoLivro` (o cálculo em si é testado em `content.test.ts`)

**Alterar:**
- `src/App.tsx` — remove `perfilAberto`, `useHideOnScroll`, import de
  `PerfilMenu`; condiciona `<header className="top">` a `!pathname.startsWith('/leitura/')`;
  adiciona `<Route path="/perfil" element={<Perfil />} />`; `<nav>` vira
  `<BarraAbas />` com os quatro itens na ordem Hoje/Explorar/Jornada/Perfil.
- `src/pages/Leitura.tsx` — remove `<p className="crumb">`
  (`Leitura.tsx:824-827`) e o import de `testamentLabel`/`testamentOf`
  (`Leitura.tsx:54`, fica sem uso); adiciona `<LeituraTopo>`; adiciona estado
  `posNoLivro` computado no efeito existente (`Leitura.tsx:271-284`).
- `src/styles/app.css` — ver lista detalhada nas seções acima; resumo:
  - Novo: `.tab-bar`/`.tab`/`.tab-rotulo`/`.tab-indicador` (mobile + a
    variante `@media (min-width: 640px)`), `.leitura-top` e filhos,
    `.pop-tipografia`, `.leitura-top-aa-wrap`, `.shell:not(:has(.leitura))`.
  - Renomear: `.perfil-pop` → `.pop-tipografia`, `.perfil-wrap` →
    `.leitura-top-aa-wrap`. Inclusive **dentro do comentário** de
    `.nav-conta-erro` (`app.css:2423-2425`), que explica o `overflow-x`
    citando `.perfil-pop` duas vezes: é a única ocorrência que não é
    seletor, e sem ela o `grep` do checklist (item 9) falha mesmo com o
    trabalho todo feito certo. O comentário também fica semanticamente
    errado depois da mudança — o `.nav-conta-erro` migra para a página
    `/perfil`, que não é popover nenhum e não tem contêiner de rolagem
    recortando filho fora do fluxo; o texto precisa ser reescrito para o
    novo lar, não só ter a classe trocada.
  - Apagar: `.top nav .perfil-btn`/`.perfil-btn[aria-expanded]`
    (`app.css:2788-2804`), `.crumb` (`app.css:2019-2024`, órfã), `.shell:has(.leitura)
    .top`/`.brand` (`app.css:225-231`, órfãs — `.top` da Leitura não é mais
    o mesmo elemento), o bloco `.top nav` dentro de `@media (max-width:
    379.98px)` (`app.css:295-298`).
- `data/pericopes.json`/nada em dados — esta fase não toca dado, só chrome.

**Apagar:**
- `src/components/PerfilMenu.tsx`, `src/components/PerfilMenu.test.tsx`
- `src/lib/perfil-secoes.ts`, `src/lib/perfil-secoes.test.ts`

**Sem mudança**, citados só para deixar claro que não são tocados:
- `src/lib/use-popover.ts`, `use-popover.test.ts`
- `src/components/LeituraPrefs.tsx`
- `src/lib/reading-prefs.ts`, `src/lib/use-reading-prefs.ts`
- `src/components/SectionChips.tsx` — continua achando `.top` porque
  `LeituraTopo` carrega essa classe.
- `src/pages/Ajustes.tsx`, `src/pages/Sobre.tsx` — mudam só de onde são
  alcançados (agora `/perfil`, não mais um popover), não o conteúdo.

## Fronteiras com specs paralelas

Três fases tocam `App.tsx`/`app.css` ao mesmo tempo neste worktree:

- **`2026-09-08-redesenho-marca-design.md`** — troca `.brand-mark` para
  apontar ao glifo novo e mexe em `.brand-wordmark`. Não toca `<nav>`, `.top
  nav`, nem qualquer regra desta spec. Risco de colisão textual baixo (edita
  outras linhas de `App.tsx`/`app.css`), mas ambas editam o mesmo arquivo —
  quem mesclar por último resolve um diff simples de linhas próximas, não de
  lógica conflitante.
- **`2026-09-08-redesenho-narracao-toque-design.md`** — a doca de narração.
  Duas interfaces diretas com esta spec:
  1. Ela afirma hoje "acima de qualquer outro elemento fixo do app (nenhum
     existe hoje concorrendo por esse espaço)". Depois desta spec isso deixa
     de ser verdade em termos absolutos — existe a barra de abas — mas
     continua verdade em tempo de execução: a barra de abas nunca renderiza
     em `/leitura/*` (decisão 3), e a doca só existe ali. As duas nunca
     coexistem na tela; a frase precisa só de uma nota, não de mudança de
     comportamento.
  2. Comportamento ao rolar (decisão 6 desta spec, escrita aqui porque foi
     pedida aqui): a doca usa o mesmo `useHideOnScroll`, mas **gated por
     tocando**: `useHideOnScroll(!tocandoNarracao)`. Enquanto o áudio toca, a
     doca fica sempre visível, ignorando o limiar de rolagem; pausada ou
     antes do primeiro play, esconde/mostra como o `.leitura-top` de cima.
  3. `.shell`'s `padding-bottom` para `/leitura/*` — esta spec só garante
     que `.shell:has(.leitura)` **não perca** o piso de hoje
     (`calc(3rem + env(safe-area-inset-bottom))`); a spec da doca é quem
     ajusta esse valor para a altura real da doca, e deve fazer isso como
     bloco aditivo, não reescrevendo a regra desta spec.
  4. A tabela de alvos de toque daquela spec cita `.read-tool` como usado em
     `PerfilMenu.tsx` (que esta spec apaga) — a referência de arquivo fica
     desatualizada, mas a classe `.read-tool` continua existindo, usada por
     `LeituraPrefs.tsx` (que sobrevive) nos dois popovers novos (`/perfil` e
     `Aa`). Nada a corrigir no comportamento, só uma nota para quem revisar
     as duas specs juntas.
- **`2026-09-08-redesenho-explorar-design.md`** — mexe só dentro de
  `Explorar.tsx`/`LivroAberto.tsx`. Sem sobreposição com esta spec.

**Ordem de merge sugerida**: esta fase antes da doca de narração, porque a
doca depende de `.shell:has(.leitura)` existir como seletor (que já existe
hoje) e de `Leitura.tsx` não ter mais o `<div className="narracao">` inline
no mesmo trecho que esta spec toca (o topo da Leitura, logo acima). As duas
mexem em pontos adjacentes do mesmo arquivo; menos risco se uma delas fixar
o "acima" (esta) antes da outra fixar o "abaixo" (a doca).

## Fora do escopo

- Qualquer mudança de cor (decisão 8) — nenhum token novo, nenhuma
  recoloração.
- A doca de narração em si (anatomia, alvos de toque, três estados de
  indisponibilidade) — pertence a
  `2026-09-08-redesenho-narracao-toque-design.md`.
- Os arquivos de marca e os dois níveis de enquadramento — pertence a
  `2026-09-08-redesenho-marca-design.md`. Os ícones desta spec (casa,
  bússola, trilha, pessoa) não são a marca do app; são ícones de navegação.
- O conteúdo interno do Explorar (campo de busca, ditado, eixo
  Livros/Registros) — pertence a `2026-09-08-redesenho-explorar-design.md`.
- Reintroduzir o tema Sépia — foi aposentado no rebranding
  (`src/lib/theme.ts:9-22`) e não volta aqui.
- Instalabilidade de PWA, manifest, splash screen.
- `Ajustes.tsx`/`Sobre.tsx` por dentro — só mudam de onde são alcançados.
- Testar o casamento de rota do `NavLink` (`.active`/`aria-current`) com
  teste de unidade próprio — é comportamento de biblioteca, não lógica do
  app; coberto pela checklist manual abaixo, não por Vitest.

## Riscos

1. **Ordem de tab por teclado invertida em relação ao visual** — discutido em
   Acessibilidade; aceito como trade-off, não como defeito a esconder.
2. **Renomear `.perfil-pop`/`.perfil-wrap`** é uma reescrita, não um bloco
   aditivo — foge do padrão "só acrescentar blocos" que a spec de 2026-09-03
   seguiu. Justificado aqui porque o nome antigo (`perfil-*`) descreveria
   incorretamente um popover que não é mais do Perfil; manter o nome errado
   custaria mais confusão do que o risco de um merge concorrente na mesma
   linha. Nenhuma outra fase paralela toca essas duas regras (confirmado por
   busca).
3. **`posicaoNoLivro` degenerado em livros de uma perícope só** (ex.: livros
   curtos do Antigo Testamento com um único registro) — `N de M` vira "1 de
   1". Não é bug, mas verificar que não fica estranho visualmente antes de
   fechar.
4. **`.top` reaproveitado por dois componentes diferentes** (`BarraAbas`
   dentro do header de `Shell`, e `LeituraTopo` sozinho na Leitura) —
   qualquer mudança futura em `.top` precisa ser testada nos dois contextos,
   porque agora "quem tem classe `.top`" não é mais um elemento só,
   estruturalmente, mesmo nunca havendo dois ao mesmo tempo no DOM.
5. **Compensação de `padding-bottom` do `.shell`** — errar a conta (62px +
   1rem + safe-area) faz o fim do conteúdo (ex.: últimas perguntas de
   reflexão de uma tela sem Leitura, como o fim de uma lista longa em
   Explorar) ficar coberto pela barra de abas. Testar com uma lista longa
   rolada até o fim.

## Checklist de verificação

1. Em `/`, `/explorar`, `/jornada`: a barra de abas aparece fixa no rodapé,
   62px + a faixa de `safe-area-inset-bottom` num aparelho com notch/home
   indicator (ou simulado via devtools); o conteúdo da página não fica
   coberto ao rolar até o fim.
2. A aba correspondente à rota atual está em `--accent`, com o traço de
   18×2px sob o rótulo, e `aria-current="page"` no DOM (inspecionar).
3. Em ≥640px, os mesmos quatro itens aparecem ao lado da marca, sem ícone,
   texto normal — igual à nav de hoje, com `Hoje` a mais.
4. Abrir uma perícope: a barra de abas some, a marca some, aparece o topo
   contextual `‹ Livro · N de M · Aa · Perfil`. Rolar para baixo esconde essa
   barra; rolar para cima a traz de volta — mesmo limiar de hoje (80px,
   `use-hide-on-scroll.ts:7`).
5. No topo da Leitura, tocar `‹ Livro` leva a `/explorar?livro=...` com o
   livro certo. Tocar `Aa` abre o popover de tipografia num toque só, sem
   passar por Perfil. Tocar Perfil leva a `/perfil`.
6. `/perfil` mostra Tema, Leitura (sempre, mesmo sem ter vindo da Leitura),
   Ajustes, Sobre, e Entrar ou Sair conforme sessão — sem popover, é página
   normal com URL própria, `voltar` do navegador funciona.
7. Deslogado, `/perfil` continua acessível e mostra tema/tipografia
   funcionando (local, sem conta) — mesma garantia que 2026-09-03 já tinha
   para `/ajustes`.
8. `grep -rn "PerfilMenu\|perfil-secoes\|mostrarPrefsDeLeitura" src` não
   retorna nada.
9. `grep -n "\.perfil-wrap\|\.perfil-pop\b" src/styles/app.css` não retorna
   nada (renomeadas, não duplicadas).
10. Leitor de tela: tab pelo topo da Leitura anuncia "Voltar para {livro}",
    "Preferências de leitura", "Perfil" — nenhum rótulo mudo tipo só "Aa".
11. `npm test`, `npx tsc -b`, `npx oxlint` e `npm run build` passam.
