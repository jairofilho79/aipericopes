# Redesenho da narração: doca fixa, alvos de toque e disponibilidade visível (2026-09-08)

Três defeitos do mesmo lugar: (1) o app tem alvos de toque abaixo do mínimo
recomendado, inclusive nos botões que tocam e pausam a narração — a ação
central do app; (2) o player de narração é um bloco solto no meio do artigo,
que some da viewport assim que o leitor rola, forçando rolar de volta para
pausar; (3) quando não há narração, `NarracaoPlayer` retorna `null` e o app
fica mudo — o leitor não sabe se é bug, carregamento, ou narração que nunca
vai existir.

Esta spec não mexe em cor, no realce da narração sobre o texto, nem no
mapeamento manifesto↔tela (`src/lib/alinhar-narracao.ts`), que já funciona e
está fora de escopo.

## O estado de hoje

O player vive dentro do `<article className="leitura">`, entre a
`SectionChips` e o corpo da perícope (`Leitura.tsx:875-884`). É um bloco
`display: grid` de largura da coluna de leitura (`.narracao`,
`app.css:1147-1163`), com rótulo, barra e transporte — e ele **desaparece da
tela** assim que o leitor rola para dentro do texto, porque não é sticky nem
fixo.

Para dar acesso à pausa depois de rolar, a `SectionChips` ganhou um controle
compacto embutido: `narracaoUsada` (`Leitura.tsx:169`) libera um botão
`.narracao-mini` de 2.55rem (40,8px) ao lado dos quatro chips
(`Leitura.tsx:850-862`, `app.css:943-965`), que só aparece **depois** do
primeiro play — antes disso, rolar para longe do player esconde o controle
por completo.

Sem áudio, `NarracaoPlayer.tsx:274` faz `if (!src) return null` — o
componente inteiro some, sem esqueleto, sem aviso, sem diferença entre "ainda
verificando", "não existe" e "existiu mas falhou ao carregar" (esse último
caso já é tratado *depois* que `src` existe, com `erro` e
`.narracao-erro`, `NarracaoPlayer.tsx:92,328,387-391`).

Na Home (`src/pages/Home.tsx`), o card de jornada (`.jornada-card`,
linhas 126-151) e os cards de trilha (`.track-card`, linhas 172-187) têm só o
CTA `Continuar`/`Rever` (`.cta`, `app.css:587-599`) — nenhum caminho de um
toque só até ouvir. A Home já carrega `loadIndex()` (linha 48,
`src/lib/content.ts`) com o `index.json` inteiro (metadados de todas as
2.823 perícopes, `scripts/shard-catalogo.ts:20`), mas o `PericopeIndex`
(`src/lib/types.ts:2-27`) não carrega nenhum sinal de cobertura de narração —
o único sinal que existe hoje é o `HEAD /api/audio/<voz>/<ordem>.m4a` que
`NarracaoPlayer.tsx:122` faz, por perícope, quando a Leitura abre.

Não existe hoje, em lugar nenhum do repositório, um manifesto ou índice
publicado de "quais perícopes têm narração". A publicação
(`scripts/publicar-narracao.sh`) sobe `.m4a`+`.json` direto pro R2 via
`wrangler r2 object put`, e a conferência (`scripts/conferir-narracao.sh`)
valida contra a API por `HEAD` em série — ambos são scripts locais, nada é
commitado. Isso é relevante para a seção "Contrato de dados da Home" abaixo.

Os quatro chips de seção (`SectionChips.tsx`) são um controle segmentado
(`.section-chip`, `app.css:892-909`) com `min-height: 2.25rem` (36px).

### O levantamento de alvos de toque abaixo de 44px

Busca por `min-height`/`min-width` menor que 44px (2.75rem) em
`src/styles/app.css`, com o seletor que os usa:

