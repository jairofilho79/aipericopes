# Batch de Geração TTS (Dorabella/Cláudio) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar as 2.647 perícopes narradas nas duas vozes oficiais no Mac mini (4 esteiras paralelas) e subir ao R2 em paralelo, com estado retomável.

**Architecture:** Um exportador TS reusa a segmentação do app para emitir `unidades.json` (ids idênticos aos `data-verse-id`). Workers Python (Kokoro-82M) sintetizam por seção, gravam master FLAC + AAC 48k + manifesto de offsets, e um uploader paralelo sobe cada perícope pronta via wrangler (OAuth já autenticado).

**Tech Stack:** TypeScript (tsx, vitest), Python 3.12 (uv, kokoro==0.9.4, soundfile, pytest), ffmpeg, wrangler r2.

**Spec:** `docs/superpowers/specs/2026-09-01-tts-batch-vozes-design.md`

## Global Constraints

- Receitas EXATAS: Dorabella `0.5·pf_dora + 0.5·bf_isabella`; Cláudio `0.7·pm_santa + 0.3·bm_george`.
- `kokoro==0.9.4`, modelo `hexgrad/Kokoro-82M`, `lang_code="p"`, 24 kHz mono.
- Publicação: AAC-LC mono 48 kbps `.m4a` com `-movflags +faststart`; master FLAC local.
- Chaves R2: `v1/{claudio|dorabella}/{ordem}/{secao}.{m4a,json}`, bucket `pericopes-audio`.
- Normalização: `SENHOR`→`Senhor`; números como dígitos; "Capítulo N" NUNCA vira utterance isolada (emenda no versículo seguinte); números de versículo não são lidos.
- Seções (nesta ordem): `abertura`, `contexto`, `texto`, `resenha`, `reflexao`; cabeçalhos falados "Contexto.", "Texto Bíblico.", "Resenha.", "Reflexões." como unidade `id: null`; seção sem conteúdo → sem arquivo.
- Pausa entre unidades: 0,4 s. Ids de prosa: `contexto-0`, `resenha-1`, `reflexao-2`…; ids de versículo: `"1:1"` (formato de `parseTextoNaa`).
- Dados grandes ficam FORA do repo em `/Volumes/SSD 2TB SD/dev/tts-audio/` (`unidades.json`, `masters/`, `saida/`, `estado/`, `logs/`); pode ser sobrescrito por env `TTS_AUDIO_DIR`.
- Cada worker Python: `torch.set_num_threads(2)`.
- Commits frequentes; mensagens em pt-BR com os trailers padrão da sessão.

---

### Task 1: Unidades de fala no lib do app (`tts-fala.ts`)

**Files:**
- Create: `src/lib/tts-fala.ts`
- Test: `src/lib/tts-fala.test.ts`

**Interfaces:**
- Consumes: `paragraphize(texto, {maxParas})` de `src/lib/paragraphize.ts`; `parseTextoNaa(raw)` de `src/lib/parse-texto.ts`; tipo `Pericope` de `src/lib/types.ts`.
- Produces: `type UnidadeFala = { id: string | null; texto: string }`; `type SecoesFala = { abertura: UnidadeFala[]; contexto: UnidadeFala[]; texto: UnidadeFala[]; resenha: UnidadeFala[]; reflexao: UnidadeFala[] }`; `normalizaFala(t: string): string`; `referenciaFalada(p: Pericope): string`; `unidadesDeFala(p: Pericope): SecoesFala`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/tts-fala.test.ts
import { describe, expect, it } from 'vitest'
import { normalizaFala, referenciaFalada, unidadesDeFala } from './tts-fala'
import type { Pericope } from './types'

function pericope(extra: Partial<Pericope> = {}): Pericope {
  return {
    ordem: 0,
    livro: 'Mateus',
    abbrev: 'Mt',
    capitulo_inicio: 1,
    versiculo_inicio: 1,
    capitulo_fim: 1,
    versiculo_fim: 17,
    titulo_pericope_pt: 'A genealogia de Jesus',
    texto: 'Capítulo 1\n1 Livro da geração de Jesus Cristo.\n2 Abraão gerou a Isaque.',
    contexto_historico_literario: 'Parágrafo um do contexto.',
    resenha: 'Parágrafo um da resenha.',
    perguntas_reflexao: ['Primeira pergunta?', 'Segunda pergunta?'],
    topicos_pregar: [],
    ...extra,
  } as Pericope
}

describe('normalizaFala', () => {
  it('troca SENHOR por Senhor e colapsa espaços', () => {
    expect(normalizaFala('o  SENHOR\né bom')).toBe('o Senhor é bom')
  })
})

