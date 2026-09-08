# Cobertura da Bíblia e corte das perícopes gigantes — estado

Sessão `biblia-pericopes-04`, iniciado em 2026-09-03, no worktree principal (`main`).
**Outras sessões: leiam a seção "Contrato com as sessões paralelas" antes de rodar
lote de TTS, `npm run shard`, ou qualquer coisa que regenere o catálogo.**

## Onde estamos

| # | Etapa | Estado |
|---|---|---|
| 1 | Auditoria de cobertura da NAA | ✅ feito |
| 2 | Conserto do ETL (limites pela lista `Verses`) | ✅ feito |
| 3 | Conserto dos 5 capítulos embaralhados na `NAA.json` | ✅ feito |
| 4 | Conserto do merge do `enrich` (estrutura sempre do raw) | ✅ feito |
| 5 | Auditoria repetível + testes | ✅ feito |
| 6 | Commit das correções | ✅ feito |
| 7 | Reenriquecer as 23 perícopes com material escrito sobre texto velho | ✅ feito |
| 8 | Regravar o áudio dessas 23 | ✅ feito (US$ 0,507) |
| 9 | 4 casos de versificação KJV×NAA | ✅ feito — **cobertura 100,0000%** |
| 10 | Spec dos cortes | ✅ feito (`scripts/cortes.ts`, com o motivo de cada um) |
| 11 | Campo `seq` (ordem de leitura ≠ identidade) | ✅ feito |
| 12 | Cortar Salmos (5 → 148) | ✅ feito |
| 13 | Cortar 14 grandes do AT (→ 47) | ✅ feito |
| 14 | Material editorial das 195 (cinco campos) | ✅ feito (US$ 0, subagents) |
| 15 | Aposentar ordens 1100-1104 | ✅ feito |
| 16 | Áudio das 195 | ✅ feito (US$ 4,07 · 6.085 unidades · 15,8 h) |

**ENCERRADO em 2026-09-03.** Catálogo em 2823 perícopes, cobertura 100,0000%,
narração publicada. Gasto total de TTS: US$ 4,65.

O áudio das 19 perícopes aposentadas está em `tts-corpus/gam-ash-aposentadas/`,
fora do corpus ativo e não apagado — desfazer continua barato.

Gasto real de TTS: **US$ 4,65** — US$ 0,507 nas 23, US$ 0,077 nas 5 de
versificação, US$ 4,07 nas 195. Estimativa original era US$ 4,40; a diferença é
que o material das novas saiu mais denso que a média do catálogo.

## O que as etapas 1-5 mudaram

Cobertura da NAA antes → depois: **99,884% → 99,987%**. Buracos 36 → 4.
Sobreposições 10 → 0. Referências inexistentes 1 → 0.

- `scripts/pericope-bounds.ts` — os limites de uma perícope vêm da lista `Verses`
  do dataset bruto, não dos campos `Reference Start`/`Reference End`. Em 16 das 2647
  linhas os dois discordam, e a lista é quem tem razão. Recuperou 27 versículos,
  matou a sobreposição de Nm 16:28-37 e o range inexistente de João 18:41.
- `scripts/naa-versificacao.ts` + `scripts/fix-naa.ts` — `data/NAA.json` tinha 5
  capítulos com versículos embaralhados para dentro do capítulo seguinte
  (2Sm 22/23, Sl 110/111, Is 4/5, Is 12/13, Os 3/4). O script é idempotente, tem
  guard por prefixo de texto e nunca conserta pela metade. **Reaplique-o se rebaixar
  a `NAA.json`** — o arquivo é gitignored, o conserto não sobrevive sozinho.
  Backup em `data/NAA.json.bak`.
- `scripts/montar-catalogo.ts` — o `enrich` montava o catálogo a partir do objeto
  cacheado inteiro, `texto_naa` e limites incluídos, então correção de ETL nunca
  chegava em `pericopes.json`. Agora estrutura vem do raw e só o material editorial
  vem do cache. `--desatualizados` reenriquece só o que ficou para trás.
- `scripts/auditar-cobertura.ts` — a auditoria, repetível (`--tamanhos` para o
  perfil de tamanho).

## Os 4 que sobraram (etapa 9)

