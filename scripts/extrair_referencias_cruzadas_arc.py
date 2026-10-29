#!/usr/bin/env python3
"""
Extrai todas as referências cruzadas da Bíblia ARC (Almeida Revista e Corrigida - Edição 4ª)
contidas nos rodapés do arquivo .epub na raiz do projeto.

Gera um arquivo JSON estruturado em data/referencias-cruzadas-arc.json contendo:
- Metadados gerais
- Estatísticas por livro da Bíblia
- Lista detalhada de todas as notas e referências cruzadas com origem e destino
"""

import os
import re
import json
import glob
import zipfile
from xml.etree import ElementTree as ET

# 66 Livros canônicos em português e suas abreviações padrão
BOOK_ABBREVS = {
    'Gênesis': 'Gn', 'Êxodo': 'Êx', 'Levítico': 'Lv', 'Números': 'Nm', 'Deuteronômio': 'Dt',
    'Josué': 'Js', 'Juízes': 'Jz', 'Rute': 'Rt', '1 Samuel': '1Sm', '2 Samuel': '2Sm',
    '1 Reis': '1Rs', '2 Reis': '2Rs', '1 Crônicas': '1Cr', '2 Crônicas': '2Cr', 'Esdras': 'Ed',
    'Neemias': 'Ne', 'Ester': 'Et', 'Jó': 'Jó', 'Salmos': 'Sl', 'Provérbios': 'Pv',
    'Eclesiastes': 'Ec', 'Cantares': 'Ct', 'Isaías': 'Is', 'Jeremias': 'Jr', 'Lamentações': 'Lm',
    'Ezequiel': 'Ez', 'Daniel': 'Dn', 'Oséias': 'Os', 'Oseias': 'Os', 'Joel': 'Jl', 'Amós': 'Am',
    'Obadias': 'Ob', 'Jonas': 'Jn', 'Miquéias': 'Mq', 'Miqueias': 'Mq', 'Naum': 'Na', 'Habacuque': 'Hc',
    'Sofonias': 'Sf', 'Ageu': 'Ag', 'Zacarias': 'Zc', 'Malaquias': 'Ml', 'Mateus': 'Mt',
    'Marcos': 'Mc', 'Lucas': 'Lc', 'João': 'Jo', 'Atos': 'At', 'Romanos': 'Rm',
    '1 Coríntios': '1Co', '1Coríntios': '1Co', '2 Coríntios': '2Co', '2Coríntios': '2Co',
    'Gálatas': 'Gl', 'Efésios': 'Ef', 'Filipenses': 'Fp', 'Colossenses': 'Cl',
    '1 Tessalonicenses': '1Ts', '1Tessalonicenses': '1Ts', '2 Tessalonicenses': '2Ts', '2Tessalonicenses': '2Ts',
    '1 Timóteo': '1Tm', '1Timóteo': '1Tm', '2 Timóteo': '2Tm', '2Timóteo': '2Tm',
    'Tito': 'Tt', 'Filemom': 'Fm', 'Hebreus': 'Hb', 'Tiago': 'Tg',
    '1 Pedro': '1Pe', '1Pedro': '1Pe', '2 Pedro': '2Pe', '2Pedro': '2Pe',
    '1 João': '1Jo', '1Joao': '1Jo', '1João': '1Jo', '2 João': '2Jo', '2Joao': '2Jo', '2João': '2Jo',
    '3 João': '3Jo', '3Joao': '3Jo', '3João': '3Jo', 'Judas': 'Jd', 'Apocalipse': 'Ap'
}

CANONICAL_NAMES = {
    '1Samuel': '1 Samuel', '2Samuel': '2 Samuel',
    '1Reis': '1 Reis', '2Reis': '2 Reis',
    '1Cronicas': '1 Crônicas', '2Cronicas': '2 Crônicas',
    '1Corintios': '1 Coríntios', '2Corintios': '2 Coríntios',
    '1Tessalonicenses': '1 Tessalonicenses', '2Tessalonicenses': '2 Tessalonicenses',
    '1Timoteo': '1 Timóteo', '2Timoteo': '2 Timóteo',
    '1Pedro': '1 Pedro', '2Pedro': '2 Pedro',
    '1Joao': '1 João', '2Joao': '2 João', '3Joao': '3 João',
    '1João': '1 João', '2João': '2 João', '3João': '3 João',
    'Oseias': 'Oséias', 'Miqueias': 'Miquéias'
}

