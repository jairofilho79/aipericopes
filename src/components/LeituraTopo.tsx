import { Link } from 'react-router-dom'

import { useHideOnScroll } from '../lib/use-hide-on-scroll'
import { usePopover } from '../lib/use-popover'
import { IconePessoa } from './icones-nav'
import LeituraPrefs from './LeituraPrefs'

type Props = {
  livro: string
  /** Posição da perícope dentro do livro; null quando não é calculável. */
  posicao: { n: number; m: number } | null
}

/**
 * O "Aa" da Leitura: um toque abre a tipografia em popover, sem sair da
 * página. É o mesmo `usePopover()` que servia o PerfilMenu — a infraestrutura
 * mudou de dono, não morreu (foco preso, Escape, clique fora).
 */
function LeituraTopoAa() {
  const { open, toggle, rootRef, btnRef, popRef } = usePopover()

  return (
    <span className="leitura-top-aa-wrap" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="leitura-top-aa"
        aria-expanded={open}
        aria-haspopup="dialog"
        // "Aa" soletrado por leitor de tela não diz nada.
        aria-label="Preferências de leitura"
        onClick={toggle}
      >
        Aa
      </button>
      {open && (
        <div
          className="readmenu-pop pop-tipografia"
          ref={popRef}
          role="dialog"
          aria-modal="true"
          aria-label="Preferências de leitura"
        >
          <LeituraPrefs />
        </div>
      )}
    </span>
  )
}

/**
 * Topo contextual da Leitura: voltar para o livro, posição no livro e as duas
 * ações de leitura. Substitui o breadcrumb — a linha de referência sob o
 * título já diz onde a pessoa está.
 *
 * A classe `.top` no elemento raiz NÃO é cosmética: `SectionChips` faz
 * `document.querySelector('.top')` para medir a altura e escrever `--top-h`,
 * que é o offset da barra de chips. Trocar a classe desalinha os chips sem
 * um único erro no console.
 */
export default function LeituraTopo({ livro, posicao }: Props) {
  // Sempre habilitado: este componente só monta dentro da Leitura.
  const escondido = useHideOnScroll(true)

  return (
    <header className={'top leitura-top' + (escondido ? ' top-hidden' : '')}>
      <Link
        className="leitura-top-voltar"
        to={`/explorar?livro=${encodeURIComponent(livro)}`}
        // Um chevron isolado não é confiável em leitor de tela.
        aria-label={`Voltar para ${livro}`}
      >
        <span aria-hidden>‹</span> {livro}
      </Link>

      {/* Montado mesmo sem posição: o grid é `1fr auto 1fr` e um centro
          ausente puxaria a zona da direita para a coluna do meio. Sem
          posição fica vazio de propósito — "1 de 1" seria invenção. */}
      <span className="leitura-top-pos">{posicao && `${posicao.n} de ${posicao.m}`}</span>

      {/* As duas ações são UMA zona do grid, não duas: soltas, a segunda
          cairia na linha de baixo. */}
      <div className="leitura-top-acoes">
        <LeituraTopoAa />
        <Link className="leitura-top-perfil" to="/perfil" aria-label="Perfil">
          <IconePessoa />
        </Link>
      </div>
    </header>
  )
}
