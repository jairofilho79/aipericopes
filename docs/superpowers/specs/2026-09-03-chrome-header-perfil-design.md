# Chrome do app: header, menu Perfil e limpeza da Leitura (2026-09-03)

Redesenho do chrome: o header perde um item e um controle solto, ganha um menu
`Perfil` que concentra preferências e conta, e a Leitura perde o pill
`.ref-nav`. Fase própria, referida pela spec de jornadas
(`2026-09-03-jornadas-design.md`, seção "Header") e da qual a spec de releitura
(`2026-09-03-releitura-esquecimento-design.md`) depende para hospedar
`/ajustes`.

## O estado de hoje

O header (`src/App.tsx:63-105`) é `[marca] [ThemeMenu]` mais uma nav de
`Hoje · Índice · Pesquisar · Entrar|Sair`. Em `/leitura/*` ele se auto-oculta ao
rolar (`use-hide-on-scroll.ts`) e reaparece com 4px de rolagem para cima.

Na Leitura, o cabeçalho da perícope traz um pill `.ref-nav` com `←`, `→` e `Aa`
(`Leitura.tsx:806-829`). O `Aa` abre o `ReadingMenu`: tamanho, fonte,
entrelinha, medida e layout.

## Decisões de partida

Tomadas com o usuário antes desta spec, não reabertas aqui:

1. `Hoje` sai da nav — a marca já é `<NavLink to="/">` e faz o mesmo.
2. `Sair` vira um menu `Perfil`, que absorve o `ThemeMenu`, as preferências do
   `Aa` e a conta. O `ThemeMenu` deixa de existir como controle solto.
3. As setas `←`/`→` do pill saem: o pager do rodapé e `use-swipe-nav` já cobrem,
   e setas no topo são atalho para pular sem ler.
4. O header resultante é `[marca] Jornada · Índice · Pesquisar · Perfil`.

## A pergunta que estava aberta: para onde vai o `Aa`

Ela foi feita sobre uma premissa errada — a de que o `Aa` fica visível durante
toda a leitura. **Ele não fica.** `.ref-sticky` (`app.css:2105`) é usado só em
`Pesquisar.tsx:268`; na Leitura não existe. O pill vive em `.ref-row`, um flex
comum, e rola embora com o texto. O CSS inteiro tem três elementos sticky:
`.top`, `.section-chips` e o `.ref-sticky` da Pesquisa.

Isso inverte a conta de toques. Hoje, para mexer na tipografia no meio de uma
perícope longa é preciso rolar até o topo do artigo. Com o `Aa` no Perfil,
bastam 4px de rolagem para cima — o limiar do `useHideOnScroll` — para o header
voltar. **No meio da leitura, que é justamente quando se percebe que o texto
está pequeno, o Perfil fica mais perto que o `Aa` de hoje.** O custo real é de
um toque, e só quando já se está no topo.

Decisão: a tipografia inteira vai para o Perfil.

## Header

```
[▣ Perícopes]                            ← linha 1
Jornada · Índice · Pesquisar · Perfil     ← linha 2
```

`ThemeMenu.tsx` é removido, e com ele as regras `.theme-menu` e `.theme-toggle`.
No grid do header isso libera a coluna 2 da linha 1 no celular e a terceira
coluna em ≥640px, onde `grid-template-columns` passa de
`auto minmax(0, 1fr) auto` para `auto minmax(0, 1fr)`.

Continuam **duas linhas** no celular: a nav não cabe ao lado da marca em 375px.
A altura do header não muda (55px), então a semântica de `--top-h`, medido pelo
`SectionChips`, fica intacta.

`Perfil` é um `<button aria-haspopup="dialog">` dentro da `<nav>`, não um
`NavLink`: não é destino, é menu. Ele herda a tipografia e o `min-height` de
`.top nav a` por um seletor irmão, para não destoar dos vizinhos.

## Perfil

Componente novo `src/components/PerfilMenu.tsx`, sobre o `usePopover` que já
existe — foco ao abrir, Tab preso, Escape, clique fora e foco devolvido ao
gatilho já estão prontos, e `alvoDoTab` já é testado.

