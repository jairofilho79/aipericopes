# Kickoff — a trilha no tocador (a pista separada)

> **Prompt para abrir a sessão nova:**
> *"Leia `docs/kickoff-trilha-no-tocador.md` e construa a pista da trilha.
> O desenho e os números medidos estão em `docs/sessao-5-trilhas-desenho.md` —
> leia antes de escolher como tocar o áudio."*

A Sessão 5 produziu e aprovou a paleta. **Falta só pôr no tocador.** Nada aqui
depende de gerar áudio novo nem de decisão editorial: a paleta está fechada,
o mapa está no repo e o Worker já serve as chaves.

## O que já está pronto (não refaça)

- **22 camas** em `../trilha-corpus/trilha-v1/`, a −25 LUFS, laço fechado
  (0,0–1,1 dB de desalinho entre começo e fim), 116–161 s, 35,4 MB no total.
- **`public/data/trilha.json`** — `{ prefixo, camas: { <cama>: [ordens…] } }`,
  13 KB. Cobre as 2.823. O cliente inverte uma vez no carregamento.
- **`worker/audio.ts`** já aceita `trilha-v1/santuario.m4a` (o nome deixou de
  precisar ser número). Testes em `worker/audio.test.ts`.
- **`scripts/publicar-trilha.sh`** — sobe e confere contra a API. **Ainda não
  foi rodado**; rodar é o primeiro passo desta sessão.

## O que construir

Uma pista de áudio paralela à narração, que só precisa de uma coisa: **tocar
enquanto a voz toca.** Ela é ambiente, não tem relação com nenhuma palavra, e
um atraso de 200 ms é inaudível. *Seek* não exige nada dela.

**Use Web Audio, não um segundo `<audio>`.** Três motivos, e o segundo já mordeu
este projeto antes:

1. `loop` de `<audio>` tem furo audível em vários navegadores;
   `AudioBufferSourceNode` com `loop=true` é exato por amostra.
2. **O iPhone ignora `audio.volume`** — está escrito no cabeçalho do
   `scripts/normalizar-narracao.sh`, e foi por isso que o ganho da narração foi
   para dentro do arquivo. `GainNode` funciona no iOS.
3. Entrada e saída suaves saem no mesmo nó.

A cama tem ~1,5 MB: baixa inteira, decodifica uma vez, vira `AudioBuffer`.
**Trocar de perícope só troca o buffer se a cama mudar** — perícopes seguidas da
mesma cama deixam a música correndo, e isso é proposital.

Desligar é preferência lembrada. Sugestão: ligada por padrão, controle visível
ao lado do play. As 177 perícopes sem narração não mostram tocador e portanto
também não têm cama — não invente caso para elas.

## As duas coisas que podem morder

**O nível.** Os −25 LUFS vieram de conta mais emulação offline, e a conta erra
fácil: o m4a da narração é MONO, e o navegador o copia para os dois canais em
ganho unitário — medir o arquivo como mono dá 3 LU a menos do que sai das
caixas. Emular a soma com `aformat=channel_layouts=stereo` aplica −3 dB por
canal e dá conta errada; use `pan=stereo|c0=c0|c1=c0`. **Confirme de ouvido no
iPhone antes de dar por bom.**

**O ducking FICA — e não se faz com compressor.** O dono fez o teste cego (duas
provas, ordem embaralhada, `X=seco Y=duck` e `P=duck Q=seco`) e distinguiu as
duas em ambas. Palavra dele: *"nos secos, parece que a cama está disputando com
a narração… uma relação de desrespeito, de disputa de presença. O ducking cria a
hierarquia."* Ele tem razão pelo motivo técnico: sem ducking, voz e cama ocupam a
mesma faixa ao mesmo tempo e o ouvido não sabe qual seguir.

Mas **não implemente sidechain de sinal.** O Web Audio não tem compressor com
entrada lateral, e a saída óbvia — `createMediaElementSource` na narração para
analisar o nível — puxaria o `<audio>` inteiro para dentro do grafo, e é desse
mesmo elemento que sai o realce palavra a palavra que já funciona. Não vale o
risco.

**Faça pelo manifesto.** `gam-ash1/<ordem>.json` já sabe, com precisão de
alinhamento forçado, quando a voz fala: cada unidade tem `inicio` e `dur`, e as
que já foram realinhadas trazem `palavras[]` com `i` e `d` por palavra. Isso é
o que o sidechain tenta adivinhar do sinal — só que aqui é verdade conhecida de
antemão.

Então: no carregamento, monte a envoltória de ganho da cama a partir do
manifesto (abaixada enquanto uma unidade soa, de volta ao normal nas pausas) e
agende-a no relógio do `AudioContext` com `setValueAtTime` /
`linearRampToValueAtTime`. Reagende no *seek*. A referência do que ele aprovou é
`threshold=0.03 ratio=2 attack=20ms release=400ms` — na prática, uns 4–5 dB de
redução, descendo rápido e voltando devagar.

Sem manifesto — ou em manifesto antigo sem `palavras` — caia para o nível de
unidade, que ainda é bom. Sem manifesto nenhum, toque a cama plana: é melhor
que silêncio e melhor que adivinhação.

## Território

A Sessão 3 commita neste repo em paralelo, inclusive em `src/`. Confira o
`git log` antes de assumir que um arquivo é seu, e não inclua
`data/pericopes.json` em commit desta tarefa — costuma estar modificado por ela.
