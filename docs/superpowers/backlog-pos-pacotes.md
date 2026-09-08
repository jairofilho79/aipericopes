# Backlog pós-pacotes 2–4 (2026-09-01)

Achados não-bloqueantes das revisões finais, adjudicados como melhorias
futuras. Nenhum corrompe dados nem quebra fluxo principal.

## Carga de dados

- ~~Primeira tela bloqueada pelo catálogo monolítico (`pericopes.json`, 13,7 MB
  crus / 4.446.987 bytes comprimidos).~~ Feito em 2026-09-02: `npm run shard`
  fatia o catálogo em `public/data/index.json` (metadados enxutos, servidos
  de cara) mais `texto/` e `estudo/` por livro, baixados por uma fila de
  fundo depois da primeira tela. Medido no build de produção servido local:
  a primeira tela cai de 4.446.987 para 70.739 bytes comprimidos — cerca de
  63× menos payload bloqueante (os tempos não são comparáveis entre as duas
  medições: a antiga foi pela internet contra o Cloudflare, a nova é
  servidor local — só a comparação de bytes, ambos comprimidos, é justa). O
  precache do service worker cai de ~15,7 MB para 2.271 KiB (49 entradas),
  com `index.json` como única entrada JSON. Migração de cliente com o SW da
  versão anterior instalado, offline completo em perícopes nunca visitadas
  e busca full-text sobre os shards seguem funcionando — a busca não chegou
  a ser observada progredindo ao vivo (shards já estavam em cache na sessão
  de verificação), mas está coberta por teste e revisão. Spec:
  `docs/superpowers/specs/2026-09-02-carga-progressiva-dados-design.md`.
- Precache do service worker hoje é dominado por ~25 variantes woff2 de
  subset das 5 famílias de fonte (fontsource); carregar só os subsets
  realmente usados cortaria a maior parte dos 2.271 KiB restantes.

## Sync / Worker (endurecimento)

- ~~Validações do Worker: inteiro em `pericopeOrdem`; invariante
  `id === "${ordem}:${verseId}"` nos destaques; cap do corpo bruto do POST
  `/api/sync`.~~ Feito em 2026-09-01 (`worker/sync-logic.ts`): `isOrdem`
  exige inteiro seguro `>= 0` nas três listas, `validDestaque` recusa id
  divergente, e `corpoExcedeLimite` barra corpo acima de `MAX_CORPO`
  (32 MiB) com 413 — que o cliente trata como rejeição determinística,
  junto do 400.
- `LIMIT`/paginação no pull de `destaques` (entidade mais volumosa) —
  pendente, e é pacote próprio: o cursor hoje é o `agora` opaco do
  servidor, então truncar sem mudar o protocolo faz o cliente pular
  linhas. Precisa de cursor com chave composta (`server_em` + desempate)
  e laço de re-pull no cliente.
- ~~Sem live refresh após pull: dados sincronizados de outro aparelho só
  aparecem ao navegar/remontar.~~ Feito em 2026-09-02: os `applyRemote*`
  devolvem quantas linhas mudaram, o pull avisa por `sync-event.ts` só
  quando mudou algo, e Home, Índice e Leitura assinam via
  `useSyncRefresh`. O evento anda num `EventTarget` do módulo, não na
  `window`. Na Leitura o refresh é estreito (destaques, notas, status)
  para não apagar rascunho em digitação.

## Sync — achados pré-existentes (levantados na revisão do P4, 2026-09-02)

Nenhum foi introduzido pela paginação; todos precedem a branch e nenhum é
alcançável por um cliente normal. Registrados para não se perderem.

- **Corrida de um milissegundo no cursor.** O comentário de `worker/index.ts`
  afirma que uma linha gravada entre o `agora` e a resposta "entra no próximo
  pull". Isso vale para `server_em > agora`, mas não para `== agora`: uma linha
  carimbada exatamente no `agora` e commitada depois do SELECT nunca é
  revisitada, porque a consulta seguinte é `>` estrita.
