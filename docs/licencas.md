# Licenças das versões bíblicas — o portão do projeto

> Levantado em 2026-09-04, depois de descobrir que a NAA é protegida e que o app
> a distribui sem licença. Este documento existe para que a escolha da próxima
> versão **não repita o erro**. Nada de reprocessamento começa antes de a versão
> escolhida estar aprovada aqui.

## Os três eixos que precisam de resposta

Uma licença que permite redistribuir o *texto* não permite automaticamente
distribuir uma *narração*. São direitos distintos, e este projeto precisa dos três:

1. **Redistribuir o texto** — o app serve o texto bíblico em `public/data/texto/`.
2. **Obra derivada** — recortar em perícopes e escrever material sobre o trecho.
3. **Reprodução sonora e execução pública** — narrar e servir o `.m4a` do R2.

## Veredito por versão

| Versão | Cânon | Licença | Áudio | Veredito |
|---|---|---|---|---|
| **NAA** | completo | © Sociedade Bíblica do Brasil | ❌ | **Fora.** É o motivo desta refundação. |
| **ARC 1995 / 2009** | completo | © SBB (© 2009 SBB na edição de 2009) | ❌ | **Fora — é o mesmo problema da NAA.** A SBB não distribui livremente e cobra taxa por uso do texto. |
| **Almeida 1911** (raiz da "Revista e Corrigida") | completo | Domínio público | ✅ | Livre, mas **ortografia pré-reforma**: "No principio creou Deus os céus e a terra... trevas sobre a face do abysmo". Impróprio para leitura moderna e ruim para TTS. Só serviria com modernização ortográfica nossa — que a licença permite, mas é um projeto à parte. |
| **BLT — Bíblia Livre Para Todos** | ⚠️ **só o Novo Testamento** (27 livros) | CC BY-SA 4.0, © 2022 Free Bible Ministry, Inc. | ✅ com *share-alike* | **Serve, com limite grave de cobertura.** Traduzida da Free Bible Version inglesa. Cobre ~1.047 das 2.823 perícopes. |
| **BLIVRE — Bíblia Livre** | **completo (66 livros)** | **CC BY 3.0 Brasil** (só atribuição) | ✅ **explicitamente** | **Aprovada. É a substituta da ARC.** |
| **TB — Tradução Brasileira** | completo | 1917 em domínio público; **a atualização de 2010 é © SBB** | ⚠️ | **Verificar edição antes de usar.** O JSON que circula tem ortografia moderna, o que sugere a edição de 2010 — ou seja, protegida. Não usar sem confirmar a proveniência. |

## ✅ DECISÃO (2026-09-04): **BLIVRE, versão única**

O app fica com **uma versão só**. Sem seletor de versão, sem shard duplicado, sem
chave R2 por versão — a arquitetura de hoje se preserva inteira. A BLT e qualquer
segunda versão viram backlog. Ver `docs/refundacao-blivre.md`.

## A recomendação: BLIVRE como versão principal

A **Bíblia Livre (BLIVRE)** é a única tradução em português que satisfaz os três
eixos *e* cobre a Bíblia inteira:

- **Licença CC BY 3.0 Brasil** — atribuição apenas, **sem** cláusula *share-alike*.
  É mais permissiva que a da BLT.
- A licença concede **expressamente** o que este projeto precisa:
  - §3(b) criar e reproduzir Obras Derivadas;
  - §3(d) **"Distribuir e Executar Publicamente Obras Derivadas"**;
  - §1(j) "Reproduzir" inclui explicitamente **"gravação sonora"**;
  - §1(i) "Executar Publicamente" inclui servir a obra sob demanda pela internet.
  Ou seja, a narração está coberta sem ambiguidade.
- É uma **modernização da Almeida de 1819** — mantém o registro e o vocabulário da
  tradição Almeida, que era exatamente o que se queria da ARC, em ortografia atual.

Amostras conferidas em 2026-09-04:

