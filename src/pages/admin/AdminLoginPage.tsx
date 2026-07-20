import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { firebaseAuth, isFirebaseActive } from '../../lib/firebase'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  if (session && profile?.active) return <Navigate to="/admin" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!isFirebaseActive && !isSupabaseConfigured) { setError('La base de donnees doit etre configuree avant la connexion.'); return }
    setLoading(true)
    const authError = isFirebaseActive
      ? await signInWithEmailAndPassword(firebaseAuth!, email, password).then(() => null).catch((reason: Error) => reason)
      : (await supabase.auth.signInWithPassword({ email, password })).error
    setLoading(false)
    if (authError) setError('Identifiants incorrects ou acces non autorise.')
    else navigate('/admin')
  }
  return (
    <main className="admin-login-page">
      <div className="admin-login-brand"><img className="admin-login-logo" src="https://i.ibb.co/k7R6BCs/Photo-Room-20251101-143835.png" alt="Logo Divine Glow DZ" /><small>ADMINISTRATION</small></div>
      <form className="admin-login-card" onSubmit={submit}><div className="login-icon"><LockKeyhole /></div><h1>Bienvenue</h1><p>Connectez-vous pour piloter la boutique.</p>
        <label>Adresse e-mail<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Mot de passe<div className="password-field"><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer' : 'Afficher'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {error && <p className="form-error">{error}</p>}<button className="button primary" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button><Link className="back-link" to="/"><ArrowLeft /> Retour a la boutique</Link>
      </form>
    </main>
  )
}
