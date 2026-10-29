#!/usr/bin/env python3
"""
Extrai todas as 1.933 perícopes da Bíblia ARC (Edição 4ª) contidas no arquivo .epub na raiz,
incluindo referências, títulos, referências paralelas, sobrescritos e textos bíblicos versículo a versículo.
"""

import zipfile
import re
import json
import os
from html import unescape

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

def clean_text(raw_html: str) -> str:
    # 1. Remove footnotes
    t = re.sub(r'<span class=\"chamada\".*?</span>', '', raw_html, flags=re.DOTALL)
    t = re.sub(r'<a[^>]*class=\"footnote-link\"[^>]*>.*?</a>', '', t, flags=re.DOTALL)
    
    # 2. Fix drop caps
    def fix_drop(m):
        letter = m.group(1).strip()
        rest = m.group(2).strip()
        
        # Handle small-caps SENHOR
        if letter == 'S' and rest == 'ENHOR':
            return 'SENHOR'
            
        if letter == 'A':
            return letter + rest if rest.lower() in A_FRAGMENTS else letter + ' ' + rest
        elif letter == 'O':
            return letter + rest if rest.lower() in O_FRAGMENTS else letter + ' ' + rest
        elif letter == 'E':
            return letter + rest if rest.lower() in E_FRAGMENTS else letter + ' ' + rest
        else:
            return letter + rest
            
    t = re.sub(r'<strong\s+class=\"bd(?:wj)?\">([A-ZÁÉÍÓÚÂÊÔÃÕÇ])</strong>\s*(?:<[^>]+>\s*)*([a-záéíóúãõâêîôûçA-ZÁÉÍÓÚÂÊÔÃÕÇ]+)', fix_drop, t)
    
    # 3. Strip tags: block tags to space, inline tags to empty
    t = re.sub(r'</?(?:p|div|h[1-6]|br)[^>]*>', ' ', t)
    t = re.sub(r'<[^>]+>', '', t)
    
    # 4. Unescape
    t = unescape(t)
    
    # 5. Normalize whitespace
    t = re.sub(r'[\xa0\s]+', ' ', t).strip()
    
    # 6. Normalize punctuation spacing
    t = re.sub(r'\s+([,.;:?!])', r'\1', t)
    t = re.sub(r'\(\s+', '(', t)
    t = re.sub(r'\s+\)', ')', t)
    return t

