#!/usr/bin/env python3
"""
Extrai todas as Palavras de Jesus (Red Letter) no Novo Testamento contidas no arquivo .epub da Bíblia ARC (Edição 4ª).
Livros: Mateus, Marcos, Lucas, João, Atos, 1 Coríntios, 2 Coríntios e Apocalipse.

Gera um arquivo JSON estruturado em data-arc/palavras-de-jesus-arc.json contendo:
- total_trechos (~3.763 tags wj)
- total_versiculos_com_fala_de_jesus (2.035)
- livros: estatísticas por livro
- versiculos: lista com livro, abrev, capitulo, versiculo, referencia, fala_completa_jesus, trechos
"""

import os
import sys
import re
import json
import zipfile
from html import unescape
from collections import defaultdict

A_FRAGMENTS = {
    'baixa', 'bateu', 'bençoa', 'bençoaste', 'borrecem', 'borreço', 'braão', 'bre',
    'bri', 'bsalão', 'cabadas', 'cabando', 'cabou', 'cerca', 'chaste', 'chei', 'cho',
    'conteceu', 'cordando', 'dmoesta', 'dmoesto', 'dão', 'gora', 'guardo', 'h', 'i',
    'iezer', 'inda', 'juda', 'juntando', 'juntou', 'lcançou', 'legra', 'legrei',
    'lguns', 'li', 'lvoroçai', 'lçai', 'lém', 'mado', 'mados', 'mai', 'marás',
    'mazias', 'mo', 'ndai', 'ndando', 'ndaram', 'ndarei', 'ndarão', 'ntes',
    'nunciai', 'o', 'os', 'panhai', 'parta', 'partai', 'pascenta', 'plaudi',
    'plicando', 'presentai', 'pressa', 'proximando', 'proximou', 'quele',
    'queles', 'rabe', 'ristarco', 'rmaram', 'rvorai', 's', 'sael', 'sdode',
    'ssenta', 'ssim', 'tendei', 'tenta', 'té'
}
O_FRAGMENTS = {
    'h', 'lha', 'lhais', 'lharam', 'lá', 'nde', 'ra', 'rai', 'ração', 'rna',
    's', 'u', 'usa', 'utra', 'uve', 'uvi', 'uvimos', 'uvindo', 'uviu'
}
E_FRAGMENTS = {
    'crom', 'fraim', 'ia', 'is', 'le', 'les', 'm', 'mbriagai', 'nfadais', 'nganoso',
    'nquanto', 'nsina', 'nsinai', 'nsinar', 'ntrai', 'ntrando', 'ntraram', 'ntrarei',
    'ntre', 'ntretanto', 'ntrou', 'ntão', 'nviai', 'nviando', 'nviaram', 'nviou',
    'ra', 'ram', 'scondeu', 'screvi', 'screvo', 'scuta', 'scutai', 'sforçai',
    'spere', 'sperei', 'squadrinhemos', 'ssa', 'ssas', 'sta', 'stai', 'stais',
    'stando', 'stas', 'stava', 'ste', 'stende', 'stes', 'stá', 'u', 'xalta',
    'xaltado', 'xaltai', 'xaltar', 'xaminai', 'xistiu'
}

def fix_drop(m):
    letter = m.group(1).strip()
    rest = m.group(2).strip()
    if letter == 'S' and rest == 'ENHOR': return 'SENHOR'
    if letter == 'A':
        return letter + rest if rest.lower() in A_FRAGMENTS else letter + ' ' + rest
    elif letter == 'O':
        return letter + rest if rest.lower() in O_FRAGMENTS else letter + ' ' + rest
    elif letter == 'E':
        return letter + rest if rest.lower() in E_FRAGMENTS else letter + ' ' + rest
    else:
        return letter + rest

