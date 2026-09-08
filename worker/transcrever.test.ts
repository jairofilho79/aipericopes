import { describe, expect, it } from 'vitest'
import {
  COTA_USUARIO_SEGUNDOS,
  MAX_BYTES,
  MAX_SEGUNDOS,
  MODELO,
  TETO_GLOBAL_SEGUNDOS,
  decidirCota,
  diaUtc,
  montarInput,
  paraBase64,
  parseDuracao,
  proximaMeiaNoiteUtc,
  tipoAudioAceito,
} from './transcrever'

describe('constantes', () => {
  it('limites combinam com o que o cliente promete', () => {
    expect(MAX_SEGUNDOS).toBe(60)
    expect(MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(COTA_USUARIO_SEGUNDOS).toBe(600)
    expect(TETO_GLOBAL_SEGUNDOS).toBe(10_800)
    expect(MODELO).toBe('@cf/openai/whisper-large-v3-turbo')
  })
})

describe('tipoAudioAceito', () => {
  it('aceita os contêineres que os navegadores gravam', () => {
    expect(tipoAudioAceito('audio/webm')).toBe(true)
    expect(tipoAudioAceito('audio/mp4')).toBe(true)
    expect(tipoAudioAceito('audio/mpeg')).toBe(true)
    expect(tipoAudioAceito('audio/ogg')).toBe(true)
    expect(tipoAudioAceito('audio/wav')).toBe(true)
  })

  it('aceita parâmetros (codecs) e maiúsculas/espaços', () => {
    expect(tipoAudioAceito('audio/webm;codecs=opus')).toBe(true)
    expect(tipoAudioAceito('audio/ogg; codecs="opus"')).toBe(true)
    expect(tipoAudioAceito('Audio/MP4 ; codecs=mp4a.40.2')).toBe(true)
  })

  it('rejeita ausente, vazio e tipos fora da lista', () => {
    expect(tipoAudioAceito(null)).toBe(false)
    expect(tipoAudioAceito(undefined)).toBe(false)
    expect(tipoAudioAceito('')).toBe(false)
    expect(tipoAudioAceito('application/json')).toBe(false)
    expect(tipoAudioAceito('video/webm')).toBe(false)
    expect(tipoAudioAceito('audio/webmx')).toBe(false)
  })
})

describe('parseDuracao', () => {
  it('aceita inteiros entre 1 e MAX_SEGUNDOS', () => {
    expect(parseDuracao('1')).toBe(1)
    expect(parseDuracao('7')).toBe(7)
    expect(parseDuracao(String(MAX_SEGUNDOS))).toBe(MAX_SEGUNDOS)
  })

  it('rejeita ausente, não-inteiro, zero, negativo e acima do teto', () => {
    expect(parseDuracao(null)).toBeNull()
    expect(parseDuracao(undefined)).toBeNull()
    expect(parseDuracao('')).toBeNull()
    expect(parseDuracao('abc')).toBeNull()
    expect(parseDuracao('2.5')).toBeNull()
    expect(parseDuracao('0')).toBeNull()
    expect(parseDuracao('-3')).toBeNull()
    expect(parseDuracao(String(MAX_SEGUNDOS + 1))).toBeNull()
    expect(parseDuracao('1e2')).toBeNull()
  })
})

describe('decidirCota', () => {
  it('libera quando cabe nas duas cotas', () => {
    expect(decidirCota({ usoUsuario: 0, usoGlobal: 0, duracao: 60 })).toBe('ok')
    expect(
      decidirCota({ usoUsuario: COTA_USUARIO_SEGUNDOS - 60, usoGlobal: 0, duracao: 60 }),
    ).toBe('ok')
  })

  it('a cota do usuário é inclusiva: o pedido que fecha exatamente o teto passa', () => {
    expect(
      decidirCota({ usoUsuario: COTA_USUARIO_SEGUNDOS - 1, usoGlobal: 0, duracao: 1 }),
    ).toBe('ok')
    expect(decidirCota({ usoUsuario: COTA_USUARIO_SEGUNDOS, usoGlobal: 0, duracao: 1 })).toBe(
      'usuario',
    )
    expect(
      decidirCota({ usoUsuario: COTA_USUARIO_SEGUNDOS - 30, usoGlobal: 0, duracao: 31 }),
    ).toBe('usuario')
  })

  it('o teto global barra mesmo com cota pessoal sobrando', () => {
    expect(decidirCota({ usoUsuario: 0, usoGlobal: TETO_GLOBAL_SEGUNDOS, duracao: 1 })).toBe(
      'global',
    )
    expect(
      decidirCota({ usoUsuario: 0, usoGlobal: TETO_GLOBAL_SEGUNDOS - 10, duracao: 11 }),
    ).toBe('global')
    expect(
      decidirCota({ usoUsuario: 0, usoGlobal: TETO_GLOBAL_SEGUNDOS - 10, duracao: 10 }),
    ).toBe('ok')
  })

  it('quando as duas estouram, a do usuário fala mais alto (é a mensagem útil pra ele)', () => {
    expect(
      decidirCota({
        usoUsuario: COTA_USUARIO_SEGUNDOS,
        usoGlobal: TETO_GLOBAL_SEGUNDOS,
        duracao: 5,
      }),
    ).toBe('usuario')
  })
})

describe('paraBase64', () => {
  it('codifica bytes pequenos como o btoa faria', () => {
    const bytes = new TextEncoder().encode('olá, mundo')
    expect(paraBase64(bytes.buffer)).toBe(btoa(String.fromCharCode(...bytes)))
  })

  it('vazio vira string vazia', () => {
    expect(paraBase64(new ArrayBuffer(0))).toBe('')
  })

  it('aguenta buffers grandes (acima do que caberia em fromCharCode.apply)', () => {
    const n = MAX_BYTES
    const bytes = new Uint8Array(n)
    for (let i = 0; i < n; i++) bytes[i] = i % 251
    const b64 = paraBase64(bytes.buffer)
    expect(b64.length).toBe(Math.ceil(n / 3) * 4)
    // Decodifica de volta e confere os dois extremos e o meio.
    const volta = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    expect(volta.length).toBe(n)
    expect(volta[0]).toBe(0)
    expect(volta[n - 1]).toBe((n - 1) % 251)
    expect(volta[123_457]).toBe(123_457 % 251)
  })

  it('respeita offset e comprimento de uma view', () => {
    const base = new Uint8Array([9, 9, 65, 66, 67, 9])
    expect(paraBase64(base.subarray(2, 5))).toBe(btoa('ABC'))
  })
})

describe('montarInput', () => {
  it('monta o input do modelo com português e transcrição', () => {
    expect(montarInput('QUJD')).toEqual({ audio: 'QUJD', language: 'pt', task: 'transcribe' })
  })
})

describe('diaUtc / proximaMeiaNoiteUtc', () => {
  it('dia em UTC no formato YYYY-MM-DD', () => {
    expect(diaUtc(new Date('2026-09-02T23:59:59.999Z'))).toBe('2026-09-02')
    expect(diaUtc(new Date('2026-09-03T00:00:00.000Z'))).toBe('2026-09-03')
  })

  it('a próxima meia-noite UTC é quando o dia (e a cota) viram', () => {
    expect(proximaMeiaNoiteUtc(new Date('2026-09-02T10:30:00.000Z'))).toBe(
      '2026-09-03T00:00:00.000Z',
    )
    expect(proximaMeiaNoiteUtc(new Date('2026-09-02T23:59:59.999Z'))).toBe(
      '2026-09-03T00:00:00.000Z',
    )
    // Em cima da meia-noite o dia já virou: a próxima é a do dia seguinte.
    expect(proximaMeiaNoiteUtc(new Date('2026-09-03T00:00:00.000Z'))).toBe(
      '2026-09-04T00:00:00.000Z',
    )
    // Virada de mês e de ano.
    expect(proximaMeiaNoiteUtc(new Date('2026-12-31T12:00:00.000Z'))).toBe(
      '2027-01-01T00:00:00.000Z',
    )
  })
})
