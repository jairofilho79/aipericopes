# Design: Pacote 2 — Versículos e dados

Data: 2026-08-31 · Status: aprovado em conversa (escopo dos 4 pacotes); execução noturna autorizada pelo usuário sem gates intermediários.

## Objetivo

Seis melhorias de interação com versículos e dados do usuário, mais os
débitos técnicos registrados nos pacotes anteriores. Este é o único pacote
que toca o Worker e o D1 (nova entidade sincronizada `destaques` e coluna
nova em `anotacoes`). Deploy pelo CI existente (o workflow aplica as
migrations D1 antes do `wrangler deploy`).

**Princípio registrado (vale para todos os pacotes):** contexto, resenha,
reflexão e tópicos são leitura de primeira classe. O que for tipográfico se
aplica a toda prosa; interação com versículos é exclusiva do texto NAA.

## Referências de arquitetura

O padrão exato de sync (IndexedDB + outbox + `/api/sync` + LWW por
`atualizado_em` + cursor `server_em`) está descrito no relatório
`scratchpad/arch-report.md` da sessão e é observável em:
`src/lib/user-db.ts`, `src/lib/sync.ts`, `src/lib/sync-merge.ts`,
`src/lib/sync-limits.ts`, `worker/sync-logic.ts`, `worker/index.ts`,
`migrations/0002_sync.sql`, `migrations/0003_server_em.sql`.
Uma nova entidade sincronizada toca esses arquivos de forma espelhada —
não existe abstração genérica; é replicação deliberada do padrão.

## Componentes

### 1. Menu de ações ao tocar num versículo

- Hoje o toque num versículo só alterna o destaque de foco (`focusId` +
  `setVerseFocus`). Passa a: **selecionar o versículo E abrir uma barra de
  ações** fixa na base da tela (bottom sheet leve, `position: fixed`,
  respeitando `env(safe-area-inset-bottom)`), com:
  - **Copiar** — copia `"<texto>" (<abbrev> <ref>, NAA)`;
  - **Compartilhar** — `navigator.share` quando disponível; senão copia e
    mostra "Copiado ✓";
  - **Destacar** — 4 botões de cor (amarelo, verde, azul, rosa) +
    "Remover" quando já há destaque (ver item 2);
  - **Anotar** — rola até a seção de anotações com o campo aberto e a
    referência do(s) versículo(s) vinculada (ver item 4);
  - **Fechar** (e `Escape` fecha; tocar no mesmo versículo de novo fecha e
    desseleciona).
- Novo componente `src/components/VerseActions.tsx`. Estado de seleção
  vive em `Leitura.tsx` (substitui o uso atual de `focusId` simples por
  uma seleção de intervalo — item 3 — da qual o caso de 1 versículo é o
  degenerado).
- A persistência do "versículo em leitura" (`verse-highlight.ts`) continua:
  o **primeiro** versículo da seleção é gravado via `setVerseFocus`, e a
  restauração por `?v=`/foco salvo seleciona só ele (sem abrir a barra —
  a barra só abre em resposta a toque).

### 2. Destaques com cores sincronizados via D1 (nova entidade `destaques`)

- **Modelo** (`src/lib/types.ts`):
  ```ts
  export type DestaqueCor = 'amarelo' | 'verde' | 'azul' | 'rosa'
  export type Destaque = {
    id: string            // determinístico: `${pericopeOrdem}:${verseId}` (ex.: "12:3:16")
    pericopeOrdem: number
    verseId: string       // "capitulo:versiculo", igual ao TextoBlock.id
    cor: DestaqueCor
    criadoEm: string
    atualizadoEm: string
  }
  ```
  `id` determinístico ⇒ um destaque por versículo por usuário; destacar de
  novo troca a cor (upsert LWW natural entre dispositivos). Destacar um
  intervalo grava um registro por versículo.
- **Client** (`src/lib/user-db.ts`): `DB_VERSION = 3`; branch
  `oldVersion < 3` cria store `destaques` (keyPath `id`, índice
  `by-pericope` em `pericopeOrdem`). API:
  `listDestaques(ordem)`, `setDestaque(pericopeOrdem, verseId, cor)`,
  `removeDestaque(id)` (soft delete: apaga local + outbox com
  `apagadoEm`), `applyRemoteDestaques(rows)` com o guard
  `remoteWinsLocal`. Novo membro em `OutboxItem`:
  `{ seq?; kind: 'destaque'; destaque: Destaque; apagadoEm: string | null }`.
  Mesma transação atômica `[store, 'outbox']` dos demais.
  `clearAllUserData` passa a limpar `destaques` também.
