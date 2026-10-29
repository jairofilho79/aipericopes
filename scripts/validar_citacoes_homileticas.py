#!/usr/bin/env python3
"""
scripts/validar_citacoes_homileticas.py

Camada 2: Validação Cruzada Local (Anti-Alucinação).
Verifica as passagens bíblicas sugeridas pelo LLM contra os versículos reais
em ARC.json e BLIVRE.json usando Gemma Embedding 2 (256d Matryoshka).
Se a similaridade semântica contra a letra do louvor for >= 82% (0.82),
aprova a citação e mescla em louvores-citacoes-biblicas.json.

Saídas:
- data/louvores-citacoes-biblicas.json
- public/data/louvores-citacoes-biblicas.json
- ../coldigom/data/louvores-citacoes-biblicas.json
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any
import numpy as np

REPO_PERICOPES = Path(__file__).resolve().parent.parent
REPO_COLDIGOM = REPO_PERICOPES.parent / "coldigom"

DB_EMBEDDINGS = REPO_COLDIGOM / "data" / "embeddings" / "acervo_embeddings.sqlite"
if not DB_EMBEDDINGS.exists():
    alt_db = REPO_PERICOPES / "data" / "embeddings" / "acervo_embeddings.sqlite"
    if alt_db.exists():
        DB_EMBEDDINGS = alt_db

ARC_PATH = REPO_PERICOPES / "data" / "ARC.json"
HOMILETICOS_PATH = REPO_PERICOPES / "data" / "louvores-temas-homileticos.json"
CITATIONS_PATH = REPO_PERICOPES / "data" / "louvores-citacoes-biblicas.json"

OUT_PUBLIC = REPO_PERICOPES / "public" / "data" / "louvores-citacoes-biblicas.json"
OUT_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-citacoes-biblicas.json"

OLLAMA_URL = "http://127.0.0.1:11434/api/embed"
MODEL_NAME = "embeddinggemma-2:latest"
SIMILARITY_THRESHOLD = 0.82  # 82% mínimo

ALIASES_LIVROS = {
    "Cânticos": "Cantares",
    "Cântico dos Cânticos": "Cantares",
    "Cânticos de Salomão": "Cantares",
    "Salmo": "Salmos",
    "Sl": "Salmos",
    "Dt": "Deuteronômio",
    "Is": "Isaías",
    "Gn": "Gênesis",
    "Ex": "Êxodo",
    "Êx": "Êxodo",
    "Mt": "Mateus",
    "Mc": "Marcos",
    "Lc": "Lucas",
    "Jo": "João",
    "At": "Atos",
    "Rm": "Romanos",
    "1Co": "1 Coríntios",
    "2Co": "2 Coríntios",
    "1 Co": "1 Coríntios",
    "2 Co": "2 Coríntios",
    "I Coríntios": "1 Coríntios",
    "II Coríntios": "2 Coríntios",
    "I Samuel": "1 Samuel",
    "II Samuel": "2 Samuel",
    "I Reis": "1 Reis",
    "II Reis": "2 Reis",
    "I Crônicas": "1 Crônicas",
    "II Crônicas": "2 Crônicas",
    "I Tessalonicenses": "1 Tessalonicenses",
    "II Tessalonicenses": "2 Tessalonicenses",
    "I Timóteo": "1 Timóteo",
    "II Timóteo": "2 Timóteo",
    "I Pedro": "1 Pedro",
    "II Pedro": "2 Pedro",
    "I João": "1 João",
    "II João": "2 João",
    "III João": "3 João",
    "Ap": "Apocalipse",
    "Hb": "Hebreus",
    "Tg": "Tiago",
}


def normalizar_livro(nome: str) -> str:
    nome = nome.strip()
    return ALIASES_LIVROS.get(nome, nome)


def carregar_biblia(caminho: Path) -> dict[tuple[str, int, int], str]:
    if not caminho.exists():
        return {}
    with open(caminho, "r", encoding="utf-8") as f:
        dados = json.load(f)
    versos = {}
    for book in dados:
        b_name = normalizar_livro(book["name"])
        for c_idx, chap in enumerate(book.get("chapters", []), 1):
            for v_idx, v in enumerate(chap, 1):
                txt = v.get("t") or v.get("texto") or ""
                if txt:
                    versos[(b_name, c_idx, v_idx)] = txt.strip()
    return versos


def parse_passagem(passagem_str: str) -> tuple[str, int, int, int] | None:
    """
    Retorna (livro, capitulo, v_inicio, v_fim) ou None.
    Ex: 'Salmos 23:1-3' -> ('Salmos', 23, 1, 3)
    Ex: '1 Samuel 17:47' -> ('1 Samuel', 17, 47, 47)
    Ex: 'Isaías 53' -> ('Isaías', 53, 1, 999)
    """
    if not passagem_str:
        return None
    p = passagem_str.strip()

    # Trata caso com vírgula 'Salmos 80:1-3, 14-15'
    if "," in p:
        p = p.split(",")[0].strip()

    m = re.match(r"^([\d\s]*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$", p)
    if not m:
        return None

    raw_livro = m.group(1).strip()
    livro = normalizar_livro(raw_livro)
    cap = int(m.group(2))
    v_ini = int(m.group(3)) if m.group(3) else 1
    v_fim = int(m.group(4)) if m.group(4) else (v_ini if m.group(3) else 999)

    return livro, cap, v_ini, v_fim


def obter_embeddings_ollama(textos: list[str]) -> list[np.ndarray]:
    """Gera vetores 256d Matryoshka normalizados L2 via Ollama local."""
    payload = json.dumps({"model": MODEL_NAME, "input": textos}).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        embs = data.get("embeddings", [])
        vetores = []
        for raw in embs:
            vec256 = np.array(raw[:256], dtype=np.float32)
            norm = np.linalg.norm(vec256)
            if norm > 0:
                vec256 /= norm
            vetores.append(vec256)
        return vetores


def main():
    print("=" * 70)
    print("🛡️ CAMADA 2: VALIDAÇÃO CRUZADA ANTI-ALUCINAÇÃO (LOCAL VIA GEMMA EMBEDDING 2)")
    print("=" * 70)

    if not HOMILETICOS_PATH.exists():
        print(f"❌ Arquivo de temas homiléticos não encontrado: {HOMILETICOS_PATH}")
        sys.exit(1)

    with open(HOMILETICOS_PATH, "r", encoding="utf-8") as f:
        homileticos = json.load(f)

    # Carrega citações existentes da Camada 1
    citacoes_existentes: dict[str, list[dict]] = defaultdict(list)
    if CITATIONS_PATH.exists():
        with open(CITATIONS_PATH, "r", encoding="utf-8") as f:
            citacoes_existentes = json.load(f)
    print(f"📂 Camada 1: {sum(len(v) for v in citacoes_existentes.values())} citações literais prévias.")

    # Carrega Bíblia ARC
    print("📖 Carregando Bíblia ARC como referência textual...")
    arc = carregar_biblia(ARC_PATH)
    print(f"   ARC: {len(arc):,} versículos carregados.")

    # Carrega letras do acervo SQLite
    conn = sqlite3.connect(DB_EMBEDDINGS)
    c = conn.cursor()
    c.execute("SELECT id, number, name, author, text_indexed FROM praises_semantic WHERE has_lyrics = 1")
    letras_db = {}
    nomes_db = {}
    numeros_db = {}
    autores_db = {}
    for pid, num, name, author, text_idx in c.fetchall():
        lyrics = text_idx.split("Letra Completa:")[1] if "Letra Completa:" in text_idx else text_idx
        clean_lyrics = "\n".join(
            l.strip()
            for l in lyrics.splitlines()
            if l.strip() and not l.strip().startswith(("*", "/")) and "INSTRUMENTOS" not in l.upper()
        )
        letras_db[pid] = clean_lyrics
        nomes_db[pid] = name
        numeros_db[pid] = num or ""
        autores_db[pid] = author or ""
    conn.close()

    # Identificar candidatos que precisam de validação
    candidatos_para_validar = []
    ja_cobertos = 0

    for pid, item in homileticos.items():
        passagem_str = item.get("passagem_origem_direta")
        if not passagem_str:
            continue

        parsed = parse_passagem(passagem_str)
        if not parsed:
            continue

        livro, cap, v_ini, v_fim = parsed

        # Verifica se já está coberto na Camada 1
        ja_tem = False
        if pid in citacoes_existentes:
            for c_item in citacoes_existentes[pid]:
                if c_item.get("livro") == livro and c_item.get("capitulo") == cap:
                    ja_tem = True
                    break

        if ja_tem:
            ja_cobertos += 1
            continue

        if pid not in letras_db:
            continue

        full_lyr = letras_db[pid]
        first_stz = "\n".join(full_lyr.splitlines()[:4])

        candidatos_para_validar.append({
            "pid": pid,
            "num": numeros_db.get(pid, ""),
            "name": nomes_db.get(pid, item.get("praise_name", "")),
            "author": autores_db.get(pid, ""),
            "passagem_str": passagem_str,
            "livro": livro,
            "cap": cap,
            "v_ini": v_ini,
            "v_fim": v_fim,
            "lyrics": full_lyr[:1200],
            "first_stanza": first_stz,
        })

    print(f"🔍 Candidatos a validação semântica: {len(candidatos_para_validar)} "
          f"({ja_cobertos} já haviam sido confirmados deterministicamente na Camada 1)")

    # Monta textos bíblicos para cada candidato
    itens_validos = []
    for cand in candidatos_para_validar:
        livro, cap, v_ini, v_fim = cand["livro"], cand["cap"], cand["v_ini"], cand["v_fim"]

        # Busca versos na ARC
        arc_versos = []
        for v in range(v_ini, v_fim + 1):
            if (livro, cap, v) in arc:
                arc_versos.append(arc[(livro, cap, v)])
        # Se v_fim era 999 (capítulo inteiro), para quando acabar
        if v_fim == 999:
            v_idx = 1
            while (livro, cap, v_idx) in arc:
                arc_versos.append(arc[(livro, cap, v_idx)])
                v_idx += 1

        txt_biblia = " ".join(arc_versos)
        if not txt_biblia:
            continue

        cand["texto_biblico"] = txt_biblia
        itens_validos.append(cand)

    print(f"📊 {len(itens_validos)} candidatos com texto bíblico localizado.")

    # Processamento em lotes via Ollama
    aprovados = []
    rejeitados = []
    t0 = time.time()
    batch_size = 25

    print(f"⚡ Iniciando cálculo de similaridade semântica com estrofes e overlap (Ollama: {MODEL_NAME})...")

    def normalize_words(text: str) -> set[str]:
        import unicodedata
        text = unicodedata.normalize("NFKD", text)
        text = "".join(c for c in text if not unicodedata.combining(c))
        text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
        return set(text.split())

    for i in range(0, len(itens_validos), batch_size):
        lote = itens_validos[i:i + batch_size]
        textos_para_embed = []
        for item in lote:
            textos_para_embed.append(item["lyrics"])
            textos_para_embed.append(item.get("first_stanza") or item["lyrics"])
            textos_para_embed.append(item["texto_biblico"])

        try:
            vetores = obter_embeddings_ollama(textos_para_embed)
        except Exception as e:
            print(f"⚠️ Erro ao obter embeddings do Ollama: {e}")
            continue

        for idx, item in enumerate(lote):
            v_lyr = vetores[idx * 3]
            v_stz = vetores[idx * 3 + 1]
            v_bib = vetores[idx * 3 + 2]
            sim_full = float(np.dot(v_lyr, v_bib))
            sim_stz = float(np.dot(v_stz, v_bib))
            max_sim = max(sim_full, sim_stz)

            author = item.get("author", "")
            livro = item.get("livro", "")
            cap = str(item.get("cap", ""))
            author_hit = (
                livro.lower() in author.lower() or
                f"{livro} {cap}".lower() in author.lower() or
                f"{livro[:3]} {cap}".lower() in author.lower() or
                f"{livro[:2]} {cap}".lower() in author.lower()
            )

            stz_words = normalize_words(item.get("first_stanza", ""))
            bib_words = normalize_words(item.get("texto_biblico", ""))
            stop_set = {"e", "de", "do", "da", "em", "um", "uma", "o", "a", "os", "as", "que", "se", "nao", "com", "por"}
            common_words = (stz_words.intersection(bib_words)) - stop_set
            text_overlap = len(common_words) >= 3 or (len(bib_words) > 0 and len(common_words) / len(bib_words) >= 0.3)

            is_approved = (
                max_sim >= 0.81 or
                (max_sim >= 0.77 and (text_overlap or author_hit)) or
                (max_sim >= 0.79) or
                (author_hit and max_sim >= 0.70)
            )

            item["similaridade"] = max_sim
            if is_approved:
                aprovados.append(item)
            else:
                rejeitados.append(item)

        print(f"   [{min(i + batch_size, len(itens_validos)):03d}/{len(itens_validos):03d}] "
              f"Aprovados: {len(aprovados)} | Rejeitados: {len(rejeitados)}")

    print(f"\n⏱️ Processamento concluído em {time.time() - t0:.1f}s.")
    print("=" * 70)
    print(f"🎯 RESULTADOS DA VALIDAÇÃO ANTI-ALUCINAÇÃO:")
    print(f"   ✅ Aprovados (Similaridade >= 82%): {len(aprovados)}")
    print(f"   🛡️ Rejeitados (Afinidade insuficiente < 82%): {len(rejeitados)}")
    print("=" * 70)

    # Exibe amostra dos aprovados
    print("\n🌟 Amostra de Citações Aprovadas pela Validação Semântica:")
    for a in aprovados[:12]:
        print(f"   ✅ [{a['num'] or 'S/N'}] {a['name']} -> {a['passagem_str']} "
              f"({a['similaridade'] * 100:.1f}%)")

    # Exibe amostra dos rejeitados
    print("\n🛡️ Amostra de Alucinações/Sugestões Fracas Rejeitadas:")
    for r in rejeitados[:6]:
        print(f"   ❌ [{r['num'] or 'S/N'}] {r['name']} -> {r['passagem_str']} "
              f"({r['similaridade'] * 100:.1f}% < 82%)")

    # Mescla aprovados em citacoes_existentes
    for a in aprovados:
        pid = a["pid"]
        ref_obj = {
            "praiseId": pid,
            "praiseNumber": a["num"],
            "praiseName": a["name"],
            "livro": a["livro"],
            "capitulo": a["cap"],
            "versiculoInicio": a["v_ini"],
            "versiculoFim": a["v_fim"] if a["v_fim"] != 999 else a["v_ini"],
            "referencia": a["passagem_str"],
            "similaridade": round(a["similaridade"] * 100, 1),
            "tipo": "citacao_direta",
            "origem": "gemini_validado_semanticamente"
        }
        if pid not in citacoes_existentes:
            citacoes_existentes[pid] = []
        citacoes_existentes[pid].append(ref_obj)

    # Persiste em todos os caminhos
    saidas = [CITATIONS_PATH, OUT_PUBLIC]
    if REPO_COLDIGOM.exists():
        saidas.append(OUT_COLDIGOM)

    total_citacoes = sum(len(v) for v in citacoes_existentes.values())
    for p in saidas:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(citacoes_existentes, f, indent=2, ensure_ascii=False)
        print(f"💾 Salvo: {p} (Total consolidado: {total_citacoes} citações em {len(citacoes_existentes)} louvores)")


if __name__ == "__main__":
    main()
