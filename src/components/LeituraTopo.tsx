import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import {
  idxDoHistorico,
  jornadaDoContexto,
  origemDaReferencia,
  passosAteOrigem,
  urlDaOrigem,
} from '../lib/contexto-leitura'

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
  /** Rótulo da perícope de onde veio, quando chegou por uma referência cruzada ("Gênesis 1:1"). */
  origemRotulo?: string | null
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
export default function LeituraTopo({ livro, posicao, onCompartilhar, jornadaNome, origemRotulo }: Props) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const aa = usePopover()
  const destinos = usePopover()
  // Com o "Aa" aberto o header fica travado. `.top-hidden` não é só um
  // translate: leva `visibility: hidden`, e o popover é filho daqui — rolar
  // levaria embora o painel junto com o foco que o `usePopover` acabou de
  // mover para dentro dele.
  const escondido = useHideOnScroll(!aa.open && !destinos.open)

  const { to: voltarTo, rotulo: voltarRotulo } = destinoVoltar(
    livro,
    searchParams.get('de'),
    jornadaDoContexto(searchParams),
    searchParams.has('mock'),
    jornadaNome,
  )

  const origem = origemDaReferencia(searchParams)
  const rotuloOrigem = origemRotulo ?? 'perícope de origem'

  /**
   * Volta à perícope de origem. Quando a entrada de histórico dela ainda está
   * atrás, desfaz a pilha (`navigate(-n)`) — é a MESMA volta do botão/gesto do
   * sistema, sem empilhar a origem de novo. Sem isso (refresh, link aberto de
   * fora), vai pela URL, já focando o versículo de onde saiu.
   */
  function voltarParaOrigem() {
    if (!origem) return
    const passos = passosAteOrigem(location.state, idxDoHistorico())
    if (passos !== null) navigate(passos)
    else navigate(urlDaOrigem(origem))
  }

  return (
    <header className={'top leitura-top' + (escondido ? ' top-hidden' : '')}>
      {origem ? (
        // Veio por uma referência: o toque principal volta à origem, e o menu
        // ao lado guarda o destino de sempre (jornada, ou o livro).
        <span className="leitura-top-voltar-grupo" ref={destinos.rootRef}>
          <button
            type="button"
            className="leitura-top-voltar"
            onClick={voltarParaOrigem}
            aria-label={`Voltar para ${rotuloOrigem}`}
          >
            <IconeSetaEsquerda size={15} />
            <span>{rotuloOrigem}</span>
          </button>
          <button
            ref={destinos.btnRef}
            type="button"
            className="leitura-top-voltar-mais"
            aria-haspopup="menu"
            aria-expanded={destinos.open}
            aria-label="Outros destinos para voltar"
            onClick={destinos.toggle}
          >
            ▾
          </button>
          {destinos.open && (
            <div className="readmenu-pop pop-voltar" ref={destinos.popRef} role="menu" aria-label="Voltar para">
              <button
                type="button"
                role="menuitem"
                className="pop-voltar-item"
                onClick={() => {
                  destinos.close()
                  voltarParaOrigem()
                }}
              >
                <IconeSetaEsquerda size={15} />
                <span>{rotuloOrigem}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="pop-voltar-item"
                onClick={() => {
                  destinos.close()
                  navigate(voltarTo)
                }}
              >
                <IconeSetaEsquerda size={15} />
                <span>{voltarRotulo}</span>
              </button>
            </div>
          )}
        </span>
      ) : (
        <Link
          className="leitura-top-voltar"
          to={voltarTo}
          // Um chevron isolado não é confiável em leitor de tela.
          aria-label={`Voltar para ${voltarRotulo}`}
        >
          <IconeSetaEsquerda size={15} />
          <span>{voltarRotulo}</span>
        </Link>
      )}

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
