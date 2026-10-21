import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import { getProfile } from '../api/user'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refresh = async () => {
    if (!localStorage.getItem('showoff_token')) { setUser(null); setLoading(false); return }
    try { const { data } = await getProfile(); setUser(data.profile) }
    catch { localStorage.removeItem('showoff_token'); setUser(null) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    const clear = () => { localStorage.removeItem('showoff_token'); setUser(null); setLoading(false) }
    window.addEventListener('showoff:unauthorized', clear)
    if (localStorage.getItem('showoff_token')) {
      getProfile().then(({ data }) => setUser(data.profile)).catch(() => { localStorage.removeItem('showoff_token'); setUser(null) }).finally(() => setLoading(false))
    } else Promise.resolve().then(() => setLoading(false))
    return () => window.removeEventListener('showoff:unauthorized', clear)
  }, [])
  const login = async (identifier, password) => {
    const { data } = await authApi.login({ identifier, password })
    localStorage.setItem('showoff_token', data.token)
    const profile = await getProfile()
    setUser(profile.data.profile)
    return data.user
  }
  const register = (payload) => authApi.register(payload)
  const logout = () => { localStorage.removeItem('showoff_token'); setUser(null) }
  return <AuthContext.Provider value={{ user, loading, login, logout, register, refresh }}>{children}</AuthContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
