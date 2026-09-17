#!/usr/bin/env python3
"""
Alinhamento forçado palavra a palavra para o acervo bíblico usando torchaudio MMS_FA.
Gera o campo `palavras: [{ t, i, d }]` em cada unidade do manifest.json,
honrando rigorosamente o contrato de realce do leitor (src/lib/alinhar-narracao.ts).

Uso:
  /Volumes/SSD\ 2TB\ SD/dev/tts-spike/.venv/bin/python scripts/alinhar-corpus.py 1600..1619
  /Volumes/SSD\ 2TB\ SD/dev/tts-spike/.venv/bin/python scripts/alinhar-corpus.py 1600
  /Volumes/SSD\ 2TB\ SD/dev/tts-spike/.venv/bin/python scripts/alinhar-corpus.py tudo
"""

import gc
import json
import os
import re
import resource
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

import numpy as np
import torch
import torchaudio

# Trava rigorosa de uso de CPU e memória:
torch.set_num_threads(2)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CORPUS = ROOT / "amostras" / "corpus-algenib-v3"
SR_ALVO = 16000

UNIDADES_NUM = [
    "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
    "dezoito", "dezenove"
]
DEZENAS = [
    "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
    "oitenta", "noventa"
]
CENTENAS = [
    "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
    "setecentos", "oitocentos", "novecentos"
]


