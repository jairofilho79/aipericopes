#!/usr/bin/env python3
"""
Extrai do arquivo EPUB da Bíblia ARC (Edição 4ª) duas seções temáticas cruciais:
1) 'Palavras de orientação e consolo' (OEBPS/text01325.html)
2) 'Plano de evangelização pessoal: O que a Bíblia diz sobre o perdão de Deus' (OEBPS/text01326.html)

Gera:
- data-arc/orientacao-e-consolo-arc.json
- data-arc/plano-evangelizacao-arc.json
"""

import zipfile
import re
import json
import os
import xml.etree.ElementTree as ET

EPUB_PATH = '/Volumes/SSD 2TB SD/dev/biblia-pericopes/Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'

BOOK_ABBREVS = {
    'Gênesis': 'Gn', 'Êxodo': 'Êx', 'Levítico': 'Lv', 'Números': 'Nm', 'Deuteronômio': 'Dt',
    'Josué': 'Js', 'Juízes': 'Jz', 'Rute': 'Rt', '1 Samuel': '1Sm', '2 Samuel': '2Sm',
    '1 Reis': '1Rs', '2 Reis': '2Rs', '1 Crônicas': '1Cr', '2 Crônicas': '2Cr', 'Esdras': 'Ed',
    'Neemias': 'Ne', 'Ester': 'Et', 'Jó': 'Jó', 'Salmos': 'Sl', 'Provérbios': 'Pv',
    'Eclesiastes': 'Ec', 'Cantares': 'Ct', 'Isaías': 'Is', 'Jeremias': 'Jr', 'Lamentações': 'Lm',
    'Ezequiel': 'Ez', 'Daniel': 'Dn', 'Oséias': 'Os', 'Joel': 'Jl', 'Amós': 'Am',
    'Obadias': 'Ob', 'Jonas': 'Jn', 'Miquéias': 'Mq', 'Naum': 'Na', 'Habacuque': 'Hc',
    'Sofonias': 'Sf', 'Ageu': 'Ag', 'Zacarias': 'Zc', 'Malaquias': 'Ml', 'Mateus': 'Mt',
    'Marcos': 'Mc', 'Lucas': 'Lc', 'João': 'Jo', 'Atos': 'At', 'Romanos': 'Rm',
    '1 Coríntios': '1Co', '2 Coríntios': '2Co', 'Gálatas': 'Gl', 'Efésios': 'Ef',
    'Filipenses': 'Fp', 'Colossenses': 'Cl', '1 Tessalonicenses': '1Ts', '2 Tessalonicenses': '2Ts',
    '1 Timóteo': '1Tm', '2 Timóteo': '2Tm', 'Tito': 'Tt', 'Filemom': 'Fm',
    'Hebreus': 'Hb', 'Tiago': 'Tg', '1 Pedro': '1Pe', '2 Pedro': '2Pe',
    '1 João': '1Jo', '2 João': '2Jo', '3 João': '3Jo', 'Judas': 'Jd', 'Apocalipse': 'Ap'
}

