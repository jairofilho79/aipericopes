# Design: Pacote 1 de UX de leitura

Data: 2026-08-31 · Status: aprovado em conversa, aguardando revisão do spec

## Objetivo

Melhorar a experiência de leitura — principalmente no celular — com nove
mudanças 100% no cliente. Nenhuma alteração no Worker, D1 ou sync; o deploy
sai pelo CI existente.

**Princípio registrado (vale para todo o pacote):** contexto, resenha,
reflexão e tópicos são leitura de primeira classe. Toda melhoria
tipográfica (alinhamento, fontes, tamanho) se aplica a todas as seções em
prosa, não só ao texto NAA. O modo corrido/blocos é a exceção: só faz
sentido no texto bíblico versificado.

## Decisões já tomadas

| Tema | Decisão |
|------|---------|
| Modo padrão do texto NAA | **Texto corrido** (parágrafos fluidos); modo "blocos" atual vira opção no popover "Aa" |
| Concluir perícope | Marca como concluída e mostra **card "Próxima: <título>"** tocável — não navega sozinho |
| Modo imersivo | **Header some ao rolar para baixo, volta ao rolar para cima** — automático, sem botão, só em `/leitura` |
| Fontes | Self-hosted via `@fontsource-variable/*` — sai o Google Fonts CDN |
| Escopo | Pacote inteiro no cliente; sem tabelas novas, sem API nova |

## Componentes

### 1. Texto corrido em parágrafos (padrão) + alternância

- `parseTextoNaa` (`src/lib/parse-texto.ts`) continua intocado.
- Nova função pura `groupCorrido(blocks: TextoBlock[]): CorridoGroup[]` em
  `src/lib/parse-texto.ts`, onde
  `CorridoGroup = { chapter: number; label: string | null; verses: VerseBlock[] }`:
  agrupa os versículos de cada capítulo num fluxo único, encabeçado pelo
  rótulo do capítulo quando houver (`label: null` para versículos órfãos
  antes de qualquer "Capítulo N").
- Renderização no modo corrido (`Leitura.tsx`): cada grupo vira um
  parágrafo fluido; cada versículo é um `<button>` **inline**
  (`display: inline`) com número sobrescrito discreto e o texto na
  sequência. O toque alterna o destaque — mesmo estado `focusId` e mesma
  persistência (`verse-highlight.ts`) de hoje. Versículo destacado ganha
  fundo `--focus-bg` inline (sem borda de bloco).
- O modo "blocos" atual permanece exatamente como está, selecionável.
- Preferência em `reading-prefs.ts`: campo novo
  `layout: 'corrido' | 'blocos'`, padrão `'corrido'`, no mesmo
  localStorage (`pericopes-reading`). Prefs antigas sem `layout` recebem o
  padrão (migração implícita na leitura).
- O script inline do `index.html` que aplica prefs antes do React não
  precisa conhecer `layout` (não afeta CSS global).

### 2. Posição de leitura restaurada

- Novo `src/lib/reading-position.ts`: mapa `ordem → { y: number }` em
  localStorage (`pericopes-reading-pos`), API
  `getReadingPosition(ordem)`, `setReadingPosition(ordem, y)`,
  `clearReadingPosition(ordem)`. Dados corrompidos ⇒ objeto vazio.
- `Leitura.tsx` salva `window.scrollY` com throttle (~500 ms) durante a
  rolagem; listener registrado/removido por perícope.
- Prioridade ao abrir a perícope (substitui o `scrollTo(0,0)`
  incondicional de hoje):
  1. URL com `?v=` válido → rola até o versículo (comportamento atual);
  2. senão, posição salva → `scrollTo(0, y)` instantâneo;
  3. senão → topo.
- O destaque de versículo salvo (`verse-highlight.ts`) continua sendo
  aplicado visualmente, mas **só rola** até o versículo quando vier de
  `?v=` na URL — a posição salva tem prioridade sobre a rolagem do
  destaque salvo (hoje ambos rolam; passa a valer a lista acima).
- Marcar como concluída chama `clearReadingPosition(ordem)` — releitura
  futura começa do topo.

### 3. Alinhamento à esquerda no mobile

- Remove o bloco mobile de `text-align: justify` + `hyphens: auto`
  (`src/styles/app.css`, media query ~644–652). Prosa e versículos ficam
  `text-align: start` em todas as larguras. Nenhuma outra regra muda.

### 4. Popover "Aa"

- A barra atual (`.read-toolbar` com A−/A/A+ + 3 botões de fonte) sai de
  `Leitura.tsx` e dá lugar a um único botão "Aa" ao lado da referência.
- Novo componente `src/components/ReadingMenu.tsx` (primeiro arquivo de
  `src/components/`): popover controlado por estado React contendo:
  - **Tamanho**: A− / A+ (mesmos `bumpReadingSize`);
  - **Fonte**: Serif / Literata / Sans (mesmo `setReadingFont`);
  - **Tema**: claro/escuro (mesmo `toggleTheme` de `theme.ts`);
  - **Modo**: Corrido / Blocos (novo `setReadingLayout`).
