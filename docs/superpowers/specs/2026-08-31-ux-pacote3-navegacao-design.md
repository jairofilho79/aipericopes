# Design: Pacote 3 — Navegação e busca

Data: 2026-08-31 · Status: aprovado em conversa (escopo dos 4 pacotes); execução noturna autorizada pelo usuário sem gates intermediários.

## Objetivo

Sete melhorias de navegação e busca, 100% no cliente — nenhuma mudança no
Worker ou D1. Parte do princípio registrado: contexto, resenha, reflexão e
tópicos são leitura de primeira classe.

Pré-requisito: pacote 2 integrado na main (a página de leitura já tem a
barra de ações de versículo e a seleção de intervalo).

## Componentes

### 1. Swipe entre perícopes

- Em `/leitura/:ordem`: gesto horizontal navega — swipe para a esquerda ⇒
  próxima, para a direita ⇒ anterior (dentro do testamento, como os
  botões atuais).
- Novo hook `src/lib/use-swipe-nav.ts`:
  `useSwipeNav(ref, { onPrev, onNext, enabled })` com listeners
  `touchstart`/`touchend` (passivos) no elemento raiz da página de
  leitura. Dispara só quando: `|dx| ≥ 70px`, `|dx| ≥ 2·|dy|`, duração
  ≤ 600 ms, um único toque, e não há texto selecionado
  (`window.getSelection()?.isCollapsed !== false`). Nunca chama
  `preventDefault` (não interfere na rolagem nem no back-swipe do iOS —
  o gesto começa dentro do conteúdo, não na borda; conflito residual com
  o edge-swipe do sistema é aceitável e conhecido).
- Sem animação de transição no v1; a navegação usa o mesmo
  `useNavigate` dos botões.

### 2. Chips de âncora + 4. referência viva

- As seções da leitura ganham `id`s: `#contexto`, `#texto`, `#resenha`,
  `#reflexao`, `#notas`.
- Nova barra `src/components/SectionChips.tsx`, `position: sticky;
  top: 0` dentro da página de leitura (fica visível mesmo com o header
  auto-oculto; quando o header está visível ela encosta abaixo dele sem
  sobrepor — z-index abaixo do `.top`). Contém:
  - chips **Contexto · Texto · Resenha · Reflexão** — toque rola até a
    seção (`scrollIntoView({ behavior: 'smooth' })` respeitando
    `prefers-reduced-motion`: rolagem instantânea quando reduzido);
  - chip ativo segue a rolagem via um único `IntersectionObserver` sobre
    as seções (`rootMargin` que marca ativa a seção sob o primeiro terço
    da viewport);
  - **referência viva** à direita (item 4): enquanto a seção Texto está
    ativa, mostra `"<abbrev> <cap>:<ver>"` do primeiro versículo visível
    (segundo `IntersectionObserver` sobre os elementos de versículo,
    atualizado via rAF; fora da seção Texto o rótulo some).
- A barra é discreta (fundo `--paper` translúcido + blur leve, borda
  inferior `--line`) e rola com `overflow-x: auto` se faltar largura.

### 3. Atalhos de teclado

- Novo hook `src/lib/use-keyboard-nav.ts` ativo em `/leitura/:ordem`:
  - `ArrowLeft` ⇒ perícope anterior; `ArrowRight` ⇒ próxima;
  - ignorado quando: evento com modificadores, foco em
    `input`/`textarea`/`select`/`[contenteditable]`, ou popover/barra de
    ações aberto (os handlers de `Escape` existentes têm precedência).
- Documentado no title dos botões do pager ("Atalho: ←/→").

### 5. Busca full-text no texto bíblico

- `src/pages/Pesquisar.tsx` ganha um modo "No texto" (alternância entre
  "Referência" — o atual — e "No texto", dois botões `aria-pressed`).
- Novo módulo `src/lib/fulltext.ts`:
  - `normalize(s: string): string` — NFD, remove diacríticos, lowercase;
  - índice preguiçoso em cache de módulo:
    `{ ordem, titulo, abbrev, textoNorm }` por perícope (construído uma
    vez a partir de `loadPericopes()`, ~13 MiB extras aceitos —
    documentar no código);
  - `searchTexto(q: string, limit = 50): Promise<FulltextHit[]>` com
    `FulltextHit = { ordem, titulo, refLabel, verseId, snippet }`:
    localiza a primeira ocorrência por perícope, resolve o versículo da
    ocorrência mapeando o offset de volta às linhas do `texto_naa`
    (mesmas regras do `parseTextoNaa`), e monta snippet de ~90 chars com
    reticências, destacando o trecho via `<mark>` no render.
- UX: mínimo 3 caracteres, debounce 300 ms, no máximo 50 resultados,
  contador "N resultados"; cada resultado navega para
  `/leitura/<ordem>?v=<verseId>`. Busca roda síncrona no main thread
  (2647 strings; medido aceitável — se travar, `setTimeout` em fatias de
  500 perícopes entre yields, decisão do implementador com teste).
- Testes puros de `normalize`, resolução de versículo por offset e
  snippet.

### 6. Virtualização do Índice (performance)

- Abordagem CSS, sem biblioteca: itens de `.peri-list` ganham
  `content-visibility: auto` + `contain-intrinsic-size: auto 72px`, e os
  grupos por livro idem (estimativa maior). Navegadores sem suporte
  ignoram a propriedade — degradação limpa.
- Manter o comportamento atual de 5 por livro sem filtro; o ganho é para
  livro aberto/busca com centenas de itens.

### 7. Barra de progresso visual por livro

- `src/pages/Indice.tsx`: no cabeçalho de cada grupo de livro (e no
  cabeçalho do livro aberto), uma barra fina de progresso:
  `<div class="book-progress"><div style={{width: pct%}}/></div>` +
  rótulo "N de M". Dados: `doneSet()` já carregado + contagem por
  `livro` calculada num `useMemo` sobre a lista completa.
- Cor da barra: `--accent`; trilho: `--line`; altura 4px; `aria-hidden`
  na barra com o texto "N de M" legível ao lado.

## Tratamento de erros

- `IntersectionObserver` indisponível ⇒ chips funcionam sem estado ativo
  e sem referência viva (guards de feature).
- Busca com índice ainda carregando ⇒ estado "Preparando busca…".
- Todos os hooks removem listeners/observers no cleanup.

## Testes

- Vitest: `fulltext` (normalize com acentos/caixa, offset→versículo em
  texto multi-capítulo, snippet nas bordas, limite de resultados);
  lógica pura do swipe (função `shouldSwipe(dx, dy, dt)` extraída e
  testada); `use-keyboard-nav` — predicado puro
  `isTypingTarget(el)`/`shouldHandleKey(ev)` testado.
- Checklist manual: swipe nos dois sentidos sem atrapalhar rolagem nem
  seleção; chips rolam e marcam ativo; referência viva atualiza; ←/→ no
  teclado físico do iPad/desktop; busca "no texto" com acento
  ("coração" acha "coração" e "coracao"); índice de livro grande rola
  liso; barras de progresso corretas.

## Fora de escopo

Streak, tempo de leitura, skeleton, TTS, wake lock, contexto colapsável
(pacote 4).