Versículos que a NAA tem e a KJV não, então nenhuma perícope os reivindica. Todos
são versículo final de capítulo; a decisão já está tomada:

| Versículo | Ação |
|---|---|
| 1Sm 20:43 | estender #544 (20:30-42) até 43 |
| 1Rs 22:54 | estender #707 (22:51-53) até 54 |
| 3Jo 1:15 | estender #2542 (1:13-14) até 15 |
| Ap 12:18 | **começar** #2613 (13:1-10) nele — é a montagem da besta que sai do mar |
| 2Co 13:14 | caso inverso: referência sem versículo. Fixar o fim em 13:13 |

## Critério dos cortes

O nome do app é Bíblia Perícopes. Corte tem que ser perícope de verdade — unidade com
começo, meio e fim em si — nunca fatia numérica. Consequências:

**Ficam inteiras apesar do tamanho** (11): 2Sm 22 (é o Sl 18), Jó 38:1-40:2 e
Jó 40:6-41:34 (um discurso cada), Ez 16 (alegoria com arco completo), Dt 28:15-68
(litania), Pv 22:17-24:22 (obra delimitada: prólogo em 22:17-21, se autodeclara
"trinta máximas"), e as listas — Nm 7, Ne 7, Ed 2, Nm 26, Nm 1, 1Cr 2.

**Salmos**: 1 salmo = 1 perícope, com duas exceções obrigatórias — **Sl 42-43** são um
salmo só (mesmo refrão três vezes, o 43 sem sobrescrito) e **Sl 9-10** também
(acróstico único partido pela numeração). **Sl 119 fica inteiro**: a estrofe acróstica
é unidade formal, não unidade de sentido. Total: 148.

**Cortadas** (15 → ~52): 2Sm 15-19 (~7 cenas), Gn 18:16-19:38 (4), Gn 4-5 (3-4),
Gn 43-44:17 (3), Jó 29-31 (3), Nm 23-24 (4 oráculos com moldura própria), Jr 4:5-6:30,
Jr 7-10, Jr 15:10-17:27, Jr 18-20 (pelas fórmulas de abertura), Lv 25 (2-3), Nm 31 (2),
Pv 25-29 (2: 25-27 imagético/agrário, 28-29 justo×ímpio — costura editorial, e a spec
assume por escrito que é unidade editorial, não narrativa).

## Contrato com as sessões paralelas

`ordem` acumula três papéis: **identidade**, **endereço** (`/leitura/:ordem`, chave R2
`nt-ml/<ordem>.m4a`) e **ordem de leitura** (`enrich-pericopes.ts` ordenava por ela).

Como identidade, ela é chave de dado de usuário em **seis** lugares — os cinco
conhecidos mais um levantado pela sessão `jornadas` em 2026-09-03:

| Onde | Coluna | O que quebra se a ordem sumir ou mudar |
|---|---|---|
| `progresso` | `pericope_ordem` (PK) | status + `historico: string[]` (datas de conclusão; alimenta o streak) |
| `anotacoes` | `pericope_ordem` | nota vira órfã |
| `destaques` | `pericope_ordem` | id determinístico `${ordem}:${verseId}` |
| `posicao_leitura` | `pericope_ordem` (PK) | checkpoint de leitura |
| catálogo / app | `ordem` | rota, áudio, prev/next, swipe, pager |
| `jornada` | `inicio_ordem` | **degradação silenciosa**: `indexOf` devolve -1 e a jornada volta ao escopo inteiro — "12 de 431" vira "12 de 1600", sem erro |

Regras que valem para qualquer sessão:

1. **Nunca renumerar uma `ordem` existente.** O risco não é só perda: com
   `historico`, renumerar **reatribui** datas de leitura à passagem errada, em
   silêncio. A pessoa veria "lida 3× · mar/26 · ago/25" numa perícope que nunca
   abriu. Perda o usuário percebe; mentira plausível, não.
2. Perícope nova entra com `ordem >= 3000` e um `seq` que define a posição de leitura,
   **na posição canônica do array** — nunca anexada no fim. `seq` entra em
   `PericopeIndex` (`src/lib/types.ts`) junto com a mudança, não depois.
