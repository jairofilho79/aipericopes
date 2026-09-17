/**
 * Módulo de Adaptação de Oralidade e Expressividade (SSML)
 *
 * Transforma o texto bíblico e editorial escrito em "texto de boca" com
 * marcações de prosódia, respiração, ênfases e pausas dramáticas para síntese de voz.
 */

export function escaparXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type SecaoId = 'titulo' | 'contexto' | 'texto' | 'resenha' | 'palavras' | 'reflexoes'

export function aplicarOralidadeTextoBiblico(texto: string): string {
  // 1. Marca ponto e vírgula arcaico como quebra de oração antes do escape XML
  let raw = texto.replace(/;\s*/g, ' __BREAK_400__ ')

  let t = escaparXml(raw)

  // 2. Cabeçalho de abertura da seção
  t = t.replace(/^Texto Bíblico\./i, 'Texto Bíblico. <break time="900ms"/> ')

  // 3. Marcador de Capítulo (ex: "Capítulo 1.", "Capítulo 2.")
  t = t.replace(/\bCapítulo\s+(\d+)\./g, '<break time="900ms"/> Capítulo $1. <break time="600ms"/> ')

  // 4. Decretos divinos ("E disse Deus: Haja luz")
  // Captura até a primeira pontuação ou marcador de quebra
  t = t.replace(/\b(E disse Deus):\s*([^.;:!?_\n]+)/g, (_match, prefix, fala) => {
    return `${prefix}: <break time="500ms"/> &quot;${fala.trim()}&quot;. <break time="700ms"/> `
  })

  // 5. Bênçãos divinas
  t = t.replace(
    /\b(E Deus os abençoou dizendo):\s*([^.;:!?_\n]+)/g,
    (_match, prefix, fala) => {
      return `${prefix}: <break time="500ms"/> &quot;${fala.trim()}&quot;. <break time="700ms"/> `
    },
  )

  // 6. Reconhecimento divino ("E viu Deus que era bom")
  t = t.replace(
    /\b(E viu Deus que era bom)\./g,
    '<break time="400ms"/> $1. <break time="650ms"/> ',
  )
  t = t.replace(
    /\b(E viu Deus tudo o que havia feito,\s*e eis que era bom em grande maneira)\./g,
    '<break time="500ms"/> $1. <break time="800ms"/> ',
  )

  // 7. O refrão da semana da Criação ("E foi a tarde e a manhã, o dia primeiro.")
  t = t.replace(
    /\b(E foi a tarde e a manhã,\s*(?:o dia [^.]+|o [^.]+ dia))\./g,
    '<break time="600ms"/> $1. <break time="900ms"/> ',
  )

  // 8. Restaura marcadores de respiração
  t = t.replace(/__BREAK_400__/g, '<break time="400ms"/>')

  // 9. Dois-pontos gerais restantes (que não façam parte de tags XML)
  t = t.replace(/:\s*(?!<break)/g, ': <break time="400ms"/> ')

  // 10. Limpa quebras duplicadas estritamente adjacentes
  t = t.replace(/<break time="\d+ms"\/>\s*<break time="\d+ms"\/>/g, '<break time="700ms"/>')

  return `<speak>${t.trim()}</speak>`
}

export function aplicarOralidadeContexto(texto: string): string {
  let raw = texto.replace(/;\s*/g, ' __BREAK_350__ ')
  let t = escaparXml(raw)
  t = t.replace(/^Contexto\./i, 'Contexto. <break time="800ms"/> ')
  t = t.replace(/\.\s*\n+/g, '. <break time="600ms"/>\n')
  t = t.replace(/__BREAK_350__/g, '<break time="350ms"/>')
  t = t.replace(/:\s*/g, ': <break time="400ms"/> ')
  return `<speak>${t.trim()}</speak>`
}

export function aplicarOralidadeResenha(texto: string): string {
  let raw = texto.replace(/;\s*/g, ' __BREAK_350__ ')
  let t = escaparXml(raw)
  t = t.replace(/^Resenha\./i, 'Resenha. <break time="800ms"/> ')
  t = t.replace(/\.\s*\n+/g, '. <break time="600ms"/>\n')
  t = t.replace(/__BREAK_350__/g, '<break time="350ms"/>')
  t = t.replace(/:\s*/g, ': <break time="400ms"/> ')
  t = t.replace(/&quot;([^&]+)&quot;/g, '<break time="200ms"/> &quot;$1&quot; <break time="250ms"/>')
  return `<speak>${t.trim()}</speak>`
}

export function aplicarOralidadePalavras(texto: string): string {
  let t = escaparXml(texto)
  t = t.replace(/^Palavras\./i, 'Palavras. <break time="900ms"/> ')
  t = t.replace(/\.\.\s*/g, '. <break time="800ms"/> ')
  t = t.replace(/—\s*/g, ' <break time="350ms"/> ')
  return `<speak>${t.trim()}</speak>`
}

export function aplicarOralidadeReflexoes(texto: string): string {
  let t = escaparXml(texto)
  t = t.replace(/^Reflexões\./i, 'Reflexões. <break time="900ms"/> ')
  t = t.replace(/\b(Pergunta\s+\d+)\./g, '<break time="600ms"/> $1. <break time="400ms"/> ')
  t = t.replace(/\?\s*/g, '? <break time="1000ms"/> ')
  return `<speak>${t.trim()}</speak>`
}

export function aplicarOralidadeTitulo(texto: string): string {
  const t = escaparXml(texto)
  const partes = t.split(/\.\s+(?=[A-ZÁÉÍÓÚ][a-záéíóú]+\b)/)
  if (partes.length >= 2) {
    return `<speak>${partes[0]}. <break time="800ms"/> ${partes.slice(1).join('. ')}</speak>`
  }
  return `<speak>${t}</speak>`
}

export function dividirSsmlEmChunks(ssml: string, maxBytes = 4000): string[] {
  // Se já cabe no limite, devolve direto
  if (Buffer.byteLength(ssml, 'utf8') <= maxBytes) {
    return [ssml]
  }

  // Remove <speak> e </speak> externos para fatiar
  const miolo = ssml.replace(/^<speak>\s*/i, '').replace(/\s*<\/speak>$/i, '').trim()

  // Divide em frases ou quebras de respiração
  const pedacos = miolo.split(/(?<=\.\s+|<break time="[^"]*"\/>\s*)/)
  const chunks: string[] = []
  let atual = ''

  for (const p of pedacos) {
    const candidato = atual ? `${atual} ${p}` : p
    // Reserva margem para a tag <speak>...</speak>
    if (Buffer.byteLength(candidato, 'utf8') + 20 > maxBytes) {
      if (atual) {
        chunks.push(`<speak>${atual.trim()}</speak>`)
      }
      atual = p
    } else {
      atual = candidato
    }
  }

  if (atual.trim()) {
    chunks.push(`<speak>${atual.trim()}</speak>`)
  }

  return chunks
}

export function prepararParaFalaSSML(texto: string, secao: SecaoId): string {
  switch (secao) {
    case 'titulo':
      return aplicarOralidadeTitulo(texto)
    case 'contexto':
      return aplicarOralidadeContexto(texto)
    case 'texto':
      return aplicarOralidadeTextoBiblico(texto)
    case 'resenha':
      return aplicarOralidadeResenha(texto)
    case 'palavras':
      return aplicarOralidadePalavras(texto)
    case 'reflexoes':
      return aplicarOralidadeReflexoes(texto)
  }
}
