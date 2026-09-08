# Volume da narração

Como levar a narração gerada por TTS ao volume de publicação sem estourar, e
por que cada decisão é o que é. Escrito depois do reprocessamento de 2026-09-04,
para servir ao próximo — a troca de versão da Bíblia vai regerar tudo do zero, e
estas diretrizes valem independente de qual texto e qual voz forem usados.

## O problema

O TTS entrega áudio bem mais baixo do que o padrão de publicação. Distribuição
medida em 2646 das 2842 perícopes publicadas (as outras 196 só apareceram
depois — ver "Só `list()` é inventário" adiante; batem com estes números):

| | valor |
|---|---|
| loudness integrada | **−24,0 LUFS** (de −24,7 a −23,6) |
| pico de amostra | de −8,2 a **−2,6 dBFS** |
| faixa dinâmica (LRA) | 3,2 a 4,4 LU |
| formato | AAC mono, 24 kHz, ~66 kbps |

O alvo de YouTube e Spotify é **−14 LUFS**; o de Apple Podcasts, −16. Dez
decibéis abaixo disso, a narração soa fraca ao lado de qualquer outra mídia no
mesmo aparelho — foi exatamente o relato que originou este trabalho.

Repare no contraste que importa: a **loudness é uniforme** (1,1 dB de
espalhamento em 2646 arquivos), mas o **headroom varia 5,6 dB**. Ganho fixo é
seguro; teto de limitador fixo não é.

## O ganho vai no arquivo, não no player

**O iOS ignora `HTMLMediaElement.volume`.** No Safari do iPhone a propriedade é
efetivamente somente-leitura: só os botões físicos mexem no volume. Qualquer
solução baseada em multiplicar o volume no cliente não funciona justamente no
aparelho onde o problema aparece.

Consequência prática: se um dia for preciso oferecer dois níveis ao usuário, o
caminho é **publicar dois arquivos e trocar a URL**, não aplicar ganho no
cliente. Web Audio resolveria, mas cobra caro no iOS (a `AudioContext` exige
gesto, e rotear pelo grafo interfere na reprodução em segundo plano).

## A receita

```
aresample=96000,
volume=13dB,
alimiter=limit=0.631:attack=5:release=50:level=disabled,
aresample=24000
→ AAC 80k mono 24 kHz, -movflags +faststart
```

Resultado nas 2842: **−14,6 a −13,8 LUFS** (mediana −14,1), true peak sempre
≤ −1,0 dBTP, `Flat factor: 0`, LRA entre 2,2 e 2,9 LU.

Implementada em `scripts/normalizar-narracao.sh`.

### Ganho fixo, não por alvo

Com 1,1 dB de espalhamento no acervo inteiro, ganho fixo entrega o resultado
que foi auditado por escuta e preserva as diferenças reais entre perícopes.
Normalizar cada arquivo para um alvo introduziria variação onde não havia.

### Limitar SOBREAMOSTRADO — a lição mais cara

Um limitador comum enxerga só o pico de **amostra** e deixa passar o pico
**entre** amostras, que é o que o conversor reconstrói na hora de tocar.

Na perícope 1104 (83 minutos), o teto nativo de −4,5 dBFS entregou **+0,3 dBTP**
— estouro. Sobreamostrando para 96 kHz antes de limitar, o mesmo material fica
em **−1,4 dBTP e ainda sai mais alto**. Melhor nos dois eixos ao mesmo tempo.

### Bitrate é o que controla o estouro que sobra — não o teto

O excesso que persiste depois do limitador é **ruído de quantização do AAC**, e
ele **piora quando se aperta mais o codec**. Na perícope 1100, mesmo ganho:

| ajuste | true peak |
|---|---|
| teto −4 dB, 80k | +0,2 dBTP |
| teto −5 dB, 80k | −0,8 dBTP |
| teto −6 dB, 80k | **+2,2 dBTP** |
| teto −4 dB, **96k** | −2,1 dBTP |
| teto −4 dB, **128k** | −3,0 dBTP |

Baixar o teto é não-monotônico e custa volume. Subir o bitrate resolve e **não
custa volume nenhum**. Por isso a repescagem sobe o bitrate: 80k → 96k → 128k.