2b. **Contrato de emissão**: `index.json` sai do shard **já ordenado por `seq`**. O app
   não reordena — `ordensDoTestamento` (`src/lib/content.ts:85`) faz `filter`+`map` e
   `proximaNoTestamento` pega `seq[i±1]`, ou seja, **posição no array**, nunca valor
   numérico. Por isso "ordem 3000 entre ordens 1000" é inofensivo. Mas se o arquivo sair
   na ordem de `ordem` esperando que o consumidor ordene, a navegação erra em silêncio —
   e erra os três caminhos de uma vez (pager do rodapé, swipe, atalhos ←/→ passam todos
   por `irAnterior`/`irProxima` em `Leitura.tsx:469`). Travar com teste de fixture inline
   contendo ordens fora de ordem numérica: `[{ordem:1000},{ordem:3000},{ordem:1001}]`.
3. **São dois sorts por `ordem` no pipeline, não um** — `enrich-pericopes.ts:533` e
   `enrich-preach.ts:357`, e o segundo também REGRAVA o catálogo. Trocar só um faz o
   outro desfazer a ordenação sem erro nenhum.
4. **Invariante de nome de livro**: perícope nova herda `livro` e `abbrev` da que
   substitui. A tela `/explorar` casa o catálogo com `src/lib/bible-books.ts` pelo nome
   completo; grafia nova some da tela em silêncio. Vêm do `BOOK_MAP`, nunca à mão.
5. Os scripts de `/Volumes/SSD 2TB SD/dev/tts-spike/` leem `public/data/` do **worktree
   principal** (`RAIZ` hardcoded). Rodar `npm run shard` aqui muda o que eles enxergam.
6. `sobe_gam.sh loop`, enquanto vivo, **publica no R2 automaticamente** todo manifesto
   cujo mtime passe o do marcador `.subiu_json`. Não regenere manifesto sem querer publicar.
7. `alinha_palavras.py` pula manifesto que já tem `palavras` — reprocessar exige apagar
   o campo antes.
8. Ordem obrigatória: **catálogo estabiliza primeiro, lote de áudio roda depois.** Áudio
   gerado sobre um catálogo que vai mudar é dinheiro jogado fora.
9. **Teste nunca lê `public/data/` nem `data/`** — são derivados e/ou gitignored. Passa
   local e quebra a CI com ENOENT, porque `npm test` roda antes do build que os gera.
   Use fixture inline, `data/pericopes.json` (versionado) ou `src/lib/bible-books.ts`.
10b. **Depois de qualquer merge que toque `src/styles/app.css`, confira o balanceamento
    de chaves.** CSS inválido não quebra NADA do pipeline: `tsc -b` passa, `npm test`
    passa, o lint não olha CSS e o build gera o bundle normalmente. Uma chave faltando
    engole todas as regras seguintes em silêncio — aconteceu no merge do chrome
    (601898b) e matou 217 linhas, inclusive o menu Perfil inteiro. Só apareceu quando
    alguém abriu o app no navegador.

    ```
    node -e "const c=require('fs').readFileSync('src/styles/app.css','utf8').replace(/\/\*[\s\S]*?\*\//g,''); let n=0; for(const ch of c){if(ch==='{')n++;else if(ch==='}')n--} console.log('nivel final (0 = ok):', n)"
    ```

10. Contagem honesta de testes na `main` exige excluir as worktrees, senão o vitest
    coleta as das outras sessões:

    ```
    npx vitest run --exclude '**/node_modules/**' --exclude '**/.git/**' \
      --exclude '.worktrees/**' --exclude '.claude/worktrees/**'
    ```

    Baseline em 2026-09-03: 39 arquivos / 435 testes. Com as correções: 42 / 452.

Estado do corpus em 2026-09-03: `gam-ash` com 2647/2647 perícopes, áudio + manifesto
alinhado, tudo subido. Narrador `openai/gpt-audio-mini` voz `ash`.

As 23 perícopes corrigidas foram regravadas e republicadas em 2026-09-03 (667 unidades,
118 min, US$ 0,507). Verificado: todos os versículos do catálogo aparecem na narração das
23. O material anterior está em `tts-corpus/gam-ash-backup-fix23/`.

