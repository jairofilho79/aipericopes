# Releitura e esquecimento — design

Data: 2026-09-03

## Problema

`progresso` é uma linha por perícope (`status`, `atualizadoEm`) e só sabe
avançar. Não existe nenhuma forma de desmarcar: `Leitura.tsx` oferece "Marcar
como concluída" e depois disso o selo é permanente. `setProgresso` aceita
`'nao_iniciado'`, mas nenhuma UI chama.

Não há histórico: reler sobrescreve o mesmo `atualizadoEm`, e a leitura
anterior desaparece. E não há nada que traga de volta o que foi lido há muito
tempo — 2646 perícopes lidas ficam indistinguíveis de 2646 perícopes lidas
ontem.

Com **no máximo uma jornada ativa por vez** (feature paralela), zerar deixa de
ser conveniência: é o mecanismo pelo qual o leitor recomeça de verdade.

## Decisões de produto (tomadas com o usuário)

1. **Zerar em massa é a prioridade.** Depois, desmarcar individual. "Marcar
   para reler" e o esquecimento por decay vêm por último.
2. **Desmarcar tira da jornada.** O predicado exige `status === 'concluido'`.
   Desmarcar significa "não consta mais como lida" — é o único jeito de
   desfazer um engano. Quem quer revisitar sem regredir usa "marcar para
   reler".
3. **O streak sobrevive a zerar.** Os dias em que se leu aconteceram; o hábito
   não é o progresso. A confirmação diz isso em voz alta.
4. **O streak está pendurado na fonte errada** e isso é um bug separado: hoje
   ele deriva de conclusões, então ler 40 minutos de Isaías sem terminar não
   conta. Vira a fatia 3.
5. **Esquecimento é 1 ano fixo**, não intervalo que cresce com as releituras.
6. **Histórico de leituras completo**, não só a última data: quando se leu,
   cada vez.
7. **A lista "Vale reler" tem duas fontes que se somam**: o pin manual e o
   decay. Uma lista só, que se visita — nunca um alarme.

## Objetivo

Poder voltar atrás (uma perícope ou o catálogo inteiro), sinalizar o que se
quer revisitar, e ser lembrado do que se leu há muito tempo — sem que nada
disso reescreva o passado.

**Não é objetivo:** mexer em jornadas, no player, na busca, ou no catálogo.
Não é objetivo apagar o histórico de leitura: não existe botão para isso.

## O contrato com jornadas (verificado, não presumido)

Jornadas consomem **apenas** o predicado *"existe uma conclusão da perícope `o`
com timestamp `>= desde`"*, exposto como função pura. A spec de jornadas
(`2026-09-03-jornadas-design.md`) já o implementa com o nome `contaComoLida`.

**Este design adota esse nome.** Não se cria um segundo. Ele passa a morar em
`src/lib/conclusao.ts` — arquivo desta feature, para que reimplementá-lo sobre
um formato novo não toque em nada de jornadas.

```ts
// src/lib/conclusao.ts
export function contaComoLida(p: Progresso | undefined, desde: string | null): boolean
```

Corpo **hoje**, sobre o modelo atual, sem migration nenhuma — é a fatia 0, e
sai primeiro para jornadas poderem começar:

```ts
if (!p || p.status !== 'concluido') return false
return desde === null || p.atualizadoEm >= desde
```

Corpo **depois da fatia 1**: `p.atualizadoEm` vira `p.historico[0]`. É essa
linha, e só ela. Nenhum chamador percebe.

Açúcar assíncrono para consumidores que não têm o `Map` em mãos (jornadas têm,
e não precisam disto):

```ts
export async function concluidaDesde(ordem: number, desde: string | null): Promise<boolean>
export async function concluidasDesde(ordens: number[], desde: string | null): Promise<Set<number>>
```

`Set<number>` e não contagem: `.size` alimenta a barra, `.has(o)` alimenta o ✓,
pelo mesmo preço.

**Ganho colateral do histórico.** O contrato é literalmente *"existe uma
conclusão >= desde"*. Com uma data só isso era aproximação. Com o histórico é
literal — e como `historico[0]` é o máximo, `historico.some(d => d >= desde)`
⟺ `historico[0] >= desde`. Continua O(1).

## O modelo

```ts
export type Progresso = {
  pericopeOrdem: number
  status: ProgressoStatus
  /** Conclusões em ISO canônico, mais nova primeiro. Teto de 50. Nunca esvaziado. */
  historico: string[]
  paraReler: boolean
  /** Continua sendo a chave do LWW. */
  atualizadoEm: string
}
```

Continua **uma linha por perícope**, a primeira das quatro entidades
sincronizadas, sem lápide
(desmarcar é upsert de status; o LWW resolve sozinho).

