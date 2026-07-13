import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../types'

type AuthValue = { session: Session | null; profile: Profile | null; loading: boolean; signOut: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const loadProfile = async (nextSession: Session | null) => {
      setSession(nextSession)
      if (!nextSession) { setProfile(null); setLoading(false); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle()
      setProfile(data as Profile | null)
      setLoading(false)
    }
    void supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { void loadProfile(nextSession) })
    return () => listener.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, profile, loading, signOut: async () => { await supabase.auth.signOut() } }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
