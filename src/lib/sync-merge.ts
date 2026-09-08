export function remoteWinsLocal(
  remoteAtualizadoEm: string,
  localAtualizadoEm: string | undefined,
): boolean {
  if (!localAtualizadoEm) return true
  return remoteAtualizadoEm > localAtualizadoEm
}
