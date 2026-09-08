# Carga progressiva do catálogo — design

Data: 2026-09-02

## Problema

`loadPericopes()` busca `public/data/pericopes.json` inteiro e o parseia antes
de qualquer tela aparecer. Medido em produção:

```
4.446.987 bytes comprimidos (13,7 MB crus) — 12,5 s
```

O service worker ainda precacheia o arquivo (`globPatterns` inclui `**/*.json`,
e `maximumFileSizeToCacheInBytes` foi elevado para 16 MB só para caber nele).

A distribuição do payload mostra o desperdício:

| Campo | Tamanho | Quem consome |
|---|---|---|
| `texto_naa` | 4,22 MB | Leitura (1 por vez) + busca full-text (todas) |
| `topicos_pregar` | 4,06 MB | Leitura (1 por vez) |
| `resenha` | 2,49 MB | Leitura (1 por vez) |
| `contexto_historico_literario` | 1,31 MB | Leitura (1 por vez) |
| `perguntas_reflexao` | 0,93 MB | Leitura (1 por vez) |
| metadados (ordem, livro, abbrev, refs, título) | 0,48 MB | Home, Índice, Pesquisa por referência |

96,5% do payload serve a uma tela por vez. A Home espera 13,7 MB para escrever
dois títulos e duas referências.

Não é um bug: é a escolha offline-first levada ao limite, e ter a Bíblia inteira
disponível offline é uma qualidade do produto. O custo é que a primeira visita
não mostra nada até o download terminar.

## Objetivo

A primeira tela pinta com ~480 KB em vez de 4,4 MB comprimidos. O restante
desce em segundo plano até o aparelho ter o mesmo conteúdo de hoje.

**Não é objetivo** reduzir o total baixado, nem mudar a promessa offline: ao
final do preenchimento, o app funciona offline exatamente como hoje. O que muda
é *quando* o usuário espera, não *quanto* ele baixa.

## Artefatos de dados

O gerador (`scripts/shard-catalogo.ts`, novo) lê o catálogo e escreve três
conjuntos em `public/data/`:

| Arquivo | Quantidade | Tamanho |
|---|---|---|
| `index.json` | 1 | ~480 KB |
| `texto/<slug>.json` | 66 | 4,3 MB total — média 65 KB, maior 231 KB (Salmos) |
| `estudo/<slug>.json` | 66 | 9,0 MB total — média 137 KB, maior 520 KB (Lucas) |

`<slug>` vem do **nome completo** do livro normalizado para ASCII minúsculo com
hífens (`Gênesis` → `genesis`, `1 Samuel` → `1-samuel`).

Não use a abreviação: `Jó` e `João` têm abreviações distintas (`Jó` e `Jo`) que
**colidem em `jo`** ao perder o acento, e um dos dois livros sobrescreveria o
outro no build — silenciosamente, porque o gerador só escreveria dois arquivos
com o mesmo nome. Os 66 nomes completos, por outro lado, dão 66 slugs distintos
(verificado sobre o catálogo). O gerador deve falhar em voz alta se dois livros
produzirem o mesmo slug, para que uma mudança futura no dataset não reintroduza
a colisão.

### Por que separar texto de estudo, e não apenas por livro

A busca full-text precisa de `texto_naa` de **todas** as perícopes e de mais
nada. Com os dois conjuntos separados, a busca fica pronta depois de 4,3 MB em
vez de 13,7 MB. `topicos_pregar` sozinho é 4 MB — 30% do payload — e não
participa de busca alguma; fatiar só por livro deixaria esse peso no caminho
da busca sem necessidade.

### Forma do índice

```ts
export type PericopeIndex = {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  titulo_pericope_pt: string
  /** Minutos de leitura, pré-calculados pelo gerador com a mesma
      `readingMinutes` da UI. */
  minutos: number
}
```

`minutos` existe porque a Home mostra "~5 min" a partir de
`readingMinutes(texto_naa)`. Sem pré-calcular, o índice arrastaria os 4,22 MB
de texto de volta e o ganho evaporaria. Pré-calcular com a mesma função garante
que o número exibido não mude.

Fora `minutos`, o índice é exatamente o conjunto de campos que Home, Índice e
Pesquisa-por-referência já usam — nenhuma dessas telas precisa de mudança de
comportamento, só de fonte.

## Carregamento

1. **Boot** — busca `index.json`. Home, Índice e Pesquisa-por-referência
   pintam.
2. **Abrir uma perícope** — os dois shards do livro daquela perícope furam a
   fila de fundo. Se já estiverem em cache, a leitura abre sem rede.
3. **Fila de fundo** — todos os `texto/*` primeiro (destrava a busca antes),
   depois os `estudo/*`. Um shard por vez, sem paralelismo: a fila é de fundo e
   não deve competir por banda com o que o usuário pediu.

A fila começa depois do primeiro `requestIdleCallback` (com `setTimeout` de
reserva onde ele não existe), para não disputar com a renderização inicial.

## Armazenamento

Cache Storage, via runtime caching do service worker — não IndexedDB. Os shards
são estáticos e endereçados por URL: é o caso de uso literal do Cache Storage,
o offline sai sem código de persistência próprio, e a invalidação acompanha o
`autoUpdate` que o app já usa.

Isso exige mexer no `vite.config.ts`:

- `globPatterns` hoje inclui `**/*.json`, o que precachearia os 132 shards e
  desfaria o ganho inteiro. O precache passa a levar o app shell e
  `index.json`, com os shards excluídos por `globIgnores`.
- `maximumFileSizeToCacheInBytes: 16 * 1024 * 1024` existe só para caber o
  monolito e volta ao padrão.
