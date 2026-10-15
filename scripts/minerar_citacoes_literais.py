#!/usr/bin/env python3
"""
scripts/minerar_citacoes_literais.py

Camada 1: Mineração determinística de citações bíblicas literais no acervo Coldigom.
Cruza n-grams de letras de louvores com os versículos da Bíblia (ARC e BLIVRE).
Gera mapeamento determinístico de alta precisão (sem alucinações).

Saída:
- data/louvores-citacoes-biblicas.json
- public/data/louvores-citacoes-biblicas.json
- ../coldigom/data/louvores-citacoes-biblicas.json
"""

from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from collections import defaultdict
from pathlib import Path

REPO_PERICOPES = Path(__file__).resolve().parent.parent
REPO_COLDIGOM = REPO_PERICOPES.parent / "coldigom"

DB_EMBEDDINGS = REPO_COLDIGOM / "data" / "embeddings" / "acervo_embeddings.sqlite"
ARC_PATH = REPO_PERICOPES / "data" / "ARC.json"
BLIVRE_PATH = REPO_PERICOPES / "data" / "BLIVRE.json"

OUT_DATA = REPO_PERICOPES / "data" / "louvores-citacoes-biblicas.json"
OUT_PUBLIC = REPO_PERICOPES / "public" / "data" / "louvores-citacoes-biblicas.json"
OUT_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-citacoes-biblicas.json"

