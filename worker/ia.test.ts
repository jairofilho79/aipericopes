import { describe, expect, it, vi } from 'vitest'
import { cifrarChave, decifrarChave } from './ia-cripto'
import {
  classificarStatus,
  ehProvedor,
  parsePedidoChave,
  validarChave,
} from './ia-provedores'

describe('ia-cripto', () => {
  it('round-trip', async () => {
    const { cifrada, iv } = await cifrarChave('segredo', 'u1', 'sk-abc')
    expect(cifrada).not.toContain('sk-abc')
    expect(await decifrarChave('segredo', 'u1', cifrada, iv)).toBe('sk-abc')
  })
  it('IV diferente a cada cifragem', async () => {
    const a = await cifrarChave('s', 'u1', 'x')
    const b = await cifrarChave('s', 'u1', 'x')
    expect(a.iv).not.toBe(b.iv)
    expect(a.cifrada).not.toBe(b.cifrada)
  })
  it('falha com segredo errado', async () => {
    const { cifrada, iv } = await cifrarChave('certo', 'u1', 'x')
    await expect(decifrarChave('errado', 'u1', cifrada, iv)).rejects.toThrow()
  })
  it('falha para outro usuário (AAD)', async () => {
    const { cifrada, iv } = await cifrarChave('s', 'u1', 'x')
    await expect(decifrarChave('s', 'u2', cifrada, iv)).rejects.toThrow()
  })
  it('exige segredo', async () => {
    await expect(cifrarChave('', 'u1', 'x')).rejects.toThrow()
  })
})

describe('parsePedidoChave', () => {
  const chaveOpenai = 'sk-' + 'a'.repeat(30)
  it('aceita e usa modelo padrão', () => {
    expect(parsePedidoChave({ provedor: 'openai', chave: chaveOpenai })).toEqual({
      provedor: 'openai',
      modelo: 'gpt-4o-mini',
      chave: chaveOpenai,
      contaId: null,
    })
  })
  it('Cloudflare exige Account ID de 32 hex e aceita modelo com @', () => {
    const chave = 'a'.repeat(40)
    const contaId = 'ABCDEF0123456789abcdef0123456789'
    expect(parsePedidoChave({ provedor: 'cloudflare', chave })).toBeNull()
    expect(parsePedidoChave({ provedor: 'cloudflare', chave, contaId: 'curto' })).toBeNull()
    expect(parsePedidoChave({ provedor: 'cloudflare', chave, contaId })).toEqual({
      provedor: 'cloudflare',
      modelo: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      chave,
      contaId: contaId.toLowerCase(),
    })
  })
  it('rejeita provedor desconhecido, chave vazia, com espaço ou formato errado', () => {
    expect(parsePedidoChave({ provedor: 'x', chave: chaveOpenai })).toBeNull()
    expect(parsePedidoChave({ provedor: 'openai', chave: '' })).toBeNull()
    expect(parsePedidoChave({ provedor: 'openai', chave: 'sk-aaa aaa' })).toBeNull()
    expect(parsePedidoChave({ provedor: 'anthropic', chave: chaveOpenai })).toBeNull()
    expect(parsePedidoChave(null)).toBeNull()
  })
  it('rejeita modelo com caracteres estranhos', () => {
    expect(parsePedidoChave({ provedor: 'openai', chave: chaveOpenai, modelo: 'a b;c' })).toBeNull()
  })
  it('ehProvedor não cai em propriedades do protótipo', () => {
    expect(ehProvedor('toString')).toBe(false)
    expect(ehProvedor('gemini')).toBe(true)
  })
})

describe('validação', () => {
  it('classifica status HTTP', () => {
    expect(classificarStatus(200)).toBe('ok')
    expect(classificarStatus(401)).toBe('invalida')
    expect(classificarStatus(402)).toBe('sem_credito')
    expect(classificarStatus(500)).toBe('indisponivel')
  })
  it('validarChave usa o header certo e não lança em falha de rede', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    expect(await validarChave('anthropic', 'k', null, f as unknown as typeof fetch)).toBe('ok')
    const init = f.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k')
    const quebra = vi.fn().mockRejectedValue(new Error('rede'))
    expect(await validarChave('openai', 'k', null, quebra as unknown as typeof fetch)).toBe('indisponivel')
  })
  it('Cloudflare valida na conta informada com Bearer', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const conta = '0123456789abcdef0123456789abcdef'
    expect(await validarChave('cloudflare', 'tok', conta, f as unknown as typeof fetch)).toBe('ok')
    expect(f.mock.calls[0][0]).toContain(`/accounts/${conta}/ai/`)
    const init = f.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })
})