### Arquivo longo estoura mais que arquivo curto

True peak é um *máximo* sobre o arquivo inteiro. Uma perícope de 83 minutos
sorteia a cauda da distribuição vinte vezes mais que uma de 4. Os poucos casos
que precisaram de 128k foram todos longos. Nenhum teto fixo cobre isso — só
medir cobre.

## A verificação não é opcional

**Nada é publicado sem que o arquivo pronto tenha sido medido.** Três critérios,
todos obrigatórios:

- loudness integrada dentro da janela;
- **true peak ≤ −1,0 dBTP**;
- **`Flat factor: 0`** (nenhuma amostra ceifada).

Quem falhar é **regerado com bitrate maior**, até passar. Quem não passar em
nenhum bitrate não recebe o `manifest.json`, e sem ele o publicador o ignora.

O número que justifica tudo isso: no reprocessamento de 2026-09-04, **109
tentativas falharam** nas 2842 perícopes. 104 estouraram no bitrate padrão e
foram salvas em 96k; 5 precisaram de 128k. São **3,7% do acervo** que teria ido
ao ar estourando se a receita tivesse sido aplicada sem conferência.

A receita acima foi calibrada na perícope 1600, cujo pico (−6,5 dBFS) é
praticamente a mediana do acervo. Calibrar num exemplo confortável é o erro
natural; a verificação por arquivo é o que o torna inofensivo.

### Como medir

```sh
# loudness integrada e true peak
ffmpeg -nostdin -i ARQUIVO -af ebur128=peak=true -f null -
# amostras ceifadas
ffmpeg -nostdin -i ARQUIVO -af astats=metadata=1 -f null - | grep 'Flat factor'
```

## Publicação

### Prefixo novo a cada regeração, sempre

O Worker serve `/api/audio/*` com `cache-control: public, max-age=31536000,
immutable` (`worker/index.ts`). Regravar uma chave existente **nunca chega em
quem já ouviu aquela perícope**. Toda regeração ganha um prefixo novo, e o
prefixo anterior fica no ar como rollback.

### O nome do prefixo tem que dizer de onde o áudio veio

O prefixo antigo se chamava `nt-ml` — nome de uma primeira tentativa de
narração, abandonada. O conteúdo servido dali era de outro render inteiramente
(`gam-ash`). **O nome mentia**, e descobrir qual era o master de verdade custou
meio dia de trabalho e um lote inteiro processado da árvore errada.

O prefixo atual, `gam-ash1`, tem o nome da árvore-master que o originou. Se a
voz mudar, o nome muda junto.

Os três lugares que precisam concordar:

- `VOZ` em `src/lib/manifesto.ts` (o app monta as duas URLs a partir dela);
- `PREFIXO` em `scripts/publicar-narracao.sh`;
- `PREFIXO` em `scripts/conferir-narracao.sh`.

O regex de `chaveAudio` em `worker/audio.ts` aceita dígito no nome
(`[a-z][a-z0-9-]*`) — há teste travando isso, porque exigir só letras faria toda
a narração publicada virar 404.

### Só `list()` é inventário — marcador mente, e sondagem também

Duas formas de se enganar sobre o que está no bucket, ambas cometidas em
2026-09-04:

**Marcador local.** O fluxo antigo confiava num `.subiu` por diretório. O
marcador **dizia 309 enviadas enquanto o R2 servia 2646**, porque o corpus
local foi podado depois do envio. Um marcador registra o que o script fez, não
o que o bucket tem.

**Sondagem por chave adivinhada.** A correção seguinte foi sondar
`/api/audio/nt-ml/<ordem>.m4a` para as ordens 1–2823, o tamanho do catálogo.
Parecia exaustivo e não era: o bucket tinha perícopes nas ordens **0 e
3000–3194**. Essas 196 não foram migradas, e ficaram sem narração em produção
até o inventário real aparecer. **Sondagem só encontra as chaves que você já
imaginou.**

O `wrangler` **não lista objetos do R2**. O único inventário completo vem de
`env.AUDIO.list()`, chamável sem tocar em produção por um worker descartável —
a receita está em [`narracao-lixo.md`](narracao-lixo.md). Levante o inventário
real **antes** de migrar prefixo, e compare conjunto com conjunto.