| Seletor | Arquivo:linha | Valor hoje | Usado em | Valor novo |
|---|---|---|---|---|
| `.read-tool` | `app.css:815-816` | 2.25rem (36px) | `LeituraPrefs.tsx`, `PerfilMenu.tsx` — botões de fonte/tema/layout | 44px |
| `.collapse-btn` | `app.css:1047` | 2.25rem (36px) | botão que expande/recolhe o Contexto | 44px |
| `.section-chip` | `app.css:897` | 2.25rem (36px) | os 4 chips de seção | 44px (decisão 7) |
| `.narracao-btn` | `app.css:1187-1188` | 2.25rem (36px) | voltar/avançar 10s do player atual | 48px (vira o botão de salto da doca) |
| `.narracao-barra` | `app.css:1251` | 2.25rem (36px, é a área de toque do range) | barra de posição do player atual | 44px (vira a área de toque do trilho da doca) |
| `.linkish` | `app.css:1941` | 2.25rem (36px) | botão-link (“ver todas”, etc.) | 44px |
| `.trocar-livro` | `app.css:2173` | 2.25rem (36px) | botão de trocar livro no Explorar | 44px |
| `.chip-filtro` | `app.css:2922` | 2.25rem (36px) | chips de recorte no Explorar | 44px |
| `.narracao-mini` | `app.css:948-949` (`width`/`height`, não `min-*`) | 2.55rem (40,8px) | botão compacto ao lado dos chips | removido — a doca substitui |
| `.narracao-play` (desktop, ≥40rem) | `app.css:1352-1353` | 2.5rem (40px) | play/pause do player atual em telas largas | 60px (vira o play/pause da doca, decisão 2) |
| `.narracao-play` (mobile) | `app.css:1217-1218` | 2.75rem (44px) | play/pause do player atual | já estava em 44px; sobe para 60px na doca mesmo assim, por ser o play/pause dela |

`.chip-filtro`, `.trocar-livro`, `.read-tool` e `.linkish` estão fora do
escopo funcional da narração, mas entram no levantamento porque a decisão 1
("nenhum alvo de toque abaixo de 44px") é do app inteiro, não só do player —
e são as únicas ocorrências de `2.25rem` no arquivo além das já listadas
acima do player e dos chips.

A escala final, para toda edição feita por esta spec:

| Papel | Tamanho |
|---|---|
| Alvo de toque mínimo (qualquer botão pequeno) | 44px |
| Ação secundária (voltar/avançar 10s, velocidade) | 48px |
| Botão "Ouvir" (cartão pré-play, Home) | 56px |
| Play/pausa da doca | 60px |

## Decisões de partida

Tomadas antes desta spec, não reabertas aqui:

1. Nenhum alvo de toque abaixo de 44px em lugar nenhum do app; a escala é
   44 / 48 / 56 / 60px conforme a tabela acima.
2. A narração ganha uma doca fixa no rodapé, ativa só enquanto toca,
   substituindo o bloco solto (`.narracao`) e o `.narracao-mini`.
3. Antes de tocar, um cartão no corpo da perícope oferece "Ouvir esta
   perícope" com um botão de 56px — um toque para começar.
4. Quando não há áudio, o app diz por quê, em três estados distintos:
   verificando, ainda não gravada, falhou ao carregar.
5. A Home ganha um botão "Ouvir" de 48px nos cards de trilha/jornada, que
   abre a perícope já tocando quando há narração — e não aparece quando não
   há.
6. Nenhuma cor muda. O realce da narração sobre o texto (`--candle`,
   `--candle-fundo`, `--candle-luz-pct`) é intocado.
7. Os chips de seção continuam existindo, como âncora e salto na narração,
   crescem para 44px de altura e perdem o mini-player embutido.

## A doca de narração

Substitui o `<div className="narracao">` de hoje (`Leitura.tsx:875-884`,
`app.css:1147-1163`) e o `.narracao-mini` da `SectionChips`
(`Leitura.tsx:850-862`). Monta condicionalmente — só existe enquanto a
narração desta perícope está tocando ou pausada em algum ponto que não o
início (ver "quando a doca aparece e some", abaixo) —, fixa no rodapé da
viewport (`position: fixed; bottom: 0; inset-inline: 0`), acima de qualquer
outro elemento fixo do app (nenhum existe hoje concorrendo por esse espaço).

