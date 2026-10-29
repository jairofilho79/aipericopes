#!/usr/bin/env python3
"""
Extrai todas as notas de tradução e textuais da ARC (Almeida Revista e Corrigida - Edição 4ª)
contidas nos arquivos de notas (<p class="f">...</p>) do arquivo .epub na raiz do projeto.

Gera um arquivo JSON estruturado contendo:
- Metadados gerais (totais e estatísticas por tipo)
- Estatísticas por livro da Bíblia (66 livros com distribuição por tipo)
- Lista completa das 963 notas com livro, abreviação, referência, versículo, texto limpo, tipo e link de retorno
"""

import os
import re
import json
import zipfile

# 66 Livros canônicos em português na ordem bíblica e suas abreviações padrão
CANONICAL_BOOKS = [
    ("Gênesis", "Gn"), ("Êxodo", "Êx"), ("Levítico", "Lv"), ("Números", "Nm"), ("Deuteronômio", "Dt"),
    ("Josué", "Js"), ("Juízes", "Jz"), ("Rute", "Rt"), ("1 Samuel", "1Sm"), ("2 Samuel", "2Sm"),
    ("1 Reis", "1Rs"), ("2 Reis", "2Rs"), ("1 Crônicas", "1Cr"), ("2 Crônicas", "2Cr"), ("Esdras", "Ed"),
    ("Neemias", "Ne"), ("Ester", "Et"), ("Jó", "Jó"), ("Salmos", "Sl"), ("Provérbios", "Pv"),
    ("Eclesiastes", "Ec"), ("Cantares", "Ct"), ("Isaías", "Is"), ("Jeremias", "Jr"), ("Lamentações", "Lm"),
    ("Ezequiel", "Ez"), ("Daniel", "Dn"), ("Oséias", "Os"), ("Joel", "Jl"), ("Amós", "Am"),
    ("Obadias", "Ob"), ("Jonas", "Jn"), ("Miquéias", "Mq"), ("Naum", "Na"), ("Habacuque", "Hc"),
    ("Sofonias", "Sf"), ("Ageu", "Ag"), ("Zacarias", "Zc"), ("Malaquias", "Ml"), ("Mateus", "Mt"),
    ("Marcos", "Mc"), ("Lucas", "Lc"), ("João", "Jo"), ("Atos", "At"), ("Romanos", "Rm"),
    ("1 Coríntios", "1Co"), ("2 Coríntios", "2Co"), ("Gálatas", "Gl"), ("Efésios", "Ef"), ("Filipenses", "Fp"),
    ("Colossenses", "Cl"), ("1 Tessalonicenses", "1Ts"), ("2 Tessalonicenses", "2Ts"),
    ("1 Timóteo", "1Tm"), ("2 Timóteo", "2Tm"), ("Tito", "Tt"), ("Filemom", "Fm"), ("Hebreus", "Hb"),
    ("Tiago", "Tg"), ("1 Pedro", "1Pe"), ("2 Pedro", "2Pe"), ("1 João", "1Jo"), ("2 João", "2Jo"),
    ("3 João", "3Jo"), ("Judas", "Jd"), ("Apocalipse", "Ap")
]

BOOK_ABBREVS = dict(CANONICAL_BOOKS)

# Normalização de nomes vindos dos títulos dos arquivos HTML
NORM_MAP = {
    '1Samuel': '1 Samuel', '2Samuel': '2 Samuel',
    '1Reis': '1 Reis', '2Reis': '2 Reis',
    '1Cronicas': '1 Crônicas', '2Cronicas': '2 Crônicas',
    '1Crônicas': '1 Crônicas', '2Crônicas': '2 Crônicas',
    '1Corintios': '1 Coríntios', '2Corintios': '2 Coríntios',
    '1Coríntios': '1 Coríntios', '2Coríntios': '2 Coríntios',
    '1Tessalonicenses': '1 Tessalonicenses', '2Tessalonicenses': '2 Tessalonicenses',
    '1Timoteo': '1 Timóteo', '2Timoteo': '2 Timóteo',
    '1Timóteo': '1 Timóteo', '2Timóteo': '2 Timóteo',
    '1Pedro': '1 Pedro', '2Pedro': '2 Pedro',
    '1Joao': '1 João', '2Joao': '2 João', '3Joao': '3 João',
    '1João': '1 João', '2João': '2 João', '3João': '3 João',
    'Oseias': 'Oséias', 'Miqueias': 'Miquéias'
}

def normalizar_nome_livro(nome: str) -> str:
    nome = nome.strip()
    return NORM_MAP.get(nome, nome)

