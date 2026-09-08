# Design: rebranding para aiPericopes — a lâmpada sobre o livro

Data: 2026-09-05 · Status: aprovado em conversa, aguardando revisão do spec

## Objetivo

O domínio `pericopes` não existe. O app passa a se chamar **aiPericopes**, troca
o verde pelo âmbar, perde o tema sépia e ganha uma revisão de hierarquia na tela
de Leitura.

O rebranding não é troca de tinta. É a chance de fazer a identidade visual
carregar a coisa que este app já faz melhor que a maioria: **ser honesto sobre
onde a máquina entrou.** Hoje isso está escrito na página `Sobre` e em nenhum
outro lugar. Depois deste trabalho, está na cor.

## A tese: a lâmpada

O `public/favicon.svg` de hoje é um livro claro sobre fundo verde, e **arde uma
chama âmbar `#f6e7a8` no meio dele**. O verde era a capa; o âmbar sempre foi a
luz. O rebranding não inventa cor nenhuma — promove a chama que já estava lá.

Daí sai a regra que rege tudo o que vem abaixo:

> **Âmbar é a voz do app.** A Escritura é a exceção, e a exceção se marca pela
> **ausência** da marca, não por um carimbo. O único âmbar que toca o texto
> bíblico é o **transitório**: a narração passando por cima do versículo, que é
> a máquina em ação e some quando ela passa.

Reverência como contenção. Onde o app se cala, está a fonte.

Isso resolve, sem rótulo nenhum, a tensão registrada em `src/pages/Sobre.tsx`:
a decisão do dono é que *"NENHUMA dessas marcas aparece no tocador nem na tela
de leitura: ouvir primeiro, saber depois"*. Cor não é rótulo. A distinção fica
visível sem entregar a conclusão antes da escuta.

## Decisões travadas

| Tema | Decisão | Motivo |
|------|---------|--------|
| Nome | **aiPericopes**, sem acento, sempre | Marca é palavra cunhada, não substantivo comum |
| A palavra | **perícope / perícopes**, com acento, no corpo do texto | A marca é a marca; a palavra é a palavra |
| Sentido do `ai` | **IA declarada, sem eufemismo** | Alinha a fachada ao que a página `Sobre` já fazia no porão |
| Cor | **Âmbar** substitui o verde | Promoção da chama que já existia no favicon |
| Temas | **Claro e escuro. Sépia morre.** | Sépia já era o tema âmbar (`--accent: #8a5a2b`); manter os dois seria oferecer uma escolha que não escolhe nada |
| Escuro | Deixa de ser azul-carvão e vira **carvão quente** | É a sala escura onde a vela faz sentido |
| Claro | **Esquenta** em relação ao de hoje | Absorve o sépia que morre, para quem usava sépia não ficar órfão |
| Grifo amarelo | **Sai da paleta de destaques** | Era o único caso de âmbar *permanente* sobre a Escritura, aplicado por humano — furava a regra no lugar onde ela mais importa |
| Cabeçalhos | Todos em âmbar; **só o "Texto (Bíblia Livre)" se distingue**, em tinta | Marca a Escritura por retirada, não por adição |
| Ordem da Leitura | **Contexto continua aberto**, como hoje | A decisão em `contexto-collapse.ts` ganha da tese: saber onde você está antes de ler é remover uma barreira, e essa é a missão |
| `--rec` (gravando) | **Fica como está nesta rodada** | Não aprovado; anotado como risco a verificar com a paleta no ar |
| Escopo | Identidade **+ revisão de hierarquia** | Fora: tipografia, escalas de leitura, medidas de coluna — já calibradas e caras |

## A paleta

Dois papéis de âmbar. A separação é o coração do sistema:

| token | papel | regra |
|---|---|---|
| `--accent` | âmbar **queimado** | tudo que é **texto**: links, CTA, foco. Mínimo 4,5:1. |
| `--flame` | âmbar **vivo** | tudo que é **luz**: barra de progresso, chama da marca, brilho decorativo. **Nunca carrega texto.** Mínimo 3:1. |

**O realce da narração fica com `--accent`, não com `--flame`.** O comentário do
CSS de hoje registra que `--candle` colore também *"o título falado"* — ou seja,
`--candle` carrega texto. No claro, `--flame: #c4780e` daria 3,42:1 num
cabeçalho, abaixo dos 4,5:1 exigidos. Então `--candle: var(--accent)` nos dois
temas, como já é hoje. **Quem trocar isso por `--flame` quebra o contraste do
título falado no tema claro.**

