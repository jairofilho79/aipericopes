#!/usr/bin/env python3
"""
scripts/gerar_louvores_versiculos.py

Camada B: Gera sugestões de louvores específicas versículo a versículo para
todos os 66 livros da Bíblia (ou livros individuais).

- Modelo: embeddinggemma-2:latest (via Ollama local: http://127.0.0.1:11434/api/embed)
- Trunca para 256 dimensões Matryoshka com normalização L2 unitária
- Compara com acervo Coldigom (praises_semantic + homiléticos)
- Formato compacto com dicionário de louvores indexados:
    {
      "praises": [ { id, shortId, number, name, category, mensagemCentral, temasHomileticos } ],
      "verses": { "cap:ver": [ [praiseIdx, score], ... ] }
    }
- Saída:
    public/data/versiculos-louvores/<livro-slug>.json
    data/versiculos-louvores/<livro-slug>.json

Uso:
  python3 scripts/gerar_louvores_versiculos.py --livro="Jó"
  python3 scripts/gerar_louvores_versiculos.py --all
  python3 scripts/gerar_louvores_versiculos.py --all --resume
"""

import argparse
import json
import re
import sqlite3
import struct
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DB_COLDIGOM = ROOT.parent / "coldigom" / "data" / "embeddings" / "acervo_embeddings.sqlite"
HOMILETICOS_JSON = ROOT / "data" / "louvores-temas-homileticos.json"
HOMILETICOS_NPZ = ROOT / "data" / "louvores-embeddings-homileticos.npz"
SHORT_IDS_JSON = ROOT / "data" / "coldigom-short-ids.json"
NAA_JSON = ROOT / "data" / "NAA.json"

OUT_DIR_PUBLIC = ROOT / "public" / "data" / "versiculos-louvores"
OUT_DIR_DATA = ROOT / "data" / "versiculos-louvores"

OLLAMA_URL = "http://127.0.0.1:11434/api/embed"
MODEL_NAME = "embeddinggemma-2:latest"
BATCH_SIZE = 50


