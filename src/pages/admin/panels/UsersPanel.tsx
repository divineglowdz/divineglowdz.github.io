import { Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { getProfiles, manageUser } from '../../../lib/api'
import { isSupabaseConfigured } from '../../../lib/supabase'
import type { Profile } from '../../../types'

export function UsersPanel() {
  const [users, setUsers] = useState<Profile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'staff' })
  const [error, setError] = useState('')
  const load = async () => { if (isSupabaseConfigured) setUsers(await getProfiles()) }
  useEffect(() => { void load() }, [])
  const create = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await manageUser('create', { user: form }); setShowForm(false); setForm({ email: '', password: '', full_name: '', role: 'staff' }); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Creation impossible') } }
  const remove = async (user: Profile) => { if (!confirm(`Supprimer l'acces de ${user.full_name || user.email} ?`)) return; await manageUser('delete', { user_id: user.id }); await load() }
  return <div className="admin-panel-stack"><div className="panel-intro"><div><h2>Utilisateurs admin</h2><p>Gerez les personnes autorisees a acceder au panneau.</p></div><button className="button primary small" onClick={() => setShowForm(true)} disabled={!isSupabaseConfigured}><UserPlus /> Ajouter</button></div>
    <section className="admin-surface no-padding"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Utilisateur</th><th>Role</th><th>Statut</th><th>Ajoute le</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="user-cell"><span>{user.full_name?.slice(0, 1) || user.email.slice(0, 1)}</span><div><b>{user.full_name || 'Sans nom'}</b><small>{user.email}</small></div></div></td><td><span className="role-badge"><Shield /> {user.role}</span></td><td><span className={user.active ? 'active-dot' : 'inactive-dot'}>{user.active ? 'Actif' : 'Desactive'}</span></td><td>{new Date(user.created_at).toLocaleDateString('fr-DZ')}</td><td><button className="table-icon danger" onClick={() => void remove(user)} title="Supprimer"><Trash2 /></button></td></tr>)}</tbody></table></div>{!users.length && <div className="surface-empty"><Users /><p>Aucun utilisateur charge.</p></div>}</section>
    {showForm && <div className="modal-backdrop"><form className="admin-modal compact" onSubmit={create}><div className="modal-heading"><div><h2>Nouvel utilisateur</h2><p>Creez un acces securise au panneau.</p></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><label>Nom complet<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label><label>E-mail<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Mot de passe temporaire<input type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Equipe</option><option value="admin">Administrateur</option></select></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Annuler</button><button className="button primary">Creer l'utilisateur</button></div></form></div>}
  </div>
}