def extrair_todas_pericopes(epub_path: str):
    with zipfile.ZipFile(epub_path, 'r') as z:
        all_files = sorted([n for n in z.namelist() if n.startswith('OEBPS/text') and n.endswith('.html')])
        
        chapter_files = []
        for fn in all_files:
            c = z.read(fn).decode('utf-8', errors='ignore')
            div_m = re.search(r'<div id=\"ARC([^\"]+)\"', c)
            if div_m:
                div_id = div_m.group(1)
                if not div_id.endswith('Intro') and div_id != '-998.html':
                    m = re.match(r'^([A-Za-z0-9_áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]+?)(\d+)$', div_id)
                    if m:
                        b_key = m.group(1)
                        ch_num = int(m.group(2))
                        chapter_files.append((fn, b_key, ch_num, c))

    # Group by book preserving canonical order
    books_order = []
    books_data = {}
    for fn, b_key, ch_num, c in chapter_files:
        if b_key not in books_data:
            books_order.append(b_key)
            books_data[b_key] = []
        books_data[b_key].append((ch_num, c))

    pericopes = []
    token_pattern = re.compile(
        r'(?P<s1><h3\s+class=\"s1\"[^>]*>(.*?)</h3>)|'
        r'(?P<r><h5\s+class=\"r\"[^>]*>(.*?)</h5>)|'
        r'(?P<d><p\s+class=\"d\"[^>]*>(.*?)</p>)|'
        r'(?P<v><a\s+[^>]*class=\"(?:v|vwj)\"\s+id=\"v(?P<vnum>\d+)\"[^>]*>.*?</a>)',
        re.DOTALL
    )

    pericope_id = 1
    total_versiculos_global = 0

    for b_key in books_order:
        b_name = BOOK_NAMES_PT.get(b_key, b_key)
        chs = books_data[b_key]
        chs.sort(key=lambda x: x[0])
        
        current_p = None
        
        for ch_num, c in chs:
            tokens = list(token_pattern.finditer(c))
            
            for idx, tok in enumerate(tokens):
                kind = tok.lastgroup
                
                if kind == 's1':
                    raw_title = tok.group(2)
                    clean_title = clean_text(raw_title)
                    if current_p is not None:
                        pericopes.append(current_p)
                        
                    current_p = {
                        'id': pericope_id,
                        'livro': b_name,
                        'titulo': clean_title,
                        'referencia_paralela': None,
                        'sobrescrito': None,
                        'inicio': None,
                        'fim': None,
                        'referencia': None,
                        'total_versiculos': 0,
                        'texto': '',
                        'versiculos': []
                    }
                    pericope_id += 1
                    
                elif kind == 'r':
                    if current_p is not None and not current_p['versiculos']:
                        raw_r = tok.group(4)
                        clean_r = clean_text(raw_r).strip('()')
                        current_p['referencia_paralela'] = clean_r
                        
                elif kind == 'd':
                    if current_p is not None and not current_p['versiculos']:
                        raw_d = tok.group(6)
                        current_p['sobrescrito'] = clean_text(raw_d)
                        
                elif kind == 'v':
                    vnum = int(tok.group('vnum'))
                    start_pos = tok.end()
                    end_pos = tokens[idx + 1].start() if idx + 1 < len(tokens) else c.find('</div>', start_pos)
                    if end_pos == -1:
                        end_pos = len(c)
                        
                    v_raw = c[start_pos:end_pos]
                    v_clean = clean_text(v_raw)
                    
                    if current_p is not None:
                        current_p['versiculos'].append({
                            'capitulo': ch_num,
                            'versiculo': vnum,
                            'texto': v_clean
                        })
                        total_versiculos_global += 1

        if current_p is not None:
            pericopes.append(current_p)

    # Finalize bounds, references and concatenated texts
    for p in pericopes:
        vs = p['versiculos']
        p['total_versiculos'] = len(vs)
        first_v = vs[0]
        last_v = vs[-1]
        
        p['inicio'] = {
            'livro': p['livro'],
            'capitulo': first_v['capitulo'],
            'versiculo': first_v['versiculo']
        }
        p['fim'] = {
            'livro': p['livro'],
            'capitulo': last_v['capitulo'],
            'versiculo': last_v['versiculo']
        }
        
        if first_v['capitulo'] == last_v['capitulo']:
            if first_v['versiculo'] == last_v['versiculo']:
                p['referencia'] = f"{p['livro']} {first_v['capitulo']}:{first_v['versiculo']}"
            else:
                p['referencia'] = f"{p['livro']} {first_v['capitulo']}:{first_v['versiculo']}-{last_v['versiculo']}"
        else:
            p['referencia'] = f"{p['livro']} {first_v['capitulo']}:{first_v['versiculo']}–{last_v['capitulo']}:{last_v['versiculo']}"
            
        p['texto'] = ' '.join(f"{v['versiculo']} {v['texto']}" for v in vs)

    return pericopes, total_versiculos_global

if __name__ == '__main__':
    epub = 'Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
    print(f'Extraindo perícopes de: {epub}...')
    pericopes, total_v = extrair_todas_pericopes(epub)
    print(f'Total de perícopes extraídas: {len(pericopes)}')
    print(f'Total de versículos extraídos: {total_v}')
    
    out_file_1 = 'perícopes ARC.json'
    out_file_2 = 'data/pericopes-arc.json'
    
    print(f'Gravando {out_file_1}...')
    with open(out_file_1, 'w', encoding='utf-8') as f:
        json.dump(pericopes, f, ensure_ascii=False, indent=2)
        
    print(f'Gravando {out_file_2}...')
    with open(out_file_2, 'w', encoding='utf-8') as f:
        json.dump(pericopes, f, ensure_ascii=False, indent=2)
        
    file_size_mb = os.path.getsize(out_file_1) / (1024 * 1024)
    print(f'Pronto! Arquivo gerado com sucesso ({file_size_mb:.2f} MB).')
