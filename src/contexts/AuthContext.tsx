import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../types'

type AuthValue = { session: Session | null; profile: Profile | null; loading: boolean; signOut: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
const profileCacheKey = 'divine-glow-current-profile-v1'

function readCachedProfile(): Profile | null {
  try { return JSON.parse(localStorage.getItem(profileCacheKey) || 'null') as Profile | null } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedProfile = readCachedProfile()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(cachedProfile)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const loadProfile = async (nextSession: Session | null) => {
      setSession(nextSession)
      if (!nextSession) { setProfile(null); localStorage.removeItem(profileCacheKey); setLoading(false); return }
      if (cachedProfile?.id === nextSession.user.id) { setProfile(cachedProfile); setLoading(false) }
      const { data } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle()
      const nextProfile = data as Profile | null
      setProfile(nextProfile)
      if (nextProfile) localStorage.setItem(profileCacheKey, JSON.stringify(nextProfile))
      setLoading(false)
    }
    void supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { void loadProfile(nextSession) })
    return () => listener.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, profile, loading, signOut: async () => { localStorage.removeItem(profileCacheKey); await supabase.auth.signOut() } }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
