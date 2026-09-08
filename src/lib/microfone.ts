/**
 * Permissão do microfone para o ditado nativo. A Web Speech API no iOS não
 * sobe diálogo nenhum quando o Safari está sem acesso ao microfone: devolve
 * `not-allowed` ("microphone permission check has failed") e pronto. Então,
 * antes de começar a ouvir, olhamos o estado da permissão e, quando o
 * navegador ainda não perguntou, pedimos nós mesmos via getUserMedia — que
 * sobe o prompt de verdade — e soltamos o microfone em seguida. Quando está
 * negado, o que resta é dizer onde liberar.
 */

export type EstadoMicrofone = 'granted' | 'denied' | 'prompt' | 'desconhecido'

/** Estado da permissão pela Permissions API; `desconhecido` onde ela falta. */
export async function estadoMicrofone(): Promise<EstadoMicrofone> {
  try {
    const s = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return s.state
  } catch {
    return 'desconhecido'
  }
}

/**
 * Sobe o prompt do microfone (getUserMedia) e solta o stream na hora — só
 * queremos a permissão, quem grava é o reconhecedor. false se a pessoa
 * negou ou o navegador nem perguntou porque já estava bloqueado.
 */
export async function pedirMicrofone(): Promise<boolean> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true })
    s.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

/**
 * Onde liberar. No iPhone o bloqueio típico é o do sistema (o Safari inteiro
 * sem microfone), que fica em Privacidade — não nos ajustes do site.
 */
export function mensagemMicrofoneBloqueado(ua: string = navigator.userAgent): string {
  return /iPhone|iPad|iPod/.test(ua)
    ? 'Microfone bloqueado. Libere em Ajustes ▸ Privacidade ▸ Microfone ▸ Safari'
    : 'Microfone bloqueado. Libere nos ajustes do navegador'
}
