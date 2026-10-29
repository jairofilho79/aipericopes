#!/usr/bin/env python3
"""
Extrai todos os 132 cabeçalhos de estrofes de Poemas Acrósticos Hebraicos (<h5 class="qa">...</h5>)
da Bíblia ARC (Almeida Revista e Corrigida - Edição 4ª) contidos no arquivo EPUB.

Gera o arquivo com:
- Metadados gerais
- Estatísticas consolidadas e por livro/capítulo
- Visão geral dos poemas acrósticos
- Dados agrupados hierarquicamente por livro e capítulo
- Lista plana consolidada de todos os 132 cabeçalhos acrósticos
"""

import json
import os
import re
import zipfile
from html import unescape

EPUB_PATH = '/Volumes/SSD 2TB SD/dev/biblia-pericopes/Bíblia Sagrada ARC_ Almeida Revista e Corrigida - Edição 4ª.epub'
OUTPUT_TMP = '/tmp/acrosticos-hebraicos-arc.json'

# Informações canônicas das 22 letras do alfabeto hebraico
HEBREW_ALPHABET_DATA = {
    'Álefe': {'posicao': 1, 'caractere': 'א', 'transliteracao': 'Alef', 'significado_nome': 'Boi / Líder'},
    'Bete': {'posicao': 2, 'caractere': 'ב', 'transliteracao': 'Bet', 'significado_nome': 'Casa'},
    'Guímel': {'posicao': 3, 'caractere': 'ג', 'transliteracao': 'Gimel', 'significado_nome': 'Camelo'},
    'Dálete': {'posicao': 4, 'caractere': 'ד', 'transliteracao': 'Dalet', 'significado_nome': 'Porta'},
    'Hê': {'posicao': 5, 'caractere': 'ה', 'transliteracao': 'He', 'significado_nome': 'Janela / Louvor'},
    'Vau': {'posicao': 6, 'caractere': 'ו', 'transliteracao': 'Vav', 'significado_nome': 'Gancho / Estaca'},
    'Zain': {'posicao': 7, 'caractere': 'ז', 'transliteracao': 'Zayin', 'significado_nome': 'Espada / Arma'},
    'Hete': {'posicao': 8, 'caractere': 'ח', 'transliteracao': 'Chet', 'significado_nome': 'Cerca'},
    'Tete': {'posicao': 9, 'caractere': 'ט', 'transliteracao': 'Tet', 'significado_nome': 'Cesto / Barro'},
    'Iode': {'posicao': 10, 'caractere': 'י', 'transliteracao': 'Yod', 'significado_nome': 'Mão'},
    'Jode': {'posicao': 10, 'caractere': 'י', 'transliteracao': 'Yod', 'significado_nome': 'Mão'},
    'Cafe': {'posicao': 11, 'caractere': 'כ', 'transliteracao': 'Kaf', 'significado_nome': 'Palma da mão'},
    'Lâmede': {'posicao': 12, 'caractere': 'ל', 'transliteracao': 'Lamed', 'significado_nome': 'Aguilhão de boi / Ensino'},
    'Mem': {'posicao': 13, 'caractere': 'מ', 'transliteracao': 'Mem', 'significado_nome': 'Águas'},
    'Nun': {'posicao': 14, 'caractere': 'נ', 'transliteracao': 'Nun', 'significado_nome': 'Peixe / Vida'},
    'Sâmeque': {'posicao': 15, 'caractere': 'ס', 'transliteracao': 'Samekh', 'significado_nome': 'Sustento / Apoio'},
    'Ain': {'posicao': 16, 'caractere': 'ע', 'transliteracao': 'Ayin', 'significado_nome': 'Olho / Fonte'},
    'Pê': {'posicao': 17, 'caractere': 'פ', 'transliteracao': 'Pe', 'significado_nome': 'Boca'},
    'Tsadê': {'posicao': 18, 'caractere': 'צ', 'transliteracao': 'Tsade', 'significado_nome': 'Anzol / Justo'},
    'Cofe': {'posicao': 19, 'caractere': 'ק', 'transliteracao': 'Qof', 'significado_nome': 'Fundo da agulha / Macaco'},
    'Rexe': {'posicao': 20, 'caractere': 'ר', 'transliteracao': 'Resh', 'significado_nome': 'Cabeça'},
    'Chim': {'posicao': 21, 'caractere': 'ש', 'transliteracao': 'Shin', 'significado_nome': 'Dente'},
    'Tau': {'posicao': 22, 'caractere': 'ת', 'transliteracao': 'Tav', 'significado_nome': 'Sinal / Marca / Cruz'}
}

