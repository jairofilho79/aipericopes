#!/usr/bin/env python3
"""
Alinha e injeta as Palavras de Jesus em vermelho no banco de dados do projeto:
- data/pericopes.json (Bíblia Livre / aipericopes.com)
- data/pericopes-arc.json (Bíblia ARC)

Fonte: data/palavras-de-jesus-arc.json (2.035 versículos extraídos do EPUB da ARC).
"""

import os
import re
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PALAVRAS_JESUS_PATH = os.path.join(ROOT, 'data/palavras-de-jesus-arc.json')
PERICOPES_JSON_PATH = os.path.join(ROOT, 'data/pericopes.json')
PERICOPES_ARC_PATH = os.path.join(ROOT, 'data/pericopes-arc.json')

# Casos em que a estrutura de diálogo ou pontuação em BLIVRE requer recorte preciso
SPECIAL_CASES = {
    ('Mateus', 3, 15): ['Permite por agora, porque assim nos convém cumprir toda a justiça.'],
    ('Mateus', 8, 3): ['Quero, sê limpo.'],
    ('Mateus', 8, 13): ['Vai, e assim como creste, a ti seja feito.'],
    ('Mateus', 8, 26): ['Por que temeis, homens de pouca fé?'],
    ('Mateus', 8, 32): ['Ide.'],
    ('Mateus', 9, 6): ['Ora, para que saibais que o Filho do homem tem autoridade na terra para perdoar pecados', 'Levanta-te, toma o teu leito, e vai para tua casa.'],
    ('Mateus', 9, 9): ['Segue-me.'],
    ('Mateus', 9, 22): ['Tem bom ânimo, filha, a tua fé te sarou.'],
    ('Mateus', 9, 24): ['Retirai-vos, porque a menina não está morta, mas sim dormindo.'],
    ('Mateus', 9, 28): ['Credes que posso fazer isto?'],
    ('Mateus', 12, 13): ['Estende a tua mão.'],
    ('Mateus', 13, 51): ['Entendestes todas estas coisas?'],
    ('Mateus', 14, 29): ['Vem.'],
    ('Mateus', 15, 28): ['Ó mulher, grande é a tua fé. A ti seja feito como tu queres.'],
    ('Mateus', 15, 34): ['Quantos pães tendes?'],
    ('Mateus', 16, 4): ['Uma geração má e adúltera pede um sinal; mas nenhum sinal lhe será dado, a não ser o sinal do profeta Jonas.'],
    ('Mateus', 17, 23): ['E o matarão, e ele será ressuscitado ao terceiro dia.'],
    ('Mateus', 20, 21): ['O que queres?'],
    ('Mateus', 20, 22): ['Não sabeis o que pedis. Podeis vós beber o cálice que eu beberei, e ser batizados com o batismo com que eu sou batizado?'],
    ('Mateus', 21, 19): ['Nunca de ti nasça fruto, jamais!'],
    ('Mateus', 21, 25): ['De onde era o batismo de João? Do céu, ou dos seres humanos?'],
    ('Mateus', 21, 31): ['Qual dos dois fez a vontade do pai?', 'Em verdade vos digo que os publicanos e as prostitutas estão indo adiante de vós ao Reino de Deus.'],
    ('Mateus', 22, 19): ['Mostrai-me a moeda do tributo.'],
    ('Mateus', 22, 42): ['Que pensais vós acerca do Cristo? De quem ele é filho?'],
    ('Mateus', 26, 50): ['Amigo, para que vieste?'],
    ('Mateus', 26, 56): ['Porém tudo isto aconteceu para que as Escrituras dos profetas se cumpram.'],
    ('Mateus', 26, 75): ['Antes do galo cantar, tu me negarás três vezes.'],
    ('Mateus', 27, 46): ['Eli, Eli, lamá sabactâni?', 'Deus meu, Deus meu, porque me desamparaste?'],
    ('Mateus', 28, 9): ['Saudações.'],
    ('Mateus', 28, 20): ['ensinando-lhes a guardar todas as coisas que eu vos tenho mandado. E eis que eu estou convosco todos os dias, até o fim dos tempos.'],
    ('Marcos', 2, 10): ['Mas para que saibais que o Filho do homem tem poder na terra para perdoar pecados,'],
    ('Marcos', 2, 14): ['Segue-me.'],
    ('Marcos', 3, 4): ['É lícito no sábado fazer o bem, ou o mal? Salvar uma pessoa, ou matá-la?'],
    ('Marcos', 3, 5): ['Estende a tua mão.'],
    ('Marcos', 4, 39): ['Cala-te, aquieta-te!'],
    ('Marcos', 5, 8): ['Sai deste homem, espírito imundo'],
    ('Marcos', 5, 9): ['Qual é o teu nome?'],
    ('Marcos', 5, 41): ['Talita cumi', 'Menina, eu te digo, levanta-te'],
    ('Marcos', 6, 31): ['Vinde vós à parte a um lugar deserto, e descansai um pouco;'],
    ('Marcos', 6, 37): ['Dai-lhes vós mesmos de comer.'],
    ('Marcos', 6, 38): ['Quantos pães tendes? Ide ver.'],
    ('Marcos', 7, 34): ['Efatá', 'abre-te'],
    ('Marcos', 8, 5): ['Quantos pães tendes?'],
    ('Marcos', 8, 19): ['quando parti os cinco pães entre os cinco mil, quantos cestos cheios de pedaços levantastes?'],
    ('Marcos', 8, 20): ['E quando parti os sete entre os quatro mil, quantas cestas cheias de pedaços levantastes?'],
    ('Marcos', 8, 23): ['Vês alguma coisa?'],
    ('Marcos', 8, 29): ['E vós, quem dizeis que eu sou?'],
    ('Marcos', 9, 21): ['Quanto tempo há que isto lhe sobreveio?'],
    ('Marcos', 9, 25): ['Espírito mudo e surdo, eu te ordeno, sai dele, e nunca mais entres nele!'],
    ('Marcos', 10, 18): ['Por que me chamas bom? Ninguém é bom, a não ser um: Deus.'],
    ('Marcos', 10, 33): ['Eis que subimos a Jerusalém, e o Filho do homem será entregue aos chefes dos sacerdotes, e aos escribas; e o condenarão à morte, e o entregarão aos gentios.'],
    ('Marcos', 10, 36): ['O que quereis que eu vos faça?'],
    ('Marcos', 10, 51): ['Que queres que eu te faça?'],
    ('Marcos', 10, 52): ['Vai; a tua fé te salvou.'],
    ('Marcos', 11, 14): ['Nunca mais ninguém coma fruto de ti!'],
    ('Marcos', 12, 16): ['De quem é esta imagem, e a inscrição?'],
    ('Marcos', 12, 17): ['Dai, pois, a César o que é de César, e a Deus o que é de Deus.'],
    ('Marcos', 12, 34): ['Não estás longe do Reino de Deus.'],
    ('Marcos', 12, 37): ['Ora, se o próprio Davi o chama de Senhor, como, pois, é seu filho?'],
    ('Marcos', 14, 48): ['Viestes me prender com espadas e bastões, como se eu fosse um bandido?'],
    ('Marcos', 14, 72): ['Antes que o galo cante duas vezes, tu me negarás três vezes.'],
    ('Marcos', 15, 34): ['ELOÍ, ELOÍ, LAMÁ SABACTÂNI', 'Deus meu, Deus meu, por que me desamparaste?'],
    ('Lucas', 4, 35): ['Cala-te, e, sai dele.'],
    ('Lucas', 5, 4): ['Vai à água profunda, e lançai as vossas redes para pescar.'],
    ('Lucas', 5, 13): ['Quero; sê limpo.'],
    ('Lucas', 5, 24): ['Para que saibais que o Filho do homem tem poder sobre a terra para perdoar pecados', 'Eu te digo, levanta-te, toma o teu leito, e vai para a tua casa.'],
    ('Lucas', 6, 8): ['Levanta-te, e põe-te em pé no meio.'],
    ('Lucas', 6, 10): ['Estende a tua mão.'],
    ('Lucas', 7, 14): ['Jovem, a ti eu digo: levanta-te.'],
    ('Lucas', 7, 40): ['Simão, tenho uma coisa a te dizer'],
    ('Lucas', 7, 41): ['Certo credor tinha dois devedores. Um lhe devia quinhentas moedas de prata, e o outro cinquenta.'],
    ('Lucas', 7, 48): ['Os teus pecados são perdoados.'],
    ('Lucas', 7, 50): ['A tua fé te salvou; vai em paz.'],
    ('Lucas', 8, 8): ['Quem tem ouvidos para ouvir, ouça.'],
    ('Lucas', 8, 22): ['Passemos para o outro lado do lago'],
    ('Lucas', 8, 25): ['Onde está a vossa fé?'],
    ('Lucas', 8, 30): ['Qual é teu nome?'],
    ('Lucas', 8, 39): ['Volta para tua casa, e conta como foram grandes as coisas que Deus te fez'],
    ('Lucas', 8, 45): ['Quem me tocou?'],
    ('Lucas', 8, 48): ['Tem bom ânimo, filha; a tua fé te sarou; vai em paz'],
    ('Lucas', 8, 52): ['Não choreis; ela não está morta, mas dorme'],
    ('Lucas', 8, 54): ['Levanta-te, menina'],
    ('Lucas', 9, 13): ['Dai-lhes vós de comer'],
    ('Lucas', 9, 20): ['E vós, quem dizeis que eu sou?'],
    ('Lucas', 9, 56): ['Porque o Filho do homem não veio para destruir as almas dos seres humanos, mas sim para salvá-las.'],
    ('Lucas', 9, 59): ['Segue-me'],
    ('Lucas', 17, 14): ['Ide, e mostrai-vos aos sacerdotes.'],
    ('Lucas', 17, 19): ['Levanta-te, e vai; tua fé te salvou.'],
    ('Lucas', 18, 19): ['Por que me chamas de bom? Ninguém é bom, a não ser um: Deus.'],
    ('Lucas', 18, 41): ['Que queres que eu te faça?'],
    ('Lucas', 18, 42): ['Vê, tua fé te salvou.'],
    ('Lucas', 19, 5): ['Zaqueu, apressa-te, e desce; porque hoje é necessário que eu fique em tua casa.'],
    ('Lucas', 19, 40): ['Digo-vos, que se estes se calarem, as pedras clamariam.'],
    ('Lucas', 20, 16): ['Virá, e destruirá a estes lavradores, e dará a vinha a outros.'],
    ('Lucas', 20, 24): ['Mostrai-me uma moeda; ela tem a imagem e a inscrição de quem?'],
    ('Lucas', 20, 42): ['Senta-te à minha direita,'],
    ('Lucas', 22, 35): ['Quando vos mandei sem bolsa, e sem sacola, e sem sandálias, por acaso algo vos faltou?'],
    ('Lucas', 22, 51): ['Para com isto!'],
    ('Lucas', 23, 34): ['Pai, perdoa-lhes, porque não sabem o que fazem.'],
    ('Lucas', 23, 46): ['Pai, em tuas mãos eu entrego meu espírito.'],
    ('Lucas', 24, 19): ['Quais?'],
    ('João', 1, 38): ['Que buscais?'],
    ('João', 1, 39): ['Vinde, e vede-o;'],
    ('João', 1, 42): ['Tu és Simão, filho de Jonas; tu serás chamado Cefas.'],
    ('João', 2, 7): ['Enchei estes vasos com água.'],
    ('João', 2, 8): ['Agora tirai, e a levai ao mestre de cerimônia.'],
    ('João', 4, 50): ['Vai, teu filho vive.'],
    ('João', 6, 10): ['Fazei sentar as pessoas;'],
    ('João', 6, 64): ['Mas há alguns de vós que não creem.'],
    ('João', 8, 41): ['Vós fazeis as obras de vosso pai.'],
    ('João', 9, 7): ['Vai, lava-te no tanque de Siloé'],
    ('João', 11, 34): ['Onde o pusestes?'],
    ('João', 11, 39): ['Tirai a pedra.'],
    ('João', 12, 28): ['Pai, glorifica teu Nome.'],
    ('João', 12, 36): ['Enquanto tendes luz, crede na luz, para que sejais filhos da luz.'],
    ('João', 13, 26): ['Aquele a quem eu der o pedaço molhado de pão.'],
    ('João', 18, 5): ['Eu sou.'],
    ('João', 18, 7): ['A quem buscais?'],
    ('João', 19, 27): ['Eis aí tua mãe.'],
    ('João', 19, 30): ['Está consumado;'],
    ('João', 20, 15): ['Mulher, por que choras? A quem buscas?'],
    ('João', 20, 16): ['Maria!'],
    ('João', 21, 5): ['Filhinhos, tendes algo para comer?'],
    ('João', 21, 6): ['Lançai a rede do lado direito do barco, e achareis.'],
    ('João', 21, 12): ['Vinde, jantai.'],
    ('João', 21, 15): ['Simão filho de Jonas, tu me amas mais do que estes outros?', 'Alimenta meus cordeiros.'],
    ('João', 21, 16): ['Simão, filho de Jonas, tu me amas?', 'Apascenta minhas ovelhas.'],
    ('João', 21, 17): ['Simão, filho de Jonas, tu me amas?', 'Alimenta minhas ovelhas.'],
    ('Atos', 1, 4): ['de mim ouvistes.'],
    ('Atos', 9, 10): ['Ananias!'],
    ('2 Coríntios', 12, 9): ['Minha graça te basta, porque meu poder se aperfeiçoa na fraqueza'],
    ('Apocalipse', 1, 8): ['Eu sou o Alfa e o Ômega, o princípio e o fim', 'que é, e que era, e que virá, o Todo-Poderoso.'],
    ('Apocalipse', 22, 20): ['Certamente logo venho.']
}

