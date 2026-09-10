// Os quatro ícones de traço da barra de abas — Hoje, Explorar, Jornada, Perfil.
// A cor nunca é declarada aqui: vem do currentColor do botão que os contém,
// então a troca para --accent na aba ativa não precisa de CSS por ícone.

const svg = {
  viewBox: '0 0 24 24',
  width: 21,
  height: 21,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
} as const

export function IconeCasa() {
  return (
    <svg {...svg}>
      <path d="M3.7 10.9 12 3.9l8.3 7" />
      <path d="M5.9 9.05v11.55h12.2V9.05" />
      <path d="M9.7 20.6v-4.6h4.6v4.6" />
    </svg>
  )
}

export function IconeBussola() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M15.7 8.3 14.26 14.26 8.3 15.7 9.74 9.74Z" />
    </svg>
  )
}

export function IconeTrilha() {
  return (
    <svg {...svg}>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <path d="M8.4 18h8a3.4 3.4 0 0 0 0-6.8H7.6a2.6 2.6 0 0 1 0-5.2h8" />
    </svg>
  )
}

export function IconePessoa() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="7.6" r="3.6" />
      <path d="M19.4 20.4v-1.4a4.4 4.4 0 0 0-4.4-4.4H9a4.4 4.4 0 0 0-4.4 4.4v1.4" />
    </svg>
  )
}

export function IconeCompartilhar() {
  return (
    <svg {...svg}>
      <path d="M4 12v7.4a1.6 1.6 0 0 0 1.6 1.6h12.8a1.6 1.6 0 0 0 1.6-1.6V12" />
      <path d="M12 3.5v11.5" />
      <path d="M7.5 8 12 3.5 16.5 8" />
    </svg>
  )
}