**Receita para regravar um subconjunto**, se precisar de novo: copie `gera_lote_gam.py`
para uma variante apontando `CORPUS` a um diretório novo e filtrando a fila pelo conjunto
de ordens desejado (é o que `tts-spike/gera_fix23.py` faz). Gerar num corpus ISOLADO evita
que um `sobe_gam.sh loop` vivo publique o manifesto antes do alinhamento — o site ficaria
sem realce de palavra até a segunda passada. Só mova para `gam-ash/` depois de alinhar, e
apague `.subiu`/`.subiu_json` para o upload reconhecer que mudou.

**Depois de qualquer queda no alinhamento**, apague as travas `.alinhando` órfãs antes de
religar — `mkdir` só é devolvido em exceção, não quando o processo morre. Uma sessão que
reiniciou no meio deixou 16 travas e 10 perícopes bloqueadas.

## Quanto dado de usuário está realmente em jogo (medido no D1, 2026-09-03)

Consulta no banco remoto de produção:

- Ordens 1100-1104 (as 5 de Salmos a aposentar): **1 linha**, em `progresso`, na ordem
  1100. Zero anotações, zero destaques.
- As 16 perícopes que mudaram de faixa: **zero linhas** de progresso.
- Banco inteiro: 184 KB.

Ou seja: o app ainda é de um usuário só (o dono). As regras acima continuam valendo —
elas protegem o desenho, não a contagem de hoje — mas o custo real de aposentar
1100-1104 hoje é **uma linha de progresso**, não uma migração.

Consequência que a spec precisa declarar mesmo assim, porque é visível: quem concluiu
"Livro 1 dos Salmos" tinha 1 perícope lida; depois do corte passa a ter 41 não lidas. A
**barra de Salmos cai de 100% para perto de zero** sem ninguém ter feito nada. Não é bug,
é o denominador mudando — mas parece bug. O **streak não cai**: `historico` é por ordem
e nunca é apagado, então a ordem aposentada continua contribuindo os dias lidos. O hábito
fica; o que muda é a unidade de contagem.

## Achado em aberto: os sobrescritos dos Salmos não existem na NAA.json

`data/NAA.json` **não traz os sobrescritos** ("Salmo de Davi, quando fugia de
Absalão, seu filho", "Ao mestre de canto, sobre Sosanim", etc.). Sl 3:1 começa
direto em "SENHOR, como tem crescido o número dos meus adversários".

Não é buraco de cobertura: a numeração em uso é a da KJV, que não numera o
sobrescrito, então a auditoria fecha em 100% corretamente. As contagens ficam
1-2 versículos abaixo do hebraico só nos salmos que têm sobrescrito (Sl 3: 8 vs
9; Sl 51: 19 vs 21; Sl 90: 17 vs 17, porque o dele é curto).

**Por que passou a importar:** com os Salmos virando 148 perícopes próprias, o
sobrescrito é exatamente o contexto que a perícope deveria dar — "quando fugia
de Absalão" é a diferença entre um lamento genérico e uma oração datada.

Não dá para gerar: teria de vir de fonte NAA licenciada. Os subagents foram
instruídos a usar o sobrescrito como CONHECIMENTO de contexto (mencionar no
`contexto_historico_literario` que a tradição atribui o salmo a tal situação),
nunca a citá-lo como se fosse texto do trecho — o que seria inventar Escritura.

Decisão pendente do usuário: aceitar assim, ou conseguir os sobrescritos de uma
fonte NAA e reprocessar os Salmos.

## Efeito visível de aposentar as ordens 1100-1104

Levantado pela sessão da fusão Índice/Pesquisa: quando as cinco saírem do
`index.json`, qualquer `progresso`, `destaque` ou `anotacao` que exista para elas
vira dado órfão. As telas não quebram — elas só leem progresso de ordem presente
no índice — mas **o ✓ some sem explicação** para quem tiver lido uma das cinco.

Medido no D1 em 2026-09-03: é exatamente **1 linha**, de `progresso`, na ordem
1100. Zero anotações, zero destaques. Ou seja, o efeito real é o ✓ do próprio
dono sumindo de "Livro 1 dos Salmos" — que ele já aceitou ao decidir aposentar.

Some junto a barra de Salmos, que hoje mostra 1 de 5 concluída e passa a mostrar
0 de 148. Não é bug, é o denominador mudando; mas parece bug, e por isso está
escrito aqui.