def carregar_dados():
    with open(PALAVRAS_JESUS_PATH, 'r', encoding='utf-8') as f:
        pj = json.load(f)
    with open(PERICOPES_JSON_PATH, 'r', encoding='utf-8') as f:
        cat = json.load(f)
    with open(PERICOPES_ARC_PATH, 'r', encoding='utf-8') as f:
        arc_p = json.load(f)
    return pj, cat, arc_p

def montar_mapa_versiculos(cat, arc_p):
    arc_verses = {}
    for p in arc_p:
        for v in p['versiculos']:
            arc_verses[(p['livro'], v['capitulo'], v['versiculo'])] = v['texto']

    blivre_verses = {}
    for p in cat:
        lines = p['texto'].split('\n')
        ch = 0
        for l in lines:
            l = l.strip()
            if l.startswith('Capítulo '):
                ch = int(l.replace('Capítulo ', ''))
            elif l and l[0].isdigit():
                parts = l.split(' ', 1)
                blivre_verses[(p['livro'], ch, int(parts[0]))] = parts[1] if len(parts) > 1 else ''

    return arc_verses, blivre_verses

def obter_frases_blivre(item, b_text, arc_v):
    key = (item['livro'], item['capitulo'], item['versiculo'])
    if key in SPECIAL_CASES:
        return SPECIAL_CASES[key]

    fala = item['fala_completa_jesus']
    norm_full = re.sub(r'[\s\.,;:?!\"\'“”«»]+', ' ', arc_v).strip().lower()
    norm_fala = re.sub(r'[\s\.,;:?!\"\'“”«»]+', ' ', fala).strip().lower()

    if norm_full == norm_fala:
        return [b_text]
    elif norm_full.endswith(norm_fala):
        if ':' in b_text:
            idx = b_text.find(':')
            speech = b_text[idx+1:].strip()
            if (speech.startswith('“') and speech.endswith('”')) or (speech.startswith('\"') and speech.endswith('\"')):
                speech = speech[1:-1].strip()
            return [speech]
        return [b_text]
    else:
        raise ValueError(f"Versículo não categorizado: {key}")

