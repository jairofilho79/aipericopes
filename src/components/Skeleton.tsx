/**
 * Silhuetas cinza com shimmer enquanto o conteúdo não chega. A primeira visita
 * baixa ~13 MiB de `pericopes.json`: é este esqueleto que o leitor vê nesse
 * intervalo (nas visitas seguintes o cache torna a troca instantânea).
 *
 * O shimmer é pura decoração — quem usa leitor de tela recebe o `role="status"`
 * com um texto visualmente oculto (`aria-label` sozinho não é anunciado por
 * todo leitor de tela) — e o CSS desliga a animação sob `prefers-reduced-motion`.
 */

function Linhas({ n, curta = false }: { n: number; curta?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="skeleton skeleton-line"
          style={curta && i === n - 1 ? { width: '62%' } : undefined}
        />
      ))}
    </>
  )
}

export function SkeletonLeitura() {
  return (
    <article className="leitura skeleton-page" role="status">
      <span className="sr-only">Carregando perícope…</span>
      <span className="skeleton skeleton-crumb" />
      <span className="skeleton skeleton-title" />
      <span className="skeleton skeleton-ref" />
      <div className="skeleton-block">
        <Linhas n={2} curta />
      </div>
      <div className="skeleton-block">
        <Linhas n={2} curta />
      </div>
      <div className="skeleton-block">
        <Linhas n={6} curta />
      </div>
    </article>
  )
}

export function SkeletonHome() {
  return (
    <section className="home skeleton-page" role="status">
      <span className="sr-only">Carregando leituras de hoje…</span>
      <span className="skeleton skeleton-title" />
      <div className="track-grid">
        {[0, 1].map((i) => (
          <article key={i} className="track-card">
            <Linhas n={3} curta />
            <span className="skeleton skeleton-cta" />
          </article>
        ))}
      </div>
    </section>
  )
}

export function SkeletonIndice() {
  return (
    <div className="skeleton-page" role="status">
      <span className="sr-only">Carregando índice…</span>
      {[0, 1, 2].map((g) => (
        <div key={g} className="skeleton-block">
          <span className="skeleton skeleton-subtitle" />
          <Linhas n={4} />
        </div>
      ))}
    </div>
  )
}