Fundo `color-mix(in srgb, var(--paper) 94%, transparent)` com
`backdrop-filter: blur(6px)` (mesma técnica da `.section-chips` de hoje,
`app.css:852-860`, só que a 94% em vez de 82% — 94% é opaco o bastante para
nunca deixar o texto rolando atravessar por baixo, o mesmo defeito que a
spec de 2026-09-03 corrigiu na barra de chips). Borda superior
`1px solid var(--line)`.

Anatomia, de cima para baixo:

**1. Linha de estado** — `font-family: var(--font-ui)`, `padding` lateral
igual ao das outras barras do app (`1.05rem`, consistente com
`.section-chips`).

```
[🔥 NARRANDO   Texto · João 3:16                    3:24 / 9:07]
```

- Ícone de chama: reaproveita a máscara `--chama-svg` que já pinta
  `.streak-chama` (`app.css:370-378`) em `var(--flame)` — é a mesma cor que
  já significa "isto é vivo, é o app falando", coerente com a regra do
  âmbar (o `--flame` é luz, nunca texto sobre papel).
- Rótulo "NARRANDO": caixa alta, `letter-spacing` aberto, no padrão de
  `.narracao-rotulo` de hoje (`app.css:1165-1173`) — mesmo peso visual,
  cor `var(--muted)`.
- Seção + referência do que está tocando agora: deriva de `falando`
  (o mesmo estado que já existe, `Leitura.tsx:164`, alimentado por
  `onAlvo` do `NarracaoPlayer`). Os ids que `falando` assume vêm de
  `alinhar-narracao.ts` e `paragraphize.ts`; a tradução para rótulo humano:

  | Padrão do id em `falando` | Rótulo na doca |
  |---|---|
  | `null` (nada alinhado ainda, ou seção sem alinhamento) | só a referência da perícope (`refLabel(p)`) |
  | `'titulo'` / `'referencia'` | título da perícope |
  | `'cabecalho-<secao>'` | nome da seção (mesmos rótulos dos chips: Contexto/Texto/Resenha/Reflexões) |
  | `'cap-<n>'` | `Texto · Capítulo <n>` |
  | `/^\d+:\d+$/` (id de versículo) | `Texto · <livro> <cap>:<vers>` |
  | `'contexto-<n>'` | `Contexto` |
  | `'resenha-<n>'` ou `'palavra-<n>'` | `Resenha` |
  | `'reflexao-<n>'` | `Reflexões` |

  Nunca fica em branco: sem alvo alinhado, cai na referência da perícope.
- Tempo `3:24 / 9:07`, alinhado à direita, `font-variant-numeric:
  tabular-nums` (já é assim em `.narracao-tempo`, `app.css:1230-1245`) —
  reaproveita `formatarTempo` de `narracao-controles.ts:16`.

**2. Barra de posição** — trilho de 4px (mesma espessura de hoje,
`.narracao-barra::-webkit-slider-runnable-track`, `app.css:1265-1275`),
thumb de 16px (sobe de 14px, `app.css:1277-1298`, para acompanhar a escala
maior da doca), **área de toque de 44px** de altura no elemento `<input
type="range">` (a barra visual continua fina; é a caixa de toque que
cresce — mesmo truque que `.narracao-barra` já faz hoje ao dar `height:
2.25rem` a um trilho desenhado de 4px, só que com o número novo). Arrastável
com o dedo e com teclado (`step={0.1}` na resposta ao arrasto, setas do
teclado dão o salto fixo de 10s — ver "Acessibilidade").

**3. Linha de controles**, centralizada:

```
        [«10]      [ ▶/❚❚ ]      [10»]      [1×]
        48px         60px          48px       48px
```

- Voltar 10s e avançar 10s: 48px, mesmos ícones de hoje (`IconeSalto`,
  `NarracaoPlayer.tsx:415-447`), mesmo salto fixo `SALTO = 10`
  (`NarracaoPlayer.tsx:52`).
