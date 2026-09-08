export interface Env {
  DB: D1Database
  AUDIO: R2Bucket
  /** Workers AI: o ditado de fallback (whisper) e a revisão do ditado (llama). */
  AI: Ai
  BETTER_AUTH_SECRET: string
  APP_URL: string
  EMAIL_FROM: string
  RESEND_API_KEY?: string
  ALLOWED_EMAILS?: string
}