Conteúdo, nesta ordem:

| Seção | Quando aparece |
|---|---|
| **Tema** — Sistema · Claro · Sépia · Escuro | sempre |
| **Leitura** — tamanho, fonte, layout, entrelinha, medida | só em `/leitura/*` |
| *separador* | sempre |
| **Ajustes** — link para a rota da fase de releitura | sempre |
| **Entrar** ou **Sair** | sempre |

A seção **Leitura é contextual** porque ajustar entrelinha no Índice não mostra
efeito nenhum: não há prosa de leitura na tela. Fora da Leitura o menu fica em
torno de 200px; dentro dela, em torno de 520px.

### Deslogado, a nav continua mostrando `Perfil`

O item **não** vira `Entrar`. Só o último item de dentro do menu muda.

Tema e tipografia são `localStorage` e funcionam sem conta. Se a nav virasse
`Entrar` quando deslogado, quem não tem conta perderia acesso a tema e
tipografia por completo — a única regressão real que este redesenho poderia
introduzir.

### Detalhes que vêm junto

O `erroSaida` com `role="status" aria-live="polite"` (`App.tsx:96-99`) migra
para dentro do popover, com o comentário que explica por que fica sempre
montado: uma região `aria-live` só anuncia mudança se já existir no DOM antes
dela.

CSS, em bloco novo (sem reescrever o existente): `.readmenu-pop` sobe de
`min-width: 230px` para `260px` — a 230px a linha de fontes
(`Serif`/`Literata`/`Sans`) e a de tema (quatro rótulos) quebram em duas linhas
— e ganha `max-height: calc(100dvh - 5rem)`, `overflow-y: auto` e
`overscroll-behavior: contain`, para os ~520px nunca estourarem a tela num
aparelho baixo.

## Uma interação que hoje não existe

Com o `Aa` fora do header o caso nunca apareceu: **rolar com o Perfil aberto faz
o header deslizar para cima levando o popover junto.** O `usePopover` fecha em
clique fora, mas rolar não é clicar.

O auto-ocultar fica travado enquanto o menu está aberto:

```ts
useHideOnScroll(pathname.startsWith('/leitura/') && !perfilAberto)
```

## Leitura

O `.ref-nav` inteiro sai de `Leitura.tsx:806-829` — as duas setas e o
`ReadingMenu`. `.ref-row` fica só com a referência e os minutos, então
`flex-wrap` e `margin-left: auto` perdem a razão de existir e o bloco simplifica.

**Os atalhos de teclado `←`/`→` continuam.** Eles moram em `use-keyboard-nav.ts`
e são cobertos por `use-keyboard-nav.test.ts`; os `title` dos links do pill só os
anunciavam. Nada de navegação por teclado se perde.

`ReadingMenu.tsx` vira `LeituraPrefs.tsx`: os cinco `readmenu-row`, sem o botão
`Aa` e sem popover próprio, para o Perfil consumir como seção.

### O seam de `prefs`

Hoje `prefs` mora na Leitura (`Leitura.tsx:142`) e não serve só ao menu — a
linha 910 usa `prefs.layout` para decidir corrido/blocos. Com o menu no header,
o estado sobe para o `Shell`, e a Leitura precisa saber quando ele muda.

`reading-prefs.ts` ganha um `EventTarget` de módulo e um `useReadingPrefs()`;
`Shell` e `Leitura` assinam. É o padrão mais novo do repo — `sync-event.ts` faz
exatamente isso, e deliberadamente num `EventTarget` de módulo em vez da
`window`.

## A barra de chips: o que o backlog registra e o que é

`backlog-pos-pacotes.md` registra como NÃO RESOLVIDO em três tentativas: "a barra
de chips sobrepõe o header ao rolar", com o diagnóstico de que
`.shell:has(.top-hidden)` não estaria casando. **O diagnóstico está errado, e o
sintoma tem outra causa.**

Investigado ao vivo em 2026-09-03, em `/leitura/1` com o header visível e
`scrollY: 0`:

