// Um endereço só para o app: `www` redireciona para a raiz.

/**
 * Devolve o destino do redirecionamento, ou `null` quando o host já é o certo.
 *
 * POR QUE ISTO EXISTE, E NÃO É CAPRICHO DE SEO: o cookie de sessão e o escopo
 * do service worker são presos ao host. Se `www` e a raiz servissem o app, uma
 * pessoa que entrasse por um e voltasse pelo outro apareceria deslogada, com o
 * app instalado duas vezes e o progresso partido entre os dois. E o `APP_URL`
 * — que monta o link do e-mail de acesso — só pode nomear um deles.
 *
 * POR QUE 308 E NÃO 301: o 301 permite ao navegador trocar POST por GET e
 * descartar o corpo. Um formulário de acesso enviado a `www` por um marcador
 * antigo viraria um GET sem o e-mail dentro, e a pessoa veria um erro sem
 * causa visível. O 308 é igualmente permanente e igualmente cacheável, e
 * preserva método e corpo. Buscadores tratam os dois do mesmo jeito.
 *
 * O `www.` é reconhecido por prefixo, sem citar o domínio: assim isto segue
 * valendo em `workers.dev`, em ambiente de teste e num domínio futuro, sem
 * ninguém precisar lembrar de vir aqui atualizar uma constante.
 */
export function destinoCanonico(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!u.hostname.startsWith('www.')) return null
  // `slice` e não `replace`: um host como `www.www-x.com` não pode perder o
  // segundo `www` no meio do caminho.
  u.hostname = u.hostname.slice(4)
  // Host vazio ou sem ponto não é domínio de verdade (`www.` sozinho,
  // `www.localhost`): redirecionar levaria a lugar nenhum.
  if (!u.hostname.includes('.')) return null
  return u.toString()
}