### Claro

```css
--bg: #f5f1e8        --paper: #fffdf7      --line: #ddd2bd
--ink: #1c1914       --read-ink: #12100e   --muted: #5f574a
--accent: #92500a    --accent-soft: #f6e5c8
--flame: #c4780e     --cta-ink: #fffaf0
--glow-a: #f5e8cf    --glow-b: #f0dfc0
--candle: var(--accent)
--candle-luz-pct: 0%   /* mantém: sobre papel claro o branco não tem para onde brilhar */
```

### Escuro

```css
--bg: #16130f        --paper: #1e1a15      --line: #2e2820
--ink: #ece6da       --read-ink: #f5f2eb   --muted: #a89f90
--accent: #f0b357    --accent-soft: #3a2a12
--flame: #ffc46b     --cta-ink: #1a1206
--glow-a: #2a2113    --glow-b: #241c10
--candle: var(--accent)
--candle-luz-pct: 22%  /* mantém: é o único tema onde a luz existe */
```

### Contraste medido

16 pares verificados por script (WCAG 2.1, fórmula de luminância relativa).
**Todos passam.** Pior par textual: 5,03:1 (`--accent` sobre `--accent-soft`,
claro). Pior par não-textual: 3,08:1 (`--flame` sobre `--bg`, claro).

A chama viva original (`#d98613`) dava só **2,53:1** sobre o papel claro e foi
rebaixada para `#c4780e`. É a mesma física que o comentário do CSS de hoje já
tinha descoberto: sobre papel quase branco, o âmbar claro não tem para onde
brilhar. **Qualquer ajuste futuro nesses hexes tem de rodar a medição de novo.**

## A marca

**Wordmark:** `ai` em âmbar + `Pericopes` em tinta, sem espaço. O logotipo
executa a tese sozinho — a máquina é a cor, o texto é a tinta. Minúsculo contra
maiúsculo já separa as duas partes, e o `ai` lê como prefixo, não como sílaba.

**Símbolo:** o **pingo do `i` é a chama**. O `ai` vira lamparina, sobrevive a
16px como favicon, e a marca da máquina é uma luz pequena sobre a tinta.

**Descrição** (a atual ainda diz "NAA", desatualizada desde a refundação):

> Estudo bíblico por perícopes. O texto é a Bíblia Livre; o material e a
> narração são de IA, e isso está dito.

## Hierarquia — o que muda de lugar

**1. A porta da IA sai do porão.** Hoje `contexto-ia.ts` alimenta a **terceira
aba** do bloco de notas, chamada **"Contexto"** — que colide com a seção
"Contexto" do topo da mesma página, significando outra coisa. Ela copia
`"Quero conversar sobre o texto X sobre o(s) seguinte(s) aspecto(s):"` para
colar numa IA em outro lugar.

- Renomear para **"Conversar"**. Mata a colisão.
- Sair das abas e virar ação âmbar explícita junto de "Marcar como concluída",
  que é o momento em que o leitor decide o que fazer a seguir.

**2. A chama assume onde já era a metáfora.**

- `book-progress-fill` → `--flame`: o progresso vira a chama subindo.
- O `🔥` do streak vira ícone desenhado em âmbar. É o único elemento
  não-desenhado da Home e renderiza diferente em cada sistema.
- `narracao-mini`, chip de seção ativa, anel de foco → `--accent`.

**3. Um nome só por coisa.** O chip diz **"Texto Bíblico"**
(`SectionChips.tsx`) e o `<h2>` diz **"Texto (Bíblia Livre)"**
(`Leitura.tsx`). Mesmo destino, dois nomes. Unificar.

**4. Cabeçalhos.** `<h2>` em `--accent` por padrão; o `<h2>` de `#texto`
recebe tratamento próprio em `--read-ink`.

## Inventário de execução

### Paleta e temas
- `src/styles/app.css` — três blocos de tema viram dois; tokens novos;
  `--flame` nasce; bloco `[data-theme='sepia']` sai; o `@media
  (prefers-color-scheme: dark)` perde a exclusão de `'sepia'` no seletor.
  Três hexes soltos fora dos tokens: `#fff` (l. 1850) e `#b3564d` (l. 2402,
  2419).
- `src/lib/theme.ts` — `Theme` perde `'sepia'`; `TEMAS` idem.
- `src/lib/theme.test.ts` — os casos de sépia (l. 21-26, 54) viram casos de
  **migração**: `'sepia'` gravado tem de resolver para `'light'`, não quebrar.