> **Salmo 23:1-2** — "O SENHOR é meu pastor, nada me faltará. Ele me faz deitar em
> pastos verdes, e me leva a águas quietas."
>
> **Isaías 53:5** — "Porém ele foi ferido por nossas transgressões, e esmagado por
> nossas perversidades; o castigo que nos traz a paz estava sobre ele, e por suas
> feridas fomos curados."

### Ressalva honesta sobre a BLIVRE

O `status-revisao.md` do projeto mostra que a **revisão editorial** cobre cerca de
15 livros do NT (Mateus, Marcos, Romanos, Gálatas, Efésios, Filipenses, Colossenses,
1Ts, 1Tm, 2Tm, Hebreus, Tiago, 1Pe, 1Jo, 3Jo), com Lucas em andamento, e o último
release é de **2018**. O texto está completo nos 66 livros; o que é parcial é o
passe de revisão. As amostras do AT lidas acima estão boas, mas a barra de
qualidade deste projeto é alta — vale uma leitura por amostragem antes de fechar.

### Crédito obrigatório (colar no rodapé do app)

> Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE),
> Copyright © Diego Santos, Mario Sérgio, e Marco Teles,
> http://sites.google.com/site/biblialivre/ — fevereiro de 2018.
> Licença Creative Commons Atribuição 3.0 Brasil
> (http://creativecommons.org/licenses/by/3.0/br/).

## Sobre a BLT: excelente, mas só o Novo Testamento

Confirmado na fonte (`copr.htm` do pacote oficial do eBible.org e a própria página
da versão): *"The New Testament in Portuguese, translated from the English Free
Bible Version"*. O download traz 27 arquivos, de Mateus a Apocalipse. **Não existe
Antigo Testamento.**

Consequência: a BLT não pode ser *a* versão do app. Pode ser uma **segunda versão
disponível apenas no NT** — o que é defensável (o leitor do NT ganha uma alternativa
em linguagem contemporânea), mas precisa aparecer na UI, senão parece defeito.

Atenção ao *share-alike*: a CC BY-SA 4.0 exige que a obra derivada seja
redistribuída **sob a mesma licença**. Na prática, a narração em áudio do texto da
BLT teria de ser publicada como CC BY-SA 4.0. Para um app gratuito isso não
atrapalha, mas fecha a porta para tornar esse áudio proprietário depois.

## Achado urgente, fora do escopo de licença de versão

`data/pericopes.json` (14 MB, com o campo `texto_naa` de todas as 2.823 perícopes)
**está versionado no repositório público** `jairofilho79/biblia-pericopes`. O
`data/NAA.json` está no `.gitignore` e não aparece no histórico, mas o
`pericopes.json` carrega o mesmo texto e está no histórico do Git. Tirar isso exige
reescrita de histórico, não só um `git rm`. Endereçado na Sessão 1.

## Fontes

- [Biblia Livre Para Todos — eBible.org](https://ebible.org/details.php?id=porblt)
  (declaração de copyright e licença CC BY-SA 4.0; escopo Novo Testamento)
- [Bíblia Livre — LICENCA.md no repositório oficial](https://github.com/blivre/BibliaLivre)
  (texto integral da CC BY 3.0 Brasil; §1(j), §3(b), §3(d))
- [Bíblia Livre — página do projeto](https://blivre.org/)
- [Almeida Revista e Corrigida — SBB](https://www.sbb.org.br/almeida-revista-e-corrigida)
  (titularidade e edições de 1966, 1995, 2009)
- [damarals/biblias](https://github.com/damarals/biblias) — coletânea em JSON;
  marca como domínio público a Tradução Brasileira, a Bíblia Livre e a Almeida 1911
- [Tradução Brasileira — SBB](https://www.sbb.org.br/a-biblia-sagrada/as-traducoes-da-sbb/traducao-brasileira/)
  (relançamento de 2010 com atualização ortográfica)

> Este documento reúne o que as próprias licenças e os detentores declaram. Não é
> parecer jurídico. Para a BLIVRE e a BLT os termos são explícitos e públicos; se
> alguma dúvida sobrar, o caminho é o contato listado em cada projeto.
