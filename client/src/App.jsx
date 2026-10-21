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
import './App.css'

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
    </Route>
    <Route path="/dashboard" element={<Protected><AppLayout /></Protected>}><Route index element={<Dashboard />} /></Route>
    <Route path="/admin" element={<Protected admin><AppLayout admin /></Protected>}><Route index element={<Admin />} /></Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>
}