SINGLE_CHAPTER_BOOKS = {'Obadias', 'Filemom', '2 João', '2Joao', '2João', '3 João', '3Joao', '3João', 'Judas'}

def normalizar_nome_livro(nome: str) -> str:
    nome = nome.strip()
    return CANONICAL_NAMES.get(nome, nome)

def parse_origem_cv(origem_str: str, livro: str):
    """
    Interpreta a indicação de capítulo e versículo da nota no rodapé.
    Exemplos:
      '1.1' -> cap 1, v_ini 1, v_fim 1
      '4.7-10' -> cap 4, v_ini 7, v_fim 10
      '16' (em Obadias) -> cap 1, v_ini 16, v_fim 16
    """
    origem_str = origem_str.replace('&nbsp;', ' ').strip()
    
    # Formato padrão 'capitulo.versiculo' ou 'capitulo.versiculo_ini-versiculo_fim'
    m_cv = re.match(r'^(\d+)\.(\d+)(?:-(\d+))?$', origem_str)
    if m_cv:
        cap = int(m_cv.group(1))
        v_ini = int(m_cv.group(2))
        v_fim = int(m_cv.group(3)) if m_cv.group(3) else v_ini
        return cap, v_ini, v_fim
        
    # Livros de capítulo único (Obadias, Filemom, etc.)
    m_v = re.match(r'^(\d+)(?:-(\d+))?$', origem_str)
    if m_v:
        cap = 1
        v_ini = int(m_v.group(1))
        v_fim = int(m_v.group(2)) if m_v.group(2) else v_ini
        return cap, v_ini, v_fim
        
    return None, None, None