- Play/pausa: 60px, círculo cheio em `--cta-bg`/`--cta-ink` (a mesma dupla
  de tokens que `.narracao-play` já usa, `app.css:1217-1224`, só maior e sem
  o encolhimento que hoje acontece em telas largas — na doca o play é 60px
  em qualquer largura, porque é o botão mais tocado do app).
- Velocidade: 48px, rótulo textual `1×` (não ícone — é a única forma de o
  estado atual ficar legível sem abrir nada). Ciclo num único toque, sem
  menu: `1× → 1,25× → 1,5× → 0,75× → 1×`. Implementação: `audio.playbackRate`
  e `audio.preservesPitch = true` (evita o efeito "esquilo").

  **Isto reabre, de propósito, uma decisão registrada em código**:
  `narracao-controles.ts:7` diz que não há controle de velocidade "de
  propósito: a leitura é momento de descanso, e fora de 1× o realce da
  palavra perderia o passo". Essa razão não vale mais, e o comentário
  precisa ser corrigido quando este item for implementado: o realce lê
  `audio.currentTime` (`NarracaoPlayer.tsx:180`), que é tempo **de faixa**,
  não tempo de parede. `playbackRate` muda a velocidade real sem mudar a
  escala em que `indiceEm`/`indiceDaPalavra` operam — `currentTime` continua
  batendo com `inicio`/`dur`/`palavras[].i` do manifesto em qualquer
  velocidade. O realce por palavra e por versículo não quebra a 1,25× ou
  1,5×. Verificar isso no app real antes de fechar o item (critério de
  aceite abaixo).

### Quando a doca aparece e some

A doca monta quando `tocando` vira verdadeiro pela primeira vez nesta
perícope (o mesmo gatilho que hoje libera `narracaoUsada`,
`Leitura.tsx:461-475`) e continua montada enquanto pausada — some só ao
trocar de perícope ou ao voltar ao início absoluto sem nunca ter tocado.
Isto é o `narracaoUsada` de hoje, sem mudança de comportamento; muda só a
casa onde o controle mora (doca fixa, não mais ao lado dos chips).

Com a doca visível, o corpo da página ganha um `padding-bottom` igual à
altura dela, para o fim do texto (perguntas de reflexão) não ficar coberto.

## O cartão "antes de tocar"

Enquanto a narração desta perícope nunca foi iniciada nesta sessão de
leitura (`!narracaoUsada`) **e** o áudio existe, um cartão substitui o lugar
onde a doca ficaria — no corpo da perícope, no mesmo ponto em que
`NarracaoPlayer` é montado hoje (`Leitura.tsx:875`, logo após a
`SectionChips`):

```
┌──────────────────────────────────────────┐
│  ⏵    Ouvir esta perícope                 │
│ 56px  5 min · voz sintetizada, lida       │
│       sobre o texto                       │
└──────────────────────────────────────────┘
```

- Botão play de 56px, círculo cheio em `--cta-bg`, ícone `IconePlay`
  existente.
- Título "Ouvir esta perícope", Cormorant, 21px. **Cormorant não existe
  hoje no app** — as famílias atuais são `--font-display` (Fraunces
  Variable, `app.css:65`) e as três opções de `--read-font` (Source Serif 4,
  Literata, sans; `index.html:33`). Entra como fonte nova, só para este
  rótulo: carregar `Cormorant Variable` via Google Fonts (permitido pela
  allowlist de CDN) e declarar um token dedicado, por exemplo
  `--font-ouvir: 'Cormorant Variable', Georgia, serif`, para não colidir com
  os dois já em uso.
- Linha secundária, `var(--muted)`: "N min · voz sintetizada, lida sobre o
  texto" — `N` vem de `minutos` (`Leitura.tsx:192`, `readingMinutes`).
  "Voz sintetizada" aqui não reintroduz o TTS do navegador (removido na fase
  de 2026-09-02): descreve a narração pré-gerada de fato — é uma voz gerada
  por IA, só que renderizada uma vez e servida do R2, não sintetizada ao
  vivo no aparelho.

Um toque no botão chama `alternar()` (o mesmo método já exposto pelo
`NarracaoPlayerHandle`, `NarracaoPlayer.tsx:255`) e a doca assume o lugar do
cartão.

