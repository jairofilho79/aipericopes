import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarDitadoNativo, obterReconhecimento } from './reconhecimento-fala'
import { FakeReconhecimento } from './testing/reconhecimento-fake'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('obterReconhecimento', () => {
  it('devolve o construtor padrão, o com prefixo webkit, ou null', () => {
    vi.stubGlobal('SpeechRecognition', undefined)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    expect(obterReconhecimento()).toBeNull()
    vi.stubGlobal('webkitSpeechRecognition', FakeReconhecimento)
    expect(obterReconhecimento()).toBe(FakeReconhecimento)
    class Padrao extends FakeReconhecimento {}
    vi.stubGlobal('SpeechRecognition', Padrao)
    expect(obterReconhecimento()).toBe(Padrao)
  })
})

describe('criarDitadoNativo', () => {
  const h = {
    onFinal: vi.fn(),
    onParcial: vi.fn(),
    onErro: vi.fn(),
    onFim: vi.fn(),
  }
  const rec = () => FakeReconhecimento.instancias[0]

  beforeEach(() => {
    FakeReconhecimento.instancias = []
    Object.values(h).forEach((f) => f.mockClear())
  })

  it('devolve null sem a API', () => {
    expect(criarDitadoNativo(h, null)).toBeNull()
  })

  it('configura pt-BR, contínuo, com parciais e uma alternativa', () => {
    criarDitadoNativo(h, FakeReconhecimento)
    expect(rec().lang).toBe('pt-BR')
    expect(rec().continuous).toBe(true)
    expect(rec().interimResults).toBe(true)
    expect(rec().maxAlternatives).toBe(1)
  })

  it('iniciar/parar chamam start/stop (stop, não abort, para o último final chegar)', () => {
    const d = criarDitadoNativo(h, FakeReconhecimento)!
    const abort = vi.spyOn(rec(), 'abort')
    d.iniciar()
    expect(rec().starts).toBe(1)
    d.parar()
    expect(rec().stops).toBe(1)
    expect(abort).not.toHaveBeenCalled()
  })

  it('iniciar de novo enquanto já ouve não estoura', () => {
    const d = criarDitadoNativo(h, FakeReconhecimento)!
    d.iniciar()
    expect(() => d.iniciar()).not.toThrow()
  })

  it('parciais viram prévia; finais viram onFinal uma vez, e a prévia esvazia', () => {
    const d = criarDitadoNativo(h, FakeReconhecimento)!
    d.iniciar()
    rec().resultado([['o senhor é ', false], ['o meu', false]])
    expect(h.onParcial).toHaveBeenLastCalledWith('o senhor é o meu')
    expect(h.onFinal).not.toHaveBeenCalled()

    rec().resultado([['O Senhor é o meu pastor', true]])
    expect(h.onFinal).toHaveBeenCalledTimes(1)
    expect(h.onFinal).toHaveBeenCalledWith('O Senhor é o meu pastor')
    expect(h.onParcial).toHaveBeenLastCalledWith('')
  })

  it('só lê a partir de resultIndex e junta os finais de um mesmo evento', () => {
    const d = criarDitadoNativo(h, FakeReconhecimento)!
    d.iniciar()
    rec().resultado([['primeira frase', true]])
    // Evento seguinte traz a lista inteira, mas resultIndex aponta para o novo.
    rec().resultado(
      [['primeira frase', true], ['segunda', true], ['terceira ', true], ['e a', false]],
      1,
    )
    expect(h.onFinal).toHaveBeenCalledTimes(2)
    expect(h.onFinal).toHaveBeenLastCalledWith('segunda terceira')
    expect(h.onParcial).toHaveBeenLastCalledWith('e a')
  })

  it('não entrega de novo um final reemitido (Chrome Android)', () => {
    const d = criarDitadoNativo(h, FakeReconhecimento)!
    d.iniciar()
    rec().resultado([['amém', true]])
    rec().resultado([['amém', true]], 0)
    expect(h.onFinal).toHaveBeenCalledTimes(1)
    // Sessão nova (iOS reinicia): a lista recomeça do zero e o índice também.
    rec().fim()
    d.iniciar()
    rec().resultado([['de novo', true]])
    expect(h.onFinal).toHaveBeenCalledTimes(2)
    expect(h.onFinal).toHaveBeenLastCalledWith('de novo')
  })

  it('ignora finais vazios', () => {
    const d = criarDitadoNativo(h, FakeReconhecimento)!
    d.iniciar()
    rec().resultado([['  ', true]])
    expect(h.onFinal).not.toHaveBeenCalled()
  })

  it('mapeia os erros que merecem aviso (com o código) e cala os outros', () => {
    criarDitadoNativo(h, FakeReconhecimento)
    rec().erro('not-allowed')
    expect(h.onErro).toHaveBeenLastCalledWith('Permita o microfone para ditar', 'not-allowed')
    rec().erro('service-not-allowed')
    expect(h.onErro).toHaveBeenLastCalledWith('Ditado desativado no aparelho', 'service-not-allowed')
    rec().erro('audio-capture')
    expect(h.onErro).toHaveBeenLastCalledWith('Nenhum microfone encontrado', 'audio-capture')
    rec().erro('network')
    expect(h.onErro).toHaveBeenLastCalledWith('Sem conexão para ditar', 'network')
    expect(h.onErro).toHaveBeenCalledTimes(4)
    rec().erro('no-speech')
    rec().erro('aborted')
    expect(h.onErro).toHaveBeenCalledTimes(4)
  })

  it('onend vira onFim', () => {
    criarDitadoNativo(h, FakeReconhecimento)
    rec().fim()
    expect(h.onFim).toHaveBeenCalledTimes(1)
  })
})