Para conferir o que foi publicado (não para descobrir o que existe),
`scripts/conferir-narracao.sh` compara objeto a objeto o `content-length` da
API com o tamanho local.

### Sequência de publicação

1. `scripts/normalizar-narracao.sh` — processa e verifica.
2. `scripts/publicar-narracao.sh` — sobe para o prefixo novo.
3. `scripts/conferir-narracao.sh` — confirma contra a API. **Antes do deploy.**
4. Deploy.

**A ordem importa.** Em 2026-09-04 o deploy saiu com o envio ainda em curso e
cerca de 600 perícopes ficaram sem áudio por uns minutos. O estrago foi pequeno
porque o player faz `HEAD` antes de montar e simplesmente não aparece quando o
áudio falta — sem erro na tela, e se cura sozinho a cada abertura. Mas não foi
por projeto: foi sorte de um bom modo de falha.

## O que a receita NÃO muda

**Duração e alinhamento.** Nem ganho nem limitador deslocam amostras. Conferido
no reprocessamento: contagem de PCM idêntica antes e depois, e o único
deslocamento é um viés uniforme de **5 ms**, que é o `attack=5` do limitador —
constante, não acumulativo, e irrelevante para um realce que trabalha na escala
de centenas de milissegundos.

Por isso o `manifest.json` (offsets do realce palavra a palavra) é **copiado sem
tocar**. Se algum dia a receita passar a incluir corte, silêncio ou mudança de
velocidade, essa garantia morre e os manifestos precisam ser regerados.

## Custo

O acervo cresce ao normalizar: **5,7 GB → 7,4 GB** (média de 2,2 para 2,8 MB por
perícope), por causa do bitrate maior. Mantendo o prefixo anterior como rollback,
o bucket fica em ~13 GB — acima da franquia de 10 GB do R2, algo em torno de
US$ 0,05/mês. Apagar o prefixo antigo depois que o novo assentar devolve isso.

## Checklist para regerar do zero

1. Medir o novo acervo **antes** de escolher qualquer parâmetro: loudness,
   pico e LRA de **todos** os arquivos, não de uma amostra. O que decide o teto
   é o pico **máximo** do acervo, não o típico.
2. Conferir se o ganho fixo ainda se justifica (espalhamento de loudness baixo).
   Se a nova voz variar muito mais, aí sim normalizar por alvo.
3. Gerar 3 ou 4 níveis de um trecho e **decidir por escuta**, não por número.
   Mais alto sempre soa melhor num A/B direto — a pergunta certa é a partir de
   qual a voz começa a soar achatada. A LRA mede isso: no reprocessamento ela
   caiu de 3,7 para 2,4 LU.
4. Rodar o lote com verificação por arquivo e repescagem por bitrate.
5. Auditar por fora, sem confiar no relatório do próprio script: remedir os de
   pior true peak mais uma amostra aleatória.
6. Publicar em prefixo novo, conferir contra a API, **e só então** deployar.
7. Antes de aposentar o prefixo antigo, levantar o inventário real dos dois com
   `env.AUDIO.list()` e exigir cobertura idêntica — conjunto contra conjunto,
   não contagem contra contagem. O que sobra vira lixo controlado:
   [`narracao-lixo.md`](narracao-lixo.md).

## Armadilhas de ferramenta

- **`ffmpeg` consome o stdin** e devora a lista de um laço `while read` —
  perícopes somem em silêncio e outras chegam com a ordem truncada ("1600" vira
  "00"). Use **`-nostdin`** em toda chamada dentro de laço.
- **zsh come `:l` e `:a` depois de variável sem chaves.** `limit=$teto:attack=5`
  vira o modificador de caminho absoluto do zsh e o filtro chega corrompido.
  Sempre `${teto}`.
- **`awk` compara campos como texto.** `$3 > pior` com "−3,6" e "−1,0" dá o
  resultado errado, porque "3" > "1" lexicalmente. Force número (`+0`) ou use
  outra ferramenta.
- **`split -n r/N` não existe no macOS.** Para dividir em esteiras:
  `awk -v p=lane- '{print > (p (NR%5))}'`.