Se a perícope já tinha um checkpoint de narração salvo
(`tempoInicialNarracao`, `Leitura.tsx:172`), o áudio já está posicionado
nele antes mesmo do toque (`NarracaoPlayer.tsx:140-148`) — o toque em
"Ouvir esta perícope" retoma do ponto salvo, não do zero. Nada muda aqui: é
o comportamento de hoje, só herdado pelo cartão novo.

## Os três estados de indisponibilidade

Hoje `NarracaoPlayer.tsx:274` (`if (!src) return null`) apaga qualquer
sinal quando não há áudio. Os três estados abaixo entram no lugar do cartão
"antes de tocar" — cada um visível, cada um com o texto exato a usar:

### 1. Verificando

Enquanto o `HEAD` de `NarracaoPlayer.tsx:122` está em voo (não decidiu
ainda se existe áudio). Um esqueleto discreto, do mesmo tamanho do cartão
final (evita reflow quando a resposta chega), seguindo o padrão de
`Skeleton.tsx`: `role="status"` com texto oculto visualmente, mais uma
barra `.skeleton` no lugar do botão.

```tsx
<div className="ouvir-skeleton" role="status">
  <span className="sr-only">Verificando narração desta perícope…</span>
  <span className="skeleton" />
</div>
```

Sem texto visível — é o mesmo princípio do esqueleto da página inteira
(`Skeleton.tsx:1-9`): decoração para quem vê, anúncio explícito para quem
não vê.

### 2. Ainda não gravada

`HEAD` respondeu e não é `ok` (404 — a chave não existe no R2; é a resposta
esperada para a maior parte do catálogo enquanto a Sessão 5 da refundação
BLIVRE não termina de narrar as 2.823 perícopes). Linha em `var(--muted)`,
sem botão, sem ícone de erro — não é uma falha, é um fato do catálogo:

> **Texto exato:** "A narração desta perícope ainda não foi gravada."

### 3. Falhou ao carregar

Dois casos entram aqui, e os dois levam ao mesmo texto: (a) o `HEAD` em si
falhou por erro de rede (hoje engolido em silêncio no `.catch(() => {})` de
`NarracaoPlayer.tsx:130`); (b) o `HEAD` confirmou o áudio mas o `<audio>`
disparou `onError` ao carregar de fato (`NarracaoPlayer.tsx:328`, hoje já
existe como `erro`/`.narracao-erro` mas só depois de `src` existir — o
cartão pré-play herda esse estado). Mesma linha visual do estado 2, mais uma
ação:

> **Texto exato:** "Não foi possível carregar a narração desta perícope."
> **Botão:** "Tentar de novo" — refaz o `HEAD` (e, se já havia `src`,
> recarrega o `<audio>`).

`role="status"` nos dois estados 2 e 3 (mesmo padrão do `.narracao-erro` de
hoje, `NarracaoPlayer.tsx:387-391`), para o leitor de tela ouvir a mudança
quando o estado 1 (verificando) resolve para um destes dois.

## Contrato de dados: como a Home sabe da cobertura

A Home não pode fazer um `HEAD` por card. Hoje ela já renderiza, no mínimo,
um card de jornada ou até dois cards de trilha, mais até a lista inteira de
"Vale reler" quando "ver todas" é tocado (`candidatos.length`,
`Home.tsx:206-230`, sem limite superior) — um `HEAD` por linha não escala e
não funciona offline, e o app é local-first por decisão (ver a seção sobre
`/ajustes` na spec de 2026-09-03).

**O que existe hoje:** nada publicado diz, de antemão, quais ordens têm
áudio. `scripts/publicar-narracao.sh` sobe direto pro R2 via `wrangler r2
object put`; `scripts/conferir-narracao.sh` confere via `HEAD` em série, mas
só imprime contagem e grava divergências — não emite uma lista.