def livro_slug(livro: str) -> str:
    """Mesmo algoritmo de src/lib/livro-slug.ts."""
    nfd = unicodedata.normalize("NFD", livro)
    sem_acento = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    slug = sem_acento.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def embed_batch(texts: list[str]) -> np.ndarray:
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps({"model": MODEL_NAME, "input": texts}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
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
    parser = argparse.ArgumentParser(description="Gera louvores por versículo para livros da Bíblia.")
    parser.add_argument("--livro", type=str, default="", help="Nome do livro (ex: Jó, Gênesis).")
    parser.add_argument("--all", action="store_true", help="Processar todos os 66 livros.")
    parser.add_argument("--resume", action="store_true", help="Pular livros já gerados.")
    args = parser.parse_args()

    if not args.livro and not args.all:
        print("Especifique --livro='Nome' ou --all. Use -h para ajuda.")
        sys.exit(1)

    print("=" * 70)
    print("🎵 GERADOR DE LOUVORES POR VERSÍCULO (CAMADA B)")
    print("=" * 70)

    # 1. Carrega louvores do Coldigom
    print("⏳ Carregando louvores do acervo Coldigom...")
    if not DB_COLDIGOM.exists():
        print(f"❌ Banco Coldigom não encontrado em: {DB_COLDIGOM}", file=sys.stderr)
        sys.exit(1)

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
        if any(
            bad in uname
            for bad in [
                "NÃO USAR",
                "NAO USAR",
                "(NA",
                "DEVEM USAR",
                "USAR ESTE",
                "USAR OUTRA",
                "ANTIGO (VOZES",
            ]
        ):
            continue

        vec = struct.unpack("768f", blob)
        vec256 = np.array(vec[:256], dtype=np.float32)
        norm = np.linalg.norm(vec256)
        if norm > 0:
            vec256 /= norm

        hom = homileticos.get(pid, {})
        praises.append(
            {
                "id": pid,
                "shortId": short_map.get(pid, ""),
                "number": num or "",
                "name": name,
                "category": cat or "Geral",
                "tags": tags or "",
                "mensagemCentral": hom.get("mensagem_central", ""),
                "temasHomileticos": hom.get("temas_homileticos", []),
            }
        )
        praise_vecs.append(vec256)
    conn.close()

    P = np.array(praise_vecs, dtype=np.float32)
    print(f"   -> {len(praises)} louvores carregados (Matriz P: {P.shape})")

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
        print(f"   -> Homiléticos alinhados (Matriz H: {H.shape})")

    # Carrega Bíblia NAA
    with open(NAA_JSON, "r", encoding="utf-8") as f:
        all_books = json.load(f)

    books_to_process = []
    if args.livro:
        target_name = args.livro.strip().lower()
        matched = [b for b in all_books if b["name"].strip().lower() == target_name or livro_slug(b["name"]) == livro_slug(target_name)]
        if not matched:
            print(f"❌ Livro '{args.livro}' não encontrado em NAA.json!")
            sys.exit(1)
        books_to_process = matched
    else:
        books_to_process = all_books

    OUT_DIR_PUBLIC.mkdir(parents=True, exist_ok=True)
    OUT_DIR_DATA.mkdir(parents=True, exist_ok=True)

    total_livros = len(books_to_process)
    t_global_start = time.time()

    for book_idx, book in enumerate(books_to_process, 1):
        nome_livro = book["name"]
        slug = livro_slug(nome_livro)
        target_public_file = OUT_DIR_PUBLIC / f"{slug}.json"
        target_data_file = OUT_DIR_DATA / f"{slug}.json"

        if args.resume and target_public_file.exists():
            print(f"⏩ [{book_idx}/{total_livros}] Pulando {nome_livro} (já existe em {target_public_file.name})")
            continue

        print(f"\n📖 [{book_idx}/{total_livros}] Processando {nome_livro} (slug: {slug})...")

        # Extrai todos os versículos do livro
        versiculos_info = []
        for cap_idx, chapter in enumerate(book["chapters"]):
            cap_num = cap_idx + 1
            for ver_idx, text in enumerate(chapter):
                ver_num = ver_idx + 1
                ref = f"{cap_num}:{ver_num}"
                full_text = f"{nome_livro} {cap_num}:{ver_num} - {text}"
                versiculos_info.append((ref, full_text))

        total_v = len(versiculos_info)
        t_book_start = time.time()

        # Dicionário de louvores únicos no livro
        unique_praises = []
        praise_to_idx = {}
        verses_map = {}

        for i in range(0, total_v, BATCH_SIZE):
            batch = versiculos_info[i:i + BATCH_SIZE]
            texts = [b[1] for b in batch]
            vecs = embed_batch(texts)

            sim_p = np.dot(vecs, P.T)
            if H is not None:
                sim_h = np.dot(vecs, H.T)
                sim_final = 0.50 * sim_p + 0.50 * sim_h
            else:
                sim_final = sim_p

            for b_idx, (ref, _) in enumerate(batch):
                scores = sim_final[b_idx]
                top_indices = np.argsort(-scores)[:4]

                verse_top_list = []
                nomes_vistos = set()
                for idx in top_indices:
                    pr = praises[idx]
                    nome_n = pr["name"].strip().lower()
                    if nome_n in nomes_vistos:
                        continue
                    nomes_vistos.add(nome_n)

                    pid = pr["id"]
                    if pid not in praise_to_idx:
                        praise_to_idx[pid] = len(unique_praises)
                        unique_praises.append({
                            "id": pid,
                            "shortId": pr["shortId"],
                            "number": pr["number"],
                            "name": pr["name"],
                            "category": pr["category"],
                            "mensagemCentral": pr["mensagemCentral"],
                            "temasHomileticos": pr["temasHomileticos"],
                        })

                    p_index = praise_to_idx[pid]
                    score = round(float(scores[idx]) * 100, 1)
                    verse_top_list.append([p_index, score])

                verses_map[ref] = verse_top_list

            done = min(i + BATCH_SIZE, total_v)
            elapsed = time.time() - t_book_start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (total_v - done) / rate if rate > 0 else 0
            print(f"\r   Versículos: {done}/{total_v} ({done/total_v*100:.1f}%) - {rate:.1f} v/s - ETA: {eta:.0f}s", end="")

        book_payload = {
            "book": nome_livro,
            "slug": slug,
            "praises": unique_praises,
            "verses": verses_map,
        }

        with open(target_public_file, "w", encoding="utf-8") as f:
            json.dump(book_payload, f, ensure_ascii=False, separators=(",", ":"))

        with open(target_data_file, "w", encoding="utf-8") as f:
            json.dump(book_payload, f, ensure_ascii=False, separators=(",", ":"))

        t_book_elapsed = time.time() - t_book_start
        size_kb = target_public_file.stat().st_size / 1024
        print(f"\n   ✅ {nome_livro} salvo em {t_book_elapsed:.1f}s ({size_kb:.1f} KB, {len(unique_praises)} louvores únicos)")

    print("\n" + "=" * 70)
    print(f"🎉 Processamento concluído em {time.time() - t_global_start:.1f}s!")
    print("=" * 70)


if __name__ == "__main__":
    main()