- `src/components/PerfilMenu.tsx` — item `{ id: 'sepia' }` (l. 13) sai.
- `index.html` — **script inline que roda antes do bundle** (l. 16). Hoje a
  guarda aceita `'sepia'` e o preserva. Tirando `'sepia'` da lista, um valor
  gravado cai no ramo `matchMedia('(prefers-color-scheme: dark)')` — ou seja,
  **quem estava no sépia acorda no escuro se o sistema estiver escuro.** A queda
  tem de ser explicitamente para `'light'`, tanto aqui quanto em `theme.ts`.

### Grifo amarelo
- `src/lib/types.ts` — `DestaqueCor` perde `'amarelo'`.
- `src/components/VerseActions.tsx` — opção `{ id: 'amarelo' }` sai.
- `src/styles/app.css` — `--hl-amarelo` e as regras `.hl-amarelo` /
  `.verse-hl-amarelo` saem.
- **Cuidado:** `DestaqueCor` é dado **persistido e sincronizado** (IndexedDB +
  D1). Registros com `'amarelo'` existem. O código não pode quebrar ao ler um
  valor desconhecido — precisa de fallback de renderização. Testes em
  `user-db.test.ts` e `sync.test.ts` usam `'amarelo'` como fixture e mudam
  junto.

### Nome e metadados
- `index.html` — `<title>`, `<meta name="theme-color">` (`#2f5d50`),
  `<meta name="description">`.
- `vite.config.ts` — `manifest.name`, `short_name`, `description` (ainda diz
  NAA), `theme_color`, `background_color`.
- `src/App.tsx` — `<span>Perícopes</span>` e o `<img brand/logo.png>` viram o
  wordmark novo.
- `worker/email.ts` — nome e **duas ocorrências de `#2f5d50`** no HTML do
  e-mail de OTP; `worker/auth.test.ts` tem o `EMAIL_FROM`.
- `README.md` — desatualizado desde a refundação (ainda diz NAA).
- `src/pages/Sobre.tsx` — ganha a explicação da marca e da regra do âmbar.

### Arte (fora do código)
- `public/favicon.svg` (verde e livro, hardcoded), `favicon.png`,
  `favicon.ico`, `apple-touch-icon.png`, `pwa-192.png`, `pwa-512.png`,
  `pwa-512-maskable.png`, `brand/logo.png`, `brand/logo-master.png`.

### Não mexer
- Chaves de `localStorage` (`pericopes-theme`, `pericopes-reading`,
  `pericopes-contexto-aberto`) e o evento `pericopes-theme`. Renomear só
  perderia preferência do usuário sem ganhar nada — são invisíveis.

## Riscos

1. **`--rec` fica vizinho do âmbar.** `#c0392b` no claro, `#e4655a` no escuro,
   ao lado de `--flame: #ffc46b`. "Gravando" precisa ser inconfundível.
   **Não aprovado nesta rodada** — verificar com a paleta no ar.
2. **O realce da narração encostar no fundo no escuro quente.** O `--candle`
   foi calibrado contra `#12151a` azul. Contra `#16130f` quente a separação
   cai. Reverificar `--candle-fundo` e `--candle-luz-pct` na tela, não no
   papel.
3. **Migração de tema pela porta errada.** Quem tem `'sepia'` gravado passa
   pelo script inline do `index.html` **antes** de qualquer bundle. Tirar
   `'sepia'` da guarda sem mais nada joga o valor no ramo do `matchMedia`, e
   quem escolheu um tema claro acorda no escuro. A migração é explícita para
   `'light'`, nos dois lugares — e o `index.html` é uma duplicação deliberada
   de `src/lib/`, como o próprio arquivo avisa: mudou lá, mude aqui.
4. **`DestaqueCor` órfão.** Ver acima.

## Fora de escopo (backlog)

- **Perguntar no versículo.** O lugar realmente certo de conversar com a IA é
  no instante da dúvida, e o `VerseActions.tsx` já existe. É feature nova, não
  rebranding.
- Tipografia, escalas de leitura, medidas de coluna.
- Domínio e DNS.

## O prompt da logo

Entregue em conversa em 2026-09-05, e independente de tudo que ficou aberto.
Conceito: o pingo do `i` é a chama. Restrições duras: plano, dois tons mais
fundo, 16px, margem de 20% para o ícone maskable. Os dois clichês proibidos são
o de tecnologia (circuito, rede neural, cérebro, bolha de chat, brilho mágico)
e o devocional (cruz, pomba, raios, mãos postas, vitral).
