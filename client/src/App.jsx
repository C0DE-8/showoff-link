import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import SiteLayout from './components/layout/SiteLayout'
import AppLayout from './components/layout/AppLayout'
import Landing from './pages/landing/Landing'
import Login from './pages/login/Login'
import Register from './pages/register/Register'
import Dashboard from './pages/dashboard/Dashboard'
import Admin from './pages/admin/Admin'
import NotFound from './pages/not-found/NotFound'
import CreateContent from './pages/create-content/CreateContent'
import Profile from './pages/profile/Profile'
import GiftTokens from './pages/gift-tokens/GiftTokens'
import TokenShop from './pages/token-shop/TokenShop'
import SkinShop from './pages/skin-shop/SkinShop'
import SkinInventory from './pages/skin-inventory/SkinInventory'
import ContentView from './pages/content-view/ContentView'
import StaticPage from './pages/static/StaticPage'
import RecoverPassword from './pages/recover-password/RecoverPassword'
import MyLinks from './pages/my-links/MyLinks'
import { ToastProvider } from './context/ToastContext'
import './App.css'
import './theme.css'

function Protected({ children, admin = false }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="spinner" />Loading your workspace</div>
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return <Routes>
    <Route element={<SiteLayout />}>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<RecoverPassword />} />
      <Route path="/terms" element={<StaticPage kind="terms" />} />
      <Route path="/privacy" element={<StaticPage kind="privacy" />} />
      <Route path="/credits" element={<StaticPage kind="credits" />} />
    </Route>
    <Route path="/note/:id" element={<ContentView type="note" />} />
    <Route path="/image/:id" element={<ContentView type="image" />} />
    <Route path="/voice/:id" element={<ContentView type="voice" />} />
    <Route path="/dashboard" element={<Protected><AppLayout /></Protected>}><Route index element={<Dashboard />} /></Route>
    <Route path="/create/:type" element={<Protected><AppLayout /></Protected>}><Route index element={<CreateContent />} /></Route>
    <Route path="/profile" element={<Protected><AppLayout /></Protected>}><Route index element={<Profile />} /></Route>
    <Route path="/links" element={<Protected><AppLayout /></Protected>}><Route index element={<MyLinks />} /></Route>
    <Route path="/gift-tokens" element={<Protected><AppLayout /></Protected>}><Route index element={<GiftTokens />} /></Route>
    <Route path="/tokens" element={<Protected><AppLayout /></Protected>}><Route index element={<TokenShop />} /></Route>
    <Route path="/skins" element={<Protected><AppLayout /></Protected>}><Route index element={<SkinShop />} /></Route>
    <Route path="/skins/inventory" element={<Protected><AppLayout /></Protected>}><Route index element={<SkinInventory />} /></Route>
    <Route path="/admin" element={<Protected admin><AppLayout admin /></Protected>}><Route index element={<Admin />} /></Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
}

export default function App() {
  return <AuthProvider><ToastProvider><AppRoutes /></ToastProvider></AuthProvider>
}
