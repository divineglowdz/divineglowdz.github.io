import { Mail, Phone, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getContactMessages } from '../../../lib/api'
import type { ContactMessage } from '../../../types'

export function MessagesPanel() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { setMessages(await getContactMessages()) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  return <div className="admin-panel-stack"><div className="panel-intro"><div><h2>Messages</h2><p>Demandes envoyées depuis le formulaire de contact.</p></div><button className="button secondary small" onClick={() => void load()}><RefreshCw /> Actualiser</button></div><section className="admin-surface message-list">{messages.map((message) => <article key={message.id}><header><div><b>{message.name}</b><span>{message.subject}</span></div><time>{new Date(message.created_at).toLocaleString('fr-DZ')}</time></header><p>{message.message}</p><footer><a href={`mailto:${message.email}`}><Mail /> {message.email}</a>{message.phone && <a href={`tel:${message.phone}`}><Phone /> {message.phone}</a>}</footer></article>)}{!loading && !messages.length && <div className="surface-empty"><Mail /><p>Aucun message pour le moment.</p></div>}</section></div>
}