- `--top-h` vale `55px` no `:root` e herda corretamente por toda a cadeia de
  ancestrais até `.section-chips`.
- Enumerando todas as regras que casam com `.section-chips` e declaram `top`,
  **existe exatamente uma**: `top: var(--top-h, 0px)`. Não há regra concorrente.
- `.shell:has(.top-hidden)` de fato não casa — **e é para não casar mesmo**,
  quando o header está visível. Não é o defeito.
- A `CSSTransition` que o browser gerou tem keyframes `0px → 55px`. Esse `55px`
  só pode ter vindo de `--top-h`. **Não existe bug de `var()`.**

O `top: 0px` que aparecia na medição foi artefato do ambiente: a aba nunca
chegou a pintar (`visibilityState: "hidden"`, `document.timeline.currentTime: 0`,
sem `requestAnimationFrame`), o que congela a transição no keyframe inicial. Num
tab que pinta ela conclui e o `top` chega aos 55px corretos.

Os dois sintomas relatados, contra capturas do app real:

1. **"A barra cobre o header."** O header não está sendo coberto: está
   auto-oculto. É o `useHideOnScroll` funcionando como projetado.
2. **"A barra fica descolada do header."** Entre a nav e o pill aparece uma
   linha de texto desbotada e borrada, enquanto o texto logo abaixo da barra
   está nítido. O texto não está num vão — está **atravessando** a barra.
   `.section-chips` tem `background: color-mix(in srgb, var(--paper) 82%,
   transparent)` mais `backdrop-filter: blur(6px)`: 18% de vazamento, e o
   `padding: 0.3rem 1.05rem` cria uma faixa translúcida acima do pill onde o
   texto rolando aparece por baixo. A barra não termina onde parece terminar.

### O que muda

- **Opacidade da `.section-chips`.** É a correção do sintoma real. Bloco novo
  subindo o `color-mix` para perto de opaco na faixa que fica sobre o texto.
- **Remover `transition: top 0.25s ease`** (`app.css:854`). Não é a causa do que
  se vê, mas anima um offset de sticky cujo valor vem de uma custom property
  medida em JS: mid-flight os chips ficam num offset que não corresponde a
  estado nenhum. Quando o header desliza, o certo é o chip **saltar** para o
  novo offset, não persegui-lo.
- **Corrigir a entrada do backlog**, para uma quarta tentativa não recomeçar do
  lugar errado.

Nada aqui depende da retirada do `.ref-nav`: o pill nunca foi sticky, então
tirá-lo não desempilha aquele canto. O canto sticky continua com `.top` e
`.section-chips`, exatamente como antes.

## Fronteiras com as sessões paralelas

`src/App.tsx` e `src/styles/app.css` são tocados por várias fases. No CSS, esta
fase **acrescenta blocos** em vez de reescrever os existentes. As exceções são
poucas e nomeadas: `.theme-menu` e `.theme-toggle` são removidas por ficarem
órfãs, `.ref-nav`/`.ref-arrow` idem, e o bloco `.section-chips` perde duas
declarações (`transition` e o `color-mix` do fundo). Fora essas, nada de
reescrita.

**Ordem de merge, acordada em 2026-09-03:** jornadas → releitura → esta fase.

- **Jornadas** (`2026-09-03-jornadas-design.md`). Vai primeiro, porque a edição
  dela na nav é aditiva e a desta fase é uma reescrita do bloco: aditivo sobre
  reescrita é fácil, reescrita sobre reescrita não. Ela acrescenta `Jornada`
  apontando para `/jornada` — tela própria, sem colidir com a marca, que aponta
  para `/` — **e remove `Hoje` no mesmo passo**, para não mesclar uma nav de
  cinco itens apertada a 360px enquanto esta fase não entra. Então esta fase
  encontra `[marca] Jornada · Índice · Pesquisar · Entrar|Sair` e tem um item a
  menos para remover. Tudo o mais em `App.tsx` — `ThemeMenu`, `sair()`,
  `saindo`, `erroSaida`, `useHideOnScroll`, o estado de `prefs` — chega intacto.
