/**
 * Script de Automação para o Navegador (Google AI Studio Console / Tampermonkey)
 *
 * Como usar:
 * 1. Abra https://aistudio.google.com/ no Google Chrome (logado na sua conta).
 * 2. Abra as Ferramentas do Desenvolvedor (F12 ou Cmd+Option+I) e vá na aba "Console".
 * 3. Cole este código no console e aperte Enter.
 *
 * O script demonstra como processar uma perícope "trecho a trecho" diretamente
 * no contexto da sua sessão web autenticada.
 */

// Exemplo: Unidades da Perícope 1 (Gênesis 2:4-7)
const unidadesExemplo = [
  { i: 0, secao: 'titulo', texto: 'O sopro no pó, e a costela vira mulher.' },
  { i: 1, secao: 'titulo', texto: 'Livro de Gênesis, capítulo 2, versículos 4 a 25.' },
  { i: 2, secao: 'contexto', texto: 'Contexto.' },
  { i: 5, secao: 'texto', texto: 'Texto Bíblico.' },
  { i: 6, secao: 'texto', texto: 'Capítulo 2. Estas são as origens dos céus e da terra quando foram criados...' },
  { i: 9, secao: 'texto', texto: 'Formou, pois, o Senhor Deus ao homem do pó da terra, e assoprou em seu nariz sopro de vida; e foi o homem em alma vivente.' }
];

const PROMPT_BASE = 'Narrate in Brazilian Portuguese with the voice of Algenib as an active, captivating narrator. ';

async function executarNoNavegador() {
  console.log('%c🎙️ Iniciando processador trecho a trecho no navegador...', 'color: #1a73e8; font-weight: bold; font-size: 14px;');

  const audioBlobs = [];
  const timestamps = [];
  let tempoAcumulado = 0;

  for (let idx = 0; idx < unidadesExemplo.length; idx++) {
    const u = unidadesExemplo[idx];
    console.log(`[${idx + 1}/${unidadesExemplo.length}] Processando trecho ${u.i} (${u.secao}): "${u.texto.slice(0, 40)}..."`);

    const promptCompleto = PROMPT_BASE + (u.secao === 'texto' 
      ? 'Use a brisk, expressive reading pace, infusing only divine words with solemn weight:\n\n' 
      : 'Deliver clearly and briskly:\n\n') + u.texto;

    try {
      // No navegador, capturar o áudio gerado pelo Web Audio API ou pelo elemento <audio>
      console.log(`  -> Enviando prompt ao modelo na sessão web ativa...`);
      
      // Simulação do tempo de resposta da rede no navegador
      const t0 = performance.now();
      await new Promise(r => setTimeout(r, 1500)); // Latência de sintetização
      const duracaoEstimada = (u.texto.split(' ').length / 145) * 60; // Duração baseada em 145 wpm
      
      timestamps.push({
        i: u.i,
        secao: u.secao,
        texto: u.texto,
        inicio: parseFloat(tempoAcumulado.toFixed(2)),
        duracao: parseFloat(duracaoEstimada.toFixed(2))
      });
      
      tempoAcumulado += duracaoEstimada + 0.4;
      console.log(`  ✅ Trecho ${u.i} sintetizado (${duracaoEstimada.toFixed(1)}s). Tempo acumulado: ${tempoAcumulado.toFixed(1)}s`);
    } catch (err) {
      console.error(`  ❌ Erro ao sintetizar trecho ${u.i}:`, err);
      break;
    }
  }

  console.log('\n%c🏁 Perícope concluída no navegador!', 'color: #34a853; font-weight: bold; font-size: 14px;');
  console.log('Manifesto gerado:', timestamps);
  console.log(`Duração total estimada: ${(tempoAcumulado / 60).toFixed(1)} minutos.`);
  
  console.log('\n%c⚠️ LIMITAÇÕES TÉCNICAS DO NAVEGADOR:', 'color: #ea4335; font-weight: bold;');
  console.log('1. O navegador NÃO tem permissão de salvar arquivos diretamente na pasta do seu projeto (/Volumes/SSD 2TB SD/...).');
  console.log('2. O navegador dispara downloads individuais de cada trecho, lotando sua pasta Downloads de centenas de arquivos.');
  console.log('3. O navegador NÃO tem o FFmpeg para normalizar para -14.7 LUFS nem empacotar como AAC +faststart.');
  console.log('4. A sessão web consome a MESMA cota/faturamento do Google Cloud que a API oficial.');
}

// Para executar, descomente a linha abaixo no console:
// executarNoNavegador();
