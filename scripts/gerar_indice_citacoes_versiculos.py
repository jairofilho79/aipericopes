#!/usr/bin/env python3
"""
scripts/gerar_indice_citacoes_versiculos.py

Gera o índice otimizado de citações bíblicas literais por livro e capítulo
para consulta instantânea (O(1)) no frontend ao selecionar versículos.

Gera:
- public/data/citacoes-por-versiculo.json
- data/citacoes-por-versiculo.json
"""

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_COLDIGOM = ROOT.parent / "coldigom" / "data" / "embeddings" / "acervo_embeddings.sqlite"
CITATIONS_JSON = ROOT / "data" / "louvores-citacoes-biblicas.json"
HOMILETICOS_JSON = ROOT / "data" / "louvores-temas-homileticos.json"
SHORT_IDS_JSON = ROOT / "data" / "coldigom-short-ids.json"

OUT_PUBLIC = ROOT / "public" / "data" / "citacoes-por-versiculo.json"
OUT_DATA = ROOT / "data" / "citacoes-por-versiculo.json"


def main():
    print("📖 Gerando índice de citações bíblicas por versículo...")

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

    praises_meta = {}
    if DB_COLDIGOM.exists():
        conn = sqlite3.connect(DB_COLDIGOM)
        c = conn.cursor()
        c.execute("SELECT id, number, name, category, tags FROM praises_semantic")
        for pid, num, name, cat, tags in c.fetchall():
            praises_meta[pid] = {
                "number": num or "",
                "name": name,
                "category": cat or "Geral",
                "tags": tags or "",
            }
        conn.close()

    with open(CITATIONS_JSON, "r", encoding="utf-8") as f:
        citations = json.load(f)

    # Estrutura:
    # index[livro][capitulo_str] = [ { versiculoInicio, versiculoFim, id, shortId, number, name, ... } ]
    index: dict[str, dict[str, list[dict]]] = {}
    total_entries = 0

    for pid, c_list in citations.items():
        pmeta = praises_meta.get(pid, {})
        hom = homileticos.get(pid, {})
        short_id = short_map.get(pid, "")

        for c in c_list:
            livro = c["livro"]
            cap = str(c["capitulo"])
            v_ini = int(c["versiculoInicio"])
            v_fim = int(c["versiculoFim"])

            if livro not in index:
                index[livro] = {}
            if cap not in index[livro]:
                index[livro][cap] = []

            entry = {
                "id": pid,
                "shortId": short_id,
                "number": pmeta.get("number") or c.get("praiseNumber", ""),
                "name": pmeta.get("name") or c.get("praiseName", ""),
                "category": pmeta.get("category", "Geral"),
                "tags": pmeta.get("tags", ""),
                "versiculoInicio": v_ini,
                "versiculoFim": v_fim,
                "referencia": c.get("referencia", f"{livro} {cap}:{v_ini}-{v_fim}"),
                "mensagemCentral": hom.get("mensagem_central", ""),
                "temasHomileticos": hom.get("temas_homileticos", []),
            }

            # Evita duplicatas se o mesmo louvor tiver mesma citação
            ja_existe = any(
                item["id"] == pid and item["versiculoInicio"] == v_ini and item["versiculoFim"] == v_fim
                for item in index[livro][cap]
            )
            if not ja_existe:
                index[livro][cap].append(entry)
                total_entries += 1

    # Ordena as listas de cada capítulo por versículo inicial
    for livro, caps in index.items():
        for cap, lista in caps.items():
            lista.sort(key=lambda x: (x["versiculoInicio"], x["name"]))

    OUT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PUBLIC, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    with open(OUT_DATA, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    tamanho_kb = OUT_PUBLIC.stat().st_size / 1024
    print(f"✅ Índice gerado com sucesso!")
    print(f"   -> {total_entries} citações mapeadas em {len(index)} livros")
    print(f"   -> Tamanho minificado: {tamanho_kb:.1f} KB em {OUT_PUBLIC}")


if __name__ == "__main__":
    main()
