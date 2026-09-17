import { Link, useSearchParams } from 'react-router-dom'

import { useHideOnScroll } from '../lib/use-hide-on-scroll'
import { usePopover } from '../lib/use-popover'
import { IconeCompartilhar, IconePessoa, IconeSetaEsquerda } from './icones'
import LeituraPrefs from './LeituraPrefs'

type Props = {
  /** Livro da perícope; null quando não há perícope na tela (carga, erro). */
  livro: string | null
  /** Posição da perícope dentro do livro; null quando não é calculável. */
  posicao: { n: number; m: number } | null
  onCompartilhar: () => void
  /** Nome da jornada quando a leitura ocorre no contexto de uma jornada. */
  jornadaNome?: string | null
}

type AaProps = ReturnType<typeof usePopover>

/**
 * O "Aa" da Leitura: um toque abre a tipografia em popover, sem sair da
 * página. É o mesmo `usePopover()` que servia o PerfilMenu — a infraestrutura
 * mudou de dono, não morreu (foco preso, Escape, clique fora).
 *
 * O estado do popover não mora aqui, e sim no `LeituraTopo`: quem precisa
 * saber que ele está aberto é o auto-ocultar do header.
 */
function LeituraTopoAa({ open, toggle, rootRef, btnRef, popRef }: AaProps) {
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
 * Destino do chevron: quem veio de `/jornada` (`?de=jornada` ou `?jornadaId=...`) volta pra lá;
 * senão, o livro no Explorar (ou o catálogo, sem perícope).
 */
function destinoVoltar(
  livro: string | null,
  de: string | null,
  jornadaId: string | null,
  mock: boolean,
  jornadaNome?: string | null,
) {
  if (de === 'jornada' || Boolean(jornadaId)) {
    const rotulo = jornadaNome ? `Jornada: ${jornadaNome}` : 'Jornada'
    return { to: mock ? '/jornada?mock=1' : '/jornada', rotulo }
  }
  if (livro) {
    return { to: `/explorar?livro=${encodeURIComponent(livro)}`, rotulo: livro }
  }
  return { to: '/explorar', rotulo: 'Explorar' }
}

/**
 * Topo contextual da Leitura: voltar para o livro, posição no livro e as
 * ações de leitura. Substitui o breadcrumb — a linha de referência sob o
 * título já diz onde a pessoa está.
 *
 * A classe `.top` no elemento raiz NÃO é cosmética: `SectionChips` faz
 * `document.querySelector('.top')` para medir a altura e escrever `--top-h`,
 * que é o offset da barra de chips. Trocar a classe desalinha os chips sem
 * um único erro no console.
 */
export default function LeituraTopo({ livro, posicao, onCompartilhar, jornadaNome }: Props) {
  const [searchParams] = useSearchParams()
  const aa = usePopover()
  // Com o "Aa" aberto o header fica travado. `.top-hidden` não é só um
  // translate: leva `visibility: hidden`, e o popover é filho daqui — rolar
  // levaria embora o painel junto com o foco que o `usePopover` acabou de
  // mover para dentro dele.
  const escondido = useHideOnScroll(!aa.open)

  const { to: voltarTo, rotulo: voltarRotulo } = destinoVoltar(
    livro,
    searchParams.get('de'),
    searchParams.get('jornadaId'),
    searchParams.has('mock'),
    jornadaNome,
  )

  return (
    <header className={'top leitura-top' + (escondido ? ' top-hidden' : '')}>
      <Link
        className="leitura-top-voltar"
        to={voltarTo}
        // Um chevron isolado não é confiável em leitor de tela.
        aria-label={`Voltar para ${voltarRotulo}`}
      >
        <IconeSetaEsquerda size={15} />
        <span>{voltarRotulo}</span>
      </Link>

      {/* Montado mesmo sem posição: o grid é `1fr auto 1fr` e um centro
          ausente puxaria a zona da direita para a coluna do meio. Sem
          posição fica vazio de propósito — "1 de 1" seria invenção. */}
      <span className="leitura-top-pos">{posicao && `${posicao.n} de ${posicao.m}`}</span>

      {/* As ações são UMA zona do grid: soltas, a segunda cairia na linha
          de baixo. Ordem: Aa → compartilhar → Perfil. */}
      <div className="leitura-top-acoes">
        <LeituraTopoAa {...aa} />
        <button
          type="button"
          className="leitura-top-compartilhar"
          aria-label="Compartilhar perícope"
          onClick={onCompartilhar}
        >
          <IconeCompartilhar />
        </button>
        <Link className="leitura-top-perfil" to="/perfil" aria-label="Perfil">
          <IconePessoa />
        </Link>
      </div>
    </header>
  )
}
