#!/usr/bin/env python3
"""
Extrai do EPUB da ARC o PONTO EXATO de cada chamada de nota de rodapé (a letrinha
sobrescrita da Bíblia impressa) dentro do texto de cada versículo.

Complementa extrair_referencias_cruzadas_arc.py: aquele diz O QUE cada nota
referencia; este diz ONDE, no versículo, a nota está ancorada.

Saída: data/referencias-ancoras-arc.json

  {
    "metadados": {...},
    "livros": {
      "Gênesis": {
        "1:1": [
          {"id": "footnote-103667-1", "ordem": 0, "palavra_idx": 1,
           "antes": "No", "depois": "princípio,"}
        ]
      }
    }
  }

- `ordem`: posição da nota entre as notas do versículo (0, 1, 2…). É dela que sai a
  letra (a, b, c…) no app.
- `palavra_idx`: quantas palavras do versículo vêm ANTES da chamada.
- `total_palavras`: palavras do versículo inteiro na ARC (para estimar a posição
  proporcional no texto da Bíblia Livre).
- `antes`/`depois`: a palavra imediatamente anterior e posterior, para o alinhador
  reencontrar o ponto no texto da Bíblia Livre, cuja redação difere da ARC.
"""

import glob
import json
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extrair_pericopes_arc import BOOK_NAMES_PT, clean_text  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(ROOT, 'data/referencias-ancoras-arc.json')
REFERENCIAS = os.path.join(ROOT, 'data/referencias-cruzadas-arc.json')

CHAMADA = re.compile(
    r'<span class="chamada">\s*<a[^>]*id="([^"]+)-backlink"[^>]*>.*?</a>\s*</span>',
    re.DOTALL,
)
VERSICULO = re.compile(
    r'<a\s+[^>]*class="(?:v|vwj)"\s+id="v(\d+)"[^>]*>.*?</a>',
    re.DOTALL,
)
# Sentinela que sobrevive ao clean_text (que remove tags e normaliza espaços).
MARCA = re.compile(r'⟦([^⟧]+)⟧')


def ancoras_do_versiculo(trecho_html: str):
    """Âncoras de um versículo, na ordem em que aparecem no texto."""
    html = CHAMADA.sub(lambda m: f' ⟦{m.group(1)}⟧ ', trecho_html)
    texto = clean_text(html)
    partes = MARCA.split(texto)
    # split com grupo de captura: [texto, id, texto, id, texto…]
    saida = []
    palavras_antes = 0
    for i in range(0, len(partes), 2):
        palavras = partes[i].split()
        if i > 0:
            anterior = saida[-1]
            anterior['depois'] = palavras[0] if palavras else ''
        palavras_antes += len(palavras)
        if i + 1 < len(partes):
            ultima = palavras[-1] if palavras else (saida[-1]['antes'] if saida else '')
            saida.append({
                'id': partes[i + 1],
                'ordem': len(saida),
                'palavra_idx': palavras_antes,
                'antes': ultima,
                'depois': '',
            })
    for a in saida:
        a['total_palavras'] = palavras_antes
    return saida


def extrair(epub_path: str):
    livros = {}
    ids_vistos = {}
    duplicados = []
    with zipfile.ZipFile(epub_path) as z:
        for nome in sorted(n for n in z.namelist() if n.startswith('OEBPS/text') and n.endswith('.html')):
            c = z.read(nome).decode('utf-8', errors='ignore')
            div = re.search(r'<div id="ARC([^"]+)"', c)
            if not div or div.group(1).endswith('Intro'):
                continue
            m = re.match(r'^(.+?)(\d+)$', div.group(1))
            if not m or m.group(1) not in BOOK_NAMES_PT:
                continue
            livro, cap = BOOK_NAMES_PT[m.group(1)], int(m.group(2))

            marcas = list(VERSICULO.finditer(c))
            for i, mv in enumerate(marcas):
                fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(c)
                trecho = c[mv.end():fim]
                if 'class="chamada"' not in trecho:
                    continue
                ancoras = ancoras_do_versiculo(trecho)
                if not ancoras:
                    continue
                chave = f'{cap}:{mv.group(1)}'
                for a in ancoras:
                    if a['id'] in ids_vistos:
                        duplicados.append(a['id'])
                    ids_vistos[a['id']] = (livro, chave)
                livros.setdefault(livro, {})[chave] = ancoras
    return livros, ids_vistos, duplicados


def main():
    epubs = glob.glob(os.path.join(ROOT, '*.epub'))
    if not epubs:
        print('Nenhum .epub na raiz do projeto.')
        sys.exit(1)
    livros, ids_vistos, duplicados = extrair(epubs[0])

    with open(REFERENCIAS, encoding='utf-8') as f:
        notas = json.load(f)['notas']
    ids_notas = {n['id'] for n in notas}
    sem_ancora = sorted(ids_notas - set(ids_vistos))
    sem_nota = sorted(set(ids_vistos) - ids_notas)

    total = sum(len(v) for lv in livros.values() for v in lv.values())
    saida = {
        'metadados': {
            'fonte': os.path.basename(epubs[0]),
            'total_ancoras': total,
            'notas_sem_ancora': len(sem_ancora),
            'ancoras_sem_nota': len(sem_nota),
            'ids_duplicados': len(duplicados),
        },
        'livros': livros,
    }
    with open(SAIDA, 'w', encoding='utf-8') as f:
        json.dump(saida, f, ensure_ascii=False)

    print(f'Âncoras: {total} em {len(livros)} livros')
    print(f'Notas de referência sem âncora no texto: {len(sem_ancora)} {sem_ancora[:5]}')
    print(f'Âncoras sem nota de referência (notas explicativas): {len(sem_nota)} {sem_nota[:5]}')
    print(f'IDs duplicados: {len(duplicados)} {duplicados[:5]}')
    print(f'Salvo em {SAIDA}')


if __name__ == '__main__':
    main()