def extrair_referencias_epub(epub_path: str):
    if not os.path.exists(epub_path):
        raise FileNotFoundError(f"Arquivo EPUB não encontrado: {epub_path}")

    with zipfile.ZipFile(epub_path, 'r') as z:
        # 1. Ordem canônica dos livros a partir do Sumário (toc.ncx)
        toc_data = z.read('OEBPS/toc.ncx')
        root = ET.fromstring(toc_data)
        ns = {'ncx': 'http://www.daisy.org/z3986/2005/ncx/'}
        navpoints = root.findall('.//ncx:navPoint', ns)
        
        excluded_sections = {
            'Início', 'Colofão', 'Sumário', 'Prefácio',
            'Palavras de Orientação e Consolo',
            'O que a Bíblia diz sobre o perdão de Deus',
            'Índices de capítulos e versículos'
        }
        
        canonical_books = []
        for np in navpoints:
            t = np.find('ncx:navLabel/ncx:text', ns).text.strip()
            if t not in excluded_sections:
                canonical_books.append(normalizar_nome_livro(t))

        # 2. Mapeamento de arquivos HTML de texto para Livro e Capítulo
        file_map = {}
        for name in z.namelist():
            if name.startswith('OEBPS/text') and name.endswith('.html'):
                fname = name.replace('OEBPS/', '')
                data = z.read(name).decode('utf-8', errors='ignore')
                m_title = re.search(r'<title>(.*?)</title>', data)
                if m_title:
                    title_text = m_title.group(1).strip()
                    m_bc = re.search(r'^(.*?)(?:\s+(\d+))?$', title_text)
                    if m_bc:
                        raw_book = m_bc.group(1).strip()
                        clean_book = normalizar_nome_livro(raw_book)
                        chapter_num = int(m_bc.group(2)) if m_bc.group(2) else 1
                        file_map[fname] = {
                            'livro': clean_book,
                            'capitulo': chapter_num,
                            'abrev': BOOK_ABBREVS.get(clean_book, '')
                        }

        # 3. Extração das notas dos 66 arquivos de rodapé
        notas_resultado = []
        estatisticas = {b: {'notas': 0, 'referencias': 0, 'explicativas_com_ref': 0} for b in canonical_books}
        
        # Encontrar arquivos de notas
        note_files = []
        for name in z.namelist():
            if name.startswith('OEBPS/text') and name.endswith('.html'):
                data = z.read(name).decode('utf-8', errors='ignore')
                m_div = re.search(r'<div id=\"notas([^\"]+)\">', data)
                if m_div:
                    raw_id = m_div.group(1)
                    m_title = re.search(r'<title>(.*?)</title>', data)
                    b_name = normalizar_nome_livro(m_title.group(1).strip() if m_title else raw_id)
                    note_files.append((name, b_name, data))

        total_notas_global = 0
        total_referencias_global = 0
        total_f_refs_global = 0

        for fname, book_name, content in note_files:
            if book_name not in estatisticas:
                estatisticas[book_name] = {'notas': 0, 'referencias': 0, 'explicativas_com_ref': 0}

            # Extrair parágrafos <p class="x"> (referências cruzadas puras)
            x_paras = re.findall(r'<p\s+class=\"x\">(.*?)</p>', content, re.DOTALL)
            for p in x_paras:
                total_notas_global += 1
                estatisticas[book_name]['notas'] += 1
                
                # ID da nota
                m_id = re.search(r'id=\"([^\"]+)\"', p)
                nota_id = m_id.group(1) if m_id else ''
                
                # Versículo de origem no <strong class="xo">
                m_xo = re.search(r'<strong\s+class=\"x[or]\">(.*?)</strong>', p)
                xo_str = m_xo.group(1).replace('&nbsp;', ' ').strip() if m_xo else ''
                cap_orig, v_ini_orig, v_fim_orig = parse_origem_cv(xo_str, book_name)
                
                # Links de referências cruzadas
                links = re.findall(r'<a\s+class=\"linkref\"\s+href=\"([^\"]+)\">(.*?)</a>', p)
                alvos = []
                
                for href, txt in links:
                    total_referencias_global += 1
                    estatisticas[book_name]['referencias'] += 1
                    
                    target_file = href.split('#')[0]
                    anchor = href.split('#')[1] if '#' in href else ''
                    target_info = file_map.get(target_file, {'livro': '?', 'capitulo': 0, 'abrev': ''})
                    
                    clean_txt = txt.replace('\xa0', ' ').strip()
                    
                    # Determinar versículo alvo
                    verse_target = None
                    if '.' in clean_txt:
                        verse_target = clean_txt.split('.')[-1]
                    elif target_info['livro'] in SINGLE_CHAPTER_BOOKS:
                        m_v = re.search(r'(\d+(?:[-,]\d+)*)$', clean_txt)
                        if m_v:
                            verse_target = m_v.group(1)
                    elif anchor.startswith('v'):
                        verse_target = anchor[1:]
                    elif 'ARC' in anchor:
                        verse_target = '1'
                    else:
                        verse_target = clean_txt

                    # Reconstruir referência canônica completa (ex: 'Hb 11.13' em vez de apenas '11.13')
                    t_abrev = target_info['abrev']
                    t_cap = target_info['capitulo']
                    ref_completa = f"{t_abrev} {t_cap}.{verse_target}" if t_abrev and verse_target else clean_txt

                    alvos.append({
                        'livro': target_info['livro'],
                        'abrev': target_info['abrev'],
                        'capitulo': target_info['capitulo'],
                        'versiculo': verse_target,
                        'texto_impresso': clean_txt,
                        'referencia_completa': ref_completa,
                        'link_epub': href
                    })

                notas_resultado.append({
                    'id': nota_id,
                    'tipo': 'referencia_cruzada',
                    'origem': {
                        'livro': book_name,
                        'abrev': BOOK_ABBREVS.get(book_name, ''),
                        'capitulo': cap_orig,
                        'versiculo_inicio': v_ini_orig,
                        'versiculo_fim': v_fim_orig,
                        'indicador_original': xo_str
                    },
                    'alvos': alvos
                })

            # Extrair parágrafos <p class="f"> que contenham referências
            f_paras = re.findall(r'<p\s+class=\"f\">(.*?)</p>', content, re.DOTALL)
            for p in f_paras:
                links = re.findall(r'<a\s+class=\"linkref\"\s+href=\"([^\"]+)\">(.*?)</a>', p)
                if not links:
                    continue
                
                m_id = re.search(r'id=\"([^\"]+)\"', p)
                nota_id = m_id.group(1) if m_id else ''
                m_fr = re.search(r'<strong\s+class=\"fr\">(.*?)</strong>', p)
                fr_str = m_fr.group(1).replace('&nbsp;', ' ').strip() if m_fr else ''
                cap_orig, v_ini_orig, v_fim_orig = parse_origem_cv(fr_str, book_name)

                alvos = []
                for href, txt in links:
                    total_f_refs_global += 1
                    estatisticas[book_name]['explicativas_com_ref'] += 1
                    target_file = href.split('#')[0]
                    anchor = href.split('#')[1] if '#' in href else ''
                    target_info = file_map.get(target_file, {'livro': '?', 'capitulo': 0, 'abrev': ''})
                    clean_txt = txt.replace('\xa0', ' ').strip()

                    verse_target = None
                    if '.' in clean_txt:
                        verse_target = clean_txt.split('.')[-1]
                    elif anchor.startswith('v'):
                        verse_target = anchor[1:]
                    else:
                        verse_target = clean_txt

                    t_abrev = target_info['abrev']
                    t_cap = target_info['capitulo']
                    ref_completa = f"{t_abrev} {t_cap}.{verse_target}" if t_abrev and verse_target else clean_txt

                    alvos.append({
                        'livro': target_info['livro'],
                        'abrev': target_info['abrev'],
                        'capitulo': target_info['capitulo'],
                        'versiculo': verse_target,
                        'texto_impresso': clean_txt,
                        'referencia_completa': ref_completa,
                        'link_epub': href
                    })

                notas_resultado.append({
                    'id': nota_id,
                    'tipo': 'nota_textual_com_referencia',
                    'origem': {
                        'livro': book_name,
                        'abrev': BOOK_ABBREVS.get(book_name, ''),
                        'capitulo': cap_orig,
                        'versiculo_inicio': v_ini_orig,
                        'versiculo_fim': v_fim_orig,
                        'indicador_original': fr_str
                    },
                    'alvos': alvos
                })

        # Montar lista de estatísticas na ordem canônica
        tabela_estatisticas = []
        for i, b in enumerate(canonical_books, 1):
            st = estatisticas.get(b, {'notas': 0, 'referencias': 0, 'explicativas_com_ref': 0})
            tabela_estatisticas.append({
                'posicao': i,
                'livro': b,
                'abrev': BOOK_ABBREVS.get(b, ''),
                'total_notas_rodape': st['notas'],
                'total_referencias_cruzadas': st['referencias'],
                'referencias_em_notas_textuais': st['explicativas_com_ref'],
                'total_geral_referencias': st['referencias'] + st['explicativas_com_ref']
            })

        output_data = {
            'metadados': {
                'versao': 'Almeida Revista e Corrigida (ARC) - Edição 4ª',
                'arquivo_fonte': os.path.basename(epub_path),
                'total_livros': len(canonical_books),
                'total_notas_rodape': total_notas_global,
                'total_referencias_cruzadas': total_referencias_global,
                'total_referencias_em_notas_textuais': total_f_refs_global,
                'total_combinado_referencias': total_referencias_global + total_f_refs_global
            },
            'estatisticas_por_livro': tabela_estatisticas,
            'notas': notas_resultado
        }

        return output_data

if __name__ == '__main__':
    epub_files = glob.glob('*.epub')
    if not epub_files:
        print("Nenhum arquivo .epub encontrado na raiz do projeto.")
        exit(1)

    epub_file = epub_files[0]
    print(f"Lendo EPUB: {epub_file}...")
    resultado = extrair_referencias_epub(epub_file)

    meta = resultado['metadados']
    print(f"\nExtração concluída com sucesso!")
    print(f"- Total de livros: {meta['total_livros']}")
    print(f"- Total de notas de rodapé de referências cruzadas: {meta['total_notas_rodape']}")
    print(f"- Total de referências bíblicas cruzadas: {meta['total_referencias_cruzadas']}")
    print(f"- Referências em notas textuais: {meta['total_referencias_em_notas_textuais']}")
    print(f"- Total combinado de referências: {meta['total_combinado_referencias']}")

    output_path = 'data/referencias-cruzadas-arc.json'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nArquivo salvo em: {output_path} ({file_size_mb:.2f} MB)")