CANONICAL_BOOK_PREFIXES = [
    ('1 Tessalonicenses', '1 Tessalonicenses'),
    ('1Tessalonicenses', '1 Tessalonicenses'),
    ('2 Tessalonicenses', '2 Tessalonicenses'),
    ('2Tessalonicenses', '2 Tessalonicenses'),
    ('1 Coríntios', '1 Coríntios'),
    ('1Coríntios', '1 Coríntios'),
    ('2 Coríntios', '2 Coríntios'),
    ('2Coríntios', '2 Coríntios'),
    ('1 Crônicas', '1 Crônicas'),
    ('1Cronicas', '1 Crônicas'),
    ('2 Crônicas', '2 Crônicas'),
    ('2Cronicas', '2 Crônicas'),
    ('1 Timóteo', '1 Timóteo'),
    ('1Timóteo', '1 Timóteo'),
    ('1Timoteo', '1 Timóteo'),
    ('2 Timóteo', '2 Timóteo'),
    ('2Timóteo', '2 Timóteo'),
    ('2Timoteo', '2 Timóteo'),
    ('1 Samuel', '1 Samuel'),
    ('1Samuel', '1 Samuel'),
    ('2 Samuel', '2 Samuel'),
    ('2Samuel', '2 Samuel'),
    ('1 Pedro', '1 Pedro'),
    ('1Pedro', '1 Pedro'),
    ('2 Pedro', '2 Pedro'),
    ('2Pedro', '2 Pedro'),
    ('1 Reis', '1 Reis'),
    ('1Reis', '1 Reis'),
    ('2 Reis', '2 Reis'),
    ('2Reis', '2 Reis'),
    ('1 João', '1 João'),
    ('1Joao', '1 João'),
    ('1João', '1 João'),
    ('2 João', '2 João'),
    ('2Joao', '2 João'),
    ('2João', '2 João'),
    ('3 João', '3 João'),
    ('3Joao', '3 João'),
    ('3João', '3 João'),
    ('Eclesiastes', 'Eclesiastes'),
    ('Filipenses', 'Filipenses'),
    ('Colossenses', 'Colossenses'),
    ('Apocalipse', 'Apocalipse'),
    ('Provérbios', 'Provérbios'),
    ('Proverbios', 'Provérbios'),
    ('Lamentações', 'Lamentações'),
    ('Habacuque', 'Habacuque'),
    ('Malaquias', 'Malaquias'),
    ('Zacarias', 'Zacarias'),
    ('Sofonias', 'Sofonias'),
    ('Miquéias', 'Miquéias'),
    ('Miqueias', 'Miquéias'),
    ('Jeremias', 'Jeremias'),
    ('Ezequiel', 'Ezequiel'),
    ('Levítico', 'Levítico'),
    ('Levitico', 'Levítico'),
    ('Deuteronômio', 'Deuteronômio'),
    ('Deuteronomio', 'Deuteronômio'),
    ('Gênesis', 'Gênesis'),
    ('Genesis', 'Gênesis'),
    ('Números', 'Números'),
    ('Numeros', 'Números'),
    ('Hebreus', 'Hebreus'),
    ('Gálatas', 'Gálatas'),
    ('Galatas', 'Gálatas'),
    ('Efésios', 'Efésios'),
    ('Efesios', 'Efésios'),
    ('Filemom', 'Filemom'),
    ('Obadias', 'Obadias'),
    ('Salmos', 'Salmos'),
    ('Salmo', 'Salmos'),
    ('Mateus', 'Mateus'),
    ('Marcos', 'Marcos'),
    ('Isaías', 'Isaías'),
    ('Isaias', 'Isaías'),
    ('Daniel', 'Daniel'),
    ('Oséias', 'Oséias'),
    ('Oseias', 'Oséias'),
    ('Esdras', 'Esdras'),
    ('Neemias', 'Neemias'),
    ('Juízes', 'Juízes'),
    ('Juizes', 'Juízes'),
    ('Cantares', 'Cantares'),
    ('Lucas', 'Lucas'),
    ('Tiago', 'Tiago'),
    ('Êxodo', 'Êxodo'),
    ('Exodo', 'Êxodo'),
    ('Josué', 'Josué'),
    ('Josue', 'Josué'),
    ('Ester', 'Ester'),
    ('Judas', 'Judas'),
    ('Atos', 'Atos'),
    ('João', 'João'),
    ('Joao', 'João'),
    ('Naum', 'Naum'),
    ('Ageu', 'Ageu'),
    ('Joel', 'Joel'),
    ('Amós', 'Amós'),
    ('Amos', 'Amós'),
    ('Rute', 'Rute'),
    ('Tito', 'Tito'),
    ('Jonas', 'Jonas'),
    ('Romanos', 'Romanos'),
    ('Jó', 'Jó'),
    ('Jo', 'Jó')
]

