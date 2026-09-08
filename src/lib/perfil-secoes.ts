/**
 * A tipografia só aparece onde há prosa de leitura na tela: ajustar entrelinha
 * no Índice não mostraria efeito nenhum. Puro, para ser testável.
 */
export function mostrarPrefsDeLeitura(pathname: string): boolean {
  return pathname.startsWith('/leitura/')
}
