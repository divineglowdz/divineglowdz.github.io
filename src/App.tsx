import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { trackEvent } from './lib/api'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ShopPage } from './pages/ShopPage'
import { ProductPage } from './pages/ProductPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ThankYouPage } from './pages/ThankYouPage'
import { EngagementPage } from './pages/EngagementPage'
import { ContactPage } from './pages/ContactPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminPage } from './pages/admin/AdminPage'
import { AdminRoute } from './pages/admin/AdminRoute'

function PageTracker() {
  const location = useLocation()
  useEffect(() => { window.scrollTo(0, 0); void trackEvent('page_view') }, [location.pathname])
  return null
}

export default function App() {
  return (
    <>
      <PageTracker />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/boutique" element={<ShopPage />} />
          <Route path="/engagements" element={<EngagementPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/produit/:slug" element={<ProductPage />} />
          <Route path="/commande" element={<CheckoutPage />} />
          <Route path="/merci" element={<ThankYouPage />} />
        </Route>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/*" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