`concluidoEm` e `vezes` **não são campos** — são derivados de `historico[0]` e
`historico.length`. Duas colunas viraram uma, e a subcontagem de um contador
inteiro (dois aparelhos concluindo offline viram 1) desaparece: a união soma.

### Duas políticas de merge na mesma linha, de propósito

| campo | política | por quê |
|---|---|---|
| `status`, `paraReler` | LWW por `atualizadoEm` | estado, alterna nos dois sentidos |
| `historico` | união de conjuntos, **fora** da guarda do LWW | fato, só cresce |

Sem tirar o histórico da guarda, a promessa vaza: aparelho A conclui offline em
T2, aparelho B desmarca em T3 > T2 e sincroniza primeiro; a guarda
`> atualizado_em` descartaria o lote de A **inteiro**, junto da conclusão.

### Migration 0010 (aditiva, padrão da 0005)

```sql
ALTER TABLE "progresso" ADD COLUMN "historico"  TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE "progresso" ADD COLUMN "para_reler" INTEGER NOT NULL DEFAULT 0;
-- Linha já concluída teve ao menos uma conclusão; a única data que existe hoje
-- é atualizado_em (mesmo espírito do backfill da 0003).
UPDATE "progresso" SET "historico" = json_array("atualizado_em") WHERE "status" = 'concluido';
```

### O upsert

```sql
ON CONFLICT(user_id, pericope_ordem) DO UPDATE SET
  status     = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                    THEN excluded.status     ELSE progresso.status     END,
  para_reler = CASE WHEN excluded.atualizado_em > progresso.atualizado_em
                    THEN excluded.para_reler ELSE progresso.para_reler END,
  atualizado_em = MAX(excluded.atualizado_em, progresso.atualizado_em),
  historico = (SELECT json_group_array(d) FROM (
                 SELECT value AS d FROM json_each(excluded.historico)
                 UNION
                 SELECT value AS d FROM json_each(progresso.historico)
                 ORDER BY d DESC LIMIT 50)),
  server_em = excluded.server_em
WHERE excluded.atualizado_em > progresso.atualizado_em
   OR EXISTS (SELECT 1 FROM json_each(excluded.historico)
              WHERE value NOT IN (SELECT value FROM json_each(progresso.historico)))
```

O `EXISTS` no lugar de um `<>` de string é deliberado: um cliente velho
(service worker em cache) empurra sem `historico`, o Worker preenche `'[]'`, e
um `<>` faria `server_em` avançar à toa — cada push viraria uma linha
re-entregue no pull seguinte, para sempre.

**Verificado, não presumido.** `json_each` / `json_group_array` / `UNION` com
`ORDER BY ... LIMIT` dentro de `ON CONFLICT` foram testados em D1 **local** (o
upsert completo: 2 datas locais + 2 recebidas com 1 sobreposta → 3 únicas,
mais nova primeiro) e a disponibilidade das funções em D1 **remoto**
(`v3-prod`, `rows_written: 0`, `changed_db: false`). Ainda assim o cliente
reordena na leitura, para que a ordem devolvida pelo SQL nunca seja um
requisito.

### Cliente

`applyRemoteProgresso` espelha as duas políticas e conta como "aplicada"
também quando só a união mudou — senão o live refresh (`sync-event.ts`) perde
uma releitura vinda de outro aparelho.

**IndexedDB v5 → v6**, com backfill no `upgrade()`: `historico ← [atualizadoEm]`
nas concluídas, `paraReler ← false`. É **obrigatório**, não otimização:
`remoteWinsLocal` é `>` estrito, então o pull nunca reescreve uma linha local
de timestamp igual ao do servidor, e os campos ficariam `undefined` para sempre
em quem já usa o app.

Teto de 50 em `src/lib/sync-limits.ts`, espelhado em `worker/sync-logic.ts` com
o comentário de sempre (o Worker não importa de `src/`).

`validProgresso` aceita `historico` e `paraReler` **ausentes** — um cliente não
atualizado continua sincronizando, como `destaques`/`posicoes` já fazem — e
valida array de no máximo 50 ISO canônicos.

## Fatia 0 — o seam (sai primeiro, hoje)

`src/lib/conclusao.ts` com `contaComoLida` sobre o modelo atual, mais os dois
açúcares assíncronos e o teste. Nenhuma migration, nenhuma mudança de tipo.
Desbloqueia jornadas imediatamente.

## Fatia 1 — zerar em massa e desmarcar

```ts
export async function desmarcarProgresso(ordem: number): Promise<void>
export async function zerarProgresso(ordens: number[]): Promise<number>
```

Ambas numa transação só com o outbox, como todo o resto de `user-db.ts`.

Três decisões dentro de `zerarProgresso`:

1. **Só escreve o que muda.** Zerar tudo com 32 lidas escreve 32 linhas, não
   2646. Sem o filtro, o outbox receberia 2646 itens para mudar 32.
