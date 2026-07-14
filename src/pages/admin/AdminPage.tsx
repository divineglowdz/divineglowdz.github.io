import { BarChart3, Boxes, ChevronRight, ClipboardList, ExternalLink, LogOut, Menu, PackagePlus, ShoppingBag, Truck, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DashboardPanel } from './panels/DashboardPanel'
import { ProductsPanel } from './panels/ProductsPanel'
import { OrdersPanel } from './panels/OrdersPanel'
import { DeliveryPanel } from './panels/DeliveryPanel'
import { UsersPanel } from './panels/UsersPanel'

const navigation = [
  { path: '', label: 'Vue generale', icon: BarChart3 },
  { path: 'produits', label: 'Produits', icon: Boxes },
  { path: 'commandes', label: 'Commandes', icon: ClipboardList },
  { path: 'livraison', label: 'Livraison', icon: Truck },
  { path: 'utilisateurs', label: 'Utilisateurs', icon: Users },
]

export function AdminPage() {
  const { profile, signOut } = useAuth()
  const isStaff = profile?.role === 'staff'
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentPath = location.pathname.replace('/admin/', '').replace('/admin', '')
  const allowedNavigation = isStaff ? navigation.filter((item) => item.path === 'commandes') : navigation
  const current = allowedNavigation.find((item) => item.path === currentPath) || allowedNavigation[0]
  return (
    <div className="admin-shell">
      <aside className={mobileOpen ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="admin-brand"><span className="admin-brand-mark">DG</span><div><b>DIVINE GLOW</b><small>ADMIN</small></div><button className="sidebar-mobile-close" onClick={() => setMobileOpen(false)}><X /></button></div>
        <nav>{allowedNavigation.map(({ path, label, icon: Icon }) => { const active = currentPath === path; return <Link key={label} className={active ? 'active' : ''} to={`/admin${path ? `/${path}` : ''}`} onClick={() => setMobileOpen(false)}><Icon /><span>{label}</span>{active && <ChevronRight />}</Link> })}</nav>
        <div className="admin-sidebar-bottom"><Link to="/" target="_blank"><ExternalLink /> Voir la boutique</Link><button onClick={async () => { await signOut(); navigate('/admin/login') }}><LogOut /> Deconnexion</button><div className="admin-user"><span>{profile?.full_name?.slice(0, 1) || 'A'}</span><div><b>{profile?.full_name || 'Administrateur'}</b><small>{profile?.email}</small></div></div></div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar"><button className="admin-menu-button" onClick={() => setMobileOpen(true)}><Menu /></button><div><small>Administration</small><h1>{current.label}</h1></div>{!isStaff && <div className="admin-quick"><Link className="button small secondary" to="/admin/produits"><PackagePlus /> Nouveau produit</Link></div>}</header>
        <div className="admin-content">{isStaff ? <Routes><Route path="commandes" element={<OrdersPanel />} /><Route path="*" element={<Navigate to="/admin/commandes" replace />} /></Routes> : <Routes><Route index element={<DashboardPanel />} /><Route path="produits" element={<ProductsPanel />} /><Route path="commandes" element={<OrdersPanel />} /><Route path="livraison" element={<DeliveryPanel />} /><Route path="utilisateurs" element={<UsersPanel />} /><Route path="*" element={<Navigate to="/admin" replace />} /></Routes>}</div>
      </div>
      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />}
    </div>
  )
}