- Os shards entram por `runtimeCaching` com estratégia `CacheFirst` (conteúdo
  imutável dentro de uma versão do build) e um cache nomeado, para poder ser
  limpo entre versões.

## API de `content.ts`

Hoje **tudo** passa por `loadPericopes()`, inclusive quem só quer metadados.
A API passa a distinguir os dois casos:

| Função | Muda? |
|---|---|
| `loadIndex(): Promise<PericopeIndex[]>` | nova — substitui `loadPericopes()` para metadados |
| `getPericope(ordem): Promise<Pericope \| undefined>` | passa a juntar índice + shards do livro |
| `listPericopes`, `listLivros`, `findPericopeByRef`, `listPericopesByBookChapter`, `progressoPorLivro`, `ordensDoTestamento`, `proximaNoTestamento`, `anteriorNoTestamento`, `containsRef`, `refLabel` | mesma assinatura, passam a ler do índice |
| `loadPericopes()` | sai |

Consumidores a ajustar: `Home.tsx`, `Indice.tsx`, `Leitura.tsx` e
`fulltext.ts` (os quatro que hoje chamam `loadPericopes()`).

`refLabel` e `ordensDoTestamento` recebem hoje `Pericope`; passam a receber
`PericopeIndex`, que é um subconjunto — nenhum deles toca em campo pesado.

## Busca full-text

`buildIndex()` em `fulltext.ts` hoje se alimenta de `loadPericopes()`. Passa a
se alimentar dos `texto/*`: precisa dos 66 shards de texto, e apenas deles.

Enquanto eles não terminaram, o estado `preparando` ("Preparando busca…") que a
Pesquisa **já tem** passa a mostrar progresso (`n de 66`). Nunca resultado
parcial anunciado como completo: um resultado incompleto que se diz completo é
pior que esperar, porque o usuário conclui que o versículo não existe.

Se o usuário entra no modo "No texto" antes de a fila terminar, os `texto/*`
restantes furam a fila — como já acontece com a perícope aberta.

## Build e versionamento

`public/data/pericopes.json` está versionado no git e os scripts de enrich
fazem `git add` nele: é a fonte de verdade, cara de regenerar (enriquecimento
por LLM). Ele **continua versionado**, mas sai de `public/` — onde o Vite o
copia para `dist/` e o serve ao cliente — e passa a viver em
`data/pericopes.json` (caminho não coberto pelos padrões do `.gitignore`).

- `scripts/enrich-pericopes.ts` e `scripts/enrich-preach.ts` passam a ler e
  gravar o novo caminho, inclusive nos `git add`.
- Os derivados (`public/data/index.json`, `public/data/texto/`,
  `public/data/estudo/`) são gerados e entram no `.gitignore`: são função pura
  do catálogo, e versionar 133 arquivos derivados só cria ruído de diff.
- `npm run build` passa a rodar o gerador antes do `vite build`; `npm run dev`
  também, porque o servidor de dev serve `public/` direto. O gerador pula o
  trabalho quando as saídas são mais novas que o catálogo, para não cobrar
  ~2 s de todo `npm run dev`.

O deploy é automático no push da `main` (`.github/workflows/deploy-worker.yml`
roda `npm run build`), então o gerador entra no pipeline sem passo manual.

## Migração

Um cliente com o service worker antigo tem o monolito no precache e o
`pericopes.json` no Cache Storage. Com `registerType: 'autoUpdate'`, o SW novo
assume, o manifesto de precache é substituído e o Workbox limpa as entradas que
saíram — o monolito é descartado sem passo manual. Nenhum código novo referencia
o caminho antigo, então não existe janela em que o app dependa dele.

Vale conferir isso na prática antes do merge: instalar a versão atual, subir a
nova por cima e confirmar que o Cache Storage não fica com os 13 MB órfãos.

## Riscos

- **Regressão de offline.** Hoje o app funciona offline logo após a primeira
  visita. Com a carga progressiva existe uma janela — entre o boot e o fim da
  fila — em que uma perícope não visitada ainda não está no aparelho. É
  inerente à mudança e aceito: a alternativa é a espera de 12 s que estamos
  eliminando. Mitigação: a fila é agressiva (começa no primeiro idle) e a
  Leitura busca sob demanda, então offline falha só se o usuário ficar sem rede
  *durante* a janela e abrir justo o que não desceu.
- **Custo de 66 requisições por conjunto.** Sobre HTTP/2 e servidas pela CDN da
  Cloudflare, são baratas; mas a fila serializa de propósito para não estourar
  a conexão do usuário.
- **`refLabel` com dois tipos.** Alargar o parâmetro para o subconjunto é
  seguro, mas exige revisar cada chamador para não passar a depender de campo
  pesado por acidente.

## Critérios de aceite

1. Primeira visita: a Home pinta sem esperar mais que `index.json` (~480 KB
   crus). Medido no app rodando, não só nos testes.
2. Depois do preenchimento em segundo plano, o app abre qualquer perícope
   offline — mesma garantia de hoje.
3. Abrir uma perícope cujo livro ainda não desceu funciona: os shards furam a
   fila.
4. A busca "No texto" só se anuncia pronta quando os 66 `texto/*` estão em
   cache; antes disso mostra progresso.
5. O precache do service worker não contém os shards (verificado no manifesto
   gerado), e `dist/` não contém o catálogo monolítico.
6. `npm test`, `npm run typecheck:worker`, `npm run lint` e `npm run build`
   passam; a suíte existente de `content` e `fulltext` continua verde com as
   fontes novas.
