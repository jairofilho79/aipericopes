# Sessão 5 — como a trilha entra no app

Escrito depois que a paleta de 17 registros foi aprovada de ouvido. Este
documento é o desenho do encaixe: onde o áudio mora, como o tocador o usa, e em
que nível ele sai. Nada aqui foi commitado no `src/` ainda.

## Correção de rota: a narração SEMPRE esteve no R2

O kickoff dizia que a narração do `ash` já estava no R2. Sondei `ash/` e
`nt-ml/`, levei 404 nos dois, e conclui que a premissa era falsa — gerei três
narrações por US$ 0,06 para poder testar. **Estava errado.** O prefixo vivo é
`gam-ash1/` (`VOZ` em `src/lib/manifesto.ts`); `nt-ml` foi aposentado quando o
acervo foi renormalizado.

Isso não custou quase nada, mas mudou uma coisa importante — ver o nível abaixo.

Estado real hoje:

| chave | o que é |
|---|---|
| `gam-ash1/<ordem>.m4a` | narração, AAC **mono 24 kHz**, **−14,0 LUFS**, −1,2 dBTP |
| `gam-ash1/<ordem>.json` | manifesto de sincronização (realce palavra a palavra) |

**2.646 das 2.823** perícopes têm narração publicada. As 177 sem narração não
mostram tocador — e, por consequência, também não terão cama.

## Uma pista separada, não uma mistura

O kickoff já recomendava, e continua certo. As razões, na ordem em que pesam:

1. **É reversível.** Trocar um registro de lugar é publicar um JSON de 6 KB. Se
   a cama estivesse assada dentro do m4a, seria re-renderizar e re-subir os
   8 GB de narração — e passar tudo de novo pela auditoria de loudness que o
   `scripts/normalizar-narracao.sh` mostra ser delicada.
2. **Existe botão de desligar.** Trilha é gosto. Assada, não tem volta.
3. **Não recodifica a voz.** Assar significa decodificar AAC e recodificar AAC
   por cima — perda de geração em 2.646 arquivos, de graça.
4. **Custa 26 MB em vez de 8 GB.** 17 camas contra um acervo inteiro.

O preço da pista separada é sincronismo, e **aqui ele não existe**: a cama é
ambiente, não tem relação com nenhuma palavra. Ela só precisa tocar enquanto a
voz toca. Um atraso de 200 ms é inaudível; um *seek* não exige nada dela.

## Onde cada coisa mora

```
R2  gam-ash1/<ordem>.m4a     narração        (intocada)
R2  gam-ash1/<ordem>.json    manifesto       (intocado)
R2  trilha-v1/<registro>.m4a 17 camas, ~1,5 MB cada, ~26 MB no total
app public/data/trilha.json  { prefixo, registros: { <registro>: [ordens…] } }
```

**Por que o mapa não vai para o R2:** ele tem 13 KB (6 KB comprimido). Servido
com o build, é zero round-trip a mais e fica versionado junto com o código que o
lê. E o mesmo arquivo carrega o nome do prefixo — assim mapa e camas não podem
sair de sincronia, do mesmo jeito que `VOZ` é a única fonte do prefixo da voz.

**Prefixo versionado, como a voz.** `/api/audio/*` é servido `immutable` com um
ano de cache: regravar uma chave nunca chegaria em quem já ouviu. Refazer a
paleta cria `trilha-v2/`, não sobrescreve `trilha-v1/`.

**Uma mudança no Worker.** `chaveAudio()` em `worker/audio.ts` exige nome de
arquivo numérico:

```ts
/^[a-z][a-z0-9-]*\/\d+\.(m4a|json)$/
```

`trilha-v1/lamento.m4a` não passa. Duas saídas:

- **numerar as camas** (`trilha-v1/1.m4a`…`17.m4a`) — zero mudança no Worker,
  mas o nome deixa de dizer o que é;
- **alargar para `[a-z0-9-]+`** — uma linha e um teste, e a chave continua
  legível para quem for auditar isso daqui a dois anos. **Recomendo esta.**

## Como o tocador usa

O `NarracaoPlayer` já é dono do play/pause/seek e já avisa quando toca
(`onTocando`). A cama pendura nesse sinal e mais nada.

**Web Audio, não um segundo `<audio>`** — por três motivos concretos:

1. **Laço sem emenda.** `loop` de `<audio>` tem furo audível em vários
   navegadores. `AudioBufferSourceNode` com `loop=true` é exato por amostra —
   e o trabalho de fechar o laço já está feito: as 17 camas estão com
   desalinho ≤ 1,1 dB entre o começo e o fim.
2. **O iPhone ignora `audio.volume`.** Isso já mordeu este projeto uma vez —
   está escrito no cabeçalho do `normalizar-narracao.sh`, e foi por isso que o
   ganho da narração foi para dentro do arquivo. `GainNode` funciona no iOS.
3. Entrada e saída suaves saem de graça no mesmo nó.

A cama tem ~1,5 MB: baixa inteira, decodifica uma vez e vira `AudioBuffer`.
Trocar de perícope só troca o buffer **se o registro mudar** — perícopes
seguidas do mesmo registro deixam a música correndo, que é o comportamento
bonito.

