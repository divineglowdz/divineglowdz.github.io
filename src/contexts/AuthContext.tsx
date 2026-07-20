import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session as SupabaseSession } from '@supabase/supabase-js'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseDb, isFirebaseActive } from '../lib/firebase'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../types'

type AppSession = { user: { id: string } }
type AuthValue = { session: AppSession | SupabaseSession | null; profile: Profile | null; loading: boolean; signOut: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
const profileCacheKey = 'divine-glow-current-profile-v1'

function readCachedProfile(): Profile | null {
  try { return JSON.parse(localStorage.getItem(profileCacheKey) || 'null') as Profile | null } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedProfile = readCachedProfile()
  const [session, setSession] = useState<AppSession | SupabaseSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(cachedProfile)
  const [loading, setLoading] = useState(isFirebaseActive || isSupabaseConfigured)

  useEffect(() => {
    if (isFirebaseActive) {
      if (!firebaseAuth || !firebaseDb) { setLoading(false); return }
      const database = firebaseDb
      const loadProfile = async (user: { uid: string } | null) => {
        setSession(user ? { user: { id: user.uid } } : null)
        if (!user) { setProfile(null); localStorage.removeItem(profileCacheKey); setLoading(false); return }
        if (cachedProfile?.id === user.uid) setProfile(cachedProfile)
        const snapshot = await getDoc(doc(database, 'profiles', user.uid))
        const nextProfile = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Profile : null
        setProfile(nextProfile)
        if (nextProfile) localStorage.setItem(profileCacheKey, JSON.stringify(nextProfile))
        else localStorage.removeItem(profileCacheKey)
        setLoading(false)
      }
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => { void loadProfile(user) })
      return unsubscribe
    }
    if (!isSupabaseConfigured) { setLoading(false); return }
    const loadProfile = async (nextSession: SupabaseSession | null) => {
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

  return <AuthContext.Provider value={{ session, profile, loading, signOut: async () => { localStorage.removeItem(profileCacheKey); if (isFirebaseActive && firebaseAuth) await firebaseSignOut(firebaseAuth); else await supabase.auth.signOut() } }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