2. **Apaga as posições das ordens zeradas, com lápide.** Não é enfeite:
   `Home.tsx` prefere o checkpoint mais recente à primeira não-concluída. Sem
   isso se zera o Antigo Testamento e o "Continuar" devolve o leitor ao meio de
   Isaías em vez de Gênesis 1.
3. **Limpa `paraReler`.** O que não consta como lido não pode estar na fila de
   releitura.

**Regra única e permanente:** zerar e desmarcar tocam em `status` e
`paraReler`. `historico` **nunca** é apagado.

Volume: `chunk()` em `sync.ts` já fatia em lotes de 500 — zerar tudo vira ~3
POSTs. Protocolo intocado.

`markDone` passa a fazer: `historico = [agora, ...historico].slice(0, 50)`,
`status = 'concluido'`, `paraReler = false`, e o `clearPosicao` que já faz.

### Interface

Rota nova `/ajustes` (`src/pages/Ajustes.tsx`), com os três níveis na mesma
gramática, cada um mostrando a contagem real antes de confirmar.

**Ponto de entrada: uma entrada dentro do menu "Perfil"**, não um ícone solto
no header. Decidido pela sessão de jornadas, que é dona do chrome: ela remove
"Hoje" da nav (a marca já leva a `/`) e absorve o `ThemeMenu` e as preferências
do "Aa" num menu de conta — então a engrenagem que este design pedia "ao lado
do `ThemeMenu`" não teria vizinho. É melhor por mérito, não só por espaço:
ação destrutiva de conta pertence ao menu de conta, que é onde se procura por
"apagar meus dados", e ficar a dois cliques deliberados convém a algo que apaga
o ✓ de centenas de linhas.

O **formato** do Perfil ainda está sendo decidido; a **localização** (menu de
conta, nunca item de primeiro nível da nav) é estável. Se o formato mudar, o
que muda aqui é o rótulo do ponto de entrada — não a rota, nem a tela.


```
/AJUSTES  →  Progresso de leitura

  Zerar um livro       [ Gênesis ▾ ]  32 lidas   [Zerar]
  Zerar um testamento  Antigo         1189 lidas [Zerar]
                       Novo            260 lidas [Zerar]
  Zerar tudo                          1449 lidas [Zerar]
```

> **Zerar 1189 leituras do Antigo Testamento?**
> O ✓ some do Índice e as barras voltam a zero. Seu 🔥 streak e seu recorde
> continuam. Não dá para desfazer.

Na Leitura, sob o cartão "Próxima →", o link discreto `Desmarcar como
concluída` — sem confirmação (é uma perícope, remarcar é um toque). O cartão
continua sendo a ação primária; desmarcado, o bloco volta ao botão "Marcar como
concluída" de sempre.

## Fatia 2 — marcar para reler e esquecimento

`src/lib/releitura.ts`, puro:

```ts
export const DIAS_ESQUECIMENTO = 365
export function candidatosReler(progressos: Progresso[], agora: Date): CandidatoReler[]
```

Regra: `paraReler || (status === 'concluido' && dias(historico[0]) > 365)`.
Ordem: pin primeiro, depois mais esquecida, desempate por menos lida.

Bloco **"Vale reler"** na Home **abaixo do conteúdo principal nos dois
estados** — com o card de jornada ativa, e com as trilhas VT/NT quando não há
jornada — **oculto quando vazio**, top 3 mais "ver todas" que expande no lugar.
Sem rota nova.

Abaixo e não acima por decisão da sessão de jornadas, dona da estrutura da
Home: ela responde primeiro "para onde eu vou agora"; releitura é oferta, não
instrução.

Na Leitura, `★ Marcar para reler` ao lado do desmarcar, e o histórico visível:
`lida 3× · mar/26 · ago/25 · jan/25`. Concluir limpa o pin: a releitura
aconteceu.

## Fatia 3 — `dias_leitura`, streak por atividade

Entidade sincronizada nova — a quinta, ou a sexta se jornadas chegar antes:
uma linha por dia local em que houve leitura
(`{ dia: '2026-09-03' }`). Conjunto que só cresce, **sem lápide** — dois
aparelhos offline nunca conflitam, o merge é união.

Gatilho: `setPosicaoLocal` (rolar até mudar de seção, tocar num versículo, item
narrado) e `markDone`. **Abrir e sair não conta** — senão o streak vira prêmio
por tocar num link. Guard local de um `get` por dia: no máximo uma escrita
diária.

`computeStreak` fica intacto (já é puro e correto); `diasComConclusao` é
substituída pela leitura do store novo.

Backfill: semeia com **todas** as datas de `historico`, não só a última — quem
já lê hoje não perde histórico de streak no dia em que isso entrar.

Custo real: `paginarPull` ganha mais uma lista genérica (4 → 5, ou 5 → 6 se
jornadas chegar antes), no arquivo mais sutil do projeto. Ver Riscos.

