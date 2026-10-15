#!/usr/bin/env python3
"""
Testa a geração de louvores para os versículos do livro de Jó.
"""

import json
import sqlite3
import struct
import time
import urllib.request
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DB_COLDIGOM = ROOT.parent / "coldigom" / "data" / "embeddings" / "acervo_embeddings.sqlite"
HOMILETICOS_JSON = ROOT / "data" / "louvores-temas-homileticos.json"
HOMILETICOS_NPZ = ROOT / "data" / "louvores-embeddings-homileticos.npz"
SHORT_IDS_JSON = ROOT / "data" / "coldigom-short-ids.json"
NAA_JSON = ROOT / "data" / "NAA.json"

OLLAMA_URL = "http://127.0.0.1:11434/api/embed"
MODEL_NAME = "embeddinggemma-2:latest"


def embed_batch(texts: list[str]) -> np.ndarray:
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps({"model": MODEL_NAME, "input": texts}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    
    vecs = []
    for emb in res.get("embeddings", []):
        v = np.array(emb[:256], dtype=np.float32)
        norm = np.linalg.norm(v)
        if norm > 0:
            v /= norm
        vecs.append(v)
    return np.array(vecs, dtype=np.float32)


def main():
    print("⏳ Carregando louvores do Coldigom...")
    conn = sqlite3.connect(DB_COLDIGOM)
    c = conn.cursor()
    c.execute("SELECT id, number, name, category, tags, embedding FROM praises_semantic")
    
    short_map = {}
    if SHORT_IDS_JSON.exists():
        with open(SHORT_IDS_JSON, "r", encoding="utf-8") as f:
            raw = json.load(f)
            if isinstance(raw, list) and len(raw) > 0 and "results" in raw[0]:
                for r in raw[0]["results"]:
                    if r.get("id") and r.get("short_id"):
                        short_map[r["id"]] = r["short_id"]

    homileticos = {}
    if HOMILETICOS_JSON.exists():
        with open(HOMILETICOS_JSON, "r", encoding="utf-8") as f:
            homileticos = json.load(f)

    praises = []
    praise_vecs = []
    for pid, num, name, cat, tags, blob in c.fetchall():
        if not blob:
            continue
        uname = name.upper()
        if any(bad in uname for bad in ["NÃO USAR", "NAO USAR", "(NA", "DEVEM USAR", "USAR ESTE", "USAR OUTRA", "ANTIGO (VOZES"]):
            continue

        vec = struct.unpack("768f", blob)
        vec256 = np.array(vec[:256], dtype=np.float32)
        norm = np.linalg.norm(vec256)
        if norm > 0:
            vec256 /= norm

        hom = homileticos.get(pid, {})
        praises.append({
            "id": pid,
            "shortId": short_map.get(pid, ""),
            "number": num or "",
            "name": name,
            "category": cat or "Geral",
            "tags": tags or "",
            "mensagemCentral": hom.get("mensagem_central", ""),
            "temasHomileticos": hom.get("temas_homileticos", []),
        })
        praise_vecs.append(vec256)
    conn.close()

    P = np.array(praise_vecs, dtype=np.float32)
    print(f"Louvores carregados: {len(praises)} (Matriz {P.shape})")

    # Homilético NPZ se existir
    H = None
    if HOMILETICOS_NPZ.exists():
        npz = np.load(HOMILETICOS_NPZ)
        npz_ids = {str(hid): idx for idx, hid in enumerate(npz["ids"])}
        npz_vecs = npz["vectors"]
        h_rows = []
        for pr in praises:
            pid = pr["id"]
            if pid in npz_ids:
                h_rows.append(npz_vecs[npz_ids[pid]])
            else:
                h_rows.append(praise_vecs[praises.index(pr)])
        H = np.array(h_rows, dtype=np.float32)
        print(f"Homiléticos alinhados: {H.shape}")

    # Carrega livro de Jó do NAA
    with open(NAA_JSON, "r", encoding="utf-8") as f:
        books = json.load(f)
    
    livro_jo = next((b for b in books if b["name"] == "Jó"), None)
    if not livro_jo:
        print("Livro de Jó não encontrado!")
        return

    versiculos_info = [] # (ref, text)
    for cap_idx, chapter in enumerate(livro_jo["chapters"]):
        cap_num = cap_idx + 1
        for ver_idx, text in enumerate(chapter):
            ver_num = ver_idx + 1
            ref = f"{cap_num}:{ver_num}"
            full_text = f"Jó {cap_num}:{ver_num} - {text}"
            versiculos_info.append((ref, full_text, text))

    print(f"Total de versículos em Jó: {len(versiculos_info)}")

    BATCH_SIZE = 50
    resultado_versiculos = {}

    t0 = time.time()
    for i in range(0, len(versiculos_info), BATCH_SIZE):
        batch = versiculos_info[i:i + BATCH_SIZE]
        texts = [b[1] for b in batch]
        vecs = embed_batch(texts) # (batch_len, 256)
        
        # Similaridade contra P e H
        sim_p = np.dot(vecs, P.T) # (batch_len, N_praises)
        if H is not None:
            sim_h = np.dot(vecs, H.T)
            sim_final = 0.50 * sim_p + 0.50 * sim_h
        else:
            sim_final = sim_p

        for b_idx, (ref, _, raw_text) in enumerate(batch):
            scores = sim_final[b_idx]
            top_indices = np.argsort(-scores)[:4]
            
            top_louvores = []
            nomes_vistos = set()
            for idx in top_indices:
                pr = praises[idx]
                nome_n = pr["name"].strip().lower()
                if nome_n in nomes_vistos:
                    continue
                nomes_vistos.add(nome_n)
                
                score = round(float(scores[idx]) * 100, 1)
                top_louvores.append({
                    "id": pr["id"],
                    "shortId": pr["shortId"],
                    "number": pr["number"],
                    "name": pr["name"],
                    "category": pr["category"],
                    "similarity": score,
                    "mensagemCentral": pr["mensagemCentral"],
                    "temasHomileticos": pr["temasHomileticos"],
                })
            resultado_versiculos[ref] = top_louvores
        
        elapsed = time.time() - t0
        done = min(i + BATCH_SIZE, len(versiculos_info))
        rate = done / elapsed
        eta = (len(versiculos_info) - done) / rate if rate > 0 else 0
        print(f"\r   Progresso: {done}/{len(versiculos_info)} versículos ({done/len(versiculos_info)*100:.1f}%) - {rate:.1f} v/s - ETA: {eta:.0f}s", end="")

    print(f"\n✅ Concluído em {time.time() - t0:.1f}s!")

    out_file = ROOT / "public" / "data" / "versiculos-louvores" / "jo.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(resultado_versiculos, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Salvo em {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

    # Exibe amostra de Jó 42:2 e Jó 42:5
    for ref_teste in ["42:2", "42:5", "1:21", "19:25"]:
        print(f"\n--- Resultado para Jó {ref_teste} ---")
        for l in resultado_versiculos.get(ref_teste, []):
            print(f"  [{l['similarity']}%] Nº {l['number']} - {l['name']} ({l['category']})")


if __name__ == "__main__":
    main()
