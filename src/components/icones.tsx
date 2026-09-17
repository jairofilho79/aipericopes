// Sistema de ícones vetoriais SVG para o aiPericopes.
// Traço fino (strokeWidth: 1.75 - 1.85), cantos arredondados, viewBox 24x24.
// Cores sempre herdadas de `currentColor` para respeitar temas Claro e Escuro sem CSS extra.

export type IconeProps = {
  size?: number
  className?: string
}

const baseSvg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true' as const,
  focusable: 'false' as const,
}

// ── Navegação Principal (Abas) ──────────────────────────────────────────

export function IconeCasa({ size = 21, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M3.7 10.9 12 3.9l8.3 7" />
      <path d="M5.9 9.05v11.55h12.2V9.05" />
      <path d="M9.7 20.6v-4.6h4.6v4.6" />
    </svg>
  )
}

export function IconeBussola({ size = 21, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M15.7 8.3 14.26 14.26 8.3 15.7 9.74 9.74Z" />
    </svg>
  )
}

export function IconeTrilha({ size = 21, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <path d="M8.4 18h8a3.4 3.4 0 0 0 0-6.8H7.6a2.6 2.6 0 0 1 0-5.2h8" />
    </svg>
  )
}

export function IconePessoa({ size = 21, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <circle cx="12" cy="7.6" r="3.6" />
      <path d="M19.4 20.4v-1.4a4.4 4.4 0 0 0-4.4-4.4H9a4.4 4.4 0 0 0-4.4 4.4v1.4" />
    </svg>
  )
}

export function IconeCompartilhar({ size = 19, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M4 12v7.4a1.6 1.6 0 0 0 1.6 1.6h12.8a1.6 1.6 0 0 0 1.6-1.6V12" />
      <path d="M12 3.5v11.5" />
      <path d="M7.5 8 12 3.5 16.5 8" />
    </svg>
  )
}

// ── Ações de Leitura & Mídia ─────────────────────────────────────────────

export function IconeLivroAberto({ size = 19, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

export function IconeFones({ size = 18, className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M182.248,341.784c-3.692-24.802-26.77-41.91-51.562-38.228c-24.793,3.652-41.93,26.75-38.25,51.553l2.533,17.066c-9.875,2.3-16.532,11.751-15.019,21.959l7.594,51.229c1.513,10.198,10.621,17.309,20.738,16.653l1.674,11.247c3.672,24.803,26.74,41.92,51.552,38.239c24.793-3.672,41.911-26.74,38.249-51.552L182.248,341.784z" />
      <path d="M417.033,372.175l2.532-17.066c3.682-24.803-13.455-47.901-38.248-51.553c-24.793-3.681-47.872,13.426-51.563,38.228l-17.51,118.165c-3.662,24.812,13.455,47.88,38.248,51.552c24.814,3.681,47.882-13.436,51.552-38.239l1.674-11.247c10.117,0.656,19.226-6.456,20.739-16.653l7.594-51.229C433.565,383.926,426.908,374.475,417.033,372.175z" />
      <path d="M436.702,75.529C391.927,27.769,328.281-0.091,256,0C183.72-0.091,120.073,27.769,75.3,75.529c-44.856,47.7-70.728,114.735-70.688,191.595c0,8.604,0.323,17.339,0.978,26.185c5.246,71.302,17.914,127.968,23.239,151.874l40.326-8.978c-5.245-23.542-17.328-77.747-22.372-145.943c-0.574-7.846-0.857-15.563-0.857-23.138c0.04-67.721,22.493-123.914,59.481-163.302C142.485,64.484,194.19,41.406,256,41.315c61.801,0.091,113.514,23.17,150.593,62.507c36.987,39.387,59.44,95.58,59.48,163.302c0,7.575-0.282,15.292-0.857,23.148c-5.042,68.186-17.127,122.391-22.372,145.933l40.326,8.978c5.326-23.906,17.995-80.572,23.24-151.874c0.656-8.857,0.978-17.582,0.978-26.185C507.429,190.263,481.557,123.228,436.702,75.529z" />
    </svg>
  )
}

export function IconeCheck({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} strokeWidth={2.2} width={size} height={size} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconeEstrela({
  size = 18,
  preenchida = false,
  className,
}: IconeProps & { preenchida?: boolean }) {
  return (
    <svg
      {...baseSvg}
      width={size}
      height={size}
      fill={preenchida ? 'currentColor' : 'none'}
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// ── Ações de Versículo e Estudo ─────────────────────────────────────────

export function IconeCopiar({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function IconeAnotar({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export function IconeTopicos({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

export function IconeConversar({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function IconeDesvincular({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="m18.84 12.25 1.72-1.71a4.86 4.86 0 0 0-6.87-6.87l-1.71 1.71" />
      <path d="m5.16 11.75-1.72 1.72a4.86 4.86 0 0 0 6.87 6.87l1.72-1.72" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export function IconeLapis({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

export function IconeLixeira({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

// ── Gestão de Jornada & Catálogo ────────────────────────────────────────

export function IconeReiniciar({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

export function IconeBandeira({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

export function IconeOlho({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconeMais({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} strokeWidth={2.2} width={size} height={size} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconeTrocar({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="14" x2="21" y2="3" />
      <polyline points="8 21 3 21 3 16" />
      <line x1="20" y1="10" x2="3" y2="21" />
    </svg>
  )
}

// ── Navegação & Direção ──────────────────────────────────────────────────

export function IconeSetaEsquerda({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} strokeWidth={2} width={size} height={size} className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export function IconeSetaDireita({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} strokeWidth={2} width={size} height={size} className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export function IconeFechar({ size = 16, className }: IconeProps) {
  return (
    <svg {...baseSvg} strokeWidth={2} width={size} height={size} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Perfil, Sistema e Conta ─────────────────────────────────────────────

export function IconeEngrenagem({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconeInfo({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function IconeSair({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconeEntrar({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}

export function IconeEmail({ size = 18, className }: IconeProps) {
  return (
    <svg {...baseSvg} width={size} height={size} className={className}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}