def parse_ref(raw_text: str, href: str, last_book: str):
    text_clean = raw_text.replace('\xa0', ' ').strip().rstrip(';.,').strip()
    
    # 1. Identify book
    detected_book = None
    rest_of_text = text_clean
    for prefix, canonical in CANONICAL_BOOK_PREFIXES:
        if text_clean.startswith(prefix):
            detected_book = canonical
            rest_of_text = text_clean[len(prefix):].strip()
            break
            
    if not detected_book:
        book = last_book
    else:
        book = detected_book

    abrev = BOOK_ABBREVS.get(book, '')
    
    # 2. Parse chapter and verse from rest_of_text
    # Handle cross-chapter span like 1.8—2.2
    m_cross = re.match(r'^(\d+)\.(\d+)[—\-](\d+)\.(\d+)$', rest_of_text)
    if m_cross:
        cap_ini = int(m_cross.group(1))
        v_ini = int(m_cross.group(2))
        cap_fim = int(m_cross.group(3))
        v_fim = int(m_cross.group(4))
        return {
            'texto_impresso': text_clean,
            'livro': book,
            'abrev': abrev,
            'capitulo': cap_ini,
            'capitulo_inicio': cap_ini,
            'versiculo_inicio': v_ini,
            'capitulo_fim': cap_fim,
            'versiculo_fim': v_fim,
            'versiculos': f'{cap_ini}:{v_ini}—{cap_fim}:{v_fim}',
            'referencia': f'{book} {cap_ini}:{v_ini}—{cap_fim}:{v_fim}',
            'link_epub': href
        }, book

    # Handle single chapter with verse(s) e.g. 5.10, 6.25-34, 8.1,31-39, 91.1-6,14-16, 19.3b-8
    m_cv = re.match(r'^(\d+)\.(.+)$', rest_of_text)
    if m_cv:
        cap = int(m_cv.group(1))
        v_str = m_cv.group(2).replace(' ', '')
        
        m_num_range = re.findall(r'\d+', v_str)
        v_ini = int(m_num_range[0]) if m_num_range else None
        v_fim = int(m_num_range[-1]) if m_num_range else None
        
        v_formatted = v_str.replace(',', ', ')
        return {
            'texto_impresso': text_clean,
            'livro': book,
            'abrev': abrev,
            'capitulo': cap,
            'capitulo_inicio': cap,
            'versiculo_inicio': v_ini,
            'capitulo_fim': cap,
            'versiculo_fim': v_fim,
            'versiculos': v_formatted,
            'referencia': f'{book} {cap}:{v_formatted}',
            'link_epub': href
        }, book

    # Handle whole chapter e.g. Salmo 13, 146, Salmo 32, 1Coríntios 13
    m_c = re.match(r'^(\d+)$', rest_of_text)
    if m_c:
        cap = int(m_c.group(1))
        return {
            'texto_impresso': text_clean,
            'livro': book,
            'abrev': abrev,
            'capitulo': cap,
            'capitulo_inicio': cap,
            'versiculo_inicio': None,
            'capitulo_fim': cap,
            'versiculo_fim': None,
            'versiculos': None,
            'referencia': f'{book} {cap}',
            'link_epub': href
        }, book

    # Fallback
    return {
        'texto_impresso': text_clean,
        'livro': book,
        'abrev': abrev,
        'capitulo': None,
        'capitulo_inicio': None,
        'versiculo_inicio': None,
        'capitulo_fim': None,
        'versiculo_fim': None,
        'versiculos': rest_of_text or None,
        'referencia': f'{book} {rest_of_text}'.strip(),
        'link_epub': href
    }, book

