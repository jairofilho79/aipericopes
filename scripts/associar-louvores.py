#!/usr/bin/env python3
"""
scripts/associar-louvores.py

Calcula e persiste a associação semântica estática entre as 2.823 perícopes
bíblicas e os 1.845 louvores do projeto Coldigom utilizando Gemma Embedding 2
(256 dimensões Matryoshka com normalização L2 unitária).

Gera dois tipos de matches para cada perícope:
1. Só Texto Bíblico: Título + Epígrafe + Texto Bíblico
2. Temático: Título + Contexto histórico-literário + Resenha + Reflexões + Tópicos

Gera:
- public/data/pericopes-louvores.json
- data/pericopes-louvores.json
- ../coldigom/data/pericopes-louvores.json
"""

from __future__ import annotations

import json
import sqlite3
import struct
import sys
import time
from pathlib import Path
import numpy as np

np.seterr(all="ignore")

REPO_PERICOPES = Path(__file__).resolve().parent.parent
REPO_COLDIGOM = REPO_PERICOPES.parent / "coldigom"

DB_EMBEDDINGS = REPO_COLDIGOM / "data" / "embeddings" / "acervo_embeddings.sqlite"
PERICOPES_EMB_JSON = REPO_PERICOPES / "data" / "embeddings-progresso.json"

OUT_PERICOPES_PUBLIC = REPO_PERICOPES / "public" / "data" / "pericopes-louvores.json"
OUT_PERICOPES_DATA = REPO_PERICOPES / "data" / "pericopes-louvores.json"
OUT_COLDIGOM_DATA = REPO_COLDIGOM / "data" / "pericopes-louvores.json"


