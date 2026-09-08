/**
 * Divulgação e créditos, fora da tela de leitura.
 *
 * Três obrigações moram aqui, e são de naturezas diferentes:
 *
 * 1. A atribuição da Bíblia Livre é exigência da licença CC BY 3.0 Brasil
 *    (§4b), e indicar a adaptação é o §3b. Estava nos Ajustes e mudou de casa
 *    para cá — **não pode sumir no caminho**, é obrigação de licença.
 *    Ver docs/licencas.md.
 * 2. Dizer que a narração é voz de IA é exigência das políticas de uso da
 *    OpenAI, que pedem "a clear disclosure to end users that the TTS voice
 *    they are hearing is AI-generated and not a human voice". Daí a frase
 *    estar escrita com essas palavras, e não em rodeio.
 * 3. A procedência do material de estudo nenhuma licença exige. Está aqui
 *    porque é comentário sobre a Escritura, e quem lê merece saber quem
 *    escreveu.
 *
 * Por decisão do dono, NENHUMA dessas marcas aparece no tocador nem na tela de
 * leitura: ouvir primeiro, saber depois — o rótulo "voz de IA" no player
 * entrega a conclusão antes de a pessoa ter ouvido qualquer coisa, e esta
 * página pode contar o processo inteiro. A contrapartida é a condição de tudo
 * isso funcionar: **a página tem que ser achável.** Item no menu do Perfil e
 * ponteiro nos Ajustes. Quem mexer aqui mantém os dois caminhos abertos.
 *
 * Sem CSS próprio de propósito: reaproveita as classes dos Ajustes.
 */
export default function Sobre() {
  return (
    <section className="ajustes">
      <h1>Sobre</h1>
      <p className="lead">
        De onde vem cada coisa que você lê e ouve aqui: o texto bíblico, o material de estudo
        e a voz que narra.
      </p>

      <h2>O texto bíblico</h2>
      <p className="muted ajustes-credito">
        Todas as Escrituras em português citadas são da{' '}
        <a href="https://sites.google.com/site/biblialivre/" target="_blank" rel="noreferrer">
          Bíblia Livre (BLIVRE)
        </a>
        , Copyright © Diego Santos, Mario Sérgio e Marco Teles — fevereiro de 2018. Licença{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/br/" target="_blank" rel="noreferrer">
          Creative Commons Atribuição 3.0 Brasil
        </a>
        .
      </p>
      <p className="muted ajustes-credito">
        O texto foi adaptado neste app: a Bíblia Livre marca entre colchetes as palavras que o
        tradutor supriu e o original não traz — as palavras foram mantidas e os colchetes,
        removidos, para a leitura e a narração. Os sobrescritos dos Salmos aparecem como
        epígrafe, acima do texto e fora da numeração dos versículos.
      </p>
      <p className="muted ajustes-credito">
        Alguns defeitos da fonte também foram corrigidos: palavra repetida por engano de
        digitação, parêntese que fecha sem ter aberto, nota de copista colada dentro do
        versículo, frase que a Bíblia Livre omitiu. Nenhuma correção entrou por opinião de
        quem fez o app. Cada uma foi conferida contra duas testemunhas independentes — a King
        James e a Almeida de 1911, que é a ancestral da própria Bíblia Livre. Onde as duas
        concordam contra a Bíblia Livre, é defeito da fonte; onde alguma discorda, o texto
        fica como está. As correções não aparecem marcadas na tela: você lê a história, não o
        aparato crítico.
      </p>

      <h2>O material de estudo</h2>
      <p className="muted ajustes-credito">
        O contexto histórico e literário, a resenha e as palavras que a fecham, as perguntas
        de reflexão e os tópicos para pregar foram <strong>escritos por um modelo de
        linguagem</strong>, não por um comentarista humano. É comentário sobre a Escritura, e
        não Escritura: o texto bíblico acima dele é que é a fonte.
      </p>
      <p className="muted ajustes-credito">
        Nada disso entra no app sem passar por uma verificação automática, que reprova o
        material e manda reescrever. Ela confere se o material fala mesmo <em>deste</em>{' '}
        trecho e não de generalidades, se a resenha não virou passeio versículo a versículo,
        se um campo não repete o outro, e compara com o texto da perícope cada frase que o
        material apresenta entre aspas — citação torta é Escritura inventada, e é a falha mais
        grave que poderia acontecer aqui.
      </p>

      <h2>A narração</h2>
      <p className="muted ajustes-credito">
        <strong>
          A narração é feita por uma voz de inteligência artificial. Não é a gravação de um
          locutor humano.
        </strong>{' '}
        A voz chama-se “ash”, uma das vozes prontas da OpenAI, construídas a partir de
        gravações de atores profissionais.
      </p>
      <p className="muted ajustes-credito">
        O que foi feito com ela, do lado de cá: a escolha da voz saiu de uma comparação de
        timbre e de interpretação, ouvida trecho a trecho, e não da primeira que funcionou; o
        que a voz fala é conferido contra o texto que está na tela, palavra por palavra; cada
        arquivo passa por normalização de volume que só é aceita depois de o resultado ser
        medido, um a um; e o áudio é alinhado ao texto palavra a palavra, que é o que permite
        acompanhar a leitura enquanto se ouve.
      </p>

      <h2>A cobertura da narração</h2>
      <p className="muted ajustes-credito">
        Nem toda perícope tem áudio ainda — a narração vem sendo publicada aos poucos. Onde
        ela existe, o tocador aparece no alto da leitura; onde ainda não existe, ele
        simplesmente não aparece, e o texto continua inteiro. A trilha instrumental que
        acompanha a leitura ainda não foi publicada; quando for, ganha um bloco aqui.
      </p>

      <h2>A cor</h2>
      <p className="muted ajustes-credito">
        O âmbar deste app não é enfeite: ele marca onde a máquina entrou. Os títulos das
        seções, os controles e a barra de progresso são âmbar porque são a voz do app. O
        texto bíblico não é — ele fica em tinta, sem a cor da marca, e é essa ausência que o
        distingue de tudo o mais que você lê aqui.
      </p>
      <p className="muted ajustes-credito">
        A única exceção é passageira: enquanto a narração lê, o âmbar percorre o versículo e
        vai embora atrás dela. É a máquina em ação, não uma marca no texto.
      </p>
    </section>
  )
}