- **Relógio entre colos da Cloudflare.** `server_em` é `new Date()` por
  requisição, e colos não têm monotonicidade garantida entre si. Um POST
  atendido num colo atrasado pode carimbar abaixo de um cursor já avançado e
  ficar invisível para sempre. É inerente ao cursor por timestamp; a saída
  seria cursor composto `(server_em, id)`.
- **Backfill da migration 0003** define `server_em` com `DEFAULT ''`. Linha que
  tenha ficado com `''` é invisível a todo pull incremental (`> since` estrito).
- **A rota `GET /api/sync` não tem teste.** A lógica de paginação é pura e bem
  coberta, mas o teste de ida-e-volta exercita um espelho da rota escrito no
  próprio arquivo de teste. Uma regressão em `worker/index.ts` — pôr um LIMIT no
  fechamento de grupo, concatenar em vez de substituir, fechar só a primeira
  entidade sinalizada — passaria verde.

## Leitura

- ~~Chip de vínculo de anotação navega via URL (`?v=`) e o load effect
  descarta rascunho/edição em andamento.~~ Feito em 2026-09-02: o efeito
  virou dois — a carga pesada depende só de `ordem` (e é lá que rascunho,
  edição e confirmação zeram), e um efeito síncrono separado cuida do foco
  do versículo em `[ordem, verseParam]`. Manteve o `?v=` como deep-link,
  que a Pesquisa usa.
- ~~Barra de ações (`VerseActions`): `role="dialog"` sem foco movido para
  dentro nem devolvido ao versículo ao fechar.~~ Feito em 2026-09-02: o foco
  entra na caixa (que tem `aria-label`) e volta ao versículo ao fechar, com
  guard de `isConnected`. Continua sem armadilha de foco (Tab sai da barra) —
  ela não é modal, e uma armadilha sem `aria-modal` seria pior.
- ~~Swipe sem guard de diálogo aberto (assimetria com o teclado).~~ Feito
  em 2026-09-02: `onEnd` usa o mesmo `hasOpenDialog` do teclado, importado
  de lá em vez de duplicado, para as duas formas de navegar não poderem
  discordar.
- Falta cobertura de teste para o hook de wake lock (repo sem infra de
  teste de hooks). As outras duas metades deste item — o `onerror` que
  abortava a fila inteira e a cobertura de "play superseded" — saíram em
  2026-09-02 junto com a remoção do TTS sintético.
- Espaçamento padrão de leitura mudou de 1.75 para 1.65 com a escala nova
  `[1.5, 1.65, 1.8, 1.95]` — deliberado (spec §6); quem preferir mais
  respiro ajusta no "Aa".

## Navegação / Índice / Busca

- ~~Após navegar por chip, o foco não move para a seção.~~ Feito em
  2026-09-02: as quatro seções têm `tabindex="-1"` e `irPara` faz
  `focus({ preventScroll: true })` depois da rolagem suave.
- ~~←/→ com foco na linha de chips: `preventDefault` impedia a rolagem
  horizontal por teclado da própria linha.~~ Feito em 2026-09-02:
  `shouldHandleKey` devolve `null` quando o alvo está dentro de
  `.section-chips-row`.
- ~~Referência viva muda de largura ("Gn 1:1" → "Gn 12:34") e faz a linha
  de chips tremer.~~ Feito em 2026-09-02: `min-width: 10ch` em
  `.section-ref`, medido do pior rótulo real ("1Sm 150:89").
- ~~Pesquisar: "(primeiros)" aparece com exatamente 50 resultados; `<mark>`
  some durante a janela de debounce.~~ Feito em 2026-09-02: a busca pede
  `LIMITE_RESULTADOS + 1` e `fatiarResultado` decide o corte; o termo viaja
  junto dos hits no mesmo estado.
- ~~Flash de 1 frame da barra de chips antes de `--top-h` ser medido.~~ Feito
  em 2026-09-02: a medição virou `useLayoutEffect`, então roda antes da
  pintura. **Mas ver o item abaixo** — o benefício visível não pôde ser
  confirmado. Confirmado em 2026-09-03: o item abaixo era outro problema, e a
  correção do flash está certa.