- Fecha com toque/clique fora, Esc, ou novo toque no botão. Acessível:
  botão com `aria-expanded` + `aria-haspopup`, popover com
  `role="dialog"` e foco gerenciado (Esc devolve o foco ao botão).
- Sem HTML Popover API nem `<dialog>` — implementação React simples para
  máxima compatibilidade iOS.

### 5. Modo imersivo (header auto-oculto)

- Novo hook `src/lib/use-hide-on-scroll.ts`: retorna `hidden: boolean` a
  partir da direção da rolagem — rolar para baixo além de um limiar
  (~80 px do topo) oculta; rolar para cima em qualquer ponto, ou chegar ao
  topo, mostra. Listener `scroll` passivo com rAF.
- Ativo **apenas** na rota `/leitura/:ordem`. `App.tsx` aplica classe
  `top-hidden` no header; CSS anima com
  `transform: translateY(-100%)` + `transition` (respeitando
  `prefers-reduced-motion`). O header precisa ser `position: sticky/fixed`
  para o efeito — ajustar se hoje for estático.
- O botão "Aa" e a navegação ficam no corpo da página, então permanecem
  alcançáveis com o header oculto.

### 6. Fontes self-hosted

- Adiciona `@fontsource-variable/literata`,
  `@fontsource-variable/source-serif-4`,
  `@fontsource-variable/source-sans-3`, `@fontsource-variable/fraunces`,
  `@fontsource-variable/dm-sans` (imports no `src/main.tsx`).
- Remove o `@import` do Google Fonts (`app.css` linha 1) e os dois
  `preconnect` do `index.html`.
- Os nomes de família dos pacotes variable são `'Literata Variable'`,
  `'Source Serif 4 Variable'` etc. — atualizar os stacks em
  `reading-prefs.ts` (FONT_OPTIONS), nas variáveis CSS de `app.css`
  (`--font-display`, `--font-body`, `--font-ui`) **e no script inline do
  `index.html`** (mapa `fonts`), que hoje duplicam os stacks.
- Os woff2 entram no build; workbox os precacheia (glob já cobre woff2 —
  verificar `globPatterns`; o limite de tamanho já foi elevado para o
  pericopes.json, conferir folga). Resultado: tipografia correta offline.

### 7. Navegação anterior/próxima

- `anteriorNoTestamento(all, ordem)` em `src/lib/content.ts`, espelho de
  `proximaNoTestamento` (não cruza fronteira de testamento; `null` na
  primeira perícope).
- Topo da página: dois botões discretos ← / → junto à referência.
- Rodapé (seção de ações): "← Anterior" e "Próxima →" com os títulos das
  perícopes vizinhas. Botão ausente quando não há vizinha.

### 8. Concluir → card "Próxima"

- Ao tocar em "Marcar como concluída": grava o progresso (como hoje),
  limpa a posição de leitura e o botão dá lugar a um card tocável:
  "Concluída ✓ · Próxima: *<título da próxima>*" → navega para
  `/leitura/<nextOrdem>`.
- Sem próxima no testamento: só "Concluída ✓".
- Perícope aberta já concluída mostra o mesmo card (estado atual mostra
  badge "Concluída" + link "Próxima →" separados — unificam no card).
- Título da próxima vem de `getPericope(nextOrdem)` no carregamento.

### 9. Safe areas iOS

- `index.html`: viewport vira
  `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- CSS: header ganha `padding-top: env(safe-area-inset-top)` e paddings
  laterais somam `env(safe-area-inset-left/right)`; o rodapé da página
  soma `env(safe-area-inset-bottom)`. Valores via `max()`/`calc()` sobre
  os paddings atuais — zero efeito fora do iPhone instalado.

## Tratamento de erros

- localStorage indisponível/corrompido: todos os módulos novos seguem o
  padrão existente (try/catch, retorna padrão, nunca quebra a leitura).
- `groupCorrido` com entrada vazia retorna `[]`; a página cai no estado
  vazio atual.

## Testes

- **Vitest** (novos):
  - `groupCorrido`: múltiplos capítulos, versículos órfãos antes do
    primeiro capítulo, entrada vazia;
  - `reading-position`: salvar/ler/limpar, JSON corrompido;
  - `reading-prefs`: prefs antigas sem `layout` recebem `'corrido'`;
    `setReadingLayout` persiste;
  - `anteriorNoTestamento`: meio do testamento, primeira perícope,
    fronteira AT/NT.
- **Checklist manual PWA (fim do pacote):** instalar no iPhone; modo
  avião → fontes corretas offline; notch/barra home respeitados; rolar
  para baixo oculta o header e para cima devolve; fechar o app no meio da
  leitura e reabrir → posição restaurada; concluir → card da próxima;
  alternar corrido/blocos e tema pelo "Aa".

## Fora de escopo

Pacotes 2–4 já aprovados em conversa (interação com versículos e
destaques sincronizados; navegação/busca; engajamento). Espaçamento de
linha e largura de medida no "Aa" são do pacote 2 — o popover nasce
enxuto.