def extrair_acrosticos():
    if not os.path.exists(EPUB_PATH):
        raise FileNotFoundError(f"Arquivo EPUB não encontrado: {EPUB_PATH}")

    with zipfile.ZipFile(EPUB_PATH, 'r') as z:
        # Arquivos HTML conhecidos onde os poemas acrósticos estão localizados:
        # OEBPS/text00637.html -> Salmos 119 (22 estrofes)
        # OEBPS/text00701.html -> Provérbios 31 (22 versículos: 10-31)
        # OEBPS/text00850.html -> Lamentações 1 (22 estrofes) + Cabeçalho Álefe de Lam 2
        # OEBPS/text00851.html -> Lamentações 2 (21 estrofes: Bete..Tau) + Cabeçalho Álefe de Lam 3
        # OEBPS/text00852.html -> Lamentações 3 (21 estrofes: Bete..Tau) + Cabeçalho Álefe de Lam 4
        # OEBPS/text00853.html -> Lamentações 4 (21 estrofes: Bete..Tau)

        def get_qas(filename):
            content = z.read(filename).decode('utf-8', errors='ignore')
            raw_matches = re.findall(r'<h5[^>]*class=[\"\'\s]*qa[\"\'\s]*>(.*?)</h5>', content)
            cleaned = []
            for m in raw_matches:
                t = re.sub(r'<[^>]+>', '', m).strip()
                t = unescape(t).rstrip('.').strip()
                cleaned.append(t)
            return cleaned

        qas_sl119 = get_qas('OEBPS/text00637.html')
        qas_pv31 = get_qas('OEBPS/text00701.html')
        qas_850 = get_qas('OEBPS/text00850.html')
        qas_851 = get_qas('OEBPS/text00851.html')
        qas_852 = get_qas('OEBPS/text00852.html')
        qas_853 = get_qas('OEBPS/text00853.html')

    # Redistribuição dos cabeçalhos de Lamentações (o EPUB posicionou o Álefe inicial
    # dos capítulos 2, 3 e 4 no final do arquivo HTML do capítulo imediatamente anterior):
    qas_lm1 = qas_850[:22]
    qas_lm2 = qas_850[22:] + qas_851[:21]
    qas_lm3 = qas_851[21:] + qas_852[:21]
    qas_lm4 = qas_852[21:] + qas_853

    # Definição dos 6 poemas acrósticos
    poemas_specs = [
        {
            'livro': 'Salmos',
            'capitulo': 119,
            'abrev': 'Sl',
            'qas': qas_sl119,
            'v_offset': 1,
            'v_step': 8,
            'descricao': 'O grande salmo da Palavra de Deus em 22 estrofes de 8 versículos (176 versículos no total). Cada verso de cada estrofe no original hebraico inicia com a respectiva letra.',
            'ordem_alfabetica_tipo': 'Padrão canônico'
        },
        {
            'livro': 'Provérbios',
            'capitulo': 31,
            'abrev': 'Pv',
            'qas': qas_pv31,
            'v_offset': 10,
            'v_step': 1,
            'descricao': 'O elogio da Mulher Virtuosa (Provérbios 31:10-31), um poema acróstico perfeito de 22 versículos, onde cada verso inicia com uma letra sucessiva do alfabeto hebraico.',
            'ordem_alfabetica_tipo': 'Padrão canônico'
        },
        {
            'livro': 'Lamentações',
            'capitulo': 1,
            'abrev': 'Lm',
            'qas': qas_lm1,
            'v_offset': 1,
            'v_step': 1,
            'descricao': 'Elegia sobre a ruína e humilhação de Jerusalém em 22 versículos acrósticos, seguindo a ordem alfabética padrão (Ain antes de Pê).',
            'ordem_alfabetica_tipo': 'Padrão canônico (Ain antes de Pê)'
        },
        {
            'livro': 'Lamentações',
            'capitulo': 2,
            'abrev': 'Lm',
            'qas': qas_lm2,
            'v_offset': 1,
            'v_step': 1,
            'descricao': 'Elegia sobre o cerco e o julgamento divino sobre Jerusalém em 22 versículos acrósticos, preservando a célebre variante alfabética hebraica arcaica onde Pê antecede Ain.',
            'ordem_alfabetica_tipo': 'Variante hebraica (Pê antes de Ain)'
        },
        {
            'livro': 'Lamentações',
            'capitulo': 3,
            'abrev': 'Lm',
            'qas': qas_lm3,
            'v_offset': 1,
            'v_step': 3,
            'descricao': 'O ápice teológico de Lamentações em 66 versículos estruturados em 22 tercetos (3 versículos por estrofe). Preserva a variante hebraica onde Pê antecede Ain.',
            'ordem_alfabetica_tipo': 'Variante hebraica (Pê antes de Ain)'
        },
        {
            'livro': 'Lamentações',
            'capitulo': 4,
            'abrev': 'Lm',
            'qas': qas_lm4,
            'v_offset': 1,
            'v_step': 1,
            'descricao': 'Elegia sobre o horror da fome e o sofrimento do povo em 22 versículos acrósticos. Preserva a variante hebraica onde Pê antecede Ain.',
            'ordem_alfabetica_tipo': 'Variante hebraica (Pê antes de Ain)'
        }
    ]

    todos_cabecalhos = []
    livros_dict = {}
    visao_geral = []

    id_global = 1

    for spec in poemas_specs:
        livro = spec['livro']
        cap = spec['capitulo']
        abrev = spec['abrev']
        qas = spec['qas']
        v_offset = spec['v_offset']
        v_step = spec['v_step']

        if len(qas) != 22:
            raise ValueError(f"Esperado 22 cabeçalhos para {livro} {cap}, mas foram encontrados {len(qas)}")

        v_ini_cap = v_offset
        v_fim_cap = v_offset + (22 * v_step) - 1

        visao_geral.append({
            'livro': livro,
            'capitulo': cap,
            'referencia': f"{livro} {cap}:{v_ini_cap}-{v_fim_cap}",
            'total_estrofes': 22,
            'versiculo_inicio': v_ini_cap,
            'versiculo_fim': v_fim_cap,
            'versiculos_por_estrofe': v_step,
            'total_versiculos': 22 * v_step,
            'tipo_ordem_alfabetica': spec['ordem_alfabetica_tipo'],
            'descricao': spec['descricao']
        })

        if livro not in livros_dict:
            livros_dict[livro] = {
                'livro': livro,
                'abrev': abrev,
                'total_cabecalhos': 0,
                'capitulos': []
            }

        cap_obj = {
            'capitulo': cap,
            'referencia': f"{livro} {cap}",
            'total_cabecalhos': 22,
            'versiculo_inicio': v_ini_cap,
            'versiculo_fim': v_fim_cap,
            'versiculos_por_estrofe': v_step,
            'tipo_ordem_alfabetica': spec['ordem_alfabetica_tipo'],
            'descricao': spec['descricao'],
            'cabecalhos': []
        }

        for idx, letra in enumerate(qas):
            ordem_estrofe = idx + 1
            info_letra = HEBREW_ALPHABET_DATA.get(letra, {'posicao': ordem_estrofe, 'caractere': '', 'transliteracao': letra, 'significado_nome': ''})
            pos_canonica = info_letra['posicao']

            v_ini = v_offset + (idx * v_step)
            v_fim = v_ini + v_step - 1

            if v_ini == v_fim:
                ref_estrofe = f"{livro} {cap}:{v_ini}"
            else:
                ref_estrofe = f"{livro} {cap}:{v_ini}-{v_fim}"

            cabecalho_item = {
                'id': id_global,
                'livro': livro,
                'capitulo': cap,
                'letra_hebraica': letra,
                'posicao_alfabetica': pos_canonica,
                'ordem_estrofe': ordem_estrofe,
                'versiculo_inicio': v_ini,
                'versiculo_fim': v_fim,
                'total_versiculos': v_step,
                'referencia': ref_estrofe,
                'caractere_hebraico': info_letra['caractere'],
                'transliteracao': info_letra['transliteracao'],
                'significado_letra': info_letra['significado_nome']
            }

            cap_obj['cabecalhos'].append(cabecalho_item)
            todos_cabecalhos.append(cabecalho_item)
            id_global += 1

        livros_dict[livro]['capitulos'].append(cap_obj)
        livros_dict[livro]['total_cabecalhos'] += 22

    # Montar estrutura completa
    dados_finais = {
        'metadados': {
            'titulo': 'Cabeçalhos de Poemas Acrósticos Hebraicos da Bíblia ARC',
            'versao': 'Almeida Revista e Corrigida (ARC) - Edição 4ª',
            'arquivo_fonte': os.path.basename(EPUB_PATH),
            'elemento_html': '<h5 class="qa">...</h5>',
            'total_cabecalhos': len(todos_cabecalhos),
            'total_livros': len(livros_dict),
            'total_capitulos_acrosticos': len(visao_geral),
            'total_versiculos_abrangidos': sum(vg['total_versiculos'] for vg in visao_geral),
            'letras_alfabeto_hebraico': 22,
            'nota_variacao_lamentacoes': (
                "Em Lamentações 2, 3 e 4, a estrofe encabeçada pela letra Pê (posição alfabética canônica 17) "
                "antecede a letra Ain (posição alfabética canônica 16). Esse fenômeno reflete uma ordem "
                "alfabética hebraica antiga atestada arqueologicamente (inscrições de Kuntillet Ajrud e Izbet Sartah) "
                "e fielmente preservada no texto hebraico massorético e na tradução de Almeida Revista e Corrigida."
            )
        },
        'estatisticas': {
            'total_cabecalhos': len(todos_cabecalhos),
            'total_livros': len(livros_dict),
            'total_capitulos': len(visao_geral),
            'total_versiculos_abrangidos': sum(vg['total_versiculos'] for vg in visao_geral),
            'por_livro': {
                'Salmos': {
                    'capitulos': [119],
                    'total_cabecalhos': 22,
                    'versiculos_abrangidos': 176,
                    'versiculos_por_estrofe': 8,
                    'grafia_yod': 'Iode'
                },
                'Provérbios': {
                    'capitulos': [31],
                    'total_cabecalhos': 22,
                    'versiculos_abrangidos': 22,
                    'versiculos_por_estrofe': 1,
                    'grafia_yod': 'Jode'
                },
                'Lamentações': {
                    'capitulos': [1, 2, 3, 4],
                    'total_cabecalhos': 88,
                    'versiculos_abrangidos': 132,
                    'grafia_yod': 'Jode',
                    'detalhe_capitulos': {
                        '1': {'cabecalhos': 22, 'versiculos': 22, 'versiculos_por_estrofe': 1, 'ordem': 'Padrão canônico (Ain antes de Pê)'},
                        '2': {'cabecalhos': 22, 'versiculos': 22, 'versiculos_por_estrofe': 1, 'ordem': 'Variante hebraica (Pê antes de Ain)'},
                        '3': {'cabecalhos': 22, 'versiculos': 66, 'versiculos_por_estrofe': 3, 'ordem': 'Variante hebraica (Pê antes de Ain)'},
                        '4': {'cabecalhos': 22, 'versiculos': 22, 'versiculos_por_estrofe': 1, 'ordem': 'Variante hebraica (Pê antes de Ain)'}
                    }
                }
            }
        },
        'visao_geral': visao_geral,
        'livros': list(livros_dict.values()),
        'todos_cabecalhos': todos_cabecalhos
    }

    return dados_finais

def main():
    print(f"Extraindo acrósticos hebraicos de: {EPUB_PATH}...")
    dados = extrair_acrosticos()

    print(f"Total de cabeçalhos extraídos: {dados['metadados']['total_cabecalhos']}")
    print(f"Total de livros: {dados['metadados']['total_livros']}")
    print(f"Total de capítulos acrósticos: {dados['metadados']['total_capitulos_acrosticos']}")
    print(f"Total de versículos abrangidos: {dados['metadados']['total_versiculos_abrangidos']}")

    with open(OUTPUT_TMP, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

    tamanho = os.path.getsize(OUTPUT_TMP)
    print(f"Arquivo temporário salvo em: {OUTPUT_TMP} ({tamanho:,} bytes)")

if __name__ == '__main__':
    main()