- **Releitura e esquecimento**
  (`2026-09-03-releitura-esquecimento-design.md`). A rota `/ajustes` entra como
  item do Perfil, abaixo do separador e acima de `Entrar`/`Sair`, com o rótulo
  `Ajustes`. Enquanto o Perfil não existe, aquela fase põe a entrada **fora** do
  bloco `session ? (...)` da nav — decisão tomada por causa desta spec, para o
  interino não contradizer o final. Quando esta fase entrar, a entrada só muda
  de lugar e o comportamento não muda em momento nenhum da transição.

  `/ajustes` **é alcançável deslogado**, e isso está certo: `zerarProgresso`
  escreve só no IndexedDB local e enfileira no outbox, `syncNow` sai cedo sem
  sessão, e `contarConcluidas` lê só o local. Deslogado, o progresso local *é* o
  progresso. É o mesmo raciocínio que mantém tema e tipografia acessíveis sem
  conta: o app é local-first, e uma tela que some sem conta contradiz isso.
- **Fusão de Índice e Pesquisa.** Pode colapsar os dois itens de busca em um.
  A nav é uma lista literal de `<NavLink>`, não é montada a partir de rotas, e
  trocar dois itens por um é uma edição de poucas linhas em qualquer momento.
  Combinado com aquela sessão: eles não editam `App.tsx`; mandam o diff exato
  (import, `path`, rótulo, redirects) e esta fase aplica. **Se o design deles
  não estiver aprovado na hora do merge, ficam dois itens** — um item provisório
  apontando só para `/indice` esconderia a Pesquisa dos usuários, o que é
  regressão, não placeholder.

Com três itens (`Jornada · <busca> · Perfil`) a nav ganha folga suficiente para
o rótulo da busca ser escolhido por semântica, não por largura.

## Testes

Seguindo o que o repo já faz — lógica pura em Vitest, não render:

1. Quais seções o Perfil mostra dado um `pathname` (com e sem `/leitura/`).
2. Qual é o último item do menu dado sessão presente ou ausente, e que o item
   da nav é `Perfil` nos dois casos.
3. `LeituraPrefs` continua coberto pelos testes de `reading-prefs`.
4. `use-keyboard-nav.test.ts` já cobre `←`/`→` e passa sem alteração — é a
   prova de que retirar as setas do pill não custou navegação por teclado.

**Nenhum teste desta fase pode montar Home, Índice ou qualquer coisa que leia
`public/data/index.json`.** Esse arquivo é derivado e gitignored
(`.gitignore:29`), gerado por `npm run shard`, e não existe numa worktree limpa.
O workflow `.github/workflows/deploy-worker.yml` roda `npm test` (linha 19)
**antes** de `npm run build` (linha 21, que dispara o `prebuild`/`shard`): um
teste que leia esse arquivo passa na máquina local e quebra a CI com `ENOENT`.
Verificado nesta sessão; levantado independentemente pelas fases de jornadas e
de releitura, que tropeçaram nele. Precisando do catálogo num teste, usar
`data/pericopes.json` (versionado) ou `src/lib/bible-books.ts`.

Os quatro testes acima são de lógica pura e não encostam nisso — a restrição
está registrada para o plano de implementação não derivar para teste de render.

## Riscos

1. **Conflito em `src/App.tsx`.** Três fases mexem no mesmo arquivo. Mitigado
   por ordem de merge combinada por mensagem antes de qualquer edição.
2. **O popover de ~520px em aparelho baixo.** Mitigado por `max-height` +
   `overflow-y: auto`; verificar em 375×568.
3. **A correção de opacidade dos chips é sobre leitura de capturas**, não sobre
   medição no aparelho do usuário. Verificar no app real antes de fechar, e não
   registrar como resolvido sem isso.
4. **`useReadingPrefs` e o rascunho da Leitura.** O refresh da Leitura já é
   deliberadamente estreito para não apagar rascunho em digitação; a assinatura
   nova só toca `prefs` e não deve alargar isso.
