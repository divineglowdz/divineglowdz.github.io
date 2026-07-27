type ProtectedAction = 'order' | 'contact'

const limits: Record<ProtectedAction, { maxAttempts: number; windowMs: number }> = {
  order: { maxAttempts: 3, windowMs: 15 * 60 * 1000 },
  contact: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
}

export function checkSubmission(action: ProtectedAction, startedAt: number, honeypot: string) {
  if (honeypot.trim()) throw new Error('Envoi refusé.')
  if (Date.now() - startedAt < 1500) throw new Error('Veuillez patienter un instant avant de réessayer.')
  const limit = limits[action]
  const key = `divine-glow-rate-${action}`
  const now = Date.now()
  let attempts: number[] = []
  try { attempts = JSON.parse(localStorage.getItem(key) || '[]') as number[] } catch { /* Start with an empty rate-limit window. */ }
  attempts = attempts.filter((time) => Number.isFinite(time) && now - time < limit.windowMs)
  if (attempts.length >= limit.maxAttempts) throw new Error(action === 'order' ? 'Trop de tentatives. Réessayez dans quelques minutes.' : 'Trop de messages envoyés. Réessayez plus tard.')
  attempts.push(now)
  try { localStorage.setItem(key, JSON.stringify(attempts)) } catch { /* Private browsing can disable storage. */ }
}

export function cleanText(value: string, maximum: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, maximum)
}
