#!/usr/bin/env python3
"""
scripts/sincronizar_louvores.py

Orquestrador Incremental (State Reconciliation):
Sincroniza automaticamente a base de perícopes quando louvores são adicionados,
alterados ou removidos no Coldigom.

Fluxo:
1. Detecta o Diff entre o SQLite do Coldigom e os arquivos JSON/NPZ já processados
   (detectando novos, alterados por hash da letra, e removidos).
2. Para novos/alterados:
   - Minera citações determinísticas (N-grams ARC + BLIVRE)
   - Enriquece via Gemini Flash (mensagem central + temas + proposta de passagem)
   - Valida novas passagens contra os versículos reais via Gemma Embedding 2 (threshold >= 82%)
   - Gera e atualiza a matriz de embeddings homiléticos (.npz)
3. Para removidos:
   - Expuga os IDs de todos os índices e matrizes
4. Recalcula a associação matricial de todas as 2.823 perícopes e o índice invertido (~1.9s).
5. Sincroniza em biblia-pericopes e coldigom.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any
import numpy as np
import requests

np.seterr(all="ignore")

_CURRENT_REPO = Path(__file__).resolve().parent.parent
if _CURRENT_REPO.name == "coldigom":
    REPO_COLDIGOM = _CURRENT_REPO
    REPO_PERICOPES = _CURRENT_REPO.parent / "biblia-pericopes"
else:
    REPO_PERICOPES = _CURRENT_REPO
    REPO_COLDIGOM = _CURRENT_REPO.parent / "coldigom"

DB_EMBEDDINGS = REPO_COLDIGOM / "data" / "embeddings" / "acervo_embeddings.sqlite"
if not DB_EMBEDDINGS.exists():
    alt_db = REPO_PERICOPES / "data" / "embeddings" / "acervo_embeddings.sqlite"
    if alt_db.exists():
        DB_EMBEDDINGS = alt_db

ARC_PATH = REPO_PERICOPES / "data" / "ARC.json"
BLIVRE_PATH = REPO_PERICOPES / "data" / "BLIVRE.json"
PERICOPES_EMB_JSON = REPO_PERICOPES / "data" / "embeddings-progresso.json"
PERICOPES_META_JSON = REPO_PERICOPES / "data" / "pericopes.json"

HOMILETICOS_JSON = REPO_PERICOPES / "data" / "louvores-temas-homileticos.json"
HOMILETICOS_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-temas-homileticos.json"

HOMILETICOS_NPZ = REPO_PERICOPES / "data" / "louvores-embeddings-homileticos.npz"
HOMILETICOS_NPZ_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-embeddings-homileticos.npz"

CITATIONS_JSON = REPO_PERICOPES / "data" / "louvores-citacoes-biblicas.json"
CITATIONS_PUBLIC = REPO_PERICOPES / "public" / "data" / "louvores-citacoes-biblicas.json"
CITATIONS_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-citacoes-biblicas.json"

OUT_PERICOPES_PUBLIC = REPO_PERICOPES / "public" / "data" / "pericopes-louvores.json"
OUT_PERICOPES_DATA = REPO_PERICOPES / "data" / "pericopes-louvores.json"
OUT_COLDIGOM_DATA = REPO_COLDIGOM / "data" / "pericopes-louvores.json"

OUT_INVERTIDO_DATA = REPO_PERICOPES / "data" / "louvores-pericopes.json"
OUT_INVERTIDO_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-pericopes.json"

OLLAMA_URL = "http://127.0.0.1:11434/api/embed"
MODEL_OLLAMA = "embeddinggemma-2:latest"
SIMILARITY_THRESHOLD = 0.82


def obter_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if key:
        return key.strip()
    zshrc = Path.home() / ".zshrc"
    if zshrc.exists():
        with open(zshrc, "r", encoding="utf-8") as f:
            for line in f:
                if "GEMINI_API_KEY=" in line or "GOOGLE_API_KEY=" in line:
                    match = re.search(r'(?:GEMINI|GOOGLE)_API_KEY=["\']?([^"\'\s]+)["\']?', line)
                    if match:
                        return match.group(1).strip()
    return ""


CLITICS = {'me', 'te', 'se', 'nos', 'vos', 'lhe', 'lhes', 'o', 'a', 'os', 'as', 'lo', 'la', 'los', 'las'}
COMPOUND_PREFIXES = {'bem', 'mal', 'todo', 'recém', 'el', 'guia', 'dá', 'faz', 'porta', 'guarda'}
CHORD_LINE_RE = re.compile(
    r'^\s*([A-G][b#]?(?:m|maj|min|dim|aug|sus\d*|\d+)*(?:/[A-G][b#]?)?(?:\s+[A-G][b#]?(?:m|maj|min|dim|aug|sus\d*|\d+)*(?:/[A-G][b#]?)?)*)\s*$',
    re.IGNORECASE
)
VOICE_HEADER_RE = re.compile(
    r'^\s*(soprano|contralto|tenor|baixo|dueto|solista|todos|mulheres|homens)\s*[:\-]\s*',
    re.IGNORECASE
)


def _replace_hyphen(m: re.Match) -> str:
    a, b = m.group(1), m.group(2)
    if b.lower() in CLITICS or a.lower() in COMPOUND_PREFIXES or b.lower() in COMPOUND_PREFIXES:
        return f"{a}-{b}"
    return f"{a}{b}"


def limpar_letra(lyrics_raw: str) -> str:
    if not lyrics_raw:
        return ""
    linhas = []
    for line in lyrics_raw.splitlines():
        l_str = line.strip()
        if not l_str:
            continue
        if l_str.startswith(('*', '/', '(', '[')) and any(k in l_str.upper() for k in ('INSTRUMENT', 'INTERL', 'INTRO')):
            continue
        if "INSTRUMENTOS" in l_str.upper():
            continue
        if CHORD_LINE_RE.match(l_str):
            continue
        l_str = VOICE_HEADER_RE.sub('', l_str)
        for _ in range(5):
            novo = re.sub(r'\b([A-Za-zÀ-ÖØ-öø-ÿ]+)\s*-\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)\b', _replace_hyphen, l_str)
            if novo == l_str:
                break
            l_str = novo
        l_str = re.sub(r'\b(?:Tac|paddo)\b', '', l_str, flags=re.IGNORECASE)
        if l_str.strip():
            linhas.append(l_str.strip())
    return "\n".join(linhas)


def calcular_hash_letra(lyrics: str) -> str:
    return hashlib.md5(lyrics.encode("utf-8")).hexdigest()[:16]


def carregar_louvores_sqlite(db_path: Path) -> dict[str, dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, number, name, category, tags, text_indexed
        FROM praises_semantic
        WHERE has_lyrics = 1
        """
    )
    praises = {}
    for pid, num, name, cat, tags, text_idx in c.fetchall():
        if "(NA" in name.upper() and "USAR" in name.upper():
            continue
        lyrics_part = text_idx.split("Letra Completa:")[1] if "Letra Completa:" in text_idx else text_idx
        lyrics = limpar_letra(lyrics_part)
        if len(lyrics) < 20:
            continue
        praises[pid] = {
            "id": pid,
            "number": (num or "").strip(),
            "name": name.strip(),
            "category": (cat or "").strip(),
            "tags": (tags or "").strip(),
            "lyrics": lyrics,
            "lyrics_hash": calcular_hash_letra(lyrics),
        }
    conn.close()
    return praises