def parse_origem_cv(origem_str: str, livro: str):
    """
    Interpreta a indicação de capítulo e versículo da nota no rodapé.
    Exemplos:
      '1.14' -> cap 1, v_str '14', v_ini 14, v_fim 14
      '4.7-10' -> cap 4, v_str '7-10', v_ini 7, v_fim 10
      '72, título' -> cap 72, v_str 'título', v_ini 0, v_fim 0
      '1.18, título' -> cap 1, v_str '18 (título)', v_ini 18, v_fim 18
      '7.32,45-46' -> cap 7, v_str '32,45-46', v_ini 32, v_fim 46
      '21' (em Judas) -> cap 1, v_str '21', v_ini 21, v_fim 21
    """
    origem_str = origem_str.replace('&nbsp;', ' ').replace('\xa0', ' ').strip()
    
    # 1. Casos com título: "X, título" ou "X.Y, título"
    m_tit = re.match(r'^(\d+)(?:\.(\d+))?,\s*título$', origem_str)
    if m_tit:
        cap = int(m_tit.group(1))
        v_str = f"{m_tit.group(2)} (título)" if m_tit.group(2) else "título"
        v_ini = int(m_tit.group(2)) if m_tit.group(2) else 0
        v_fim = v_ini
        return cap, v_str, v_ini, v_fim

    # 2. Múltiplos versículos pontuados por vírgula: "7.32,45-46"
    m_multi = re.match(r'^(\d+)\.(\d+,\d+(?:-\d+)?)$', origem_str)
    if m_multi:
        cap = int(m_multi.group(1))
        v_str = m_multi.group(2)
        v_ini = int(v_str.split(',')[0])
        v_fim_part = v_str.split(',')[-1]
        v_fim = int(v_fim_part.split('-')[-1])
        return cap, v_str, v_ini, v_fim

    # 3. Padrão comum "X.Y" ou "X.Y-Z"
    m_cv = re.match(r'^(\d+)\.(\d+)(?:-(\d+))?$', origem_str)
    if m_cv:
        cap = int(m_cv.group(1))
        v_ini = int(m_cv.group(2))
        v_fim = int(m_cv.group(3)) if m_cv.group(3) else v_ini
        v_str = f"{v_ini}-{v_fim}" if v_fim != v_ini else str(v_ini)
        return cap, v_str, v_ini, v_fim

    # 4. Livros de capítulo único ou apenas versículo ("21")
    m_v = re.match(r'^(\d+)(?:-(\d+))?$', origem_str)
    if m_v:
        cap = 1
        v_ini = int(m_v.group(1))
        v_fim = int(m_v.group(2)) if m_v.group(2) else v_ini
        v_str = f"{v_ini}-{v_fim}" if v_fim != v_ini else str(v_ini)
        return cap, v_str, v_ini, v_fim

    return None, None, None, None

def classificar_tipo_nota(texto: str) -> str:
    """
    Classifica a nota de acordo com as regras:
    - 'leitura_alternativa' (se contiver 'ou ')
    - 'hebraico' (se contiver 'Hebr.')
    - 'grego' (se contiver 'Gr.')
    - 'etimologia_ou_significado' (se contiver 'significa' ou 'que é')
    - 'outra' (caso contrário)
    """
    # Verificação de leitura alternativa pela conjunção 'ou' (evitando falso-positivo em verbos como 'falou', 'sou')
    if re.search(r'\bou\b', texto, re.IGNORECASE):
        return 'leitura_alternativa'
    elif 'Hebr.' in texto:
        return 'hebraico'
    elif 'Gr.' in texto:
        return 'grego'
    elif 'significa' in texto.lower() or 'que é' in texto.lower():
        return 'etimologia_ou_significado'
    else:
        return 'outra'

