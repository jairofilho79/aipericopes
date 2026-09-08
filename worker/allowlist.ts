export function isEmailAllowed(email: string, allowedEmails: string | undefined): boolean {
  const raw = allowedEmails?.trim()
  if (!raw) return true
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.trim().toLowerCase())
}
