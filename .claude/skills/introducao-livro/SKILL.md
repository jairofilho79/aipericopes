---
name: introducao-livro
description: Redige a introdução histórica, teológica e canônica oficial de cada um dos 66 livros da Bíblia com profundidade exegética e cadência para narração em áudio (TTS Algenib / voz humana), sem plágio das edições da SBB.
---

# Redação da Introdução dos Livros Bíblicos (Perícope de Abertura)

Esta habilidade orienta a produção textual da introdução oficial para cada um dos 66 livros canônicos da Bíblia. Esse texto funciona como o portal de entrada do livro ("perícope 0"), antecedendo o capítulo 1, e é projetado especificamente para ser **ouvido (narração em áudio/TTS)** e lido na aplicação oficial com a Bíblia Livre (BLIVRE).

---

## 1. Os Quatro Pilares Obrigatórios

Cada introdução de livro deve conter impreterivelmente quatro seções conceituais bem definidas, redigidas em prosa contínua:

### Pilar 1: O Título Canônico e a Etimologia
- **Nome nas línguas originais**: Para o Antigo Testamento, cite o nome tradicional em hebraico (e aramaico quando cabível), explicando seu significado literal (ex.: *Bereshit* = "No princípio", *Shemot* = "Nomes", *Vayikra* = "E chamou").
- **Nome na Septuaginta (LXX) e Vulgata**: Explique a etimologia grega/latina que gerou o nome em português (ex.: *Gênesis* = "origem/nascimento", *Êxodo* = "saída/partida").
- **Importância do nome**: Conecte o significado etimológico ao papel que o livro desempenha no cânon das Escrituras.

### Pilar 2: Autoria, Contexto Histórico e Propósito Teológico
- **Autoria e Tradição Canônica**: Apresente a autoria tradicionalmente atribuída e respaldada pelo testemunho interno bíblico (ex.: Moisés no Pentateuco, Lucas nos Atos, Paulo nas epístolas paulinas), mencionando o cenário em que foi composto.
- **Público e Desafio Original**: A quem o livro se dirigia originalmente e qual crise espiritual, moral, teológica ou histórica estava em foco.
- **Propósito Teológico e Redentivo**: Por que o Espírito Santo inspirou esse livro? Qual verdade sobre o caráter de Deus, a redenção e a aliança é revelada?

### Pilar 3: Estrutura Literária e Grandes Movimentos
- **Ato a Ato**: Divida o livro em 2 a 4 grandes blocos ou movimentos literários claros, mencionando a abrangência dos capítulos (ex.: capítulos 1 a 11 e capítulos 12 a 50 em Gênesis).
- **Prosa fluida**: NUNCA utilize listas telegráficas com traços ou letras soltas. Transforme a divisão em um panorama narrativo envolvente que mostre a evolução do enredo e dos argumentos.

### Pilar 4: Mensagem Central e Abertura
- **Síntese Teológica / Cristocêntrica**: Conecte a mensagem principal do livro ao plano geral da redenção e à esperança messiânica.
- **Convite à Escuta/Leitura**: Uma frase final marcante e inspiradora que prepara o coração do leitor e ouvinte para ingressar no capítulo 1.

---

## 2. Regras de Estilo e Oralidade (Projetado para Áudio / TTS)

O texto será narrado pela voz **Algenib (Gemini 3.8 Flash TTS)** e exibido com realce palavra por palavra na interface:

1. **Pontuação e Ritmo**:
   - Utilize períodos equilibrados. Evite frases excessivamente longas (mais de 30 palavras sem vírgula ou pausa).
   - Use travessões, vírgulas e dois-pontos para criar pontos naturais de respiração e inflexão para a voz sintética.
2. **Vocabulário Vivo e Acolhedor**:
   - Nem piegas nem acadêmico-frio. O tom deve ser de um narrador maduro, seguro, cativado e reverente diante do texto sagrado.
   - Evite jargões teológicos herméticos sem explicação simples integrada.
3. **Números e Citações no Áudio**:
   - Ao citar capítulos na prosa (ex.: "do capítulo doze ao cinquenta"), use algarismos arábicos ("do capítulo 12 ao 50") no texto escrito, pois o motor de fala e o pipeline do projeto já lidam com a normalização para leitura contínua.
4. **Sem Metadados Visíveis**:
   - NÃO inclua bibliografia, rodapés ou referências de fontes no texto final. O usuário final deve ter uma experiência limpa, imersiva e devocional.

---

## 3. Diretriz Antipirataria e Não-Plágio (SBB / ARC)

A Sociedade Bíblica do Brasil (SBB) possui notas introdutórias em edições como a ARC (`<p class="ip">`). 
- **É expressamente PROIBIDO copiar ou parafrasear superficialmente** o texto da SBB.
- O material de introdução da SBB serve apenas como lembrete dos fatos históricos básicos que a tradição cristã compartilha universalmente.
- O seu texto deve ser **completamente autoral**, muito mais rico exegética e literariamente, trazendo detalhes originais (como os termos em hebraico/grego, a perspectiva pactual e a beleza narrativa) que não estão presentes no texto sucinto da SBB.

---

## 4. Estrutura de Dados Padronizada

Cada introdução de livro deve ser modelada de acordo com o seguinte contrato:

```json
{
  "livro": "Gênesis",
  "slug": "genesis",
  "abbrev": "Gn",
  "testamento": "antigo",
  "titulo_canonico": "O Primeiro Livro de Moisés chamado Gênesis",
  "titulo_introducao": "Introdução ao Livro de Gênesis",
  "secoes": [
    {
      "id": "etimologia",
      "subtitulo": "O Portal das Escrituras e o Nome do Livro",
      "texto": "..."
    },
    {
      "id": "contexto",
      "subtitulo": "Autoria e Propósito Teológico",
      "texto": "..."
    },
    {
      "id": "estrutura",
      "subtitulo": "Estrutura e Grandes Blocos Históricos",
      "texto": "..."
    },
    {
      "id": "mensagem",
      "subtitulo": "Mensagem Central",
      "texto": "..."
    }
  ],
  "texto_completo": "..."
}
```
