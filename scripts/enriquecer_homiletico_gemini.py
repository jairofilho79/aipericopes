#!/usr/bin/env python3
"""
scripts/enriquecer_homiletico_gemini.py

Camada 2: Enriquecimento Homilético do Acervo Coldigom com Gemini Flash.
Processa os louvores com letra em lotes, extraindo:
1. passagem_origem_direta (se houver citação/paráfrase direta)
2. mensagem_central (1 frase teológica/espiritual profunda)
3. temas_homileticos (2 a 4 tags temáticas para pregação/estudo)

Saída:
- data/louvores-temas-homileticos.json
- ../coldigom/data/louvores-temas-homileticos.json
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any
import requests

REPO_PERICOPES = Path(__file__).resolve().parent.parent
REPO_COLDIGOM = REPO_PERICOPES.parent / "coldigom"

DB_EMBEDDINGS = REPO_COLDIGOM / "data" / "embeddings" / "acervo_embeddings.sqlite"
if not DB_EMBEDDINGS.exists():
    # Tenta caminho relativo se rodando de dentro do coldigom
    alt_db = REPO_PERICOPES / "data" / "embeddings" / "acervo_embeddings.sqlite"
    if alt_db.exists():
        DB_EMBEDDINGS = alt_db

OUT_DATA = REPO_PERICOPES / "data" / "louvores-temas-homileticos.json"
OUT_COLDIGOM = REPO_COLDIGOM / "data" / "louvores-temas-homileticos.json"


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


def carregar_louvores(db_path: Path) -> list[dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute(
        """
        SELECT id, number, name, category, tags, text_indexed
        FROM praises_semantic
        WHERE has_lyrics = 1
        ORDER BY CASE WHEN number IS NULL OR number = '' OR number = 'S/N' THEN 999999 ELSE CAST(number AS INTEGER) END, name
        """
    )
    praises = []
    for pid, num, name, cat, tags, text_idx in c.fetchall():
        if "(NA" in name.upper() and "USAR" in name.upper():
            continue
        lyrics = text_idx.split("Letra Completa:")[1] if "Letra Completa:" in text_idx else text_idx
        # Remove seções puramente instrumentais
        clean_lyrics = "\n".join(
            line.strip()
            for line in lyrics.splitlines()
            if line.strip() and not line.strip().startswith(("*", "/")) and "INSTRUMENTOS" not in line.upper()
        )
        if len(clean_lyrics) < 20:
            continue

        praises.append({
            "id": pid,
            "number": (num or "").strip(),
            "name": name.strip(),
            "category": (cat or "").strip(),
            "tags": (tags or "").strip(),
            "lyrics": clean_lyrics[:1200],  # Primeiros 1200 caracteres bastam para o teor teológico
        })
    conn.close()
    return praises


def processar_lote_gemini(
    lote: list[dict[str, Any]],
    api_key: str,
    max_retries: int = 5
) -> list[dict[str, Any]]:
    praise_blocks = []
    for p in lote:
        block = (
            f"--- LOUVOR ---\n"
            f"praise_id: {p['id']}\n"
            f"Numero: {p['number'] or 'S/N'}\n"
            f"Titulo: {p['name']}\n"
            f"Letra:\n{p['lyrics']}"
        )
        praise_blocks.append(block)

    prompt = (
        "Você é um especialista em Teologia Bíblica e Homilética Cristã.\n"
        "Para cada louvor abaixo, analise cuidadosamente a letra e retorne um objeto JSON:\n"
        "1. praise_id: o mesmo ID fornecido no louvor\n"
        "2. passagem_origem_direta: se a letra for uma citação literal ou paráfrase direta de um trecho bíblico específico, "
        "forneça a referência bíblica em português canônico (ex: \"Salmos 23:1-3\", \"Isaías 53:4-5\", \"Deuteronômio 32:1-4\"). "
        "Se o louvor expressar apenas sentimentos gerais ou teologia sem ter sido composto diretamente sobre um texto bíblico específico, retorne null.\n"
        "3. mensagem_central: 1 frase profunda, rica e concisa resumindo o coração teológico e a proclamação espiritual do louvor.\n"
        "4. temas_homileticos: array de 2 a 4 tags temáticas adequadas para classificação e pregação (ex: [\"Soberania de Deus\", \"Esperança na Tribulação\", \"Fidelidade Divina\"]).\n\n"
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
                        "temas_homileticos": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["praise_id", "mensagem_central", "temas_homileticos"]
                }
            }
        }
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
                print(f"⚠️ [HTTP 429 Rate Limit] Aguardando {delay:.1f}s antes de tentar novamente (tentativa {attempt}/{max_retries})...")
                time.sleep(delay)
                delay *= 2
            else:
                print(f"⚠️ [HTTP {resp.status_code}] {resp.text[:200]} - tentativa {attempt}/{max_retries}")
                time.sleep(delay)
                delay *= 1.5
        except Exception as e:
            print(f"⚠️ Erro na requisição: {e} - tentativa {attempt}/{max_retries}")
            time.sleep(delay)
            delay *= 1.5

    print(f"❌ Falha ao processar lote de {len(lote)} louvores após {max_retries} tentativas.")
    return []


def salvar_resultados(resultados: dict[str, dict[str, Any]]):
    saidas = [OUT_DATA]
    if REPO_COLDIGOM.exists():
        saidas.append(OUT_COLDIGOM)

    for out_path in saidas:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(resultados, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description="Enriquecimento Homilético com Gemini Flash")
    parser.add_argument("--batch-size", type=int, default=15, help="Tamanho do lote por chamada (default: 15)")
    parser.add_argument("--concurrency", type=int, default=2, help="Chamadas concorrentes (default: 2)")
    parser.add_argument("--limit", type=int, default=None, help="Limite máximo de louvores para teste")
    parser.add_argument("--force", action="store_true", help="Reprocessar louvores já existentes")
    args = parser.parse_args()

    print("=" * 70)
    print("✨ CAMADA 2: ENRIQUECIMENTO HOMILÉTICO COM GEMINI FLASH")
    print("=" * 70)

    api_key = obter_api_key()
    if not api_key:
        print("❌ GEMINI_API_KEY não encontrada no ambiente nem no ~/.zshrc", file=sys.stderr)
        sys.exit(1)
    print("🔑 Chave API Gemini detectada com sucesso.")

    if not DB_EMBEDDINGS.exists():
        print(f"❌ Banco não encontrado em: {DB_EMBEDDINGS}", file=sys.stderr)
        sys.exit(1)

    praises = carregar_louvores(DB_EMBEDDINGS)
    print(f"🎵 Total de louvores válidos com letra: {len(praises)}")

    if args.limit:
        praises = praises[:args.limit]
        print(f"⚠️ Modo de teste: limitado aos primeiros {len(praises)} louvores")

    # Carrega progresso anterior
    resultados: dict[str, dict[str, Any]] = {}
    if OUT_DATA.exists() and not args.force:
        try:
            with open(OUT_DATA, "r", encoding="utf-8") as f:
                resultados = json.load(f)
            print(f"📂 Progresso anterior carregado: {len(resultados)} louvores já enriquecidos.")
        except Exception:
            resultados = {}

    praise_map = {p["id"]: p for p in praises}
    pendentes = [p for p in praises if p["id"] not in resultados]
    print(f"⏳ Louvores pendentes de análise: {len(pendentes)}")

    if not pendentes:
        print("✅ Todos os louvores já estão enriquecidos!")
        salvar_resultados(resultados)
        return

    # Dividir em lotes
    lotes = [pendentes[i:i + args.batch_size] for i in range(0, len(pendentes), args.batch_size)]
    print(f"📦 Total de lotes: {len(lotes)} (tamanho: {args.batch_size}, concorrência: {args.concurrency})")

    t0 = time.time()
    lotes_processados = 0
    total_lotes = len(lotes)

    def processar_um_lote(lote_idx_item):
        idx, l_data = lote_idx_item
        res_itens = processar_lote_gemini(l_data, api_key)
        return idx, l_data, res_itens

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(processar_um_lote, (idx, lote))
            for idx, lote in enumerate(lotes)
        ]
        for f in concurrent.futures.as_completed(futures):
            idx, l_data, res_itens = f.result()
            lotes_processados += 1

            for item in res_itens:
                pid = item.get("praise_id")
                if pid and pid in praise_map:
                    pr = praise_map[pid]
                    resultados[pid] = {
                        "praise_id": pid,
                        "praise_number": pr["number"],
                        "praise_name": pr["name"],
                        "category": pr["category"],
                        "passagem_origem_direta": item.get("passagem_origem_direta"),
                        "mensagem_central": item.get("mensagem_central", "").strip(),
                        "temas_homileticos": item.get("temas_homileticos", []),
                    }

            salvar_resultados(resultados)
            progresso_pct = (lotes_processados / total_lotes) * 100
            elapsed = time.time() - t0
            print(
                f"[{lotes_processados:02d}/{total_lotes:02d}] "
                f"{progresso_pct:5.1f}% concluído | "
                f"{len(resultados)} louvores salvos | "
                f"Tempo: {elapsed:.1f}s"
            )

    print("\n" + "=" * 70)
    print(f"🎉 ENRIQUECIMENTO CONCLUÍDO EM {time.time() - t0:.1f}s!")
    print(f"📊 Total consolidado: {len(resultados)} louvores enriquecidos.")
    print("=" * 70)


if __name__ == "__main__":
    main()
