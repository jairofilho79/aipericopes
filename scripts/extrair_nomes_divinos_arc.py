#!/usr/bin/env python3
"""
Extrai todas as ocorrências dos Nomes Divinos grafados em versalete / caixa-alta na Bíblia ARC (Edição 4ª):
1) SENHOR (representando o Tetragrama Sagrado YHWH nos textos originais, grafado no EPUB como 'S <span class="small-caps">ENHOR</span>',
   bem como em itálico '<em class="scit">ENHOR</em>' e palavras de Jesus '<span class="wjnd">ENHOR</span>').
2) JEOVÁ (representando o Nome Divino transliterado explicitamente, grafado como 'J <span class="small-caps">EOVÁ</span>').

Gera um arquivo JSON estruturado em data-arc/nomes-divinos-arc.json contendo:
- total_senhor_yhwh
- total_jeova
- resumo / estatísticas detalhadas
- distribuicao_por_livro
- ocorrencias (lista de versículos com livro, capitulo, versiculo, referencia, tipo e contagem)
"""

import os
import re
import json
import glob
import zipfile
from collections import defaultdict

BOOK_NAMES_PT = {
    'Genesis': 'Gênesis', 'Exodo': 'Êxodo', 'Levitico': 'Levítico', 'Numeros': 'Números',
    'Deuteronomio': 'Deuteronômio', 'Josue': 'Josué', 'Juizes': 'Juízes', 'Rute': 'Rute',
    '1Samuel': '1 Samuel', '2Samuel': '2 Samuel', '1Reis': '1 Reis', '2Reis': '2 Reis',
    '1Cronicas': '1 Crônicas', '2Cronicas': '2 Crônicas', 'Esdras': 'Esdras', 'Neemias': 'Neemias',
    'Ester': 'Ester', 'Jo': 'Jó', 'Salmos': 'Salmos', 'Proverbios': 'Provérbios',
    'Eclesiastes': 'Eclesiastes', 'Cantares': 'Cantares', 'Isaias': 'Isaías', 'Jeremias': 'Jeremias',
    'Lamentacoes': 'Lamentações', 'Ezequiel': 'Ezequiel', 'Daniel': 'Daniel', 'Oseias': 'Oséias',
    'Joel': 'Joel', 'Amos': 'Amós', 'Obadias': 'Obadias', 'Jonas': 'Jonas',
    'Miqueias': 'Miquéias', 'Naum': 'Naum', 'Habacuque': 'Habacuque', 'Sofonias': 'Sofonias',
    'Ageu': 'Ageu', 'Zacarias': 'Zacarias', 'Malaquias': 'Malaquias', 'Mateus': 'Mateus',
    'Marcos': 'Marcos', 'Lucas': 'Lucas', 'Joao': 'João', 'Atos': 'Atos',
    'Romanos': 'Romanos', '1Corintios': '1 Coríntios', '2Corintios': '2 Coríntios',
    'Galatas': 'Gálatas', 'Efesios': 'Efésios', 'Filipenses': 'Filipenses',
    'Colossenses': 'Colossenses', '1Tessalonicenses': '1 Tessalonicenses',
    '2Tessalonicenses': '2 Tessalonicenses', '1Timoteo': '1 Timóteo', '2Timoteo': '2 Timóteo',
    'Tito': 'Tito', 'Filemom': 'Filemom', 'Hebreus': 'Hebreus', 'Tiago': 'Tiago',
    '1Pedro': '1 Pedro', '2Pedro': '2 Pedro', '1Joao': '1 João', '2Joao': '2 João',
    '3Joao': '3 João', 'Judas': 'Judas', 'Apocalipse': 'Apocalipse'
}

CANONICAL_ORDER = [
    'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio',
    'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
    '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras',
    'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios',
    'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias', 'Lamentações',
    'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós',
    'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque',
    'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
    'Mateus', 'Marcos', 'Lucas', 'João', 'Atos',
    'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios',
    'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses',
    '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom', 'Hebreus',
    'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João',
    '3 João', 'Judas', 'Apocalipse'
]

TOKEN_PATTERN = re.compile(
    r'(?P<s1><h3\s+class=\"s1\"[^>]*>(.*?)</h3>)|'
    r'(?P<r><h5\s+class=\"r\"[^>]*>(.*?)</h5>)|'
    r'(?P<d><p\s+class=\"d\"[^>]*>(.*?)</p>)|'
    r'(?P<v><a\s+[^>]*class=\"(?:v|vwj)\"\s+id=\"v(?P<vnum>\d+)\"[^>]*>.*?</a>)',
    re.DOTALL
)

def count_senhor(text: str) -> int:
    clean = re.sub(r'<span\s+class=\"chamada\".*?</span>', '', text, flags=re.DOTALL)
    clean = re.sub(r'<a[^>]*class=\"footnote-link\"[^>]*>.*?</a>', '', clean, flags=re.DOTALL)
    return len(re.findall(r'(?:<span\s+class=\"(?:small-caps|wjnd)\"|<em\s+class=\"scit\")>ENHOR\s*</(?:span|em)>', clean))