Desligar é preferência lembrada. Sugestão: **ligada por padrão**, com o controle
visível ao lado do play — mas isso é decisão do dono.

## O nível, medido

Este é o detalhe que o erro do prefixo escondeu.

A paleta foi aprovada contra a narração **local**, que sai do TTS a −24 LUFS.
A narração **publicada** passou por `normalizar-narracao.sh` e está a
**−14 LUFS**. São 10 dB de diferença: uma cama publicada a −38 LUFS ficaria
inaudível sob a voz de verdade.

E tem uma segunda camada. O m4a é **mono**, e tanto o `<audio>` quanto o Web
Audio copiam mono para os dois canais em ganho unitário. Medido como arquivo
mono, a narração dá −14,0 LUFS; **do jeito que sai das caixas**, dá −11,1.
(Errei isso na primeira medição desta própria conta: emulei a soma com
`aformat=channel_layouts=stereo`, que aplica −3 dB por canal, e o pico da soma
apareceu *menor* que o da voz sozinha. Sinal de conta errada.)

Mantendo os 14 dB de separação que o dono aprovou:

| | aprovado (local) | publicado |
|---|---|---|
| voz | −24,0 LUFS | −11,1 LUFS (nas caixas) |
| cama | −38,0 LUFS | **−25,0 LUFS** |
| separação | 14 dB | 14 dB |

Soma medida com a narração publicada de verdade: **−11,0 LUFS, pico
−1,1 a −1,9 dBTP** — o headroom continua lá, sem estouro.

Os −25 LUFS são aritmética mais emulação offline. Antes de publicar as 17,
**conferir de ouvido no iPhone** — é uma conta que já errei uma vez hoje.

## O ducking fica — resolvido no teste cego

Duas provas, ordem embaralhada entre elas (`X=seco Y=duck`, `P=duck Q=seco`),
trechos de 60 s. O dono distinguiu as duas em ambas e escolheu o ducking:

> *"Nos secos, parece que a cama está disputando com a narração. Até uma relação
> de 'desrespeito', de disputa de presença. O ducking cria a hierarquia para
> equilibrar as coisas."*

A diferença medida era de 0,1 LUFS — ou seja, **a medição não via o que o ouvido
via.** Vale como lição sobre o limite dos números aqui: eles pegam nível e
timbre, não hierarquia.

Consequência de projeto: a pista precisa de ducking, mas **não de compressor**.
Ver `kickoff-trilha-no-tocador.md` — o manifesto da narração já diz quando a voz
fala, então a envoltória se monta de antemão em vez de ser adivinhada do sinal.

## O que trava a publicação

Duas coisas que não custam nada agora e custariam caro depois:

1. **Licença do Lyria.** Redistribuir áudio gerado dentro de um app é uso
   diferente de ouvir em casa. Este projeto já foi refundado uma vez por
   direitos — conferir os termos antes de gastar mais.
2. **Conta própria.** A paleta final sai da conta Google do dono, não pelo
   OpenRouter, que é revenda. Trocar isso depois de publicado é regerar tudo.

## Ordem sugerida enquanto as Sessões 3 e 4 correm

Nada abaixo depende delas.

1. Licença e conta própria — pode matar o resto, então vem primeiro.
2. ~~Teste cego do ducking~~ — feito: fica, e sem compressor.
3. Página de prova da pista separada, aberta no iPhone: laço sem emenda, ganho
   respeitado, nível confirmado de ouvido, bateria.
4. Amostra de ~40 perícopes classificadas para conferência editorial — passo 3
   do protocolo do kickoff, ainda devido.
5. Só então: alargar `chaveAudio`, subir `trilha-v1/`, e a pista no tocador.

A classificação e as camas ficam paradas até o item 1 responder.

---

## Estado em 2026-09-05 — o que deste documento já está feito

| item | estado |
|---|---|
| paleta de 22 camas aprovada de ouvido | ✅ 17 registros + 5 segundas vozes |
| classificação das 2.823 | ✅ 100%, amostra de 40 conferida pelo dono |
| camas no nível de publicação (−25 LUFS) | ✅ `../trilha-corpus/trilha-v1/`, 35,4 MB |
| mapa perícope → cama | ✅ `public/data/trilha.json`, 13 KB (6,2 gzip) |
| `chaveAudio` aceitando nome de registro | ✅ `worker/audio.ts` + testes |
| script de publicação no R2 | ✅ `scripts/publicar-trilha.sh` |
| subir `trilha-v1/` para o R2 | ⬜ o script está pronto, não foi rodado |
| a pista no tocador | ⬜ **é o que falta** — ver `kickoff-trilha-no-tocador.md` |
| ducking: fica ou sai | ✅ **fica** — pelo manifesto, sem compressor |

As 22 camas medidas: −25,0/−25,1 LUFS, pico entre −12,6 e −14,0 dBTP, laço
entre 0,0 e 1,1 dB, 116 a 161 s de duração.

**A alternância A/B** está no mapa, não no cliente: cinco registros têm segunda
cama e, dentro de uma fila do mesmo registro na ordem de leitura, a posição par
usa a primeira e a ímpar usa a segunda. A fila de 13 perícopes do tabernáculo
sai como `S S-2 S S-2 …`. O cliente só lê o mapa — não decide nada, e nada é
sorteado na hora de tocar.
