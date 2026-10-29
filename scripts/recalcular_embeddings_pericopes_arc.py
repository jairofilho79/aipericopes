#!/usr/bin/env python3
"""
scripts/recalcular_embeddings_pericopes_arc.py

Recalcula os embeddings bíblicos (vetor B) das 2.823 perícopes usando como
referência textual a Bíblia ARC (data/ARC.json).
Preserva os vetores temáticos (vetor T - resenhas, reflexões, comentários).

Gera:
- data/embeddings-progresso.json
- data/embeddings-256.bin & public/data/embeddings-256.bin
- data/embeddings-meta.json & public/data/embeddings-meta.json
"""

import json
import struct
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ARC_PATH = ROOT / "data" / "ARC.json"
PERICOPES_JSON = ROOT / "data" / "pericopes.json"
PROGRESSO_JSON = ROOT / "data" / "embeddings-progresso.json"

BIN_DATA = ROOT / "data" / "embeddings-256.bin"
BIN_PUBLIC = ROOT / "public" / "data" / "embeddings-256.bin"
META_DATA = ROOT / "data" / "embeddings-meta.json"
META_PUBLIC = ROOT / "public" / "data" / "embeddings-meta.json"

OLLAMA_URL = "http://127.0.0.1:11434/api/embed"
MODEL_NAME = "embeddinggemma-2:latest"
TARGET_DIM = 256
BATCH_SIZE = 50