- **Sync client** (`src/lib/sync.ts`): tipo `PushDestaque`, branch no
  `toPush()` (dedup por `id`, última escrita vence), chunk próprio, campo
  `destaques` no corpo do POST e no tipo da resposta do GET, e
  `applyRemoteDestaques` no pull.
- **Worker** (`worker/sync-logic.ts`): `PushDestaque` + `validDestaque()`
  (id string ≤ 64, verseId `/^\d+:\d+$/`, cor no enum, datas
  `ISO_CANONICAL`, `apagadoEm` string|null) + inclusão no
  `parseSyncPush` (aceitar corpo sem `destaques` como lista vazia —
  compatibilidade com clientes antigos).
- **Worker** (`worker/index.ts`): SELECT no pull
  (`WHERE user_id = ?1 AND server_em > ?2`) e upsert no push com o mesmo
  `ON CONFLICT(user_id, id) DO UPDATE ... WHERE excluded.atualizado_em > destaques.atualizado_em`.
- **Migration** `migrations/0004_destaques.sql`:
  ```sql
  CREATE TABLE destaques (
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    pericope_ordem INTEGER NOT NULL,
    verse_id TEXT NOT NULL,
    cor TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    apagado_em TEXT,
    server_em TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX idx_destaques_user_server ON destaques (user_id, server_em);
  ```
- **Render**: em ambos os modos (corrido/blocos), versículo com destaque
  ganha classe `verse-hl-<cor>`; cores definidas como tokens
  (`--hl-amarelo` etc.) com variantes light/dark/sépia legíveis
  (fundo suave, texto mantém `--read-ink`). O destaque de cor coexiste com
  o foco de seleção (foco = anel/box-shadow atual; cor = fundo).

### 3. Seleção de intervalo de versículos

- Estado em `Leitura.tsx`: `selection: { start: string; end: string } | null`
  (ids de versículo na ordem dos blocos parseados).
- Interação: toque em v1 seleciona v1 (barra abre). Toque em v2 ≠ v1
  **estende** a seleção ao intervalo contíguo entre eles (na ordem dos
  blocos, inclusive atravessando capítulos). Toque em qualquer versículo
  já dentro da seleção recolhe para só ele; toque no único selecionado
  desseleciona e fecha a barra.
- A barra mostra a referência da seleção (ex.: "Gn 1:3–7" ou
  "Gn 1:30–2:2" quando cruza capítulo) e as ações do item 1 operam sobre
  o intervalo inteiro (copiar concatena os textos com espaços; destacar
  grava um `Destaque` por versículo; anotar vincula o intervalo).
- Função pura `versesInRange(blocks, startId, endId): VerseBlock[]` e
  `rangeLabel(p, verses): string` em `src/lib/verse-range.ts`, com testes.

### 4. Anotações melhoradas

- **Vínculo a versículo**: `Anotacao` ganha `verseRef: string | null`
  (formato `"c:v"` ou `"c:v-c:v"`). Toca em: tipo em `types.ts`, coluna
  nova `verse_ref TEXT` via `migrations/0005_anotacao_verse_ref.sql`
  (`ALTER TABLE anotacoes ADD COLUMN verse_ref TEXT`), validação no
  `worker/sync-logic.ts` (opcional, string ≤ 32 ou null; ausente ⇒ null),
  SELECT/upsert no `worker/index.ts`, e `saveAnotacao` no client (novo
  parâmetro opcional). A ação "Anotar" da barra pré-preenche o vínculo;
  a nota exibe um chip tocável "Gn 1:3–7" que navega para
  `/leitura/<ordem>?v=<primeiro verso>`.
- **Editar**: botão "Editar" carrega a nota no textarea (estado
  `editingId`), o submit vira atualização (`saveAnotacao(ordem, texto, id, verseRef)`
  preservando `criadoEm`); botão "Cancelar" descarta.
- **Confirmação de exclusão**: "Apagar" vira confirmação inline em dois
  passos no próprio item ("Apagar mesmo? **Sim** / Cancelar"), sem
  `window.confirm`.
- **Ordenação**: lista exibida por `criadoEm` decrescente.

### 5. Tema sépia + seguir sistema

- `src/lib/theme.ts`: `Theme = 'light' | 'dark' | 'sepia'`;
  preferência armazenada = `Theme | null` (null = seguir sistema).
  Nova função `setThemePref(pref: Theme | 'system')` — `'system'` remove a
  chave e aplica o resolvido; `applyTheme` continua sendo o ponto único
  (dataset + evento `pericopes-theme`). `toggleTheme()` (header) segue
  alternando explícito claro↔escuro (a partir de sépia vai para escuro).
- `index.html` (script inline): nenhuma mudança estrutural — o valor
  armazenado `'sepia'` já cai em `dataset.theme = t`.