def main():
    print(f"📖 Carregando dados...")
    pj, cat, arc_p = carregar_dados()
    arc_verses, blivre_verses = montar_mapa_versiculos(cat, arc_p)

    pj_lookup = {(item['livro'], item['capitulo'], item['versiculo']): item for item in pj['versiculos']}
    print(f"✅ Total de versículos com fala de Jesus em ARC: {len(pj_lookup)}")

    # 1. Alinhar versículos para BLIVRE
    blivre_alinhado = {}
    for item in pj['versiculos']:
        key = (item['livro'], item['capitulo'], item['versiculo'])
        b_text = blivre_verses.get(key, '')
        arc_v = arc_verses.get(key, '')
        frases = obter_frases_blivre(item, b_text, arc_v)
        
        # Validar rigorosamente que cada trecho existe no texto de BLIVRE
        for f in frases:
            if not f or f not in b_text:
                raise ValueError(f"ERRO: Frase {f!r} não encontrada em {key}: {b_text!r}")
        blivre_alinhado[key] = frases

    print(f"✅ 100% dos 2.035 versículos alinhados com sucesso para o catálogo de BLIVRE!")

    # 2. Injetar em data/pericopes.json
    pericopes_atualizadas = 0
    total_frases_injetadas = 0
    for p in cat:
        lines = p['texto'].split('\n')
        ch = 0
        p_jesus = {}
        for l in lines:
            l = l.strip()
            if l.startswith('Capítulo '):
                ch = int(l.replace('Capítulo ', ''))
            elif l and l[0].isdigit():
                parts = l.split(' ', 1)
                vnum = int(parts[0])
                key = (p['livro'], ch, vnum)
                if key in blivre_alinhado:
                    p_jesus[f"{ch}:{vnum}"] = blivre_alinhado[key]
                    total_frases_injetadas += len(blivre_alinhado[key])

        if p_jesus:
            p['palavras_jesus'] = p_jesus
            pericopes_atualizadas += 1
        elif 'palavras_jesus' in p:
            del p['palavras_jesus']

    print(f"💾 Salvando {PERICOPES_JSON_PATH}...")
    with open(PERICOPES_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {pericopes_atualizadas} perícopes atualizadas com palavras_jesus em pericopes.json ({total_frases_injetadas} frases).")

    # 3. Injetar em data/pericopes-arc.json
    arc_pericopes_atualizadas = 0
    for p in arc_p:
        p_jesus = {}
        for v in p['versiculos']:
            key = (p['livro'], v['capitulo'], v['versiculo'])
            if key in pj_lookup:
                trechos = pj_lookup[key]['trechos']
                v['palavras_jesus'] = trechos
                p_jesus[f"{v['capitulo']}:{v['versiculo']}"] = trechos

        if p_jesus:
            p['palavras_jesus'] = p_jesus
            arc_pericopes_atualizadas += 1
        elif 'palavras_jesus' in p:
            del p['palavras_jesus']

    print(f"💾 Salvando {PERICOPES_ARC_PATH}...")
    with open(PERICOPES_ARC_PATH, 'w', encoding='utf-8') as f:
        json.dump(arc_p, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {arc_pericopes_atualizadas} perícopes atualizadas em pericopes-arc.json.")

if __name__ == '__main__':
    main()
