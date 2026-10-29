#!/usr/bin/env python3
"""
Extrai todas as palavras acrescentadas pelos tradutores da Bíblia ARC (Almeida Revista e Corrigida - Edição 4ª),
representadas no EPUB por itálicos de suprimento tradutológico (<em class="add">...</em> e <em class="wjadd">...</em>).

Gera um arquivo JSON estruturado em data-arc/italicos-suprimento-arc.json contendo:
- total_palavras_acrescentadas: contagem total de palavras/expressões de suprimento
- total_versiculos_com_acrescimos: quantidade de versículos bíblicos que possuem acréscimos
- por_livro: contagem de ocorrências por livro bíblico (66 livros canônicos)
- versiculos: lista ordenada de todos os versículos com suas respectivas adições limpas
"""

import os
import re
import json
import glob
import zipfile
import html
from collections import OrderedDict

# Mapeamento oficial dos 66 livros da Bíblia canônica protestante
BOOK_NAMES_PT = {
    'Genesis': 'Gênesis',
    'Exodo': 'Êxodo',
    'Levitico': 'Levítico',
    'Numeros': 'Números',
    'Deuteronomio': 'Deuteronômio',
    'Josue': 'Josué',
    'Juizes': 'Juízes',
    'Rute': 'Rute',
    '1Samuel': '1 Samuel',
    '2Samuel': '2 Samuel',
    '1Reis': '1 Reis',
    '2Reis': '2 Reis',
    '1Cronicas': '1 Crônicas',
    '2Cronicas': '2 Crônicas',
    'Esdras': 'Esdras',
    'Neemias': 'Neemias',
    'Ester': 'Ester',
    'Jo': 'Jó',
    'Salmos': 'Salmos',
    'Proverbios': 'Provérbios',
    'Eclesiastes': 'Eclesiastes',
    'Cantares': 'Cantares',
    'Isaias': 'Isaías',
    'Jeremias': 'Jeremias',
    'Lamentacoes': 'Lamentações',
    'Ezequiel': 'Ezequiel',
    'Daniel': 'Daniel',
    'Oseias': 'Oséias',
    'Joel': 'Joel',
    'Amos': 'Amós',
    'Obadias': 'Obadias',
    'Jonas': 'Jonas',
    'Miqueias': 'Miquéias',
    'Naum': 'Naum',
    'Habacuque': 'Habacuque',
    'Sofonias': 'Sofonias',
    'Ageu': 'Ageu',
    'Zacarias': 'Zacarias',
    'Malaquias': 'Malaquias',
    'Mateus': 'Mateus',
    'Marcos': 'Marcos',
    'Lucas': 'Lucas',
    'Joao': 'João',
    'Atos': 'Atos',
    'Romanos': 'Romanos',
    '1Corintios': '1 Coríntios',
    '2Corintios': '2 Coríntios',
    'Galatas': 'Gálatas',
    'Efesios': 'Efésios',
    'Filipenses': 'Filipenses',
    'Colossenses': 'Colossenses',
    '1Tessalonicenses': '1 Tessalonicenses',
    '2Tessalonicenses': '2 Tessalonicenses',
    '1Timoteo': '1 Timóteo',
    '2Timoteo': '2 Timóteo',
    'Tito': 'Tito',
    'Filemom': 'Filemom',
    'Hebreus': 'Hebreus',
    'Tiago': 'Tiago',
    '1Pedro': '1 Pedro',
    '2Pedro': '2 Pedro',
    '1Joao': '1 João',
    '2Joao': '2 João',
    '3Joao': '3 João',
    'Judas': 'Judas',
    'Apocalipse': 'Apocalipse'
}

PUNCT_TO_STRIP = ' \t\r\n.,;:?!()[]"\'“”«»—–-'

def extrair_italicos_suprimento(epub_path: str):
    if not os.path.exists(epub_path):
        raise FileNotFoundError(f"Arquivo EPUB não encontrado: {epub_path}")

    with zipfile.ZipFile(epub_path, 'r') as z:
        all_files = sorted([n for n in z.namelist() if n.startswith('OEBPS/text') and n.endswith('.html')])
        
        chapter_files = []
        for fn in all_files:
            c = z.read(fn).decode('utf-8', errors='ignore')
            div_m = re.search(r'<div id="ARC([^"]+)"', c)
            if div_m:
                div_id = div_m.group(1)
                if not div_id.endswith('Intro') and div_id != '-998.html':
                    m = re.match(r'^([A-Za-z0-9_áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]+?)(\d+)$', div_id)
                    if m:
                        b_key = m.group(1)
                        ch_num = int(m.group(2))
                        chapter_files.append((fn, b_key, ch_num, c))

    # Preservar ordem canônica dos livros
    books_order = []
    for _, b_key, _, _ in chapter_files:
        if b_key not in books_order:
            books_order.append(b_key)

    por_livro = OrderedDict()
    for b_key in books_order:
        por_livro[BOOK_NAMES_PT[b_key]] = 0

    versiculos = []
    total_palavras = 0

    for fn, b_key, ch_num, c in chapter_files:
        b_name = BOOK_NAMES_PT[b_key]
        v_matches = list(re.finditer(r'<a\s+[^>]*class="(?:v|vwj)"[^>]*id="v(\d+)"', c))
        
        for i, vm in enumerate(v_matches):
            vnum = int(vm.group(1))
            start = vm.end()
            end = v_matches[i + 1].start() if i + 1 < len(v_matches) else c.find('</div>', start)
            if end == -1:
                end = len(c)
                
            vtext = c[start:end]
            
            words = []
            for m in re.finditer(r'<em\s+class="(?:add|wjadd)"[^>]*>(.*?)</em>', vtext, re.DOTALL):
                raw_text = html.unescape(m.group(1))
                normalized = re.sub(r'\s+', ' ', raw_text).strip()
                cleaned = normalized.strip(PUNCT_TO_STRIP)
                if cleaned:
                    words.append(cleaned)

            if words:
                total_palavras += len(words)
                por_livro[b_name] += len(words)
                versiculos.append({
                    'livro': b_name,
                    'capitulo': ch_num,
                    'versiculo': vnum,
                    'referencia': f'{b_name} {ch_num}:{vnum}',
                    'palavras': words
                })

    resultado = {
        'total_palavras_acrescentadas': total_palavras,
        'total_versiculos_com_acrescimos': len(versiculos),
        'por_livro': por_livro,
        'versiculos': versiculos
    }

    return resultado

if __name__ == '__main__':
    epub_files = glob.glob('*.epub')
    if not epub_files:
        print("Nenhum arquivo .epub encontrado na raiz.")
        exit(1)

    epub_file = epub_files[0]
    print(f"Processando EPUB: {epub_file}...")
    res = extrair_italicos_suprimento(epub_file)

    print("\nEstatísticas da Extração:")
    print(f"- Total de palavras acrescentadas: {res['total_palavras_acrescentadas']}")
    print(f"- Total de versículos com acréscimos: {res['total_versiculos_com_acrescimos']}")
    print(f"- Total de livros com acréscimos: {len(res['por_livro'])}")

    out_file = 'data-arc/italicos-suprimento-arc.json'
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    mb = os.path.getsize(out_file) / (1024 * 1024)
    print(f"\nArquivo gravado com sucesso em: {out_file} ({mb:.2f} MB)")
