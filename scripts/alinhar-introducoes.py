#!/usr/bin/env python3
"""
Alinhador de introduções de livros bíblicos palavra por palavra usando Meta MMS_FA (Torchaudio).
Enriquece data/introducoes/<slug>.json e public/data/introducoes/<slug>.json com:
  unidades[k].palavras = [{ t: string, i: number, d: number }]
"""

import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
import numpy as np
import torch
import torchaudio

torch.set_num_threads(2)

ROOT = Path(__file__).resolve().parent.parent
DATA_INTROS = ROOT / "data" / "introducoes"
PUBLIC_INTROS = ROOT / "public" / "data" / "introducoes"
CORPUS_DIR = ROOT / "amostras" / "corpus-introducoes"
SR_ALVO = 16000

UNIDADES_NUM = [
    "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
    "dezoito", "dezenove"
]
DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]

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

bundle = torchaudio.pipelines.MMS_FA
modelo = bundle.get_model(with_star=False).to("cpu").eval()
DIC = bundle.get_dict(star=None)

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

def alinha_unidade(raw_file: Path, texto: str, offset: float) -> list[dict]:
    tokens_ui = texto.split(" ")
    grupos = [palavras_alinhaveis(t, DIC) for t in tokens_ui]
    plano = [w for g in grupos for w in g]

    if not plano:
        return [{"t": t, "i": round(offset, 3), "d": 0.0} for t in tokens_ui]

    if not raw_file.exists():
        return [{"t": t, "i": round(offset, 3), "d": 0.0} for t in tokens_ui]

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
        alinhado, pontuacao = torchaudio.functional.forced_align(emissao, alvo, blank=0)
    except Exception as e:
        print(f"    ⚠️ Erro no forced_align: {e}")
        return [{"t": t, "i": round(offset, 3), "d": 0.0} for t in tokens_ui]

    spans = torchaudio.functional.merge_tokens(alinhado[0], pontuacao[0])
    comprimentos = [len(w) for w in plano]
    dur_quadro = onda.shape[1] / SR_ALVO / emissao.shape[1]

    idx_span = 0
    palavras_audio = []
    for c in comprimentos:
        sub = spans[idx_span : idx_span + c]
        if not sub:
            palavras_audio.append({"i": round(offset, 3), "d": 0.0})
            continue
        ini = round(offset + sub[0].start * dur_quadro, 3)
        fim = round(offset + sub[-1].end * dur_quadro, 3)
        dur = max(0.0, round(fim - ini, 3))
        palavras_audio.append({"i": ini, "d": dur})
        idx_span += c

    resultado = []
    idx_audio = 0
    ultimo_t = offset
    for t, g in zip(tokens_ui, grupos):
        if not g:
            resultado.append({"t": t, "i": round(ultimo_t, 3), "d": 0.0})
            continue
        sub_audio = palavras_audio[idx_audio : idx_audio + len(g)]
        ini = sub_audio[0]["i"]
        fim = sub_audio[-1]["i"] + sub_audio[-1]["d"]
        dur = max(0.0, round(fim - ini, 3))
        resultado.append({"t": t, "i": ini, "d": dur})
        ultimo_t = ini + dur
        idx_audio += len(g)

    return resultado

def processar_slug(slug: str):
    json_path = DATA_INTROS / f"{slug}.json"
    if not json_path.exists():
        print(f"❌ Não encontrado: {json_path}")
        return

    data = json.loads(json_path.read_text(encoding="utf-8"))
    if "audio" not in data or "unidades" not in data["audio"]:
        print(f"⚠️ {slug} ainda não tem áudio gerado.")
        return

    print(f"🎯 Alinhando palavras para {slug}...")
    book_cache = CORPUS_DIR / slug
    unidades = data["audio"]["unidades"]

    for u in unidades:
        raw_name = f"u_{u['i']}_{u['id']}.raw"
        raw_file = book_cache / raw_name
        palavras = alinha_unidade(raw_file, u["texto"], u["inicio"])
        u["palavras"] = palavras

    # Salva em data/ e public/data/
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    public_path = PUBLIC_INTROS / f"{slug}.json"
    public_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✅ {slug} alinhado com sucesso!")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        slug = sys.argv[1].replace("--slug=", "")
        processar_slug(slug)
    else:
        for f in sorted(DATA_INTROS.glob("*.json")):
            processar_slug(f.stem)