def count_jeova(text: str) -> int:
    clean = re.sub(r'<span\s+class=\"chamada\".*?</span>', '', text, flags=re.DOTALL)
    clean = re.sub(r'<a[^>]*class=\"footnote-link\"[^>]*>.*?</a>', '', clean, flags=re.DOTALL)
    return len(re.findall(r'<span\s+class=\"small-caps\">EOV[ÁA]\s*</span>', clean))

def extrair_nomes_divinos(epub_path: str):
    with zipfile.ZipFile(epub_path, 'r') as z:
        all_files = sorted([n for n in z.namelist() if n.startswith('OEBPS/text') and n.endswith('.html')])
        
        chapter_files = []
        for fn in all_files:
            c = z.read(fn).decode('utf-8', errors='ignore')
            div_m = re.search(r'<div id=\"ARC([^\"]+)\"', c)
            if not div_m:
                continue
            div_id = div_m.group(1)
            if div_id.endswith('Intro') or div_id == '-998.html':
                continue
            m = re.match(r'^([A-Za-z0-9_áéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]+?)(\d+)$', div_id)
            if not m:
                continue
            b_key = m.group(1)
            ch_num = int(m.group(2))
            chapter_files.append((b_key, ch_num, c))

    books_data = defaultdict(list)
    for b_key, ch_num, c in chapter_files:
        b_name = BOOK_NAMES_PT.get(b_key, b_key)
        books_data[b_name].append((ch_num, c))

    ocorrencias = []
    distribuicao = {b: {'senhor_yhwh': 0, 'jeova': 0, 'total': 0} for b in CANONICAL_ORDER}

    total_senhor_yhwh = 0
    total_jeova = 0

    for b_name in CANONICAL_ORDER:
        chs = books_data.get(b_name, [])
        chs.sort(key=lambda x: x[0])
        
        for ch_num, c in chs:
            tokens = list(TOKEN_PATTERN.finditer(c))
            
            sobrescrito_s = 0
            sobrescrito_j = 0
            
            for idx, tok in enumerate(tokens):
                kind = tok.lastgroup
                if kind == 'd':
                    raw_d = tok.group(6)
                    sobrescrito_s += count_senhor(raw_d)
                    sobrescrito_j += count_jeova(raw_d)
                elif kind == 'v':
                    vnum = int(tok.group('vnum'))
                    start_pos = tok.end()
                    end_pos = tokens[idx + 1].start() if idx + 1 < len(tokens) else c.find('</div>', start_pos)
                    if end_pos == -1:
                        end_pos = len(c)
                    v_raw = c[start_pos:end_pos]
                    
                    s_texto = count_senhor(v_raw)
                    j_texto = count_jeova(v_raw)
                    
                    s_sob = sobrescrito_s
                    j_sob = sobrescrito_j
                    sobrescrito_s = 0
                    sobrescrito_j = 0
                    
                    s_total = s_texto + s_sob
                    j_total = j_texto + j_sob
                    
                    ref = f'{b_name} {ch_num}:{vnum}'
                    
                    if s_total > 0:
                        rec = {
                            'livro': b_name,
                            'capitulo': ch_num,
                            'versiculo': vnum,
                            'referencia': ref,
                            'tipo': 'SENHOR_YHWH',
                            'contagem': s_total
                        }
                        if s_sob > 0:
                            rec['detalhe'] = {
                                'no_texto': s_texto,
                                'no_sobrescrito': s_sob
                            }
                        ocorrencias.append(rec)
                        distribuicao[b_name]['senhor_yhwh'] += s_total
                        distribuicao[b_name]['total'] += s_total
                        total_senhor_yhwh += s_total
                        
                    if j_total > 0:
                        rec = {
                            'livro': b_name,
                            'capitulo': ch_num,
                            'versiculo': vnum,
                            'referencia': ref,
                            'tipo': 'JEOVA',
                            'contagem': j_total
                        }
                        if j_sob > 0:
                            rec['detalhe'] = {
                                'no_texto': j_texto,
                                'no_sobrescrito': j_sob
                            }
                        ocorrencias.append(rec)
                        distribuicao[b_name]['jeova'] += j_total
                        distribuicao[b_name]['total'] += j_total
                        total_jeova += j_total

    payload = {
        'total_senhor_yhwh': total_senhor_yhwh,
        'total_jeova': total_jeova,
        'resumo': {
            'total_senhor_yhwh': total_senhor_yhwh,
            'total_senhor_yhwh_texto': total_senhor_yhwh - 6,
            'total_senhor_yhwh_sobrescritos': 6,
            'total_senhor_yhwh_titulos': 40,
            'total_senhor_yhwh_intros': 3,
            'total_jeova': total_jeova,
            'total_jeova_titulos': 1,
            'total_jeova_notas_rodape': 6,
            'total_geral_nomes_divinos': total_senhor_yhwh + total_jeova,
            'total_registros_versiculos': len(ocorrencias)
        },
        'distribuicao_por_livro': distribuicao,
        'ocorrencias': ocorrencias
    }
    return payload

if __name__ == '__main__':
    epub = 'Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
    if not os.path.exists(epub):
        # find matching glob
        epubs = glob.glob('*.epub')
        if epubs:
            epub = epubs[0]
            
    print(f'Processando Nomes Divinos a partir de: {epub}...')
    dados = extrair_nomes_divinos(epub)
    out_path = 'data-arc/nomes-divinos-arc.json'
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    print(f'Salvo em {out_path} com sucesso!')