- `src/styles/app.css`: bloco `[data-theme='sepia']` com paleta papel
  quente (fundo ~`#f0e7d5`, `--paper` ~`#f7f0e0`, tinta marrom-escura,
  accent terroso; `color-scheme: light`). **Atenção obrigatória:** o
  media-query dark de fallback muda de
  `:root:not([data-theme='light'])` para
  `:root:not([data-theme='light']):not([data-theme='sepia'])`, senão o
  sistema em dark atropela o sépia explícito.
- `ReadingMenu.tsx`, linha "Tema": vira 4 botões com `aria-pressed` —
  Claro / Sépia / Escuro / Sistema (ativo = preferência armazenada;
  Sistema ativo quando não há chave).

### 6. Espaçamento de linha e largura de medida no "Aa"

- `reading-prefs.ts`: campos novos `leadingStep: number` (índice em
  `LEADING_STEPS = [1.5, 1.65, 1.8, 1.95]`, padrão 1) e
  `measure: 'estreita' | 'media' | 'larga'` (padrão `'media'`).
  `applyReadingPrefs` passa a setar `--read-leading` e `--read-measure`
  (estreita 32rem, média 38rem, larga 46rem). Setters
  `bumpReadingLeading(delta)` e `setReadingMeasure(m)` no mesmo padrão
  read-modify-apply-return. Prefs antigas sem os campos recebem o padrão.
- CSS: as classes de prosa de leitura (`.texto-biblico`, `.prose`,
  `.perguntas`, `.corrido`) consomem `line-height: var(--read-leading, 1.65)`;
  o container de conteúdo da página de leitura consome
  `max-width: var(--read-measure, var(--measure))` — as demais páginas
  continuam com `--measure` fixo.
- `index.html` (script inline): espelhar `LEADING_STEPS` e o mapa de
  medidas (mesma duplicação deliberada já existente para tamanho/fonte),
  setando `--read-leading`/`--read-measure` pré-hidratação.
- `ReadingMenu.tsx`: linha "Espaçamento" (dois botões ▲/▼ análogos a
  A−/A+) e linha "Largura" (3 botões com `aria-pressed`).

### 7. Débitos técnicos (carona)

1. `src/lib/sync.ts` `signOutLocal`: chamar `authClient.signOut()`
   **primeiro**; só limpar outbox/cursor após sucesso.
2. `src/App.tsx` botão "Sair": estado `saindo` (disabled enquanto
   pendente) + `.catch` com feedback discreto (title/aria-live), nunca
   rejeição não tratada.
3. `Leitura.tsx` pager inferior: `aria-label` "Anterior: <título>" /
   "Próxima: <título>" nos links.
4. `ReadingMenu.tsx`: `aria-modal="true"`, focus trap (Tab circula dentro
   do popover), foco devolvido ao gatilho também no fechamento por toque
   fora.
5. `.top-hidden` (app.css): adicionar `visibility: hidden` com
   `transition` que a atrase até o fim do transform (via
   `transition: transform .2s, visibility 0s .2s`), tirando o header
   oculto do fluxo de foco/leitores.
6. `.top` (app.css): paddings laterais com
   `max(var(--shell-pad), env(safe-area-inset-left/right, 0px))` como o
   `.shell` já faz.

## Tratamento de erros

- Todos os módulos novos seguem o padrão: localStorage/IndexedDB
  indisponível ⇒ try/catch, padrão seguro, leitura nunca quebra.
- `navigator.share` cancelado (AbortError) ⇒ silêncio; outros erros ⇒
  fallback copiar.
- Push de `destaques`/`verseRef` para servidor antigo não existe
  (client e worker sobem no mesmo deploy); corpo sem `destaques` no
  worker novo é aceito (lista vazia).

## Testes

- Vitest novos: `verse-range` (intervalo simples, cruzando capítulo,
  ids invertidos, rótulos); `user-db` destaques (set/troca de cor/remoção
  soft + outbox atômico, applyRemote LWW); `sync` push/pull com
  `destaques` e dedup; `worker/sync-logic` `validDestaque` +
  `verseRef` opcional (válido, nulo, ausente, inválido); `theme` (pref
  sistema/sépia); `reading-prefs` (migração de prefs antigas sem
  leading/measure).
- Checklist manual (fim do pacote, no iPhone): tocar versículo → barra;
  intervalo cruzando capítulo; destacar/trocar cor/remover; destaque
  aparece no outro dispositivo após sync; anotar com vínculo e navegar
  pelo chip; editar/apagar com confirmação; sépia + seguir sistema;
  espaçamento/largura persistem offline.

## Fora de escopo

Swipe, chips, busca (pacote 3); streak, TTS, wake lock (pacote 4).