**A proposta:** um arquivo novo, `data/audio-cobertura.json`, committed
junto do catálogo — uma lista simples de ordens (`{ "ordens": [1600, 1601,
...] }`). Ele é gerado por um passo que já teria toda a informação na mão
sem custo extra: em vez de só imprimir "ok/ausente/divergente",
`scripts/conferir-narracao.sh` (ou um script companheiro que reusa a mesma
verificação por `HEAD`) grava a lista das ordens que confirmou presentes.
`scripts/shard-catalogo.ts` passa a ler esse arquivo e a somar no `indice`
(linha 82-93) um campo booleano:

```ts
const cobertura = new Set<number>(
  JSON.parse(readFileSync(coberturaPath, 'utf8')).ordens,
)
// ...
const indice = catalogo.map((p) => ({
  // ...campos existentes...
  narrado: cobertura.has(p.ordem),
}))
```

`data/audio-cobertura.json` entra em `fontes` (`shard-catalogo.ts:29-33`) —
tanto para `precisaGerar()` reconhecer que a cobertura mudou quanto para
`versaoDosShards()` (linha 55-59), porque esse hash nomeia o cache de
runtime do service worker: sem entrar em `fontes`, um lote de narração
publicado à noite nunca chegaria a um aparelho com o app já instalado.

**Custo:** `index.json` já é ~480KB (comentário em
`shard-catalogo.ts:2`) e já é carregado inteiro pela Home via `loadIndex()`.
Um booleano por perícope soma ~2.823 bytes não comprimidos — abaixo do
ruído depois de gzip, e paga uma vez por deploy, não uma vez por card por
visita. A alternativa (`HEAD` por card) paga em toda visita, não funciona
offline, e cresce linearmente com o número de cards mostrados — o oposto do
que a Home precisa.

`PericopeIndex` (`src/lib/types.ts:2-27`) ganha o campo:

```ts
/** Se há narração publicada para esta perícope. Fonte: data/audio-cobertura.json. */
narrado: boolean
```

## Ouvir a partir da Home em um toque

Cards de jornada (`.jornada-card`, `Home.tsx:126-151`) e de trilha
(`.track-card`, `Home.tsx:172-187`) ganham, ao lado do `.cta`
"Continuar"/"Rever", um botão redondo de 48px, rótulo "Ouvir", ícone
`IconePlay`, visível só quando `peri.narrado` (ou `t.peri.narrado`) é
verdadeiro. Quando não há narração, o botão não aparece — a linha de
referência (`<p className="ref">`, `Home.tsx:139-141,176-178`) ganha, no
lugar dele, "· narração ainda não gravada" em `var(--muted)`.

Toque no botão navega para `/leitura/<ordem>?ouvir=1` (mesmo padrão de
query param que `?v=` já usa, `Leitura.tsx:2` via `useSearchParams`). A
Leitura lê `ouvir=1`: assim que `src` existir (HEAD confirmou) chama
`playerRef.current?.alternar()` e remove o parâmetro da URL (evita
retocar ao voltar pelo histórico ou recarregar a página).

**Risco técnico a verificar, não presumir:** o toque em "Ouvir" na Home
acontece dentro de um gesto do usuário, mas entre esse gesto e o `play()`
de fato — troca de rota, `HEAD`, `fetch` do manifesto
(`NarracaoPlayer.tsx:108-134`) — passam vários `await`. Navegadores mais
estritos (Safari em particular) podem já ter expirado a ativação
transitória do gesto quando o `play()` roda, e rejeitar o autoplay. Se isso
acontecer, a Leitura **não deve mostrar erro** — ela cai para o mesmo
cartão "Ouvir esta perícope" de sempre, com o áudio já carregado e um toque
a mais para começar. "Abrir já tocando" é o objetivo; "abrir pronta para
tocar com um toque a mais, sem nunca quebrar" é o piso aceitável.

## Chips de seção

`.section-chip` sobe de `min-height: 2.25rem` para 44px
(`app.css:897`). O `acao` da `SectionChips` (`SectionChips.tsx:28`,
consumido em `Leitura.tsx:850-862`) perde a razão de existir — era o slot do
`.narracao-mini` — e sai. `progresso` (`SectionChips.tsx:30`, o filete
`.leitura-progresso`) fica: continua mostrando fração rolada ou fração
ouvida, pintado pelo mesmo `pintarBarra` (`Leitura.tsx:414-419`) de hoje,
sem mudança de mecanismo — é sinal fino sob os chips, não controle, e não
compete com a doca.