- ~~Barra de chips sobrepõe o header ao rolar.~~ RESOLVIDO em 2026-09-03, e o
  diagnóstico anterior estava errado nos dois pontos. Investigado ao vivo:
  `--top-h` vale 55px e herda corretamente até `.section-chips`; existe
  exatamente UMA regra declarando `top` no elemento; e a `CSSTransition` que o
  browser gera tem keyframes `0px → 55px`, ou seja, `var(--top-h)` sempre
  resolveu. `.shell:has(.top-hidden)` não casar com o header visível é o
  comportamento CORRETO, não o defeito — as três investigações anteriores foram
  atrás da peça errada. Os dois sintomas relatados eram outra coisa: "a barra
  cobre o header" era o header auto-ocultando (`use-hide-on-scroll`, como
  projetado), e "a barra fica descolada" era o texto vazando pela faixa de
  padding translúcida — `color-mix(… 82%, transparent)` mais `blur(6px)`. O
  fundo virou opaco. A `transition: top` saiu junto, por animar um offset vindo
  de custom property medida em JS em paralelo ao `transform` do header. Spec:
  `docs/superpowers/specs/2026-09-03-chrome-header-perfil-design.md`.
- ~~Seletor `.book-group` duplicado no CSS.~~ Feito em 2026-09-02: as duas
  regras viraram uma (ambas no topo, sem `@media` em volta).
- CSS órfão depois da fusão Índice/Pesquisa (apagar `Indice.tsx` E
  `Pesquisar.tsx` deixou seletores de dois arquivos sem elemento, não só um):
  `.pesquisar .testament-h`, `.pesquisar .section-h` (`app.css:2042-2056`); o
  bloco `.modo-busca`/`.modo-btn` (`app.css:2227-2251`); `.book-group`
  (`app.css:2037-2040`); `.book-list`, `.book-chip` e variantes
  (`.book-chip .book-abbrev`, `.book-chip.active`,
  `.book-chip.active .book-abbrev`) (`app.css:2059-2096`); `.search-hit` e
  variantes (`.search-hit a`, `.search-hit a strong`, `.search-hit a span`)
  e `.catalog-hint` (`app.css:2201-2226`); `.book-group-head` com
  `.book-group-head h2` (`app.css:2291-2299`); e `.peri-list.compact`, duas
  ocorrências (`app.css:2274`, `app.css:2287`) — a prop `compact` de
  `ListaPericopes` nunca teve consumidor (nem produção, nem teste; a Task 8
  removeu a prop e o parâmetro, era o mesmo defeito já corrigido em
  `CatalogoLivros` no pré-flight, só não replicado aqui na hora). Não
  removidos junto de propósito: quatro sessões editavam o arquivo na mesma
  rodada e a remoção conflitaria. Limpeza segura agora — conferir de novo
  antes de apagar, o código-fonte muda rápido e as linhas acima podem ter se
  deslocado.

## UI geral

- Skeletons anunciam rótulo genérico "Carregando…" (poderiam ser
  específicos por página).
- Feedback do botão "Sair" só via `title`/aria-live (usuário de toque não
  vê indicação visível de falha).

- `src/pages/Explorar.tsx` tem 483 linhas (398 de código, 56 de comentário),
  contra as ~190 que a spec da fusão projetou — e a mesma spec prometia
  "nenhum arquivo passa de 200". São 11 `useState`, 5 `useEffect` e 6
  `useMemo` num arquivo só, e as três seções que carregam dados (Referência,
  Títulos, livro aberto) repetem o mesmo formato: efeito com bandeira `vivo`,
  `.then` que seta estado, `.catch` que engole. É um hook pedindo para
  nascer. Levantado na revisão final da branch e deliberadamente NÃO pago
  antes do merge: não é defeito, os testes cobrem o comportamento, e refatorar
  na mesma rodada em que quatro sessões mexeram no repositório trocaria risco
  conhecido por risco novo. É a dívida que a próxima mudança nesta tela paga.
- A extração de lógica pura para `src/lib/` (`catalogo.ts`, `item-pericope.ts`)
  nasceu de um conserto de aviso de lint, não de decisão de desenho, e por isso
  parou onde o lint parou. Vale decidir de propósito o que mais sai de
  `Explorar.tsx` quando a refatoração acima acontecer.
