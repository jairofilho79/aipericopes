import { describe, expect, it } from 'vitest'
import {
  assinarEstadoEmbedder,
  MODEL_URL,
  obterEstadoEmbedder,
  suportaWebGpu,
  WASM_CDN_DIR,
} from './gemma-embedder'

describe('gemma-embedder', () => {
  it('contém URLs válidas para Hugging Face e CDN Wasm', () => {
    expect(MODEL_URL).toContain('huggingface.co')
    expect(MODEL_URL).toContain('embeddinggemma-2-text-270m.litertlm')
    expect(WASM_CDN_DIR).toContain('jsdelivr.net')
    expect(WASM_CDN_DIR).toContain('@litert-lm/core')
  })

  it('detecta ausência de WebGPU em ambiente Node/Vitest', async () => {
    const suporta = await suportaWebGpu()
    expect(suporta).toBe(false)
  })

  it('notifica ouvintes sobre mudanças de estado', () => {
    let ultimoEstado = ''
    const cancelar = assinarEstadoEmbedder((estado) => {
      ultimoEstado = estado
    })

    expect(ultimoEstado).toBe('descarregado')
    expect(obterEstadoEmbedder().estado).toBe('descarregado')

    cancelar()
  })
})
