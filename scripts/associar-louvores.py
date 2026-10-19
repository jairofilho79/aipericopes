#!/usr/bin/env python3
"""
scripts/associar-louvores.py

Camada 1 & 2: Associação Semântica e Homilética entre as 2.823 perícopes
bíblicas e os 1.845 louvores do projeto Coldigom utilizando Gemma Embedding 2
(256 dimensões Matryoshka com normalização L2 unitária).

Gera scores refinados com 3 dimensões de match:
1. Match Bíblico: Título + Epígrafe + Texto Bíblico
2. Match Temático: Título + Contexto histórico-literário + Resenha + Reflexões + Tópicos
3. Match Homilético (Camada 2): Resenha/Tópicos × Mensagem Teológica Central e Tags Homiléticas

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
if not DB_EMBEDDINGS.exists():
    alt_db = REPO_PERICOPES / "data" / "embeddings" / "acervo_embeddings.sqlite"
    if alt_db.exists():
        DB_EMBEDDINGS = alt_db

PERICOPES_EMB_JSON = REPO_PERICOPES / "data" / "embeddings-progresso.json"
PERICOPES_META_JSON = REPO_PERICOPES / "data" / "pericopes.json"
CITATIONS_JSON = REPO_PERICOPES / "data" / "louvores-citacoes-biblicas.json"
HOMILETICOS_JSON = REPO_PERICOPES / "data" / "louvores-temas-homileticos.json"
HOMILETICOS_NPZ = REPO_PERICOPES / "data" / "louvores-embeddings-homileticos.npz"

OUT_PERICOPES_PUBLIC = REPO_PERICOPES / "public" / "data" / "pericopes-louvores.json"
OUT_PERICOPES_DATA = REPO_PERICOPES / "data" / "pericopes-louvores.json"
OUT_COLDIGOM_DATA = REPO_COLDIGOM / "data" / "pericopes-louvores.json"
OUT_INVERTIDO_DATA = REPO_PERICOPES / "data" / "louvores-pericopes.json"
OUT_INVERTIDO_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-pericopes.json"


def main():
    print("=" * 70)
    print("🎵 BÍBLIA PERÍCOPES × COLDIGOM — ASSOCIAÇÃO HOMILÉTICA & SEMÂNTICA")
    print("=" * 70)

    if not DB_EMBEDDINGS.exists():
        print(f"❌ Banco Coldigom não encontrado em: {DB_EMBEDDINGS}", file=sys.stderr)
        sys.exit(1)

    if not PERICOPES_EMB_JSON.exists():
        print(f"❌ Embeddings de perícopes não encontrados em: {PERICOPES_EMB_JSON}", file=sys.stderr)
        sys.exit(1)

    t0 = time.time()

    # 1. Carrega louvores do Coldigom
    print("🔄 1/5: Carregando louvores do acervo Coldigom...")
    conn = sqlite3.connect(DB_EMBEDDINGS)
    c = conn.cursor()
    c.execute("SELECT id, number, name, category, tags, embedding FROM praises_semantic")

    praises = []
    praise_vecs = []
    for pid, num, name, cat, tags, blob in c.fetchall():
        if not blob:
            continue
        uname = name.upper()
        if "NÃO USAR" in uname or "NAO USAR" in uname or "(NA" in uname:
            continue
        if "DEVEM USAR" in uname or "USAR ESTE" in uname or "USAR OUTRA" in uname or "ANTIGO (VOZES" in uname:
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
    praise_by_id = {pr["id"]: pr for pr in praises}
    praise_idx_by_id = {pr["id"]: idx for idx, pr in enumerate(praises)}
    print(f"   -> {len(praises)} louvores prontos em {time.time() - t0:.2f}s (Matriz P: {P.shape})")

    # Carrega citações bíblicas literais (Camada 1 + Camada 2 validadas)
    citations_by_praise: dict[str, list[dict]] = {}
    if CITATIONS_JSON.exists():
        with open(CITATIONS_JSON, "r", encoding="utf-8") as f:
            citations_by_praise = json.load(f)
        total_cits = sum(len(v) for v in citations_by_praise.values())
        print(f"   -> {total_cits} citações bíblicas literais e validadas em {len(citations_by_praise)} louvores")

    # Carrega enriquecimento homilético (Camada 2)
    homileticos_info: dict[str, dict] = {}
    if HOMILETICOS_JSON.exists():
        with open(HOMILETICOS_JSON, "r", encoding="utf-8") as f:
            homileticos_info = json.load(f)
        print(f"   -> {len(homileticos_info)} louvores com enriquecimento homilético (Camada 2)")

    # Carrega vetores homiléticos pré-calculados
    hom_vec_by_id: dict[str, np.ndarray] = {}
    if HOMILETICOS_NPZ.exists():
        npz = np.load(HOMILETICOS_NPZ)
        npz_ids = npz["ids"]
        npz_vecs = npz["vectors"]
        for hid, hvec in zip(npz_ids, npz_vecs):
            hom_vec_by_id[str(hid)] = hvec
        print(f"   -> {len(hom_vec_by_id)} vetores homiléticos pré-calculados carregados")

    # Monta matriz homilética H alinhada com P
    praise_hom_vecs = []
    for pr, pvec in zip(praises, praise_vecs):
        pid = pr["id"]
        if pid in hom_vec_by_id:
            praise_hom_vecs.append(hom_vec_by_id[pid])
        else:
            praise_hom_vecs.append(pvec)
    H = np.array(praise_hom_vecs, dtype=np.float32)

    # Carrega metadados das perícopes
    pericope_map: dict[int, dict] = {}
    if PERICOPES_META_JSON.exists():
        with open(PERICOPES_META_JSON, "r", encoding="utf-8") as f:
            pericopes_meta = json.load(f)
        pericope_map = {p.get("ordem"): p for p in pericopes_meta}

    # 2. Carrega embeddings das perícopes
    t1 = time.time()
    print("🔄 2/5: Carregando embeddings das 2.823 perícopes...")
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
    print("🔄 3/5: Multiplicando matrizes (Match Bíblico, Temático e Homilético)...")
    sim_biblico = np.dot(B, P.T)
    sim_tematico = np.dot(T, P.T)
    sim_homiletico = np.dot(T, H.T)

    # Score combinado ponderado:
    # 30% Texto Bíblico puro + 35% Temático canônico + 35% Afinidade Homilética de Pregação
    sim_combinado = 0.30 * sim_biblico + 0.35 * sim_tematico + 0.35 * sim_homiletico
    print(f"   -> 3 multiplicações completadas em {time.time() - t2:.3f}s!")

    # 4. Estruturação dos resultados
    print("🔄 4/5: Montando índices para cada perícope...")
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
        sh_row = sim_homiletico[row_idx]
        sc_row = sim_combinado[row_idx]

        p_meta = pericope_map.get(ord_id, {})
        livro_p = p_meta.get("livro")
        c_ini = p_meta.get("capitulo_inicio")
        c_fim = p_meta.get("capitulo_fim")
        v_ini = p_meta.get("versiculo_inicio")
        v_fim = p_meta.get("versiculo_fim")

        # 1. Identifica citações bíblicas literais nesta perícope
        louvores_citados = []
        if livro_p and c_ini is not None and c_fim is not None:
            for pid, c_list in citations_by_praise.items():
                for c_item in c_list:
                    if c_item.get("livro") == livro_p:
                        c_chap = c_item.get("capitulo")
                        if c_ini <= c_chap <= c_fim:
                            if c_ini == c_fim:
                                if not (c_item.get("versiculoFim") < v_ini or c_item.get("versiculoInicio") > v_fim):
                                    louvores_citados.append((pid, c_item))
                            else:
                                louvores_citados.append((pid, c_item))

        # Pega os melhores índices para bíblico, temático, homilético e combinado
        top_b_indices = np.argsort(-sb_row)[:8]
        top_t_indices = np.argsort(-st_row)[:8]
        top_h_indices = np.argsort(-sh_row)[:8]
        top_c_indices = np.argsort(-sc_row)[:8]

        # Mescla preservando a prioridade dos melhores
        candidatos_indices = []
        vistos = set()
        for idx in list(top_c_indices) + list(top_h_indices) + list(top_t_indices) + list(top_b_indices):
            if idx not in vistos:
                vistos.add(idx)
                candidatos_indices.append(idx)

        lista_louvores = []
        nomes_vistos = set()

        # Injeta citações bíblicas literais no topo (Slot #1...)
        for pid, c_item in louvores_citados:
            pr = praise_by_id.get(pid)
            if not pr:
                continue
            nome_norm = pr["name"].strip().lower()
            if nome_norm in nomes_vistos:
                continue
            nomes_vistos.add(nome_norm)

            hom_info = homileticos_info.get(pid, {})
            p_idx = praise_idx_by_id.get(pid)
            sh_score = round(float(sh_row[p_idx]) * 100, 1) if p_idx is not None else 100.0

            praise_obj = {
                "id": pr["id"],
                "number": pr["number"],
                "name": pr["name"],
                "category": pr["category"],
                "tags": pr["tags"],
                "similarity": 100.0,
                "similarityBiblico": 100.0,
                "similarityTematico": 100.0,
                "similarityHomiletico": sh_score,
                "matchTipo": "citacao_direta",
                "citacaoBiblica": c_item.get("referencia", ""),
                "mensagemCentral": hom_info.get("mensagem_central", ""),
                "temasHomileticos": hom_info.get("temas_homileticos", []),
            }
            if pr["id"] in short_id_map:
                praise_obj["shortId"] = short_id_map[pr["id"]]
            lista_louvores.append(praise_obj)
            if len(lista_louvores) >= 6:
                break

        for p_idx in candidatos_indices:
            pr = praises[p_idx]
            nome_norm = pr["name"].strip().lower()
            if nome_norm in nomes_vistos:
                continue
            nomes_vistos.add(nome_norm)

            score_bib = round(float(sb_row[p_idx]) * 100, 1)
            score_tem = round(float(st_row[p_idx]) * 100, 1)
            score_hom = round(float(sh_row[p_idx]) * 100, 1)
            score_comb = round(float(sc_row[p_idx]) * 100, 1)

            # Heurística estrita: descarta combinações fracas (< 70%) para evitar falsos-positivos
            if score_comb < 70.0:
                continue

            # Classifica tipo de match predominante
            max_estudo = max(score_tem, score_hom)
            diff = score_bib - max_estudo
            if diff >= 1.5:
                match_tipo = "biblico"
            elif max_estudo >= score_bib + 1.5:
                match_tipo = "tematico"
            else:
                match_tipo = "ambos"

            hom_info = homileticos_info.get(pr["id"], {})

            praise_obj = {
                "id": pr["id"],
                "number": pr["number"],
                "name": pr["name"],
                "category": pr["category"],
                "tags": pr["tags"],
                "similarity": score_comb,
                "similarityBiblico": score_bib,
                "similarityTematico": score_tem,
                "similarityHomiletico": score_hom,
                "matchTipo": match_tipo,
                "mensagemCentral": hom_info.get("mensagem_central", ""),
                "temasHomileticos": hom_info.get("temas_homileticos", []),
            }
            if pr["id"] in short_id_map:
                praise_obj["shortId"] = short_id_map[pr["id"]]

            lista_louvores.append(praise_obj)

            # Seleciona até 6 louvores representativos para o card
            if len(lista_louvores) >= 6:
                break

        resultado_pericopes[str(ord_id)] = lista_louvores

    # 5. Gera índice invertido (passagens bíblicas por louvor)
    print("🔄 5/6: Montando índice invertido (passagens bíblicas por louvor)...")
    invertido: dict[str, list[dict]] = {pr["id"]: [] for pr in praises}

    for ord_id, itens in resultado_pericopes.items():
        p_meta = pericope_map.get(int(ord_id), {})
        livro = p_meta.get("livro", "")
        c_ini = p_meta.get("capitulo_inicio")
        c_fim = p_meta.get("capitulo_fim")
        v_ini = p_meta.get("versiculo_inicio")
        v_fim = p_meta.get("versiculo_fim")
        titulo = p_meta.get("titulo_pericope_pt", "")

        ref_str = (
            f"{livro} {c_ini}:{v_ini}-{v_fim}"
            if c_ini == c_fim and v_ini != v_fim
            else (f"{livro} {c_ini}:{v_ini}" if c_ini == c_fim else f"{livro} {c_ini}:{v_ini} - {c_fim}:{v_fim}")
        )

        for l_item in itens:
            pid = l_item["id"]
            if pid not in invertido:
                invertido[pid] = []
            invertido[pid].append({
                "ordem": int(ord_id),
                "livro": livro,
                "referencia": ref_str,
                "titulo": titulo,
                "similarity": l_item["similarity"],
                "matchTipo": l_item.get("matchTipo"),
                "citacaoBiblica": l_item.get("citacaoBiblica"),
            })

    # Ordena passagens de cada louvor (citação direta no topo, depois maior score)
    for pid, passagens in invertido.items():
        passagens.sort(
            key=lambda x: (1 if x.get("matchTipo") == "citacao_direta" else 0, x.get("similarity", 0)),
            reverse=True,
        )
        invertido[pid] = passagens[:5]

    # 6. Salva arquivos
    print("🔄 6/6: Persistindo arquivos JSON...")
    arquivos_saida = [OUT_PERICOPES_PUBLIC, OUT_PERICOPES_DATA]
    if REPO_COLDIGOM.exists():
        arquivos_saida.append(OUT_COLDIGOM_DATA)

    for out_path in arquivos_saida:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(resultado_pericopes, f, indent=2, ensure_ascii=False)
        print(f"  💾 Salvo: {out_path} ({len(resultado_pericopes)} perícopes)")

    # Salva índice invertido
    saidas_invertido = [OUT_INVERTIDO_DATA]
    if REPO_COLDIGOM.exists():
        saidas_invertido.append(OUT_INVERTIDO_COLDIGOM)

    for out_path in saidas_invertido:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(invertido, f, indent=2, ensure_ascii=False)
        print(f"  💾 Salvo: {out_path} ({len(invertido)} louvores indexados)")

    print("\n" + "=" * 70)
    print(f"🎉 ASSOCIAÇÃO CONCLUÍDA EM {time.time() - t0:.2f}s!")
    print("=" * 70)

    # Amostras
    for ord_id in [0, 386]:
        p_info = pericope_map.get(ord_id, {})
        print(f"\n📖 Amostra Perícope {ord_id} ({p_info.get('livro')} {p_info.get('capitulo_inicio')}:{p_info.get('versiculo_inicio')}-{p_info.get('versiculo_fim')}):")
        for item in resultado_pericopes[str(ord_id)][:3]:
            cit_txt = f" [{item.get('citacaoBiblica')}]" if item.get('citacaoBiblica') else ""
            print(
                f"   - {item['name']} ({item['number'] or 'S/N'}{cit_txt}): "
                f"Comb {item['similarity']}% | Homilético {item.get('similarityHomiletico')}% [{item['matchTipo']}]"
            )
            if item.get("mensagemCentral"):
                print(f"     💡 {item['mensagemCentral'][:100]}...")


if __name__ == "__main__":
    main()
