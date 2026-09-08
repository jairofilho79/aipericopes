# Design: Pacote 4 — Engajamento e extras

Data: 2026-08-31 · Status: aprovado em conversa (escopo dos 4 pacotes); execução noturna autorizada pelo usuário sem gates intermediários.

## Objetivo

Seis melhorias de engajamento e conforto, 100% no cliente. Nenhuma mudança
no Worker/D1 — o streak deriva dos dados de progresso que já sincronizam.

Pré-requisito: pacotes 2 e 3 integrados na main.

## Componentes

### 1. Streak de dias na Home

- Novo módulo puro `src/lib/streak.ts`:
  ```ts
  export function diasComConclusao(progressos: Progresso[]): Set<string> // 'YYYY-MM-DD' local
  export function computeStreak(dias: Set<string>, hoje: Date): { atual: number; recorde: number }
  ```
  - `diasComConclusao`: datas locais (não UTC) de `atualizadoEm` dos
    registros com `status === 'concluido'`;
  - `atual`: dias consecutivos terminando hoje **ou ontem** (concluir
    ainda hoje mantém o streak; só quebra com um dia inteiro pulado);
  - `recorde`: maior sequência histórica.
- `Home.tsx`: carrega `listAllProgresso()` e mostra acima dos track
  cards, quando `atual >= 1`:
  "🔥 **N dias seguidos**" (singular "1 dia") e, se `recorde > atual`,
  "· recorde: R". Quando `atual === 0`, nada aparece (sem culpa).
- Deriva de dados sincronizados ⇒ funciona entre dispositivos sem
  entidade nova. Limitação aceita e documentada no código: `atualizadoEm`
  é a última escrita do progresso — reconcluir uma perícope antiga conta
  para o dia atual, o que é o comportamento desejado.

### 2. Tempo estimado de leitura

- `src/lib/reading-time.ts`: `readingMinutes(texto: string): number` —
  contagem de palavras (`split(/\s+/)` filtrado) ÷ 180 wpm,
  `Math.max(1, Math.round(...))`.
- `Leitura.tsx`: no cabeçalho, junto à referência: "· ~N min" (sobre o
  `texto_naa`; as demais seções não entram na conta — é o tempo do texto
  bíblico). Também no card de perícope da Home ("~N min").

### 3. Skeleton loading

- CSS: classe `.skeleton` (blocos cinza `--line` com shimmer via
  `animation`; desligado sob `prefers-reduced-motion`).
- `Leitura.tsx`: enquanto `!p && !err`, em vez do texto "Carregando…",
  renderiza um esqueleto com a forma da página (linha de título, 2
  parágrafos, 6 linhas de texto). `Home.tsx` e `Indice.tsx`: esqueleto
  dos cards/listas enquanto carregam.
- Primeira visita baixa ~13 MiB de `pericopes.json` — o esqueleto é o que
  o usuário vê nesse intervalo; nas seguintes o cache torna isso
  instantâneo.

### 4. Ouvir a perícope (TTS)

- Novo módulo `src/lib/tts.ts` sobre `speechSynthesis`:
  ```ts
  export function ttsSupported(): boolean
  export type TtsState = 'idle' | 'playing' | 'paused'
  export function createTtsController(opts: {
    onVerse?: (verseId: string | null) => void
    onState?: (s: TtsState) => void
  }): { play(verses: { id: string; text: string }[]): void; pause(): void; resume(): void; stop(): void }
  ```
  - uma `SpeechSynthesisUtterance` **por versículo** (fila), `lang
    'pt-BR'`, voz preferida = primeira com `lang` começando em `pt`
    (fallback: padrão do sistema);
  - `onstart` de cada utterance reporta o versículo corrente (highlight);
    fim da fila ⇒ `stop` implícito;
  - `stop()` cancela a fila e limpa o highlight; chamado também no
    unmount e na troca de perícope.
- `Leitura.tsx`: acima da seção Texto, quando `ttsSupported()`, botões
  "▶ Ouvir" / "⏸ Pausar" / "⏹" (aria-labels completos). Versículo em
  reprodução ganha classe `.verse-speaking` (sublinhado/realce discreto
  distinto do foco e dos destaques de cor) e rola suavemente para o
  centro (`scrollIntoView` com guard de `prefers-reduced-motion`).
- Quirk iOS conhecido: vozes carregam tarde — ouvir `voiceschanged` e
  resolver a voz na hora do `play`, não no mount.

### 5. Wake lock (tela acesa durante a leitura)

- Novo hook `src/lib/use-wake-lock.ts`: `useWakeLock(enabled: boolean)` —
  `navigator.wakeLock?.request('screen')` quando `enabled` e documento
  visível; re-adquire em `visibilitychange` (o sistema solta o lock ao
  minimizar); `release()` no cleanup. Todos os erros silenciosos
  (`NotAllowedError` em battery saver etc. nunca afetam a leitura).
- Ativo em `/leitura/:ordem` sempre que a página está montada (leitura já
  é o caso de uso; sem toggle no v1).

### 6. Contexto colapsável

- A seção Contexto ganha um cabeçalho-botão com chevron
  (`aria-expanded`), colapsando o corpo da seção. **Padrão: aberto**
  (contexto é leitura de primeira classe); a escolha persiste
  globalmente em localStorage (`pericopes-contexto-aberto`, `'1'`/`'0'`,
  try/catch padrão) — quem prefere ir direto ao texto colapsa uma vez.
- Colapsado, mostra só o título "Contexto" + chevron; o chip "Contexto"
  da barra (pacote 3) continua rolando até a seção (e a expande ao
  navegar por ele).

## Tratamento de erros

- `speechSynthesis`/`wakeLock` ausentes ⇒ recursos simplesmente não
  aparecem/não fazem nada; nunca erro visível.
- `listAllProgresso()` vazio ⇒ sem streak; datas inválidas ignoradas.

## Testes

- Vitest: `streak` (sequência terminando hoje, terminando ontem, quebra,
  recorde, fuso local — datas construídas com `new Date(y,m,d)`);
  `reading-time` (texto vazio ⇒ 1 min, contagens conhecidas);
  `tts` — lógica pura de montagem de fila e seleção de voz extraída e
  testada com mocks (`ttsSupported` false sem `speechSynthesis`);
  persistência do contexto colapsável.
- Checklist manual (iPhone): streak aparece após concluir; ~min coerente;
  skeleton na primeira carga sem cache; Ouvir lê em pt-BR com realce
  acompanhando e para ao sair; tela não apaga lendo; contexto colapsa e
  lembra a escolha.

## Fora de escopo

Nada além dos 6 itens; encerra as 28 propostas aprovadas.