def clean_snippet(text: str) -> str:
    t = re.sub(r'</?(?:p|div|h[1-6]|br)[^>]*>', ' ', text)
    t = re.sub(r'<[^>]+>', '', t)
    t = unescape(t)
    t = re.sub(r'[\xa0\s]+', ' ', t).strip()
    t = re.sub(r'\s+([,.;:?!])', r'\1', t)
    t = re.sub(r'\(\s+', '(', t)
    t = re.sub(r'\s+\)', ')', t)
    return t

def preprocess_verse_html(v_raw: str) -> str:
    # 1. Strip footnotes
    h = re.sub(r'<span class=\"chamada\".*?</span>', '', v_raw, flags=re.DOTALL)
    h = re.sub(r'<a[^>]*class=\"footnote-link\"[^>]*>.*?</a>', '', h, flags=re.DOTALL)
    
    # 2. Strip verse anchor tags
    h = re.sub(r'<a[^>]*class=\"(?:v|vwj)\"[^>]*>.*?</a>', '', h, flags=re.DOTALL)
    
    # 3. Handle SENHOR in wjnd: attach to preceding wj
    h = re.sub(r'<span class=\"wj\">(.*?S)</span>\s*<span class=\"wjnd\">ENHOR</span>', r'<span class=\"wj\">\1ENHOR</span>', h)
    h = re.sub(r'<span\s+class=\"wjnd\">ENHOR</span>', 'ENHOR', h)
    
    # 4. Handle drop caps (bdwj):
    h = re.sub(
        r'<strong\s+class=\"bdwj\">([A-ZÁÉÍÓÚÂÊÔÃÕÇ])</strong>\s*<span\s+class=\"wj\">([a-záéíóúãõâêîôûçA-ZÁÉÍÓÚÂÊÔÃÕÇ]+)',
        lambda m: f'<span class=\"wj\">{fix_drop(m)}',
        h
    )
    h = re.sub(
        r'<strong\s+class=\"bdwj\">([A-ZÁÉÍÓÚÂÊÔÃÕÇ])</strong>\s*<span\s+class=\"wj\">([,.;:?!])',
        r'<span class=\"wj\">\1\2',
        h
    )
    h = re.sub(
        r'<strong\s+class=\"bdwj\">([A-ZÁÉÍÓÚÂÊÔÃÕÇ])</strong>\s*<em\s+class=\"wjadd\">([a-záéíóúãõâêîôûçA-ZÁÉÍÓÚÂÊÔÃÕÇ]+)',
        lambda m: f'<em class=\"wjadd\">{fix_drop(m)}',
        h
    )
    h = re.sub(
        r'<strong\s+class=\"bdwj\">([A-ZÁÉÍÓÚÂÊÔÃÕÇ])</strong>\s*<span\s+class=\"wj\">',
        r'<span class=\"wj\">\1 ',
        h
    )
    
    # 5. Handle wjadd adjacent to wj
    for _ in range(3):
        h = re.sub(r'<em\s+class=\"wjadd\">([^<]+)</em>\s*<span\s+class=\"wj\">', r'<span class=\"wj\">\1 ', h)
        h = re.sub(r'<span\s+class=\"wj\">([^<]+)</span>\s*<em\s+class=\"wjadd\">([^<]+)</em>', r'<span class=\"wj\">\1 \2</span>', h)
        
    return h

BOOKS_ORDER = [
    ('Mateus', 'Mateus', 'Mt'),
    ('Marcos', 'Marcos', 'Mc'),
    ('Lucas', 'Lucas', 'Lc'),
    ('Joao', 'João', 'Jo'),
    ('Atos', 'Atos', 'At'),
    ('1Corintios', '1 Coríntios', '1Co'),
    ('2Corintios', '2 Coríntios', '2Co'),
    ('Apocalipse', 'Apocalipse', 'Ap')
]