## Coordenação com a sessão de jornadas

As duas features são desenhadas em paralelo. Divisões acordadas:

| recurso | jornadas | releitura |
|---|---|---|
| migration | `0009_jornadas.sql` | `0010` (cedida — jornadas commitou primeiro) |
| IndexedDB | v4 → v5 (store `jornadas`) | v5 → v6 (backfill de `progresso`) |
| entidade sync nova | `jornadas` | `dias_leitura`, **só na fatia 3** |
| `src/lib/conclusao.ts` | consome | **dono** |
| `src/lib/jornadas.ts` | dono | não toca |
| `streak.ts` | consome | **dono** (fatia 3) |
| `Home.tsx` | **dono da estrutura** | "Vale reler" abaixo, nos dois estados |
| header / nav | **dono** (reescreve `App.tsx`) | `/ajustes` entra pelo menu "Perfil" |

`progressoPorLivro` (`content.ts`) **não muda**: já recebe `Set<number>` e não
lê `atualizadoEm`. Nenhuma das duas features encosta nele.

`contaComoLida` sai de `src/lib/jornadas.ts` e passa a morar em
`src/lib/conclusao.ts` — mesmo nome, mesma assinatura. É o que permite trocar o
corpo por `historico[0]` sem abrir um arquivo de jornadas.

Para o streak, a recíproca: esta feature expõe `streakAtual(): Promise<Streak>`
em `streak.ts`, para a Home nova não precisar saber que a fonte muda na fatia 3.

## Testes

- `conclusao.test.ts`: `desde` null, limite exato (`>=`), status não concluído,
  histórico vazio, ordem ausente.
- União e teto de 50 no merge; ida-e-volta do upsert com histórico divergente
  entre dois "aparelhos".
- Backfill v5 → v6 do IndexedDB.
- `zerarProgresso` escreve só o que muda, enfileira lápide de posição e limpa
  `paraReler`.
- `validProgresso` aceita corpo antigo sem os campos; rejeita data inválida e
  array acima de 50.
- `candidatosReler`: fronteira em 365 dias, ordem e desempate.

## Riscos

1. **Teto de 50 conclusões por perícope.** Da 51ª releitura em diante a data
   mais antiga cai, irreversivelmente. Aceito: mantém a linha limitada e o
   payload do push previsível.
2. **Mais uma lista no `paginarPull` (fatia 3).** O arquivo mais sutil do repo, com
   invariantes de cursor documentadas em detalhe. É o pedaço mais arriscado do
   plano e provavelmente merece brainstorm próprio quando chegar a vez.
3. **Chrome ainda em movimento.** As duas colisões com jornadas (bloco na
   Home, ponto de entrada de `/ajustes`) foram **resolvidas** por ela, que é
   dona das duas estruturas — ver Fatia 1 e Fatia 2. O aperto de 360 px que a
   spec dela registrava acabou: "Hoje" sai da nav. O resíduo é que o formato
   do menu "Perfil" segue em decisão; o impacto máximo deste lado é o rótulo
   de uma entrada de menu.
4. **Cliente velho empurrando sem `historico`.** Coberto pelo `EXISTS` no
   `WHERE` (não bomba `server_em`) e pela tolerância a campo ausente no
   `validProgresso`.
5. **Ordem devolvida pelo `json_group_array`.** Não é garantida por contrato do
   SQLite. Mitigado por o cliente reordenar sempre na leitura.

## Critérios de aceite

1. Desmarcar uma perícope: o ✓ some do Índice, a barra do livro cai, a jornada
   ativa regride, e o streak **não muda**.
2. Remarcar a mesma perícope: `historico` fica com **duas** datas, não uma.
3. Zerar um livro: só as perícopes daquele livro perdem o ✓; a contagem na
   confirmação bate com o que some.
4. Zerar um testamento e voltar à Home: "Continuar" aponta para a **primeira**
   perícope do testamento, não para um checkpoint velho.
5. Zerar tudo (1449 lidas): sincroniza sem erro, e o streak e o recorde
   continuam exatamente como estavam.
6. Dois aparelhos offline concluem a mesma perícope; ao sincronizar, o
   histórico tem as **duas** datas.
7. Aparelho A conclui offline; aparelho B desmarca depois e sincroniza antes.
   Resultado: `status` de B (desmarcada) e a data de A preservada no histórico.
8. Uma perícope lida há mais de 1 ano aparece em "Vale reler"; lida há 11
   meses, não.
9. Marcar para reler uma perícope concluída: ela vai ao topo de "Vale reler" e
   o ✓ do Índice **permanece**.
10. Fatia 3: ler 10 minutos sem concluir credita o dia no streak.
11. Instalação antiga (IndexedDB v4/v5, dados locais): abre em v6 com o histórico
    backfillado e nada perdido.