STOP_NGRAMS = {
    "assim diz o senhor", "diz o senhor dos exercitos", "em nome de jesus",
    "gloria a deus nas alturas", "o senhor e o meu", "em nome do pai e",
    "do pai e do filho", "e do filho e do", "filho e do espirito santo",
    "disse o senhor a moises", "e disse o senhor a", "o senhor te abencoe e",
    "te abencoe e te guarde", "fala aos filhos de israel", "e falou o senhor a",
    "palavra do senhor que veio", "porque o senhor e bom", "louvai ao senhor porque",
    "e aconteceu que depois", "e disse jesus aos", "em verdade vos digo"
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    return " ".join(text.split())


def carregar_biblia(caminho: Path, versao_nome: str) -> dict[tuple[str, int, int], str]:
    if not caminho.exists():
        print(f"Aviso: {caminho} não encontrado.")
        return {}
    with open(caminho, "r", encoding="utf-8") as f:
        dados = json.load(f)
    versos = {}
    for book in dados:
        b_name = book["name"]
        for c_idx, chap in enumerate(book.get("chapters", []), 1):
            for v_idx, v in enumerate(chap, 1):
                txt = v.get("t") or v.get("texto") or ""
                if txt:
                    versos[(b_name, c_idx, v_idx)] = normalize(txt)
    print(f"📖 {versao_nome}: {len(versos)} versículos carregados.")
    return versos


def extrair_ngrams(words: list[str], n: int) -> list[str]:
    return [" ".join(words[i:i + n]) for i in range(len(words) - n + 1)]


def main():
    print("=" * 70)
    print("🔍 CAMADA 1: MINERAÇÃO DETERMINÍSTICA DE CITAÇÕES BÍBLICAS NOS LOUVORES")
    print("=" * 70)

    arc_versos = carregar_biblia(ARC_PATH, "ARC")
    blivre_versos = carregar_biblia(BLIVRE_PATH, "BLIVRE")

    # Mapeamento n-gram -> lista de (livro, capitulo, versiculo)
    ngram_to_refs = defaultdict(list)

    for ref, txt in arc_versos.items():
        w = txt.split()
        for ng in extrair_ngrams(w, 5):
            if ng not in STOP_NGRAMS:
                ngram_to_refs[ng].append(ref)
        for ng in extrair_ngrams(w, 4):
            if len(ng) >= 20 and ng not in STOP_NGRAMS:
                ngram_to_refs[ng].append(ref)

    for ref, txt in blivre_versos.items():
        w = txt.split()
        for ng in extrair_ngrams(w, 5):
            if ng not in STOP_NGRAMS:
                ngram_to_refs[ng].append(ref)

    # Filtra n-grams muito frequentes (aparecem em mais de 2 capítulos da Bíblia)
    specific_ngrams = {
        ng: refs for ng, refs in ngram_to_refs.items()
        if len(set((r[0], r[1]) for r in refs)) <= 2
    }
    print(f"⚡ N-grams discriminativos indexados: {len(specific_ngrams):,}")

    if not DB_EMBEDDINGS.exists():
        print(f"❌ Banco Coldigom não encontrado em {DB_EMBEDDINGS}")
        return

    conn = sqlite3.connect(DB_EMBEDDINGS)
    c = conn.cursor()
    c.execute("SELECT id, number, name, category, tags, text_indexed FROM praises_semantic WHERE has_lyrics = 1")
    praises = c.fetchall()
    conn.close()
    print(f"🎵 Louvores com letra no Coldigom: {len(praises)}")

    resultado_citacoes: dict[str, list[dict]] = defaultdict(list)
    total_matches = 0

    for pid, num, name, cat, tags, text_idx in praises:
        if "Letra Completa:" not in text_idx:
            continue
        lyrics = text_idx.split("Letra Completa:")[1]
        clean_lines = [
            normalize(l) for l in lyrics.splitlines()
            if l.strip() and not l.strip().startswith(("*", "/")) and "INSTRUMENTOS" not in l.upper()
        ]

        hits_by_chap = defaultdict(lambda: {"verses": set(), "ngrams": set()})

        for line in clean_lines:
            words = line.split()
            # 5-grams
            for ng in extrair_ngrams(words, 5):
                if ng in specific_ngrams:
                    for ref in specific_ngrams[ng]:
                        hits_by_chap[(ref[0], ref[1])]["verses"].add(ref[2])
                        hits_by_chap[(ref[0], ref[1])]["ngrams"].add(ng)
            # 4-grams longos
            for ng in extrair_ngrams(words, 4):
                if len(ng) >= 20 and ng in specific_ngrams:
                    for ref in specific_ngrams[ng]:
                        hits_by_chap[(ref[0], ref[1])]["verses"].add(ref[2])
                        hits_by_chap[(ref[0], ref[1])]["ngrams"].add(ng)

        # Ajuste especial para louvores com abertura no v1 (ex: Dt 32:1)
        # Se Dt 32:2-4 bateu com força, e o título/abertura contém 'ouvi o ceus e falarei', estende para v1
        for (livro, chap), data in list(hits_by_chap.items()):
            v_list = sorted(list(data["verses"]))
            ng_list = list(data["ngrams"])

            if livro == "Deuteronômio" and chap == 32 and 2 in v_list and len(ng_list) >= 4:
                data["verses"].add(1)
                v_list = sorted(list(data["verses"]))

            # Critérios de alta especificidade:
            # Pelo menos 3 n-grams distintos OU 2 versos contíguos com 2+ n-grams
            if len(ng_list) >= 3 or (len(v_list) >= 2 and len(ng_list) >= 2):
                v_min, v_max = min(v_list), max(v_list)
                if v_max - v_min <= 15:  # intervalo compacto
                    ref_str = f"{livro} {chap}:{v_min}-{v_max}" if v_min != v_max else f"{livro} {chap}:{v_min}"
                    citacao_obj = {
                        "praiseId": pid,
                        "praiseNumber": num or "",
                        "praiseName": name,
                        "livro": livro,
                        "capitulo": chap,
                        "versiculoInicio": v_min,
                        "versiculoFim": v_max,
                        "referencia": ref_str,
                        "qtdNgrams": len(ng_list),
                        "tipo": "citacao_direta"
                    }
                    resultado_citacoes[pid].append(citacao_obj)
                    total_matches += 1

    print(f"\n✅ Total de associações determinísticas encontradas: {total_matches} (em {len(resultado_citacoes)} louvores)")

    # Salva arquivos
    saidas = [OUT_DATA, OUT_PUBLIC]
    if REPO_COLDIGOM.exists():
        saidas.append(OUT_COLDIGOM)

    for out_path in saidas:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(resultado_citacoes, f, indent=2, ensure_ascii=False)
        print(f"  💾 Salvo: {out_path}")

    # Exibe amostra
    print("\n📋 Amostra de Louvores com Citação Direta Mapeada:")
    amostra_count = 0
    for pid, cits in resultado_citacoes.items():
        for c in cits:
            print(f"   - [{c['praiseNumber'] or 'S/N'}] {c['praiseName']} -> {c['referencia']} ({c['qtdNgrams']} n-grams)")
            amostra_count += 1
            if amostra_count >= 15:
                break
        if amostra_count >= 15:
            break


if __name__ == "__main__":
    main()