def numero_extenso(n: int) -> list[str]:
    if n == 100:
        return ["cem"]
    palavras = []
    if n >= 100:
        palavras.append(CENTENAS[n // 100])
        n %= 100
        if n:
            palavras.append("e")
    if n >= 20:
        palavras.append(DEZENAS[n // 10])
        n %= 10
        if n:
            palavras.extend(["e", UNIDADES_NUM[n]])
    elif n or not palavras:
        palavras.append(UNIDADES_NUM[n])
    return palavras


def sem_acentos(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")


def palavras_alinhaveis(token: str, dicionario: dict) -> list[str]:
    saida = []
    for parte in re.findall(r"\d+|[^\W\d_]+", token, re.UNICODE):
        if parte.isdigit():
            saida.extend(numero_extenso(int(parte)) if int(parte) <= 999 else ["número"])
        else:
            limpa = "".join(c for c in sem_acentos(parte.lower()) if c in dicionario)
            if limpa:
                saida.append(limpa)
    return [p for p in ("".join(c for c in sem_acentos(w.lower()) if c in dicionario) for w in saida) if p]


print("Inicializando modelo Meta MMS_FA (Torchaudio)...")
bundle = torchaudio.pipelines.MMS_FA
modelo = bundle.get_model(with_star=False).to("cpu").eval()
DIC = bundle.get_dict(star=None)


def alinha_unidade(raw_file: Path, texto: str, offset: float) -> list[dict]:
    tokens_ui = texto.split(" ")
    grupos = [palavras_alinhaveis(t, DIC) for t in tokens_ui]
    plano = [w for g in grupos for w in g]

    if not plano:
        return [{"t": t, "i": round(offset, 3), "d": 0.0} for t in tokens_ui]

    if not raw_file.exists():
        raise FileNotFoundError(f"Arquivo de unidade raw não encontrado: {raw_file}")

    # Converte raw PCM s16le 24kHz mono para f32le 16kHz mono em memória
    raw = subprocess.run(
        [
            "ffmpeg", "-v", "error",
            "-f", "s16le", "-ar", "24000", "-ac", "1",
            "-i", str(raw_file),
            "-f", "f32le", "-ac", "1", "-ar", str(SR_ALVO), "-"
        ],
        capture_output=True,
        check=True
    ).stdout

    onda = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).copy()).unsqueeze(0)
    with torch.inference_mode():
        emissao, _ = modelo(onda)

    alvo = torch.tensor([[DIC[c] for w in plano for c in w]], dtype=torch.int32)

    try:
        alin, pont = torchaudio.functional.forced_align(emissao, alvo, blank=0)
        spans = torchaudio.functional.merge_tokens(alin[0], pont[0].exp())
        seg_por_frame = onda.size(1) / emissao.size(1) / SR_ALVO

        por_palavra = []
        cursor = 0
        for w in plano:
            fatia = spans[cursor:cursor + len(w)]
            por_palavra.append((fatia[0].start * seg_por_frame, fatia[-1].end * seg_por_frame))
            cursor += len(w)

        saida = []
        cursor = 0
        fim_ant = 0.0
        for t, g in zip(tokens_ui, grupos):
            if g:
                ini = por_palavra[cursor][0]
                fim = por_palavra[cursor + len(g) - 1][1]
                cursor += len(g)
                fim_ant = fim
            else:
                ini = fim = fim_ant
            saida.append({"t": t, "i": round(offset + ini, 3), "d": round(fim - ini, 3)})

        return saida
    except Exception as e:
        dur_total = onda.size(1) / SR_ALVO
        passo = dur_total / len(tokens_ui)
        return [
            {"t": t, "i": round(offset + k * passo, 3), "d": round(passo, 3)}
            for k, t in enumerate(tokens_ui)
        ]
    finally:
        del onda, emissao, alvo
        gc.collect()


def check_memory_pressure() -> int:
    try:
        res = subprocess.run(
            ["sysctl", "-n", "kern.memorystatus_vm_pressure_level"],
            capture_output=True,
            text=True,
            check=True,
        )
        return int(res.stdout.strip())
    except Exception:
        return 1


def processar_pericope(pericope_dir: Path, force: bool = False) -> bool:
    manifest_path = pericope_dir / "manifest.json"
    if not manifest_path.exists():
        return False

    pressure = check_memory_pressure()
    if pressure >= 4:
        print(f"🛑 [CRÍTICO] Pressão de memória do macOS no nível {pressure} (Vermelho)! Abortando para proteger o sistema.")
        sys.exit(2)
    elif pressure == 2:
        print(f"⚠️ [AVISO] Pressão de memória no nível {pressure} (Amarelo). Pausando 4s e liberando memória...")
        gc.collect()
        time.sleep(4)

    manifest = json.loads(manifest_path.read_text("utf8"))
    unidades = manifest.get("unidades", [])
    if not unidades:
        return False

    if not force and "palavras" in unidades[0]:
        print(f"  ⏩ [{pericope_dir.name}] Já alinhada anteriormente. Pulando.")
        return True

    t0 = time.time()
    total_palavras = 0
    for u in unidades:
        raw_file = pericope_dir / "unidades" / f"u{u['i']:02d}.raw"
        palavras = alinha_unidade(raw_file, u["texto"], u["inicio"])
        u["palavras"] = palavras
        total_palavras += len(palavras)

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf8")
    dur_proc = time.time() - t0
    gc.collect()
    rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 * 1024)
    print(f"  ✨ [{pericope_dir.name}] {total_palavras} palavras alinhadas em {dur_proc:.1f}s (RAM: {rss_mb:.0f} MB)")
    time.sleep(0.5)  # pausa suave para despressurizar memória
    return True


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "1600..1619"
    corpus_dir = Path(os.environ.get("CORPUS_DIR", DEFAULT_CORPUS))

    if not corpus_dir.exists():
        print(f"Erro: diretório de corpus não encontrado: {corpus_dir}")
        sys.exit(1)

    ordens = []
    if ".." in arg:
        ini, fim = [int(v) for v in arg.split("..")]
        ordens = list(range(ini, fim + 1))
    elif arg == "tudo":
        ordens = [int(d.name) for d in corpus_dir.iterdir() if d.is_dir() and d.name.isdigit()]
        ordens.sort()
    else:
        ordens = [int(arg)]

    print(f"=== INICIANDO ALINHAMENTO FORÇADO MMS_FA ({len(ordens)} perícopes) ===")
    print(f"Corpus: {corpus_dir}\n")

    sucesso = 0
    for ordem in ordens:
        p_dir = corpus_dir / f"{ordem:04d}"
        if not p_dir.exists():
            print(f"  ⚠️ [{ordem:04d}] Pasta não encontrada. Gere o áudio primeiro.")
            continue
        if processar_pericope(p_dir):
            sucesso += 1

    print(f"\nConcluído: {sucesso}/{len(ordens)} perícopes alinhadas com sucesso.")


if __name__ == "__main__":
    main()
