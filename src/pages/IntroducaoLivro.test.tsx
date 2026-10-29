// @vitest-environment happy-dom
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IntroducaoLivro from './IntroducaoLivro'
import * as introducoesLib from '../lib/introducoes'

const MOCK_INTRO: introducoesLib.IntroducaoLivroData = {
  livro: 'Gênesis',
  slug: 'genesis',
  abbrev: 'Gn',
  testamento: 'vt',
  titulo_canonico: 'O Primeiro Livro de Moisés chamado Gênesis',
  titulo_introducao: 'Introdução ao Livro de Gênesis',
  secoes: [
    {
      id: 'etimologia',
      subtitulo: 'O Portal das Escrituras e o Nome do Livro',
      texto: 'Na tradição hebraica, este livro é chamado de Bereshit...',
    },
    {
      id: 'contexto',
      subtitulo: 'Autoria e Propósito Teológico',
      texto: 'Tradicionalmente atribuído a Moisés como o primeiro tomo do Pentateuco...',
    },
    {
      id: 'estrutura',
      subtitulo: 'Estrutura e Grandes Blocos Históricos',
      texto: 'O livro se desenvolve em dois grandes atos literários...',
    },
    {
      id: 'mensagem',
      subtitulo: 'Mensagem Central',
      texto: 'Em cada página de Gênesis, aprendemos a soberania de Deus...',
    },
  ],
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.restoreAllMocks()
})

function montar(slug = 'genesis') {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/introducao/${slug}`]}>
        <Routes>
          <Route path="/introducao/:slug" element={<IntroducaoLivro />} />
          <Route path="/explorar" element={<div>Explorar</div>} />
          <Route path="/leitura/:ordem" element={<div>Leitura</div>} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

describe('IntroducaoLivro', () => {
  it('exibe título canônico, subtítulo e os 4 blocos da introdução', async () => {
    vi.spyOn(introducoesLib, 'carregarIntroducao').mockResolvedValue(MOCK_INTRO)
    vi.spyOn(introducoesLib, 'obterPrimeiraPericopeDoLivro').mockResolvedValue({
      ordem: 1,
      seq: 0,
      livro: 'Gênesis',
      abbrev: 'Gn',
      capitulo_inicio: 1,
      versiculo_inicio: 1,
      capitulo_fim: 2,
      versiculo_fim: 3,
      titulo_pericope_pt: 'A criação',
      minutos: 5,
      narrado: false,
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers(),
    } as Response)

    montar('genesis')

    // Aguarda resolução da promessa
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    // Título canônico
    const h1 = container.querySelector('.introducao-titulo-canonico')
    expect(h1?.textContent).toBe('O Primeiro Livro de Moisés chamado Gênesis')

    // Título introdução
    const sub = container.querySelector('.introducao-subtitulo-obra')
    expect(sub?.textContent).toBe('Introdução ao Livro de Gênesis')

    // Os 4 pilares/blocos
    const blocos = container.querySelectorAll('.introducao-bloco')
    expect(blocos).toHaveLength(4)

    expect(blocos[0].textContent).toContain('Pilar 1')
    expect(blocos[0].textContent).toContain('O Portal das Escrituras e o Nome do Livro')
    expect(blocos[0].textContent).toContain('Na tradição hebraica')

    expect(blocos[1].textContent).toContain('Pilar 2')
    expect(blocos[1].textContent).toContain('Autoria e Propósito Teológico')

    expect(blocos[2].textContent).toContain('Pilar 3')
    expect(blocos[2].textContent).toContain('Estrutura e Grandes Blocos Históricos')

    expect(blocos[3].textContent).toContain('Pilar 4')
    expect(blocos[3].textContent).toContain('Mensagem Central')
  })

  it('exibe botões CTA no topo e no final apontando para a primeira perícope (/leitura/1)', async () => {
    vi.spyOn(introducoesLib, 'carregarIntroducao').mockResolvedValue(MOCK_INTRO)
    vi.spyOn(introducoesLib, 'obterPrimeiraPericopeDoLivro').mockResolvedValue({
      ordem: 1,
      seq: 0,
      livro: 'Gênesis',
      abbrev: 'Gn',
      capitulo_inicio: 1,
      versiculo_inicio: 1,
      capitulo_fim: 2,
      versiculo_fim: 3,
      titulo_pericope_pt: 'A criação',
      minutos: 5,
      narrado: false,
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers(),
    } as Response)

    montar('genesis')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    const ctaTopo = container.querySelector('.introducao-cta-topo')
    expect(ctaTopo?.getAttribute('href')).toBe('/leitura/1')
    expect(ctaTopo?.textContent).toContain('Iniciar Leitura (Capítulo 1)')

    const ctaGrande = container.querySelector('.introducao-cta-grande')
    expect(ctaGrande?.getAttribute('href')).toBe('/leitura/1')
    expect(ctaGrande?.textContent).toContain('Iniciar Leitura (Capítulo 1)')
  })

  it('exibe botão de voltar para o Explorar com o livro correspondente', async () => {
    vi.spyOn(introducoesLib, 'carregarIntroducao').mockResolvedValue(MOCK_INTRO)
    vi.spyOn(introducoesLib, 'obterPrimeiraPericopeDoLivro').mockResolvedValue(null)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      headers: new Headers(),
    } as Response)

    montar('genesis')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    const botaoVoltar = container.querySelector('a.botao-voltar')
    expect(botaoVoltar?.getAttribute('href')).toBe('/explorar?livro=G%C3%AAnesis')

    const voltarRodape = container.querySelector('.introducao-rodape-voltar a')
    expect(voltarRodape?.getAttribute('href')).toBe('/explorar?livro=G%C3%AAnesis')
  })

  it('exibe player com controles quando áudio está disponível', async () => {
    vi.spyOn(introducoesLib, 'carregarIntroducao').mockResolvedValue(MOCK_INTRO)
    vi.spyOn(introducoesLib, 'obterPrimeiraPericopeDoLivro').mockResolvedValue(null)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers(),
    } as Response)

    montar('genesis')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    const playerCard = container.querySelector('.introducao-player-card')
    expect(playerCard).not.toBeNull()

    const playBtn = container.querySelector('.narracao-doca-play')
    expect(playBtn).not.toBeNull()

    const barra = container.querySelector('.introducao-player-barra')
    expect(barra).not.toBeNull()
  })

  it('exibe mensagem apropriada quando áudio não está disponível', async () => {
    vi.spyOn(introducoesLib, 'carregarIntroducao').mockResolvedValue(MOCK_INTRO)
    vi.spyOn(introducoesLib, 'obterPrimeiraPericopeDoLivro').mockResolvedValue(null)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      headers: new Headers(),
    } as Response)

    montar('genesis')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    const semAudio = container.querySelector('.introducao-sem-audio')
    expect(semAudio).not.toBeNull()
    expect(semAudio?.textContent).toContain('Narração em áudio desta introdução em breve')
  })

  it('exibe tela de erro amigável se a introdução não for encontrada', async () => {
    vi.spyOn(introducoesLib, 'carregarIntroducao').mockResolvedValue(null)

    montar('livro-inexistente')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(container.textContent).toContain('Introdução não encontrada')
  })
})
