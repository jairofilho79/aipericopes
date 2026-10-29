#!/usr/bin/env python3
"""
Extrai as Introduções Históricas/Teológicas e os Esquemas de Conteúdo (esboços)
dos 66 livros da Bíblia ARC (Almeida Revista e Corrigida - Edição 4ª) contidos no arquivo .epub na raiz.

Gera:
1) data-arc/introducoes-livros-arc.json
2) data-arc/esbocos-conteudo-arc.json
"""

import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from html import unescape

CANONICAL_66_BOOKS = [
    'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute',
    '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias',
    'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias',
    'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas',
    'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias', 'Mateus',
    'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas',
    'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses',
    '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro',
    '1 João', '2 João', '3 João', 'Judas', 'Apocalipse'
]

def clean_text(raw_html: str) -> str:
    # 1. Remove HTML tags
    t = re.sub(r'<[^>]+>', '', raw_html)
    # 2. Unescape HTML entities
    t = unescape(t)
    # 3. Normalize whitespace
    t = re.sub(r'[\xa0\s]+', ' ', t).strip()
    # 4. Normalize punctuation spacing
    t = re.sub(r'\s+([,.;:?!])', r'\1', t)
    t = re.sub(r'\(\s+', '(', t)
    t = re.sub(r'\s+\)', ')', t)
    t = re.sub(r'\s+([”’])', r'\1', t)
    t = re.sub(r'([“‘])\s+', r'\1', t)
    return t

def extrair_introducoes_e_esbocos(epub_path: str):
    with zipfile.ZipFile(epub_path, 'r') as z:
        toc_data = z.read('OEBPS/toc.ncx')
        root = ET.fromstring(toc_data)
        ns = {'ncx': 'http://www.daisy.org/z3986/2005/ncx/'}
        # Books start at index 4 (Gênesis) and end at index 69 (Apocalipse)
        nav_points = root.findall('.//ncx:navPoint', ns)[4:70]
        
        if len(nav_points) != 66:
            raise ValueError(f"Esperava 66 livros no toc.ncx, encontrou {len(nav_points)}")
            
        introducoes = []
        esbocos = []
        
        for i, np in enumerate(nav_points):
            livro = CANONICAL_66_BOOKS[i]
            src = np.find('ncx:content', ns).attrib.get('src').split('#')[0]
            c = z.read(f'OEBPS/{src}').decode('utf-8')
            
            # 1. Título solene impresso (h1 tags before is1)
            is1_idx = c.find('<h3 class="is1">')
            header_part = c[:is1_idx] if is1_idx != -1 else c
            h1s = re.findall(r'<h1[^>]*>(.*?)</h1>', header_part, re.DOTALL)
            titulo_completo = clean_text(' '.join(h1s))
            
            # 2. Introdução (paragraphs between is1 and iot)
            iot_idx = c.find('<h3 class="iot">')
            intro_chunk = c[is1_idx:iot_idx] if (is1_idx != -1 and iot_idx != -1) else ''
            raw_ps = re.findall(r'<p\s+class="ip"[^>]*>(.*?)</p>', intro_chunk, re.DOTALL)
            paragrafos_intro = [clean_text(p) for p in raw_ps if clean_text(p)]
            
            introducoes.append({
                'livro': livro,
                'titulo_completo': titulo_completo,
                'introducao': paragrafos_intro
            })
            
            # 3. Esquema do conteúdo (paragraphs after iot with class io1, io2, io3)
            esq_chunk = c[iot_idx:] if iot_idx != -1 else ''
            p_items = re.findall(r'<p\s+class="(io\d+)"[^>]*>(.*?)</p>', esq_chunk, re.DOTALL)
            
            itens_esquema = []
            for cls, body in p_items:
                nivel = int(cls.replace('io', ''))
                a_m = re.search(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.DOTALL)
                texto = clean_text(a_m.group(2) if a_m else body)
                link_epub = a_m.group(1) if a_m else None
                
                itens_esquema.append({
                    'nivel': nivel,
                    'texto': texto,
                    'link_epub': link_epub
                })
                
            esbocos.append({
                'livro': livro,
                'esquema': itens_esquema
            })
            
    return introducoes, esbocos

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    epub_path = os.path.join(base_dir, 'Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub')
    
    if not os.path.exists(epub_path):
        epub_path = '/Volumes/SSD 2TB SD/dev/biblia-pericopes/Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
        
    print(f'Lendo EPUB: {epub_path}')
    introducoes, esbocos = extrair_introducoes_e_esbocos(epub_path)
    
    # Salvar temporários em /tmp
    tmp_intro = '/tmp/introducoes-livros-arc.json'
    tmp_esboco = '/tmp/esbocos-conteudo-arc.json'
    
    with open(tmp_intro, 'w', encoding='utf-8') as f:
        json.dump(introducoes, f, ensure_ascii=False, indent=2)
        
    with open(tmp_esboco, 'w', encoding='utf-8') as f:
        json.dump(esbocos, f, ensure_ascii=False, indent=2)
        
    print(f'Salvos temporariamente em {tmp_intro} e {tmp_esboco}')
    print(f'Total de livros com introdução: {len(introducoes)}')
    print(f'Total de livros com esquema: {len(esbocos)}')

if __name__ == '__main__':
    main()