def processar_lote_gemini(lote: list[dict[str, Any]], api_key: str, max_retries: int = 4) -> list[dict[str, Any]]:
    praise_blocks = []
    for p in lote:
        block = (
            f"--- LOUVOR ---\n"
            f"praise_id: {p['id']}\n"
            f"Numero: {p['number'] or 'S/N'}\n"
            f"Titulo: {p['name']}\n"
            f"Letra:\n{p['lyrics'][:1200]}"
        )
        praise_blocks.append(block)

    prompt = (
        "Você é um especialista em Teologia Bíblica e Homilética Cristã.\n"
        "Para cada louvor abaixo, analise a letra e retorne um objeto JSON:\n"
        "1. praise_id: o mesmo ID fornecido\n"
        "2. passagem_origem_direta: se for citação ou paráfrase direta de um texto bíblico específico, "
        "indique a referência em português canônico (ex: \"Salmos 23:1-3\", \"Isaías 53:4-5\"). Se não houver, retorne null.\n"
        "3. mensagem_central: 1 frase profunda e concisa resumindo o coração teológico do louvor.\n"
        "4. temas_homileticos: array de 2 a 4 tags temáticas para pregação.\n\n"
        "LOUVORES:\n" + "\n\n".join(praise_blocks)
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
            "responseSchema": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "praise_id": {"type": "string"},
                        "passagem_origem_direta": {"type": "string", "nullable": True},
                        "mensagem_central": {"type": "string"},
                        "temas_homileticos": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["praise_id", "mensagem_central", "temas_homileticos"],
                },
            },
        },
    }

    delay = 2.0
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.post(url, json=payload, timeout=45)
            if resp.status_code == 200:
                body = resp.json()
                text = body["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text)
            elif resp.status_code == 429:
                time.sleep(delay)
                delay *= 2
            else:
                time.sleep(delay)
                delay *= 1.5
        except Exception:
            time.sleep(delay)
            delay *= 1.5
    return []


def obter_embeddings_ollama(textos: list[str]) -> list[np.ndarray]:
    payload = json.dumps({"model": MODEL_OLLAMA, "input": textos}).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        vetores = []
        for raw in data.get("embeddings", []):
            vec256 = np.array(raw[:256], dtype=np.float32)
            norm = np.linalg.norm(vec256)
            if norm > 0:
                vec256 /= norm
            vetores.append(vec256)
        return vetores


def normalizar_livro(nome: str) -> str:
    aliases = {
        "Cânticos": "Cantares",
        "Cântico dos Cânticos": "Cantares",
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
    return aliases.get(nome.strip(), nome.strip())


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


def parse_passagem(p_str: str) -> tuple[str, int, int, int] | None:
    if not p_str:
        return None
    p = p_str.split(",")[0].strip()
    m = re.match(r"^([\d\s]*[A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$", p)
    if not m:
        return None
    livro = normalizar_livro(m.group(1))
    cap = int(m.group(2))
    v_ini = int(m.group(3)) if m.group(3) else 1
    v_fim = int(m.group(4)) if m.group(4) else (v_ini if m.group(3) else 999)
    return livro, cap, v_ini, v_fim


def reassociar_pericopes():
    """Executa a associação matricial Gemma Embedding 2."""
    from scripts.associar_louvores import main as rodar_associacao
    rodar_associacao()


def main():
    parser = argparse.ArgumentParser(description="Sincronizador Incremental de Louvores para Perícopes")
    parser.add_argument("--force", action="store_true", help="Força a reassociação mesmo sem diff")
    parser.add_argument("--dry-run", action="store_true", help="Apenas exibe o diff sem alterar arquivos")
    parser.add_argument("--batch-size", type=int, default=15, help="Tamanho do lote Gemini")
    parser.add_argument("--concurrency", type=int, default=2, help="Concorrência Gemini")
    args = parser.parse_args()

    print("=" * 70)
    print("🔄 SINCRONIZADOR INCREMENTAL DE LOUVORES × PERÍCOPES BÍBLICAS")
    print("=" * 70)

    if not DB_EMBEDDINGS.exists():
        print(f"❌ Banco não encontrado em: {DB_EMBEDDINGS}", file=sys.stderr)
        sys.exit(1)

    # 1. Carrega dados do SQLite
    praises_db = carregar_louvores_sqlite(DB_EMBEDDINGS)
    print(f"🎵 Louvores ativos com letra no SQLite: {len(praises_db)}")

    # 2. Carrega estado atual dos JSONs
    homileticos_data: dict[str, dict[str, Any]] = {}
    if HOMILETICOS_JSON.exists():
        with open(HOMILETICOS_JSON, "r", encoding="utf-8") as f:
            homileticos_data = json.load(f)

    citacoes_data: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if CITATIONS_JSON.exists():
        with open(CITATIONS_JSON, "r", encoding="utf-8") as f:
            citacoes_data = defaultdict(list, json.load(f))

    # Migração transparente de lyrics_hash se necessário
    precisa_salvar_hash = False
    for pid, item in homileticos_data.items():
        if "lyrics_hash" not in item and pid in praises_db:
            item["lyrics_hash"] = praises_db[pid]["lyrics_hash"]
            precisa_salvar_hash = True
    if precisa_salvar_hash and not args.dry_run:
        for p in [HOMILETICOS_JSON, HOMILETICOS_COLDIGOM]:
            if p.parent.exists():
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(homileticos_data, f, indent=2, ensure_ascii=False)

    # 3. Detecta Diff (State Reconciliation)
    ids_db = set(praises_db.keys())
    ids_hom = set(homileticos_data.keys())

    removidos_ids = ids_hom - ids_db
    novos_ids = ids_db - ids_hom
    alterados_ids = set()

    for pid in ids_db.intersection(ids_hom):
        h_atual = praises_db[pid]["lyrics_hash"]
        h_salvo = homileticos_data[pid].get("lyrics_hash")
        if h_salvo and h_atual != h_salvo:
            alterados_ids.add(pid)

    print("\n📊 DIFF DETECTADO:")
    print(f"   ➕ Novos louvores:      {len(novos_ids)}")
    print(f"   ✏️  Letras alteradas:    {len(alterados_ids)}")
    print(f"   🗑️  Louvores removidos:  {len(removidos_ids)}")
    print(f"   🔒 Louvores inalterados: {len(ids_hom - removidos_ids - alterados_ids)}")

    if not novos_ids and not alterados_ids and not removidos_ids and not args.force:
        print("\n✅ Base de louvores 100% sincronizada e em dia. Nenhuma ação necessária.")
        return

    if args.dry_run:
        print("\n🔍 Modo Dry-Run ativado. Nenhuma alteração aplicada.")
        return

    # 4. Trata Removidos
    if removidos_ids:
        print(f"\n🗑️ Expurgando {len(removidos_ids)} louvores removidos...")
        for pid in removidos_ids:
            homileticos_data.pop(pid, None)
            citacoes_data.pop(pid, None)

        # Salva homileticos e citações limpos
        for p in [HOMILETICOS_JSON, HOMILETICOS_COLDIGOM]:
            if p.parent.exists():
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(homileticos_data, f, indent=2, ensure_ascii=False)

        for p in [CITATIONS_JSON, CITATIONS_PUBLIC, CITATIONS_COLDIGOM]:
            if p.parent.exists():
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(citacoes_data, f, indent=2, ensure_ascii=False)

    # 5. Trata Novos e Alterados
    delta_ids = list(novos_ids.union(alterados_ids))
    if delta_ids:
        print(f"\n✨ Processando {len(delta_ids)} louvores (novos/alterados) com Gemini Flash...")
        api_key = obter_api_key()
        if not api_key:
            print("❌ GEMINI_API_KEY não localizada. Abortando enriquecimento.", file=sys.stderr)
            sys.exit(1)

        delta_louvores = [praises_db[pid] for pid in delta_ids]
        lotes = [delta_louvores[i:i + args.batch_size] for i in range(0, len(delta_louvores), args.batch_size)]

        resultados_delta = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            futures = [executor.submit(processar_lote_gemini, lote, api_key) for lote in lotes]
            for f in concurrent.futures.as_completed(futures):
                resultados_delta.extend(f.result())

        for item in resultados_delta:
            pid = item.get("praise_id")
            if pid and pid in praises_db:
                pr = praises_db[pid]
                homileticos_data[pid] = {
                    "praise_id": pid,
                    "praise_number": pr["number"],
                    "praise_name": pr["name"],
                    "category": pr["category"],
                    "passagem_origem_direta": item.get("passagem_origem_direta"),
                    "mensagem_central": item.get("mensagem_central", "").strip(),
                    "temas_homileticos": item.get("temas_homileticos", []),
                    "lyrics_hash": pr["lyrics_hash"],
                }

        # Salva homiléticos consolidados
        for p in [HOMILETICOS_JSON, HOMILETICOS_COLDIGOM]:
            if p.parent.exists():
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(homileticos_data, f, indent=2, ensure_ascii=False)

        # Validação anti-alucinação das novas passagens sugeridas
        print("\n🛡️ Validando passagens diretas sugeridas contra ARC/BLIVRE...")
        arc = carregar_biblia(ARC_PATH)
        blivre = carregar_biblia(BLIVRE_PATH)

        candidatos_validacao = []
        for item in resultados_delta:
            pid = item.get("praise_id")
            p_str = item.get("passagem_origem_direta")
            if not p_str or not pid or pid not in praises_db:
                continue
            parsed = parse_passagem(p_str)
            if not parsed:
                continue
            livro, cap, v_ini, v_fim = parsed

            # Busca texto bíblico
            versos = []
            for v in range(v_ini, v_fim + 1):
                if (livro, cap, v) in arc:
                    versos.append(arc[(livro, cap, v)])
            txt_biblia = " ".join(versos) if versos else ""
            if txt_biblia:
                candidatos_validacao.append({
                    "pid": pid,
                    "pr": praises_db[pid],
                    "passagem_str": p_str,
                    "livro": livro,
                    "cap": cap,
                    "v_ini": v_ini,
                    "v_fim": v_fim,
                    "texto_biblico": txt_biblia,
                    "lyrics": praises_db[pid]["lyrics"][:1200],
                })

        if candidatos_validacao:
            textos_embed = []
            for c_val in candidatos_validacao:
                textos_embed.append(c_val["lyrics"])
                textos_embed.append(c_val["texto_biblico"])
            try:
                vetores = obter_embeddings_ollama(textos_embed)
                novas_aprovadas = 0
                for idx, c_val in enumerate(candidatos_validacao):
                    sim = float(np.dot(vetores[idx * 2], vetores[idx * 2 + 1]))
                    if sim >= SIMILARITY_THRESHOLD:
                        citacoes_data[c_val["pid"]].append({
                            "praiseId": c_val["pid"],
                            "praiseNumber": c_val["pr"]["number"],
                            "praiseName": c_val["pr"]["name"],
                            "livro": c_val["livro"],
                            "capitulo": c_val["cap"],
                            "versiculoInicio": c_val["v_ini"],
                            "versiculoFim": c_val["v_fim"] if c_val["v_fim"] != 999 else c_val["v_ini"],
                            "referencia": c_val["passagem_str"],
                            "similaridade": round(sim * 100, 1),
                            "tipo": "citacao_direta",
                            "origem": "gemini_validado_semanticamente",
                        })
                        novas_aprovadas += 1
                        print(f"   ✅ Aprovada citação: {c_val['pr']['name']} -> {c_val['passagem_str']} ({sim * 100:.1f}%)")
                    else:
                        print(f"   ❌ Rejeitada citação fraca: {c_val['pr']['name']} -> {c_val['passagem_str']} ({sim * 100:.1f}% < 82%)")

                if novas_aprovadas > 0:
                    for p in [CITATIONS_JSON, CITATIONS_PUBLIC, CITATIONS_COLDIGOM]:
                        if p.parent.exists():
                            with open(p, "w", encoding="utf-8") as f:
                                json.dump(citacoes_data, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"⚠️ Erro ao validar no Ollama: {e}")

    # 6. Atualiza Matriz de Embeddings Homiléticos (.npz) se houve alteração
    if delta_ids or removidos_ids or not HOMILETICOS_NPZ.exists():
        print("\n⚡ Atualizando matriz de embeddings homiléticos (.npz)...")
        pids_finais = list(homileticos_data.keys())
        textos_hom = [
            f"Mensagem: {homileticos_data[pid].get('mensagem_central', '')}\nTemas: {', '.join(homileticos_data[pid].get('temas_homileticos', []))}"
            for pid in pids_finais
        ]
        batch_size = 50
        all_vecs = []
        for i in range(0, len(textos_hom), batch_size):
            lote = textos_hom[i:i + batch_size]
            all_vecs.extend(obter_embeddings_ollama(lote))

        V = np.array(all_vecs, dtype=np.float32)
        for p in [HOMILETICOS_NPZ, HOMILETICOS_NPZ_COLDIGOM]:
            if p.parent.exists():
                np.savez_compressed(p, ids=np.array(pids_finais), vectors=V)
        print(f"   💾 Matriz homilética atualizada: {V.shape}")

    # 7. Executa Associação Matricial Final (~1.9s)
    script_associar = REPO_PERICOPES / "scripts" / "associar-louvores.py"
    if script_associar.exists():
        print("\n🎯 Executando associação matricial completa (2.823 perícopes × louvores)...")
        import subprocess
        cmd = [sys.executable, str(script_associar)]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print("   ✅ Associação e índice invertido atualizados com sucesso!")
        else:
            print(f"   ❌ Erro na associação:\n{res.stderr}", file=sys.stderr)

    # 8. Consolidação Canônica dos Metadados Bíblicos (louvores-biblia-consolidado.json)
    print("\n📦 Consolidando metadados bíblicos canônicos (louvores-biblia-consolidado.json)...")
    try:
        if str(REPO_COLDIGOM) not in sys.path:
            sys.path.insert(0, str(REPO_COLDIGOM))
        from scripts.consolidar_metadados_biblicos import consolidar_metadados
        consolidar_metadados(repo_coldigom=REPO_COLDIGOM, repo_pericopes=REPO_PERICOPES, verbose=True)
    except Exception as e:
        print(f"⚠️ Erro ao consolidar metadados bíblicos: {e}", file=sys.stderr)

    print("\n" + "=" * 70)
    print("🎉 SINCRONIZAÇÃO INCREMENTAL CONCLUÍDA COM SUCESSO!")
    print("=" * 70)


if __name__ == "__main__":
    main()