def embed_batch(texts: list[str]) -> np.ndarray:
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps({"model": MODEL_NAME, "input": texts}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        res = json.loads(resp.read().decode("utf-8"))

    vecs = []
    for emb in res.get("embeddings", []):
        v = np.array(emb[:TARGET_DIM], dtype=np.float32)
        norm = np.linalg.norm(v)
        if norm > 0:
            v /= norm
        vecs.append(v)
    return np.array(vecs, dtype=np.float32)


def main():
    print("=" * 70)
    print("⚡ RECALCULANDO EMBEDDINGS BÍBLICOS DAS PERÍCOPES VIA ARC")
    print("=" * 70)

    if not ARC_PATH.exists():
        print(f"❌ {ARC_PATH} não encontrado!", file=sys.stderr)
        sys.exit(1)

    print("📖 Carregando Bíblia ARC...")
    with open(ARC_PATH, "r", encoding="utf-8") as f:
        arc_data = json.load(f)

    arc_dict = {}
    for b in arc_data:
        b_name = b["name"]
        for c_idx, chap in enumerate(b.get("chapters", []), 1):
            for v_idx, v in enumerate(chap, 1):
                txt = v.get("t") or v.get("texto") or ""
                if txt:
                    arc_dict[(b_name, c_idx, v_idx)] = txt.strip()
    print(f"   ARC: {len(arc_dict):,} versículos indexados.")

    print("📂 Carregando perícopes e checkpoint existente...")
    with open(PERICOPES_JSON, "r", encoding="utf-8") as f:
        pericopes = json.load(f)

    with open(PROGRESSO_JSON, "r", encoding="utf-8") as f:
        progresso = json.load(f)

    total_p = len(pericopes)
    print(f"   Perícopes a processar: {total_p}")

    # Monta os textos bíblicos a partir da ARC
    textos_biblicos_arc = []
    ordens = []
    for p in pericopes:
        ord_id = p["ordem"]
        ordens.append(ord_id)
        livro = p["livro"]
        c_ini, v_ini = p["capitulo_inicio"], p["versiculo_inicio"]
        c_fim, v_fim = p["capitulo_fim"], p["versiculo_fim"]

        verses_arc = []
        if c_ini == c_fim:
            for v in range(v_ini, v_fim + 1):
                txt = arc_dict.get((livro, c_ini, v))
                if txt:
                    verses_arc.append(f"{v} {txt}")
        else:
            ch_len_ini = max([k[2] for k in arc_dict.keys() if k[0] == livro and k[1] == c_ini], default=0)
            for v in range(v_ini, ch_len_ini + 1):
                txt = arc_dict.get((livro, c_ini, v))
                if txt:
                    verses_arc.append(f"{v} {txt}")
            for c in range(c_ini + 1, c_fim):
                ch_len = max([k[2] for k in arc_dict.keys() if k[0] == livro and k[1] == c], default=0)
                for v in range(1, ch_len + 1):
                    txt = arc_dict.get((livro, c, v))
                    if txt:
                        verses_arc.append(f"{v} {txt}")
            for v in range(1, v_fim + 1):
                txt = arc_dict.get((livro, c_fim, v))
                if txt:
                    verses_arc.append(f"{v} {txt}")

        texto_arc = " ".join(verses_arc)
        partes = [p["titulo_pericope_pt"]]
        if p.get("sobrescrito"):
            partes.append(p["sobrescrito"])
        partes.append(texto_arc)
        textos_biblicos_arc.append("\n\n".join(partes))

    print(f"⚡ Gerando embeddings ARC via Ollama ({MODEL_NAME}) em lotes de {BATCH_SIZE}...")
    t0 = time.time()
    novos_vecs_biblicos = []

    for i in range(0, total_p, BATCH_SIZE):
        batch = textos_biblicos_arc[i:i + BATCH_SIZE]
        vecs = embed_batch(batch)
        novos_vecs_biblicos.extend(vecs)
        pct = min(i + BATCH_SIZE, total_p) / total_p * 100
        vel = min(i + BATCH_SIZE, total_p) / max(time.time() - t0, 0.1)
        print(f"   [{min(i + BATCH_SIZE, total_p):04d}/{total_p}] ({pct:.1f}%) - {vel:.1f} p/s", end="\r")

    print(f"\n✅ Todos os {total_p} embeddings gerados em {time.time() - t0:.1f}s!")

    # Atualiza progresso JSON
    print("💾 Atualizando data/embeddings-progresso.json...")
    for idx, p in enumerate(pericopes):
        ord_str = str(p["ordem"])
        if ord_str not in progresso:
            progresso[ord_str] = {}
        progresso[ord_str]["biblico"] = [float(x) for x in novos_vecs_biblicos[idx]]

    with open(PROGRESSO_JSON, "w", encoding="utf-8") as f:
        json.dump(progresso, f, ensure_ascii=False)

    # Grava binário Float32Array (2823 * 2 * 256)
    print("💾 Gravando embeddings-256.bin...")
    total_floats = total_p * 2 * TARGET_DIM
    byte_buffer = bytearray(total_floats * 4)

    for i, p in enumerate(pericopes):
        ord_str = str(p["ordem"])
        bib_vec = progresso[ord_str]["biblico"]
        tem_vec = progresso[ord_str]["tematico"]

        offset = i * 2 * TARGET_DIM * 4
        # 256 biblico
        for d in range(TARGET_DIM):
            struct.pack_into("f", byte_buffer, offset + d * 4, bib_vec[d])
        # 256 tematico
        offset_tem = offset + TARGET_DIM * 4
        for d in range(TARGET_DIM):
            struct.pack_into("f", byte_buffer, offset_tem + d * 4, tem_vec[d])

    for bin_path in [BIN_DATA, BIN_PUBLIC]:
        bin_path.parent.mkdir(parents=True, exist_ok=True)
        with open(bin_path, "wb") as f:
            f.write(byte_buffer)
        print(f"   -> Salvo {bin_path} ({len(byte_buffer) / (1024 * 1024):.2f} MB)")

    # Grava manifesto
    meta = {
        "modelo": MODEL_NAME,
        "referenciaTextual": "ARC",
        "dimensoes": TARGET_DIM,
        "totalPericopes": total_p,
        "stridePorPericope": TARGET_DIM * 2,
        "ordens": ordens,
        "geradoEm": datetime.utcnow().isoformat() + "Z",
    }
    for meta_path in [META_DATA, META_PUBLIC]:
        meta_path.parent.mkdir(parents=True, exist_ok=True)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        print(f"   -> Salvo {meta_path}")

    print("\n🎉 Recalculo dos embeddings bíblicos concluído com sucesso!")


if __name__ == "__main__":
    main()