## Wake-lock e checkpoint: verificado, sem mudança

`useWakeLock(p !== null)` (`Leitura.tsx:496`) já está amarrado a "há
perícope aberta", não a "TTS tocando" — a tela já fica acesa com a doca
tocando, com o cartão pré-play, ou só lendo em silêncio. Nada a mudar aqui;
com a doca tocando o wake-lock importa mais, não menos, e já cobre o caso.

O checkpoint de narração (`Leitura.tsx:438-441`, `setPosicaoLocal(ordem,
'narracao', falando, playerRef.current?.tempoAtual())`) e a retomada
(`tempoInicialNarracao`, aplicada em `NarracaoPlayer.tsx:140-148`) não mudam
de mecanismo. Duas superfícies novas precisam continuar respeitando-os:

- O cartão pré-play não pode resetar a posição — ele só chama `alternar()`;
  o áudio já foi posicionado no checkpoint pelo efeito existente, antes de
  qualquer toque.
- O `?ouvir=1` vindo da Home não pode competir com o checkpoint: ele só
  decide *se* toca, nunca *onde* — a posição continua vindo exclusivamente
  de `tempoInicialNarracao`.

## Acessibilidade

- Doca: `role="region"` com `aria-label="Narração"`, mesmo padrão de landmark
  que outras barras persistentes do app não usam hoje mas deveriam — a doca
  é nova, então nasce correta.
- Botões de 48/60px: `aria-label` explícito em cada um ("Voltar 10 segundos",
  "Pausar narração"/"Tocar narração", "Avançar 10 segundos", "Velocidade,
  1×" — o rótulo de velocidade muda com o valor, então o `aria-label` muda
  junto, não só o texto visível). Mantém o padrão já usado em
  `NarracaoPlayer.tsx:337,347,357`.
- Barra de posição: `aria-label="Posição na narração"` e `aria-valuetext`
  com "3:24 de 9:07" (já é assim hoje, `NarracaoPlayer.tsx:369-370`) — só a
  altura de toque muda, o contrato de acessibilidade do `<input
  type="range">` não.
- Setas do teclado (`←`/`→`) continuam saltando ±10s em qualquer controle
  dentro da doca, como hoje (`NarracaoPlayer.tsx:267-272`) — o salto fixo é
  mais fácil de aprender que o passo nativo do range.
- Estados de indisponibilidade (2 e 3): `role="status"`, para o leitor de
  tela anunciar a transição de "verificando" para o resultado sem precisar
  navegar até lá.
- O cartão pré-play é um `<button>` único (ícone + título + linha
  secundária), não três elementos separados — um só alvo de toque, um só
  ponto de foco, um `aria-label` que diz "Ouvir esta perícope, N minutos".
- Botão "Ouvir" da Home: `aria-label="Ouvir {título}"` (não só "Ouvir" —
  numa lista de cards o rótulo genérico obriga o leitor de tela a adivinhar
  qual card).

## Fora do escopo

- Cor: nenhum token muda, nenhuma nova cor entra além do que os tokens
  existentes (`--flame`, `--cta-bg`, `--cta-ink`, `--muted`, `--paper`,
  `--line`) já cobrem.
- O mapeamento manifesto↔tela e o realce por palavra
  (`src/lib/alinhar-narracao.ts`) — já funcionam, não são tocados.
- Gerar ou publicar narração — a Sessão 5 da refundação BLIVRE
  (`docs/refundacao-blivre.md`) é quem produz o áudio; esta spec só consome
  o sinal de cobertura.
- Trilha sonora de fundo (`scripts/publicar-trilha.sh`,
  `docs/sessao-5-trilhas-desenho.md`) — projeto paralelo, sem relação com a
  doca.
- Remover ou alterar o TTS sintético — já foi removido na fase de
  2026-09-02; não há resquício a limpar aqui.