def main():
    print("=" * 70)
    print("🎵 BÍBLIA PERÍCOPES × COLDIGOM — ASSOCIAÇÃO COM GEMMA EMBEDDING 2")
    print("=" * 70)

    if not DB_EMBEDDINGS.exists():
        print(f"❌ Banco Coldigom não encontrado em: {DB_EMBEDDINGS}", file=sys.stderr)
        sys.exit(1)

    if not PERICOPES_EMB_JSON.exists():
        print(f"❌ Embeddings de perícopes não encontrados em: {PERICOPES_EMB_JSON}", file=sys.stderr)
        sys.exit(1)

    t0 = time.time()

    # 1. Carrega louvores do Coldigom
    print("🔄 1/4: Carregando louvores do acervo Coldigom...")
    conn = sqlite3.connect(DB_EMBEDDINGS)
    c = conn.cursor()
    c.execute("SELECT id, number, name, category, tags, embedding FROM praises_semantic")

    praises = []
    praise_vecs = []
    for pid, num, name, cat, tags, blob in c.fetchall():
        if not blob:
            continue
        if "(NA" in name.upper() and "USAR" in name.upper():
            continue

        vec = struct.unpack("768f", blob)
        # Matryoshka: trunca para 256 dimensões e aplica normalização L2
        vec256 = np.array(vec[:256], dtype=np.float32)
        norm = np.linalg.norm(vec256)
        if norm > 0:
            vec256 /= norm

        praises.append({
            "id": pid,
            "number": num or "",
            "name": name,
            "category": cat or "Geral",
            "tags": tags or "",
        })
        praise_vecs.append(vec256)
    conn.close()

    P = np.array(praise_vecs, dtype=np.float32)
    print(f"   -> {len(praises)} louvores prontos em {time.time() - t0:.2f}s (Matriz P: {P.shape})")

    # 2. Carrega embeddings das perícopes
    t1 = time.time()
    print("🔄 2/4: Carregando embeddings das 2.823 perícopes...")
    with open(PERICOPES_EMB_JSON, "r", encoding="utf-8") as f:
        pericopes_emb = json.load(f)

    ordens_ordenadas = sorted([int(k) for k in pericopes_emb.keys()])
    biblico_vecs = []
    tematico_vecs = []

    for ord_id in ordens_ordenadas:
        str_id = str(ord_id)
        biblico_vecs.append(pericopes_emb[str_id]["biblico"])
        tematico_vecs.append(pericopes_emb[str_id]["tematico"])

    B = np.array(biblico_vecs, dtype=np.float32)
    T = np.array(tematico_vecs, dtype=np.float32)
    print(f"   -> {len(ordens_ordenadas)} perícopes carregadas em {time.time() - t1:.2f}s (B: {B.shape}, T: {T.shape})")

    # 3. Multiplicação matricial (cosseno unitário L2)
    t2 = time.time()
    print("🔄 3/4: Multiplicando matrizes (Match Bíblico e Match Temático)...")
    sim_biblico = np.dot(B, P.T)
    sim_tematico = np.dot(T, P.T)
    sim_combinado = 0.4 * sim_biblico + 0.6 * sim_tematico
    print(f"   -> Multiplicações concluídas em {time.time() - t2:.3f}s!")

    # 4. Estruturação dos resultados
    print("🔄 4/4: Montando índices para cada perícope...")
    resultado_pericopes: dict[str, list[dict]] = {}

    # Carrega mapa de short_id (se disponível)
    short_id_map = {}
    short_ids_file = REPO_PERICOPES / "data" / "coldigom-short-ids.json"
    if short_ids_file.exists():
        with open(short_ids_file, "r", encoding="utf-8") as f:
            raw_short = json.load(f)
            if isinstance(raw_short, list) and len(raw_short) > 0 and "results" in raw_short[0]:
                for row in raw_short[0]["results"]:
                    if row.get("id") and row.get("short_id"):
                        short_id_map[row["id"]] = row["short_id"]
        print(f"   -> {len(short_id_map)} short_ids mapeados do Coldigom")

    for row_idx, ord_id in enumerate(ordens_ordenadas):
        sb_row = sim_biblico[row_idx]
        st_row = sim_tematico[row_idx]
        sc_row = sim_combinado[row_idx]

        # Pega os melhores índices para bíblico, temático e combinado
        top_b_indices = np.argsort(-sb_row)[:8]
        top_t_indices = np.argsort(-st_row)[:8]
        top_c_indices = np.argsort(-sc_row)[:8]

        # Mescla preservando a prioridade dos melhores
        candidatos_indices = []
        vistos = set()
        for idx in list(top_c_indices) + list(top_b_indices) + list(top_t_indices):
            if idx not in vistos:
                vistos.add(idx)
                candidatos_indices.append(idx)

        lista_louvores = []
        nomes_vistos = set()

        for p_idx in candidatos_indices:
            pr = praises[p_idx]
            nome_norm = pr["name"].strip().lower()
            if nome_norm in nomes_vistos:
                continue
            nomes_vistos.add(nome_norm)

            score_bib = round(float(sb_row[p_idx]) * 100, 1)
            score_tem = round(float(st_row[p_idx]) * 100, 1)
            score_comb = round(float(sc_row[p_idx]) * 100, 1)

            # Classifica tipo de match predominante
            diff = score_bib - score_tem
            if diff >= 1.5:
                match_tipo = "biblico"
            elif diff <= -1.5:
                match_tipo = "tematico"
            else:
                match_tipo = "ambos"

            praise_obj = {
                "id": pr["id"],
                "number": pr["number"],
                "name": pr["name"],
                "category": pr["category"],
                "tags": pr["tags"],
                "similarity": score_comb,
                "similarityBiblico": score_bib,
                "similarityTematico": score_tem,
                "matchTipo": match_tipo,
            }
            if pr["id"] in short_id_map:
                praise_obj["shortId"] = short_id_map[pr["id"]]

            lista_louvores.append(praise_obj)

            # Seleciona até 6 louvores representativos para o card
            if len(lista_louvores) >= 6:
                break

        resultado_pericopes[str(ord_id)] = lista_louvores

    # Salva arquivos
    arquivos_saida = [OUT_PERICOPES_PUBLIC, OUT_PERICOPES_DATA]
    if REPO_COLDIGOM.exists():
        arquivos_saida.append(OUT_COLDIGOM_DATA)

    for out_path in arquivos_saida:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(resultado_pericopes, f, indent=2, ensure_ascii=False)
        print(f"  💾 Salvo: {out_path} ({len(resultado_pericopes)} perícopes)")

    print("\n" + "=" * 70)
    print(f"🎉 ASSOCIAÇÃO CONCLUÍDA EM {time.time() - t0:.2f}s!")
    print("=" * 70)

    # Amostra
    for ord_id in [0, 3068]:
        print(f"\n📖 Amostra Perícope {ord_id}:")
        for item in resultado_pericopes[str(ord_id)][:3]:
            print(
                f"   - {item['name']} ({item['number'] or 'S/N'}): "
                f"Comb {item['similarity']}% | Bíbl {item['similarityBiblico']}% | Tem {item['similarityTematico']}% [{item['matchTipo']}]"
            )


if __name__ == "__main__":
    main()