describe('referenciaFalada', () => {
  it('mesmo capítulo', () => {
    expect(referenciaFalada(pericope())).toBe('Mateus, capítulo 1, versículos 1 a 17.')
  })
  it('versículo único', () => {
    expect(referenciaFalada(pericope({ versiculo_fim: 1 }))).toBe('Mateus, capítulo 1, versículo 1.')
  })
  it('atravessando capítulos', () => {
    expect(referenciaFalada(pericope({ capitulo_fim: 2, versiculo_fim: 5 }))).toBe(
      'Mateus, capítulo 1, versículo 1, a capítulo 2, versículo 5.',
    )
  })
})

describe('unidadesDeFala', () => {
  it('abertura tem título com ponto e a referência', () => {
    const s = unidadesDeFala(pericope())
    expect(s.abertura).toEqual([
      { id: null, texto: 'A genealogia de Jesus.' },
      { id: null, texto: 'Mateus, capítulo 1, versículos 1 a 17.' },
    ])
  })
  it('capítulo emenda no primeiro versículo e nunca fica sozinho', () => {
    const s = unidadesDeFala(pericope())
    expect(s.texto[0]).toEqual({ id: null, texto: 'Texto Bíblico.' })
    expect(s.texto[1]).toEqual({ id: '1:1', texto: 'Capítulo 1. Livro da geração de Jesus Cristo.' })
    expect(s.texto[2]).toEqual({ id: '1:2', texto: 'Abraão gerou a Isaque.' })
  })
  it('prosa ganha cabeçalho falado e ids do app', () => {
    const s = unidadesDeFala(pericope())
    expect(s.contexto[0]).toEqual({ id: null, texto: 'Contexto.' })
    expect(s.contexto[1].id).toBe('contexto-0')
    expect(s.resenha[0]).toEqual({ id: null, texto: 'Resenha.' })
    expect(s.reflexao.map((u) => u.id)).toEqual([null, 'reflexao-0', 'reflexao-1'])
  })
  it('seção vazia não ganha cabeçalho sozinho', () => {
    const s = unidadesDeFala(pericope({ perguntas_reflexao: [] }))
    expect(s.reflexao).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/tts-fala.test.ts`
Expected: FAIL — módulo `./tts-fala` não existe.

- [ ] **Step 3: Implementação mínima**

```ts
// src/lib/tts-fala.ts
import { paragraphize } from './paragraphize'
import { parseTextoNaa } from './parse-texto'
import type { Pericope } from './types'

export type UnidadeFala = { id: string | null; texto: string }

export type SecoesFala = {
  abertura: UnidadeFala[]
  contexto: UnidadeFala[]
  texto: UnidadeFala[]
  resenha: UnidadeFala[]
  reflexao: UnidadeFala[]
}

/** "SENHOR" soletra na síntese; espaços/quebras viram um espaço só. */
export function normalizaFala(t: string): string {
  return t.replaceAll('SENHOR', 'Senhor').replace(/\s+/g, ' ').trim()
}

export function referenciaFalada(p: Pericope): string {
  const ci = p.capitulo_inicio
  const vi = p.versiculo_inicio
  const cf = p.capitulo_fim
  const vf = p.versiculo_fim
  if (ci !== cf) return `${p.livro}, capítulo ${ci}, versículo ${vi}, a capítulo ${cf}, versículo ${vf}.`
  if (vi === vf) return `${p.livro}, capítulo ${ci}, versículo ${vi}.`
  return `${p.livro}, capítulo ${ci}, versículos ${vi} a ${vf}.`
}

const comCabecalho = (cabecalho: string, unidades: UnidadeFala[]): UnidadeFala[] =>
  unidades.length ? [{ id: null, texto: cabecalho }, ...unidades] : []

/**
 * As unidades faladas de cada seção, na ordem e com os MESMOS ids que a
 * página usa em data-verse-id — o realce sincroniza por construção.
 * "Capítulo N" nunca vira utterance isolada (frases curtas isoladas saem
 * deformadas da síntese): emenda no versículo seguinte.
 */
export function unidadesDeFala(p: Pericope): SecoesFala {
  const prosa = (prefixo: string, textos: string[]): UnidadeFala[] =>
    textos
      .map((t, i) => ({ id: `${prefixo}-${i}`, texto: normalizaFala(t) }))
      .filter((u) => u.texto)

  const versos: UnidadeFala[] = []
  let capitulo = ''
  for (const b of parseTextoNaa(p.texto_naa)) {
    if (b.kind === 'chapter') {
      capitulo = `${b.label}. `
      continue
    }
    const texto = normalizaFala(capitulo + b.text)
    if (texto) {
      versos.push({ id: b.id, texto })
      capitulo = ''
    }
  }

  const titulo = p.titulo_pericope_pt.trim().replace(/\.+$/, '') + '.'
  return {
    abertura: [
      { id: null, texto: titulo },
      { id: null, texto: referenciaFalada(p) },
    ],
    contexto: comCabecalho(
      'Contexto.',
      prosa('contexto', paragraphize(p.contexto_historico_literario, { maxParas: 2 })),
    ),
    texto: comCabecalho('Texto Bíblico.', versos),
    resenha: comCabecalho('Resenha.', prosa('resenha', paragraphize(p.resenha, { maxParas: 3 }))),
    reflexao: comCabecalho('Reflexões.', prosa('reflexao', p.perguntas_reflexao ?? [])),
  }
}
```

- [ ] **Step 4: Rodar e ver passar (e a suíte toda)**

Run: `npx vitest run src/lib/tts-fala.test.ts && npm test`
Expected: PASS; suíte completa verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tts-fala.ts src/lib/tts-fala.test.ts
git commit -m "feat: unidades de fala por seção com ids do app (tts-fala)"
```

---

### Task 2: Exportador `unidades.json`

**Files:**
- Create: `scripts/exporta-unidades.ts`
- Modify: `package.json` (novo script `"tts:unidades": "tsx scripts/exporta-unidades.ts"`)

**Interfaces:**
- Consumes: `unidadesDeFala`, `SecoesFala` (Task 1); `testamentOf` de `src/lib/testament.ts` (retorna `'vt' | 'nt'`).
- Produces: arquivo `${TTS_AUDIO_DIR}/unidades.json` com o formato:
  `{ versao: 'v1', pericopes: [{ ordem: number, testamento: 'vt'|'nt', secoes: { [secao]: { hash: string, unidades: UnidadeFala[] } } }] }`
  — `hash` = sha256 hex dos textos das unidades unidos por `\n`. Seções vazias são omitidas do objeto `secoes`.

- [ ] **Step 1: Escrever o script**

```ts
// scripts/exporta-unidades.ts
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { unidadesDeFala, type UnidadeFala } from '../src/lib/tts-fala'
import { testamentOf } from '../src/lib/testament'
import type { Pericope } from '../src/lib/types'

const BASE = process.env.TTS_AUDIO_DIR ?? '/Volumes/SSD 2TB SD/dev/tts-audio'
const SECOES = ['abertura', 'contexto', 'texto', 'resenha', 'reflexao'] as const

const bruto = JSON.parse(readFileSync('public/data/pericopes.json', 'utf8'))
const pericopes: Pericope[] = Array.isArray(bruto) ? bruto : Object.values(bruto)

const hashDe = (unidades: UnidadeFala[]) =>
  createHash('sha256').update(unidades.map((u) => u.texto).join('\n')).digest('hex')

let unidadesTotal = 0
const saida = pericopes.map((p) => {
  const todas = unidadesDeFala(p)
  const secoes: Record<string, { hash: string; unidades: UnidadeFala[] }> = {}
  for (const s of SECOES) {
    if (todas[s].length) {
      secoes[s] = { hash: hashDe(todas[s]), unidades: todas[s] }
      unidadesTotal += todas[s].length
    }
  }
  return { ordem: p.ordem, testamento: testamentOf(p), secoes }
})

mkdirSync(BASE, { recursive: true })
writeFileSync(join(BASE, 'unidades.json'), JSON.stringify({ versao: 'v1', pericopes: saida }))
const vt = saida.filter((p) => p.testamento === 'vt').length
console.log(`perícopes: ${saida.length} (vt ${vt}, nt ${saida.length - vt}); unidades: ${unidadesTotal}`)
```

- [ ] **Step 2: Registrar o npm script**

Em `package.json`, dentro de `"scripts"`, adicionar: `"tts:unidades": "tsx scripts/exporta-unidades.ts"`.

- [ ] **Step 3: Rodar e conferir**

Run: `npm run tts:unidades`
Expected: `perícopes: 2647 (vt 1600, nt 1047); unidades: <n>` e arquivo criado em `/Volumes/SSD 2TB SD/dev/tts-audio/unidades.json`. Conferir amostra: `node -e "const j=require('/Volumes/SSD 2TB SD/dev/tts-audio/unidades.json'); const p=j.pericopes.find(x=>x.ordem===1600); console.log(JSON.stringify(p.secoes.abertura,null,1), p.secoes.texto.unidades[1])"` — abertura com título+referência de Mateus, e `texto.unidades[1]` começando com `"Capítulo 1. "` e id `"1:1"`.

- [ ] **Step 4: Lint + commit**

```bash
npm run lint
git add scripts/exporta-unidades.ts package.json
git commit -m "feat: exportador de unidades de fala para o batch de TTS"
```

---

### Task 3: Núcleo Python — síntese com offsets, QC e estado retomável

**Files:**
- Create: `tools/tts-batch/requirements.txt`, `tools/tts-batch/vozes.py`, `tools/tts-batch/nucleo.py`, `tools/tts-batch/estado.py`, `tools/tts-batch/tests/test_nucleo.py`, `tools/tts-batch/tests/test_estado.py`
- Modify: `.gitignore` (adicionar `tools/tts-batch/.venv/` e `__pycache__/`)

**Interfaces:**
- Produces (para a Task 4):
  - `vozes.RECEITAS: dict[str, list[tuple[str, float]]]` — `{"claudio": [("pm_santa", 0.7), ("bm_george", 0.3)], "dorabella": [("pf_dora", 0.5), ("bf_isabella", 0.5)]}`
  - `nucleo.SR = 24000`, `nucleo.PAUSA_S = 0.4`
  - `nucleo.qc_ok(texto: str, dur_s: float) -> bool`
  - `nucleo.sintetizar_secao(sintetiza, unidades) -> tuple[np.ndarray, list[dict]]` — `sintetiza(texto)->np.ndarray float32 24kHz`; `unidades` = lista `{"id": str|None, "texto": str}`; retorna áudio da seção e manifesto `[{"id", "inicio", "dur", "ok"}]` (re-sintetiza 1x quando `qc_ok` falha; `ok=False` se persistir)
  - `nucleo.codificar(wav: Path, m4a: Path, flac: Path) -> None` — ffmpeg AAC 48k `+faststart` e FLAC
  - `estado.carregar(caminho: Path) -> dict` — `{"concluidas": list[int], "falhas": dict}`
  - `estado.salvar(caminho: Path, dados: dict) -> None` — escrita atômica (tmp + `os.replace`)

- [ ] **Step 1: Criar venv e requirements**

```bash
mkdir -p tools/tts-batch/tests
printf 'kokoro==0.9.4\nsoundfile\nnumpy\npytest\n' > tools/tts-batch/requirements.txt
cd tools/tts-batch && ~/.local/bin/uv venv --python 3.12 .venv && VIRTUAL_ENV=.venv ~/.local/bin/uv pip install -r requirements.txt
```

Adicionar ao `.gitignore` da raiz: `tools/tts-batch/.venv/` e `__pycache__/`.

- [ ] **Step 2: Escrever os testes que falham**

```python
# tools/tts-batch/tests/test_nucleo.py
import numpy as np
import nucleo


def fala_boa(texto):  # ~17 cps: dentro da faixa de QC
    return np.zeros(int(len(texto) / 17 * nucleo.SR), np.float32)


def test_offsets_com_pausa_entre_unidades():
    unidades = [{"id": None, "texto": "Contexto."}, {"id": "contexto-0", "texto": "a" * 170}]
    audio, mani = nucleo.sintetizar_secao(fala_boa, unidades)
    assert mani[0]["inicio"] == 0.0
    assert mani[1]["inicio"] == round(mani[0]["dur"] + nucleo.PAUSA_S, 3)
    assert mani[1]["id"] == "contexto-0"
    assert mani[1]["dur"] == 10.0
    esperado = int((mani[0]["dur"] + nucleo.PAUSA_S + 10.0) * nucleo.SR)
    assert abs(len(audio) - esperado) <= 2


def test_qc_reprova_fala_truncada_e_retenta():
    chamadas = {"n": 0}

    def fala_truncada(texto):
        chamadas["n"] += 1
        return np.zeros(int(0.1 * nucleo.SR), np.float32)  # 170 chars em 0,1s: truncado

    _, mani = nucleo.sintetizar_secao(fala_truncada, [{"id": "1:1", "texto": "a" * 170}])
    assert chamadas["n"] == 2  # re-tentou uma vez
    assert mani[0]["ok"] is False


def test_qc_ok_faixa():
    assert nucleo.qc_ok("a" * 170, 10.0) is True      # 17 cps
    assert nucleo.qc_ok("a" * 170, 0.5) is False      # 340 cps: truncado
    assert nucleo.qc_ok("a" * 170, 60.0) is False     # 2,8 cps: disparado
    assert nucleo.qc_ok("Amém.", 2.0) is True         # texto curto: leniente
```

```python
# tools/tts-batch/tests/test_estado.py
import estado


def test_roundtrip_e_default(tmp_path):
    caminho = tmp_path / "fila.json"
    dados = estado.carregar(caminho)
    assert dados == {"concluidas": [], "falhas": {}}
    dados["concluidas"].append(42)
    dados["falhas"]["7"] = ["texto:1:3"]
    estado.salvar(caminho, dados)
    assert estado.carregar(caminho) == {"concluidas": [42], "falhas": {"7": ["texto:1:3"]}}
    assert not list(tmp_path.glob("*.tmp"))  # escrita atômica não deixa lixo
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd tools/tts-batch && .venv/bin/python -m pytest tests/ -q`
Expected: FAIL — módulos `nucleo`/`estado` não existem. (pytest roda da pasta `tools/tts-batch`, então os módulos importam direto.)

- [ ] **Step 4: Implementar**

```python
# tools/tts-batch/vozes.py
"""Receitas OFICIAIS, aprovadas por audição em 2026-09-01. Mudou? É v2."""
RECEITAS: dict[str, list[tuple[str, float]]] = {
    "claudio": [("pm_santa", 0.7), ("bm_george", 0.3)],
    "dorabella": [("pf_dora", 0.5), ("bf_isabella", 0.5)],
}
```

```python
# tools/tts-batch/nucleo.py
"""Síntese de uma seção com manifesto de offsets, QC e codificação."""
import subprocess
from pathlib import Path

import numpy as np

SR = 24000
PAUSA_S = 0.4
# Fala pt-BR fica na casa de 10-20 chars/s; fora de 4-40 é truncagem ou disparo.
CPS_MIN, CPS_MAX = 4.0, 40.0
QC_MIN_CHARS = 20


def qc_ok(texto: str, dur_s: float) -> bool:
    if len(texto) < QC_MIN_CHARS:
        return dur_s > 0
    cps = len(texto) / max(dur_s, 1e-6)
    return CPS_MIN <= cps <= CPS_MAX


def sintetizar_secao(sintetiza, unidades):
    partes: list[np.ndarray] = []
    manifesto: list[dict] = []
    pausa = np.zeros(int(PAUSA_S * SR), np.float32)
    pos = 0.0
    for i, u in enumerate(unidades):
        if i:
            partes.append(pausa)
            pos += PAUSA_S
        audio = sintetiza(u["texto"])
        if not qc_ok(u["texto"], len(audio) / SR):
            audio = sintetiza(u["texto"])  # uma re-tentativa basta na prática
        dur = len(audio) / SR
        manifesto.append(
            {"id": u["id"], "inicio": round(pos, 3), "dur": round(dur, 3), "ok": qc_ok(u["texto"], dur)}
        )
        partes.append(audio)
        pos += dur
    total = np.concatenate(partes) if partes else np.zeros(0, np.float32)
    return total, manifesto


def codificar(wav: Path, m4a: Path, flac: Path) -> None:
    base = ["ffmpeg", "-y", "-v", "error", "-i", str(wav)]
    subprocess.run([*base, str(flac)], check=True)
    subprocess.run([*base, "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", str(m4a)], check=True)
```

```python
# tools/tts-batch/estado.py
"""Checkpoint por fila: sobrevive a Ctrl-C e queda de energia."""
import json
import os
from pathlib import Path


def carregar(caminho: Path) -> dict:
    if not caminho.exists():
        return {"concluidas": [], "falhas": {}}
    return json.loads(caminho.read_text())


def salvar(caminho: Path, dados: dict) -> None:
    tmp = caminho.with_suffix(caminho.suffix + ".tmp")
    tmp.write_text(json.dumps(dados))
    os.replace(tmp, caminho)
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd tools/tts-batch && .venv/bin/python -m pytest tests/ -q`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add tools/tts-batch/requirements.txt tools/tts-batch/vozes.py tools/tts-batch/nucleo.py tools/tts-batch/estado.py tools/tts-batch/tests/ .gitignore
git commit -m "feat: núcleo do batch de TTS — síntese com offsets, QC e estado"
```

---

### Task 4: Worker de esteira (`gerar.py`)

**Files:**
- Create: `tools/tts-batch/gerar.py`

**Interfaces:**
- Consumes: `vozes.RECEITAS`, `nucleo.sintetizar_secao/codificar/SR`, `estado.carregar/salvar` (Task 3); `${TTS_AUDIO_DIR}/unidades.json` (Task 2).
- Produces (layout em disco que a Task 5 consome):
  - `${TTS_AUDIO_DIR}/saida/{voz}/{ordem}/{secao}.m4a` e `{secao}.json` (manifesto `{"hash": str, "unidades": [{"id","inicio","dur"}]}` — campo `ok` não vai ao manifesto publicado; falhas vão ao estado)
  - `${TTS_AUDIO_DIR}/masters/{voz}/{ordem}/{secao}.flac`
  - `${TTS_AUDIO_DIR}/saida/{voz}/{ordem}/.done` (marcador gravado por ÚLTIMO)
  - `${TTS_AUDIO_DIR}/estado/{fila}.json`
- CLI: `gerar.py --fila {vt|nt}-{claudio|dorabella} [--limit N]`

- [ ] **Step 1: Escrever o worker**

```python
# tools/tts-batch/gerar.py
"""Uma esteira: sintetiza as perícopes de um testamento numa voz. Retomável."""
import argparse
import json
import os
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

import estado
import nucleo
from vozes import RECEITAS

BASE = Path(os.environ.get("TTS_AUDIO_DIR", "/Volumes/SSD 2TB SD/dev/tts-audio"))
SECOES = ["abertura", "contexto", "texto", "resenha", "reflexao"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fila", required=True, choices=[f"{t}-{v}" for t in ("vt", "nt") for v in RECEITAS])
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    testamento, voz = args.fila.split("-")

    torch.set_num_threads(2)
    from kokoro import KPipeline  # import tardio: caro

    pipe = KPipeline(lang_code="p")
    embedding = sum(peso * pipe.load_voice(nome) for nome, peso in RECEITAS[voz])

    def sintetiza(texto: str) -> np.ndarray:
        return np.concatenate([a for _, _, a in pipe(texto, voice=embedding)])

    todas = json.loads((BASE / "unidades.json").read_text())["pericopes"]
    fila = [p for p in todas if p["testamento"] == testamento]
    caminho_estado = BASE / "estado" / f"{args.fila}.json"
    caminho_estado.parent.mkdir(parents=True, exist_ok=True)
    st = estado.carregar(caminho_estado)
    feitas = set(st["concluidas"])
    pendentes = [p for p in fila if p["ordem"] not in feitas]
    if args.limit:
        pendentes = pendentes[: args.limit]
    print(f"[{args.fila}] {len(pendentes)} pendentes de {len(fila)}", flush=True)

    inicio_lote = time.time()
    for n, p in enumerate(pendentes, 1):
        ordem = p["ordem"]
        saida = BASE / "saida" / voz / str(ordem)
        masters = BASE / "masters" / voz / str(ordem)
        saida.mkdir(parents=True, exist_ok=True)
        masters.mkdir(parents=True, exist_ok=True)
        falhas_pericope: list[str] = []
        for secao in SECOES:
            info = p["secoes"].get(secao)
            if not info:
                continue
            audio, manifesto = nucleo.sintetizar_secao(sintetiza, info["unidades"])
            falhas_pericope += [f"{secao}:{u['id']}" for u in manifesto if not u["ok"]]
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                wav = Path(tmp.name)
            sf.write(wav, audio, nucleo.SR)
            nucleo.codificar(wav, saida / f"{secao}.m4a", masters / f"{secao}.flac")
            wav.unlink()
            publicado = {"hash": info["hash"], "unidades": [
                {"id": u["id"], "inicio": u["inicio"], "dur": u["dur"]} for u in manifesto
            ]}
            (saida / f"{secao}.json").write_text(json.dumps(publicado))
        (saida / ".done").touch()
        st["concluidas"].append(ordem)
        if falhas_pericope:
            st["falhas"][str(ordem)] = falhas_pericope
        estado.salvar(caminho_estado, st)
        ritmo = (time.time() - inicio_lote) / n
        print(f"[{args.fila}] {n}/{len(pendentes)} ordem={ordem} "
              f"({ritmo:.1f}s/perícope, resta ~{ritmo * (len(pendentes) - n) / 3600:.1f}h)", flush=True)
    print(f"[{args.fila}] fila concluída", flush=True)


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Rodar 1 perícope de verdade e conferir**

Run: `cd tools/tts-batch && HF_HOME="/Volumes/SSD 2TB SD/dev/tts-spike/hf" .venv/bin/python gerar.py --fila nt-claudio --limit 1`
Expected: log com `1/1 ordem=1600`; conferir:
- `ls "/Volumes/SSD 2TB SD/dev/tts-audio/saida/claudio/1600/"` → `abertura.m4a abertura.json contexto.m4a … .done`
- `ffprobe -v error -show_entries format=duration -of csv=p=0 ".../saida/claudio/1600/texto.m4a"` → duração > 60 s
- manifesto: `python3 -c "import json; m=json.load(open('/Volumes/SSD 2TB SD/dev/tts-audio/saida/claudio/1600/texto.json')); print(m['unidades'][:3])"` → primeiro item `id: null` (cabeçalho), segundo `id: '1:1'` com `inicio` ≈ dur do cabeçalho + 0,4
- rodar de novo o mesmo comando → `0 pendentes` (estado retomável funciona).
- Abrir o m4a (`open .../texto.m4a`) e OUVIR: cabeçalho "Texto Bíblico.", capítulo emendado, voz Cláudio.

- [ ] **Step 3: Commit**

```bash
git add tools/tts-batch/gerar.py
git commit -m "feat: worker de esteira do batch de TTS (gerar.py)"
```

---

### Task 5: Uploader paralelo (`subir.py`) + bucket

**Files:**
- Create: `tools/tts-batch/subir.py`

**Interfaces:**
- Consumes: layout `saida/{voz}/{ordem}/` com `.done` (Task 4); wrangler OAuth local (já autenticado).
- Produces: objetos `v1/{voz}/{ordem}/{secao}.{m4a,json}` no bucket `pericopes-audio`; marcador local `saida/{voz}/{ordem}/.sent`.
- CLI: `subir.py [--once] [--dry-run]` — sem `--once`, roda em loop (30 s) até existir `${TTS_AUDIO_DIR}/estado/geracao-encerrada` E a fila esvaziar.

- [ ] **Step 1: Criar o bucket (uma vez)**

Run (na raiz do repo): `npx wrangler r2 bucket list | grep -q pericopes-audio || npx wrangler r2 bucket create pericopes-audio`
Expected: `Created bucket 'pericopes-audio'` (ou nada, se já existir).

- [ ] **Step 2: Escrever o uploader**

```python
# tools/tts-batch/subir.py
"""Sobe cada perícope pronta (.done sem .sent) ao R2 via wrangler. Paralelo."""
import argparse
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = Path(os.environ.get("TTS_AUDIO_DIR", "/Volumes/SSD 2TB SD/dev/tts-audio"))
REPO = Path(__file__).resolve().parents[2]
BUCKET = "pericopes-audio"
CONCORRENCIA = 4
TIPOS = {".m4a": "audio/mp4", ".json": "application/json"}


def pendentes() -> list[Path]:
    return sorted(
        d for d in BASE.glob("saida/*/*")
        if (d / ".done").exists() and not (d / ".sent").exists()
    )


def subir_pericope(pasta: Path, dry: bool) -> bool:
    voz, ordem = pasta.parent.name, pasta.name
    for arq in sorted(pasta.iterdir()):
        if arq.suffix not in TIPOS:
            continue
        chave = f"{BUCKET}/v1/{voz}/{ordem}/{arq.name}"
        cmd = ["npx", "wrangler", "r2", "object", "put", chave,
               "--file", str(arq), "--content-type", TIPOS[arq.suffix], "--remote"]
        if dry:
            print("dry-run:", chave, flush=True)
            continue
        for tentativa in range(3):
            r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
            if r.returncode == 0:
                break
            time.sleep(2 ** tentativa)
        else:
            print(f"FALHA {chave}: {r.stderr.strip()[-200:]}", flush=True)
            return False
    if not dry:
        (pasta / ".sent").touch()
    print(f"subiu {voz}/{ordem}", flush=True)
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    encerrada = BASE / "estado" / "geracao-encerrada"
    while True:
        fila = pendentes()
        if fila:
            with ThreadPoolExecutor(CONCORRENCIA) as pool:
                resultados = list(pool.map(lambda p: subir_pericope(p, args.dry_run), fila))
            if not all(resultados):
                print("houve falhas; tentará de novo no próximo ciclo", flush=True)
        if args.once or (encerrada.exists() and not pendentes()):
            return 0
        time.sleep(30)


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Testar dry-run e upload real da perícope da Task 4**

Run: `cd tools/tts-batch && .venv/bin/python subir.py --once --dry-run`
Expected: linhas `dry-run: pericopes-audio/v1/claudio/1600/…` (10 objetos), nenhum `.sent` criado.

Run: `.venv/bin/python subir.py --once`
Expected: `subiu claudio/1600`; conferir no R2: `cd ../.. && npx wrangler r2 object get pericopes-audio/v1/claudio/1600/abertura.json --pipe --remote | head -c 200` → JSON do manifesto. Rodar `subir.py --once` de novo → sem trabalho (marcador `.sent` respeitado).

- [ ] **Step 4: Commit**

```bash
git add tools/tts-batch/subir.py
git commit -m "feat: uploader paralelo do batch de TTS para o R2 (subir.py)"
```

---

### Task 6: Orquestrador (`rodar-tudo.sh`), smoke completo e disparo do batch

**Files:**
- Create: `tools/tts-batch/rodar-tudo.sh`

**Interfaces:**
- Consumes: `gerar.py --fila … [--limit N]` (Task 4), `subir.py` (Task 5).
- Produces: 4 esteiras + uploader rodando sob `caffeinate` com logs em `${TTS_AUDIO_DIR}/logs/`; sentinela `estado/geracao-encerrada` ao fim da geração.

- [ ] **Step 1: Escrever o orquestrador**

```bash
#!/bin/zsh
# Sobe as 4 esteiras + uploader. Uso: ./rodar-tudo.sh [limite-por-fila]
set -euo pipefail
cd "$(dirname "$0")"
BASE="${TTS_AUDIO_DIR:-/Volumes/SSD 2TB SD/dev/tts-audio}"
export HF_HOME="${HF_HOME:-/Volumes/SSD 2TB SD/dev/tts-spike/hf}"
mkdir -p "$BASE/logs" "$BASE/estado"
rm -f "$BASE/estado/geracao-encerrada"

LIMITE=()
[[ $# -ge 1 ]] && LIMITE=(--limit "$1")

pids=()
for fila in vt-claudio nt-claudio vt-dorabella nt-dorabella; do
  caffeinate -i .venv/bin/python gerar.py --fila "$fila" "${LIMITE[@]}" \
    >"$BASE/logs/$fila.log" 2>&1 &
  pids+=($!)
  echo "esteira $fila: pid $!"
done

caffeinate -i .venv/bin/python subir.py >"$BASE/logs/subir.log" 2>&1 &
UPLOADER=$!
echo "uploader: pid $UPLOADER"

falhou=0
for pid in "${pids[@]}"; do wait "$pid" || falhou=1; done
touch "$BASE/estado/geracao-encerrada"
wait "$UPLOADER" || falhou=1
[[ $falhou -eq 0 ]] && echo "BATCH COMPLETO" || echo "TERMINOU COM FALHAS (ver logs)"
exit $falhou
```

Run: `chmod +x tools/tts-batch/rodar-tudo.sh`

- [ ] **Step 2: Smoke de ponta a ponta (2 perícopes por fila)**

Run: `cd tools/tts-batch && ./rodar-tudo.sh 2`
Expected: termina em poucos minutos com `BATCH COMPLETO`; `grep -c subiu "/Volumes/SSD 2TB SD/dev/tts-audio/logs/subir.log"` ≥ 8 (2 por fila × 4, mais a perícope da Task 5 se pendente); logs das 4 esteiras com `fila concluída`… (com `--limit`, a fila "concluída" é só o lote limitado); estados em `estado/*.json` com 2 ordens cada.

- [ ] **Step 3: Validação humana (gate)**

Pedir ao usuário: ouvir 1 seção de cada voz baixando do R2 —
`npx wrangler r2 object get pericopes-audio/v1/dorabella/0/abertura.m4a --file /tmp/a.m4a --remote && open /tmp/a.m4a` (e o equivalente de `claudio`). Só seguir ao Step 4 com o OK explícito do usuário.

- [ ] **Step 4: Commit e disparo do batch completo**

```bash
git add tools/tts-batch/rodar-tudo.sh
git commit -m "feat: orquestrador das 4 esteiras + uploader do batch de TTS"
cd tools/tts-batch && nohup ./rodar-tudo.sh > "/Volumes/SSD 2TB SD/dev/tts-audio/logs/rodar-tudo.log" 2>&1 &
```

Expected: 4 esteiras + uploader no ar (`ps aux | grep gerar.py` mostra 4 processos). O `nohup` garante que o batch sobrevive ao fim da sessão. Acompanhar com `tail -f ".../logs/vt-claudio.log"`. Estimativa: ~17–24 h.

- [ ] **Step 5: Monitoramento e encerramento**

Checar periodicamente: `wc -l` dos `estado/*.json` (via `python3 -c "import json;print({f.split('/')[-1]: len(json.load(open(f))['concluidas']) for f in __import__('glob').glob('/Volumes/SSD 2TB SD/dev/tts-audio/estado/*.json')})"`), falhas de QC em `estado/*-falhas`, e espaço no R2 ao final (`npx wrangler r2 bucket info pericopes-audio`). Ao término: reportar total de perícopes, falhas de QC registradas e tamanho no bucket. Falhas de QC registradas não bloqueiam o batch — viram lista de re-síntese pontual.

---

## Self-review (executado na escrita do plano)

- **Cobertura da spec:** receitas (T3/vozes.py), narração+normalização (T1), manifesto/hash (T2/T4), AAC+FLAC (T3/codificar, T4), 4 esteiras retomáveis com QC e caffeinate (T4/T6), upload paralelo via wrangler com retry e dry-run (T5), bucket (T5). Fase 2 fora deste plano, como na spec.
- **Placeholders:** nenhum — todo step tem código ou comando concreto.
- **Consistência de tipos:** `UnidadeFala`/`SecoesFala` (T1) fluem para o JSON da T2 e para os dicts `{"id","texto"}` da T3/T4; `RECEITAS` (T3) consumida na T4; layout `saida/…/.done` (T4) consumido na T5; sentinela `geracao-encerrada` (T5) criada pela T6.