def extrair_orientacao_consolo(epub_path: str):
    with zipfile.ZipFile(epub_path, 'r') as z:
        raw = z.read('OEBPS/text01325.html').decode('utf-8')
        root = ET.fromstring(raw)
        div = root.find('.//{http://www.w3.org/1999/xhtml}div')
        
        temas = []
        curr_tema = None
        curr_tema_raw = None
        last_book = None
        
        for el in div:
            tag = el.tag.replace('{http://www.w3.org/1999/xhtml}', '')
            if tag == 'h4':
                raw_h4 = (el.text or '').strip()
                curr_tema_raw = raw_h4
                curr_tema = raw_h4.lstrip('…').lstrip('.').rstrip(':').strip()
                last_book = None
                temas.append({
                    'id': len(temas) + 1,
                    'tema': curr_tema_raw,
                    'tema_limpo': curr_tema,
                    'passagens': []
                })
            elif tag == 'p' and curr_tema_raw:
                for a in el.findall('.//{http://www.w3.org/1999/xhtml}a'):
                    ref_data, last_book = parse_ref(a.text or '', a.get('href', ''), last_book)
                    temas[-1]['passagens'].append(ref_data)
                    
        total_passagens = sum(len(t['passagens']) for t in temas)
        for t in temas:
            t['total_passagens'] = len(t['passagens'])
            
        return {
            'versao': 'Almeida Revista e Corrigida (ARC) - Edição 4ª',
            'arquivo_fonte': os.path.basename(epub_path),
            'secao_epub': 'OEBPS/text01325.html',
            'titulo': 'Palavras de orientação e consolo',
            'subtitulo': 'Na Palavra de Deus você encontra auxílio quando está…',
            'total_temas': len(temas),
            'total_passagens': total_passagens,
            'temas': temas
        }

def extrair_plano_evangelizacao(epub_path: str):
    with zipfile.ZipFile(epub_path, 'r') as z:
        raw = z.read('OEBPS/text01326.html').decode('utf-8')
        root = ET.fromstring(raw)
        div = root.find('.//{http://www.w3.org/1999/xhtml}div')
        
        pontos = []
        curr_ponto = None
        last_book = None
        
        for el in div:
            tag = el.tag.replace('{http://www.w3.org/1999/xhtml}', '')
            if tag == 'h4':
                curr_ponto = (el.text or '').strip()
                last_book = None
                pontos.append({
                    'id': len(pontos) + 1,
                    'ponto': len(pontos) + 1,
                    'titulo': curr_ponto,
                    'passagens': []
                })
            elif tag == 'p' and curr_ponto:
                for a in el.findall('.//{http://www.w3.org/1999/xhtml}a'):
                    ref_data, last_book = parse_ref(a.text or '', a.get('href', ''), last_book)
                    pontos[-1]['passagens'].append(ref_data)
                    
        total_passagens = sum(len(p['passagens']) for p in pontos)
        for p in pontos:
            p['total_passagens'] = len(p['passagens'])
            
        return {
            'versao': 'Almeida Revista e Corrigida (ARC) - Edição 4ª',
            'arquivo_fonte': os.path.basename(epub_path),
            'secao_epub': 'OEBPS/text01326.html',
            'titulo': 'Plano de evangelização pessoal',
            'subtitulo': 'O que a Bíblia diz sobre o perdão de Deus',
            'total_pontos': len(pontos),
            'total_passagens': total_passagens,
            'pontos': pontos
        }

if __name__ == '__main__':
    epub = EPUB_PATH
    d1 = extrair_orientacao_consolo(epub)
    d2 = extrair_plano_evangelizacao(epub)
    
    out1 = '/Volumes/SSD 2TB SD/dev/biblia-pericopes/data-arc/orientacao-e-consolo-arc.json'
    out2 = '/Volumes/SSD 2TB SD/dev/biblia-pericopes/data-arc/plano-evangelizacao-arc.json'
    
    os.makedirs(os.path.dirname(out1), exist_ok=True)
    with open(out1, 'w', encoding='utf-8') as f:
        json.dump(d1, f, ensure_ascii=False, indent=2)
    print(f"Salvo {out1}: {d1['total_temas']} temas, {d1['total_passagens']} passagens.")
    
    with open(out2, 'w', encoding='utf-8') as f:
        json.dump(d2, f, ensure_ascii=False, indent=2)
    print(f"Salvo {out2}: {d2['total_pontos']} pontos, {d2['total_passagens']} passagens.")