def extrair_palavras_de_jesus(epub_path: str):
    if not os.path.exists(epub_path):
        raise FileNotFoundError(f"Arquivo EPUB não encontrado: {epub_path}")

    with zipfile.ZipFile(epub_path, 'r') as z:
        all_files = sorted([n for n in z.namelist() if n.startswith('OEBPS/text') and n.endswith('.html')])
        
        chapters_by_book = defaultdict(list)
        for fn in all_files:
            c = z.read(fn).decode('utf-8', errors='ignore')
            div_m = re.search(r'<div id=\"ARC([^\"]+)\"', c)
            if not div_m: continue
            div_id = div_m.group(1)
            if div_id.endswith('Intro') or div_id == '-998.html': continue
            m = re.match(r'^([A-Za-z0-9_áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]+?)(\d+)$', div_id)
            if not m: continue
            b_key = m.group(1)
            ch_num = int(m.group(2))
            chapters_by_book[b_key].append((ch_num, fn, c))

    versiculos_resultado = []
    estatisticas_livros = []
    total_trechos_global = 0

    for b_pos, (b_key, b_nome, b_abrev) in enumerate(BOOKS_ORDER, 1):
        chs = chapters_by_book.get(b_key, [])
        chs.sort(key=lambda x: x[0])
        
        livro_versiculos_count = 0
        livro_trechos_count = 0
        
        for ch_num, fn, c in chs:
            v_tokens = list(re.finditer(r'<a\s+[^>]*class=\"(?:v|vwj)\"\s+id=\"v(\d+)\"[^>]*>', c))
            for idx, v_tok in enumerate(v_tokens):
                vnum = int(v_tok.group(1))
                start = v_tok.end()
                end = v_tokens[idx+1].start() if idx+1 < len(v_tokens) else c.find('</div>', start)
                if end == -1: end = len(c)
                v_raw = c[start:end]
                
                # Checar se há fala de Jesus neste versículo
                if not any(cls in v_raw for cls in ['class=\"wj\"', 'class=\"bdwj\"', 'class=\"wjadd\"', 'class=\"wjnd\"']):
                    continue
                    
                h = preprocess_verse_html(v_raw)
                snippets = [clean_snippet(s) for s in re.findall(r'<span class=\"wj\">(.*?)</span>', h, re.DOTALL)]
                snippets = [s for s in snippets if s]
                if not snippets:
                    continue
                    
                fala_completa = clean_snippet(' '.join(snippets))
                referencia = f'{b_nome} {ch_num}:{vnum}'
                
                versiculos_resultado.append({
                    'livro': b_nome,
                    'abrev': b_abrev,
                    'capitulo': ch_num,
                    'versiculo': vnum,
                    'referencia': referencia,
                    'fala_completa_jesus': fala_completa,
                    'trechos': snippets
                })
                
                livro_versiculos_count += 1
                livro_trechos_count += len(snippets)
                total_trechos_global += len(snippets)
                
        estatisticas_livros.append({
            'posicao': b_pos,
            'livro': b_nome,
            'abrev': b_abrev,
            'total_versiculos': livro_versiculos_count,
            'total_trechos': livro_trechos_count
        })

    return {
        'total_trechos': total_trechos_global,
        'total_versiculos_com_fala_de_jesus': len(versiculos_resultado),
        'livros': estatisticas_livros,
        'versiculos': versiculos_resultado
    }

if __name__ == '__main__':
    epub = 'Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
    if not os.path.exists(epub):
        epub = '/Volumes/SSD 2TB SD/dev/biblia-pericopes/Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
        
    print(f'Extraindo palavras de Jesus de: {epub}...')
    resultado = extrair_palavras_de_jesus(epub)
    
    out_tmp = '/tmp/palavras-de-jesus-arc.json'
    print(f'Gravando arquivo temporário {out_tmp}...')
    with open(out_tmp, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
        
    print(f'Total de versículos extraídos: {resultado[\"total_versiculos_com_fala_de_jesus\"]}')
    print(f'Total de trechos extraídos: {resultado[\"total_trechos\"]}')
