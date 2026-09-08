import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Ordem canônica das seções — é ela que decide qual chip fica ativo quando
 * mais de uma seção cruza a faixa de leitura ao mesmo tempo. */
const SECTIONS: { id: string; label: string }[] = [
  { id: 'contexto', label: 'Contexto' },
  { id: 'texto', label: 'Texto' },
  { id: 'resenha', label: 'Resenha' },
  { id: 'reflexao', label: 'Reflexões' },
]

function rolagemSuave(): ScrollBehavior {
  // Guard: matchMedia falta em ambiente sem DOM completo.
  const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return reduzido ? 'auto' : 'smooth'
}

type Props = {
  /** Muda a cada perícope: força re-observar o DOM novo. */
  ordem: number
  /** Avisa a página ANTES de rolar — é assim que o chip Contexto expande a
   * seção colapsada em vez de parar num título mudo. */
  onIr?: (id: string) => void
  /** A seção em leitura MUDOU (nunca dispara pela inicial): é o evento de
   * checkpoint da posição de leitura. DEVE ser referência estável por ordem. */
  onSecaoAtiva?: (id: string) => void
  /** Controle compacto ao lado dos chips (pausa da narração no header). */
  acao?: ReactNode
  /** Filete rente à borda de baixo da barra (progresso da perícope). */
  progresso?: ReactNode
}

export default function SectionChips({ ordem, onIr, onSecaoAtiva, acao, progresso }: Props) {
  const [ativo, setAtivo] = useState<string>(SECTIONS[0].id)
  // Fora do estado: o observer dispara em rajada durante uma rolagem e o
  // callback só interessa quando a seção de fato troca.
  const ativaAnterior = useRef<string>(SECTIONS[0].id)

  // O header é sticky e some ao rolar: os chips precisam saber a altura dele
  // para encostar embaixo sem sobrepor. O CSS zera esse offset quando o header
  // está escondido (`.shell:has(.top-hidden)`).
  // useLayoutEffect (não useEffect): mede e aplica `--top-h` antes do browser
  // pintar o frame, senão os chips desenham um frame no offset errado (0px)
  // até a medição rodar — o flash que este efeito existe para evitar.
  useLayoutEffect(() => {
    const top = document.querySelector<HTMLElement>('.top')
    const raiz = document.documentElement
    if (!top) return
    const aplicar = () => raiz.style.setProperty('--top-h', `${top.offsetHeight}px`)
    aplicar()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', aplicar)
      return () => {
        window.removeEventListener('resize', aplicar)
        raiz.style.removeProperty('--top-h')
      }
    }
    const ro = new ResizeObserver(aplicar)
    ro.observe(top)
    return () => {
      ro.disconnect()
      raiz.style.removeProperty('--top-h')
    }
  }, [])

  // Chip ativo: um único observer sobre as quatro seções.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    // Perícope nova recomeça da primeira seção — sem isto, abrir a próxima
    // perícope já em "contexto" nunca dispararia o primeiro checkpoint dela.
    ativaAnterior.current = SECTIONS[0].id
    const alvos = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (!alvos.length) return
    const visiveis = new Set<string>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visiveis.add(e.target.id)
          else visiveis.delete(e.target.id)
        }
        const primeira = SECTIONS.find((s) => visiveis.has(s.id))
        if (primeira) {
          setAtivo(primeira.id)
          if (primeira.id !== ativaAnterior.current) {
            ativaAnterior.current = primeira.id
            onSecaoAtiva?.(primeira.id)
          }
        }
      },
      // Faixa fina no primeiro terço da viewport: o que está ali é o que o
      // leitor está lendo agora.
      { rootMargin: '-15% 0px -67% 0px', threshold: 0 },
    )
    for (const el of alvos) obs.observe(el)
    return () => obs.disconnect()
  }, [ordem, onSecaoAtiva])

  function irPara(id: string) {
    onIr?.(id)
    const alvo = document.getElementById(id)
    // Expandir o Contexto não move o topo dele — é a primeira seção da página
    // —, então rolar na mesma volta do evento já chega no lugar certo.
    alvo?.scrollIntoView({ behavior: rolagemSuave(), block: 'start' })
    // O foco tem que acompanhar a rolagem: sem isso, quem navega por teclado
    // ou leitor de tela continua lá atrás, e o próximo Tab volta para o começo
    // da página em vez de seguir dentro da seção. `preventScroll` porque a
    // rolagem já foi feita acima, suave — deixar o foco rolar de novo daria um
    // salto seco por cima dela. As seções levam tabindex="-1" para poder
    // receber foco sem entrar na ordem de tabulação.
    alvo?.focus({ preventScroll: true })
  }

  return (
    <nav className="section-chips" aria-label="Seções da perícope">
      {/* A linha é flex: os chips continuam um controle segmentado de largura
          cheia, e a `acao` (quando existe) entra como um botão compacto à
          direita sem quebrar o grid de quatro colunas. */}
      <div className="section-chips-linha">
        {/* Controle segmentado: os quatro chips dividem a largura em partes
            iguais, então nunca há rolagem lateral nem chip cortado — e não há
            mais faixa para trazer o chip ativo "para dentro". */}
        <div className="section-chips-row">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              // `section-chip-texto`: o único rótulo de duas palavras; no
              // celular o CSS deixa só ele quebrar em duas linhas.
              className={`section-chip${s.id === 'texto' ? ' section-chip-texto' : ''}${
                ativo === s.id ? ' active' : ''
              }`}
              aria-current={ativo === s.id ? 'true' : undefined}
              onClick={() => irPara(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {acao}
      </div>
      {progresso}
    </nav>
  )
}
