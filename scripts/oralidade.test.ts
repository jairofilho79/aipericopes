import { describe, it, expect } from 'vitest'
import { prepararParaFalaSSML, escaparXml, dividirSsmlEmChunks } from './oralidade.ts'

describe('oralidade', () => {
  it('escapa caracteres XML especiais sem quebrar entidades', () => {
    expect(escaparXml('Tom & Jerry <filme>')).toBe('Tom &amp; Jerry &lt;filme&gt;')
  })

  it('adiciona pausas e destaque em decretos divinos no texto bíblico', () => {
    const raw = 'Texto Bíblico. Capítulo 1. E disse Deus: Haja luz; e houve luz.'
    const ssml = prepararParaFalaSSML(raw, 'texto')

    expect(ssml).toContain('<speak>')
    expect(ssml).toContain('</speak>')
    expect(ssml).toContain('Texto Bíblico.')
    expect(ssml).toContain('E disse Deus:')
    expect(ssml).toContain('&quot;Haja luz&quot;')
    expect(ssml).toContain('e houve luz.')
  })

  it('destaca a aprovação divina ("E viu Deus que era bom")', () => {
    const raw = 'Texto Bíblico. E viu Deus que era bom.'
    const ssml = prepararParaFalaSSML(raw, 'texto')

    expect(ssml).toContain('E viu Deus que era bom.')
    expect(ssml).toContain('<break time="650ms"/>')
  })

  it('destaca o refrão da semana da Criação', () => {
    const raw = 'Texto Bíblico. E foi a tarde e a manhã, o dia primeiro.'
    const ssml = prepararParaFalaSSML(raw, 'texto')

    expect(ssml).toContain('E foi a tarde e a manhã, o dia primeiro.')
    expect(ssml).toContain('<break time="900ms"/>')
  })

  it('formata reflexões com pausas longas entre perguntas', () => {
    const raw = 'Reflexões. Pergunta 1. O que você acha? Pergunta 2. O que muda?'
    const ssml = prepararParaFalaSSML(raw, 'reflexoes')

    expect(ssml).toContain('Reflexões. <break time="900ms"/>')
    expect(ssml).toContain('? <break time="1000ms"/>')
  })

  it('divide SSML longo em chunks que cabem no limite de bytes mantendo tags válidas', () => {
    const frase = 'No princípio criou Deus os céus e a terra. <break time="500ms"/> '
    const ssmlLongo = `<speak>${frase.repeat(50)}</speak>`
    const chunks = dividirSsmlEmChunks(ssmlLongo, 800)

    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.startsWith('<speak>')).toBe(true)
      expect(c.endsWith('</speak>')).toBe(true)
      expect(Buffer.byteLength(c, 'utf8')).toBeLessThanOrEqual(800)
    }
  })
})
