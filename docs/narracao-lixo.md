# Lixo da narração: o que dá para apagar, e quando

Reprocessar a narração deixa rastro: prefixo antigo no R2, árvores de render
abandonadas no disco, pesos de modelo de experimentos que não vingaram. Este
documento lista o que existe, o que **não** pode sair, e o gatilho que libera
cada coisa.

Levantado em 2026-09-04. Companheiro de [`narracao-volume.md`](narracao-volume.md).

## Regra que vale para tudo

**Nunca apague com base em palpite de nome ou em marcador local.** Levante o
inventário real antes (veja abaixo como), confira que o substituto cobre
*exatamente* o mesmo conjunto, e só então apague.

Isto não é zelo teórico. Em 2026-09-04, a migração de prefixo foi feita a
partir de uma sondagem que varreu as ordens 1–2823 (o tamanho do catálogo).
O bucket tinha perícopes nas ordens **0 e 3000–3194**: 196 delas ficaram sem
narração em produção até o inventário real aparecer. Se o prefixo antigo
tivesse sido apagado antes dessa descoberta, teria sido preciso reprocessar e
republicar tudo de novo.

## Como listar o R2 de verdade

`wrangler` **não lista objetos** — só `get`, `put` e `delete`. Sondar a API por
chave descobre apenas as chaves que você adivinhou. O único inventário
completo vem de `env.AUDIO.list()`, e dá para chamá-lo sem tocar em produção,
com um worker descartável:

```jsonc
// wrangler.jsonc, num diretório temporário
{
  "name": "r2-inventario-temp",
  "main": "index.js",
  "compatibility_date": "2026-01-01",
  "account_id": "<seu account id>",
  "workers_dev": false,
  "r2_buckets": [{ "binding": "AUDIO", "bucket_name": "biblia-pericopes-audio" }]
}
```

```js
// index.js
export default {
  async fetch(req, env) {
    const u = new URL(req.url)
    const r = await env.AUDIO.list({
      limit: 1000,
      cursor: u.searchParams.get('cursor') ?? undefined,
    })
    return Response.json({
      objetos: r.objects.map((o) => [o.key, o.size]),
      cursor: r.truncated ? r.cursor : null,
    })
  },
}
```

`npx wrangler dev --remote` sobe isso contra o bucket real; pagine pelo
`cursor` até vir `null`. **Use `curl`, não `urllib`** — o proxy do dev devolve
403 para o User-Agent padrão do Python. Apague o diretório quando terminar.

## R2

O bucket é `biblia-pericopes-audio`. Cada regeração da narração ganha um
prefixo novo, porque `/api/audio/*` é servido `immutable` com um ano de cache
e regravar chave não chega em quem já ouviu. O resultado é que **o prefixo
anterior sempre sobra**.

| item | tamanho | pode apagar quando |
|---|---|---|
| prefixo em uso (hoje `gam-ash1`) | 8,2 GB | **nunca** — é o que o app serve |
| prefixo anterior (`nt-ml`, apagado em 2026-09-04) | 6,3 GB | depois que o novo estiver conferido e no ar |

**Antes de apagar um prefixo aposentado, confirme três coisas:**

1. a constante `VOZ` em `src/lib/manifesto.ts` aponta para o prefixo novo, e
   esse deploy **já está no ar**;
2. o inventário real mostra que o prefixo novo cobre **exatamente** as mesmas
   ordens do antigo — nem uma a menos;
3. os masters continuam em `tts-corpus/` (é deles que se reconstrói, se
   precisar).

`scripts/apagar-prefixo-narracao.sh` faz a exclusão e recusa apagar o prefixo
que `VOZ` aponta. Ele exige um arquivo de chaves vindo do inventário real —
por construção, não dá para rodá-lo em cima de um palpite.

Franquia do R2 é 10 GB. Com dois prefixos vivos passa disso (~US$ 0,05/mês);
com um só, cabe.

## Disco: masters — NÃO APAGUE

`/Volumes/SSD 2TB SD/dev/tts-corpus/`

| árvore | tamanho | por que fica |
|---|---|---|
| `gam-ash` | 13 GB | **o master.** Origem de 2646 das publicadas, e das 196 recuperadas. Gerar de novo custa dinheiro de API. |
| `gam-ash-r2` | 265 MB | 19 perícopes grandes do AT cujo master local se perdeu e foi puxado de volta do R2. **Só existem aqui.** |
| `gam-ash1` | 8,2 GB | o que está publicado. Derivável de `gam-ash` pelo script (~40 min), mas é a cópia local do que está no ar. |

O nome `gam-ash` é **g**pt-**a**udio-**m**ini + voz **ash**, via OpenRouter — a
narração publicada vem de API, não de modelo local. Regerar não depende de
nenhum peso em disco.

## Disco: renders abandonados — pode apagar

Todos verificados byte a byte contra o inventário do R2: **nenhum tem uma única
perícope que não exista em `gam-ash` ou `gam-ash-r2`.**

| árvore | tamanho | o que é |
|---|---|---|
| `nt-ml-aposentada` | 1,4 GB | primeira tentativa de narração, outro narrador, abandonada |
| `novas` | 1,1 GB | cópia byte a byte de 195 perícopes que já estão em `gam-ash` |
| `gam-ash-aposentadas` | 621 MB | 19 perícopes idênticas ao que está publicado |
| `g31` | 385 MB | rodada anterior de direção de voz |
| `fix23` + `gam-ash-backup-fix23` | 277 MB | lote de correção e seu backup |
| `vers5` + `gam-ash-backup-vers5` | 41 MB | idem, menor |

**~3,8 GB.** O `nt-ml-aposentada/LEIA-ME.md` explica a história dos dois
narradores; se apagar o áudio, vale preservar esse arquivo.

## Disco: modelos de TTS local — pode apagar

`/Volumes/SSD 2TB SD/dev/tts-spike/` — **24 GB**, quase tudo de experimentos
que não vingaram. A narração publicada é por API, e o alinhamento palavra a
palavra usa `torchaudio` (cache em `~/.cache/torch`), não estes pesos.

| item | tamanho | observação |
|---|---|---|
| `hf/hub/Qwen3-TTS` (3 variantes) | 12,6 GB | ⚠️ **decida antes**: registrado como candidato principal para vozes futuras |
| `hf/hub/chatterbox` | 3,0 GB | abandonado |
| `hf/hub/F5-TTS-pt-br` | 1,3 GB | abandonado |
| `hf/hub/Kokoro-82M` | 316 MB | era o plano do spec de 2026-09-01, substituído |
| `hf/hub/vocos-mel-24khz` | 52 MB | dependência do F5 |
| `hf/whisper` | 461 MB | não é usado pelo alinhamento |
| `xtts-home` | 1,7 GB | experimento XTTS |
| `amostras` | 427 MB | amostras de teste de voz |
| `librivox` | 104 MB | referências de leitura |

Tudo aqui é rebaixável do HuggingFace. O custo de apagar é tempo de download,
não perda de material.

## Resumo

| | recuperável | gatilho |
|---|---|---|
| R2, prefixo aposentado | 6,3 GB | prefixo novo conferido e no ar |
| disco, renders abandonados | 3,8 GB | agora |
| disco, modelos exceto Qwen3-TTS | 7,4 GB | agora |
| disco, Qwen3-TTS | 12,6 GB | quando decidir a voz das próximas |
