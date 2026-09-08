/**
 * Lógica pura do ditado (POST /api/transcrever): limites, cotas e a montagem
 * do input do Workers AI. O handler em index.ts só orquestra HTTP + D1 + AI.
 */

/** Teto de uma gravação. O cliente para sozinho aqui; o servidor recusa acima. */
export const MAX_SEGUNDOS = 60

/**
 * Teto do corpo (o áudio bruto). 60 s de Opus a ~32 kbps dá ~240 KB; AAC no
 * Safari fica na mesma ordem. 2 MiB é folga de sobra e barra abuso barato.
 */
export const MAX_BYTES = 2 * 1024 * 1024

/** Cota por usuário e por dia (UTC): 10 minutos de fala bastam para anotar. */
export const COTA_USUARIO_SEGUNDOS = 10 * 60

/**
 * Teto global por dia (UTC), somando todos os usuários. O free tier do Workers
 * AI cobre ~215 minutos/dia deste modelo; 180 deixa margem para o arredondamento
 * de cobrança e garante que o ditado NUNCA vira fatura — acima disto a rota
 * responde 503 e volta à meia-noite UTC.
 */
export const TETO_GLOBAL_SEGUNDOS = 180 * 60

export const MODELO = '@cf/openai/whisper-large-v3-turbo'

// Os contêineres que MediaRecorder produz (webm/ogg no Chrome e Firefox, mp4
// no Safari) mais os dois formatos "de arquivo" que qualquer cliente honesto
// mandaria. A comparação ignora os parâmetros (`;codecs=opus`) porque o
// navegador os inclui no `blob.type`.
const TIPOS_ACEITOS = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'])

export function tipoAudioAceito(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  const base = contentType.split(';', 1)[0].trim().toLowerCase()
  return TIPOS_ACEITOS.has(base)
}

/**
 * Duração declarada pelo cliente (header X-Duracao-Segundos). É o que a cota
 * cobra, então precisa ser um inteiro estrito — `1e2`, `2.5` e afins são
 * recusados, não arredondados. Zero não faz sentido para uma gravação.
 */
export function parseDuracao(header: string | null | undefined): number | null {
  if (!header || !/^\d{1,3}$/.test(header)) return null
  const n = Number(header)
  if (n < 1 || n > MAX_SEGUNDOS) return null
  return n
}

export type DecisaoCota = 'ok' | 'usuario' | 'global'

/**
 * Decide se a gravação pedida cabe nas cotas do dia. As duas são inclusivas: o
 * pedido que fecha exatamente o teto ainda passa. Quando as duas estouram, a
 * do usuário prevalece — é a mensagem útil para quem está do outro lado.
 */
export function decidirCota(args: {
  usoUsuario: number
  usoGlobal: number
  duracao: number
}): DecisaoCota {
  if (args.usoUsuario + args.duracao > COTA_USUARIO_SEGUNDOS) return 'usuario'
  if (args.usoGlobal + args.duracao > TETO_GLOBAL_SEGUNDOS) return 'global'
  return 'ok'
}

/**
 * ArrayBuffer (ou view) → base64, em blocos. `String.fromCharCode(...bytes)`
 * de uma vez estoura a pilha em buffers de centenas de KB, e o áudio chega
 * perto disso. Os blocos são múltiplos de 3 bytes para que cada pedaço
 * codificado feche sem padding — assim a concatenação é o base64 do todo.
 */
export function paraBase64(dados: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    dados instanceof ArrayBuffer
      ? new Uint8Array(dados)
      : new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength)
  const BLOCO = 0x8000 * 3
  let binario = ''
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOCO) as unknown as number[])
  }
  return btoa(binario)
}

/**
 * Input do modelo, no formato da doc do whisper-large-v3-turbo: `audio` é o
 * áudio em base64; `language` fixo em português evita a detecção automática
 * cair em espanhol numa frase curta; `task` explícito porque o padrão poderia
 * mudar.
 */
export function montarInput(base64: string): { audio: string; language: 'pt'; task: 'transcribe' } {
  return { audio: base64, language: 'pt', task: 'transcribe' }
}

/** `YYYY-MM-DD` em UTC: a chave do dia na tabela transcricao_uso. */
export function diaUtc(agora: Date): string {
  return agora.toISOString().slice(0, 10)
}

/**
 * Instante em que o dia UTC vira — e com ele a cota do usuário e o teto
 * global. Vai nas respostas 429/503 para o cliente mostrar "volta às HH:mm".
 */
export function proximaMeiaNoiteUtc(agora: Date): string {
  return new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1),
  ).toISOString()
}