- Escolher a implementação exata do "cabeçalho" reservado a
  `data/audio-cobertura.json` (formato do JSON, nome do script gerador) além
  do contrato descrito — é decisão de implementação, não de design.

## Riscos

1. **Velocidade e realce.** A análise acima (currentTime é tempo de faixa)
   indica que o realce sobrevive a `playbackRate != 1`, mas isso precisa ser
   confirmado no app rodando, não só no papel — é o mesmo princípio desta
   família de specs ("na dúvida, realce nenhum") aplicado a uma mudança que
   ainda não foi testada.
2. **Autoplay da Home.** Ver "risco técnico" acima — Safari pode recusar o
   `play()` depois da cadeia de `await`. Degradar para o cartão pré-play é
   obrigatório, não opcional.
3. **`data/audio-cobertura.json` desatualizado.** Se o passo que grava esse
   arquivo não rodar depois de um lote de narração, a Home mostra "narração
   ainda não gravada" para perícopes que já têm áudio — falso negativo, não
   falso positivo (nunca promete o que não existe), mas ainda é uma
   regressão de experiência. Precisa entrar no mesmo fluxo que já publica
   (`publicar-narracao.sh` → `conferir-narracao.sh`), não ser um passo à
   parte que alguém esquece.
4. **Fonte nova (Cormorant).** É a primeira vez que o app carrega uma
   terceira família de exibição. Verificar peso do arquivo (Variable font)
   contra o orçamento de carregamento antes de fechar.
5. **`padding-bottom` da doca.** Esquecer de reservar esse espaço no corpo
   da perícope faz a doca cobrir as últimas perguntas de reflexão — testar
   com uma perícope curta (poucas perguntas) e uma longa.

## Checklist de verificação

1. `grep -n "2\.25rem" src/styles/app.css` não retorna nenhum seletor da
   tabela de alvos de toque desta spec — os que sobrarem são de telas fora
   de escopo, e mesmo esses deveriam ter sido revistos.
2. Abrir uma perícope com narração publicada: aparece o cartão "Ouvir esta
   perícope", não a doca. Tocar: a doca sobe, o cartão some.
3. Rolar o texto inteiro com a doca tocando: ela continua visível, fixa no
   rodapé, e o fim do texto (últimas perguntas) não fica coberto por ela.
4. Pausar e retomar: a doca continua visível pausada; navegar para outra
   perícope some com ela.
5. Arrastar a barra de posição da doca com o dedo, em toque real (não só
   mouse): o alvo de 44px de altura responde sem precisar mirar no trilho
   fino.
6. Tocar velocidade três vezes seguidas: ciclo `1× → 1,25× → 1,5× →
   0,75× → 1×`, tom da voz sem distorcer (chipmunk), e o realce por palavra
   continua acendendo no lugar certo em 1,25× e 1,5×.
7. Perícope sem narração: aparece a linha "A narração desta perícope ainda
   não foi gravada.", sem botão, em `--muted`.
8. Forçar falha de rede no `HEAD` (ou no `<audio>` depois de carregado):
   aparece "Não foi possível carregar a narração desta perícope." com o
   botão "Tentar de novo", e o botão de fato tenta de novo.
9. Na Home, um card cuja perícope tem `narrado: true` mostra o botão
   redondo "Ouvir"; um card cuja perícope tem `narrado: false` não mostra o
   botão, e a linha de referência diz "narração ainda não gravada".
10. Tocar "Ouvir" na Home: navega para a Leitura e tenta tocar sozinho. Em
    pelo menos um navegador que bloqueie autoplay (testar Safari/iOS se
    houver acesso), confirmar que a queda para o cartão pré-play acontece
    sem erro visível.
11. Leitor de tela (VoiceOver ou NVDA): navegar pela doca por Tab anuncia
    cada botão com seu `aria-label`, incluindo a mudança de rótulo do botão
    de velocidade; os estados "ainda não gravada" e "falhou" são anunciados
    ao aparecer.
12. `npm test`, `npx tsc -b`, `npx oxlint` e `npm run build` passam.