def extrair_notas_epub(epub_path: str):
    if not os.path.exists(epub_path):
        raise FileNotFoundError(f"Arquivo EPUB não encontrado: {epub_path}")

    with zipfile.ZipFile(epub_path, 'r') as z:
        # Localizar arquivos de notas dos 66 livros
        note_files = []
        for name in sorted(z.namelist()):
            if name.startswith('OEBPS/text') and name.endswith('.html'):
                content = z.read(name).decode('utf-8', errors='ignore')
                m_div = re.search(r'<div id=\"notas([^\"]+)\">', content)
                if m_div:
                    m_title = re.search(r'<title>(.*?)</title>', content)
                    raw_title = m_title.group(1).strip() if m_title else m_div.group(1)
                    canonical_name = normalizar_nome_livro(raw_title)
                    note_files.append((name, canonical_name, content))

        notas_extraidas = []
        stats_livro = {livro: {'total': 0, 'leitura_alternativa': 0, 'hebraico': 0, 'grego': 0, 'etimologia_ou_significado': 0, 'outra': 0} for livro, _ in CANONICAL_BOOKS}
        stats_tipo = {'leitura_alternativa': 0, 'hebraico': 0, 'grego': 0, 'etimologia_ou_significado': 0, 'outra': 0}

        for fname, book_name, content in note_files:
            abrev = BOOK_ABBREVS.get(book_name, '')
            f_paras = re.findall(r'<p[^>]*class=[\"\']f[\"\'][^>]*>(.*?)</p>', content, re.DOTALL | re.IGNORECASE)

            for p_body in f_paras:
                # 1. Âncora de nota (id e href de retorno)
                m_a = re.search(r'<a\s+([^>]*class=[\"\']footnote-anchor[\"\'][^>]*)>', p_body)
                if not m_a:
                    continue
                attrs = m_a.group(1)
                m_id = re.search(r'id=[\"\']([^\"\']+)[\"\']', attrs)
                nota_id = m_id.group(1) if m_id else ''
                m_href = re.search(r'href=[\"\']([^\"\']+)[\"\']', attrs)
                retorno_href = m_href.group(1) if m_href else ''

                # 2. Indicador de capítulo e versículo no <strong class="fr">
                m_fr = re.search(r'<strong[^>]*class=[\"\']fr[\"\'][^>]*>(.*?)</strong>', p_body, re.DOTALL)
                fr_raw = m_fr.group(1) if m_fr else ''
                referencia_original = fr_raw.replace('&nbsp;', ' ').replace('\xa0', ' ').strip()
                cap, v_str, v_ini, v_fim = parse_origem_cv(referencia_original, book_name)

                # 3. Limpeza do texto da nota (remover âncora, strong.fr e demais tags HTML)
                clean_body = re.sub(r'<a[^>]*class=[\"\']footnote-anchor[\"\'][^>]*>.*?</a>', '', p_body, flags=re.DOTALL)
                clean_body = re.sub(r'<strong[^>]*class=[\"\']fr[\"\'][^>]*>.*?</strong>', '', clean_body, flags=re.DOTALL)
                texto = re.sub(r'<[^>]+>', '', clean_body)
                texto = texto.replace('&nbsp;', ' ').replace('\xa0', ' ')
                texto = re.sub(r'\s+', ' ', texto).strip()

                # 4. Classificação do tipo da nota
                tipo = classificar_tipo_nota(texto)

                # 5. Formatar referência canônica completa (ex: 'Gn 1.14')
                ref_completa = f"{abrev} {referencia_original}" if abrev else referencia_original

                nota_obj = {
                    "id": nota_id,
                    "livro": book_name,
                    "abrev": abrev,
                    "capitulo": cap,
                    "versiculo": v_str,
                    "versiculo_inicio": v_ini,
                    "versiculo_fim": v_fim,
                    "referencia": referencia_original,
                    "referencia_completa": ref_completa,
                    "texto": texto,
                    "tipo": tipo,
                    "retorno_href": retorno_href
                }

                notas_extraidas.append(nota_obj)

                # Atualizar contadores
                if book_name in stats_livro:
                    stats_livro[book_name]['total'] += 1
                    stats_livro[book_name][tipo] += 1
                stats_tipo[tipo] += 1

        # Tabela ordenada na ordem canônica
        tabela_estatisticas_livro = []
        for i, (livro, abrev) in enumerate(CANONICAL_BOOKS, 1):
            st = stats_livro.get(livro, {'total': 0, 'leitura_alternativa': 0, 'hebraico': 0, 'grego': 0, 'etimologia_ou_significado': 0, 'outra': 0})
            tabela_estatisticas_livro.append({
                "posicao": i,
                "livro": livro,
                "abrev": abrev,
                "total_notas": st['total'],
                "por_tipo": {
                    "leitura_alternativa": st['leitura_alternativa'],
                    "hebraico": st['hebraico'],
                    "grego": st['grego'],
                    "etimologia_ou_significado": st['etimologia_ou_significado'],
                    "outra": st['outra']
                }
            })

        resultado_final = {
            "metadados": {
                "versao": "Almeida Revista e Corrigida (ARC) - Edição 4ª",
                "arquivo_fonte": os.path.basename(epub_path),
                "total_livros": len(CANONICAL_BOOKS),
                "total_notas": len(notas_extraidas),
                "estatisticas_por_tipo": stats_tipo
            },
            "estatisticas_por_livro": tabela_estatisticas_livro,
            "notas": notas_extraidas
        }

        return resultado_final

if __name__ == '__main__':
    epub_path = os.environ.get(
        'EPUB_PATH',
        '/Volumes/SSD 2TB SD/dev/biblia-pericopes/Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
    )
    resultado = extrair_notas_epub(epub_path)
    
    output_dest = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data-arc', 'notas-traducao-arc.json')
    tmp_path = '/tmp/notas-traducao-arc.json'
    
    saved_dest = False
    try:
        with open(output_dest, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
        print(f"Salvo com sucesso em {output_dest}")
        saved_dest = True
    except Exception as e:
        print(f"Aviso: Não foi possível salvar diretamente em {output_dest} ({e}).")

    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)
    print(f"Salvo em {tmp_path}")
    print(f"Total notas: {resultado['metadados']['total_notas']}")
    print(f"Estatísticas por tipo: {resultado['metadados']['estatisticas_por_tipo']}")
