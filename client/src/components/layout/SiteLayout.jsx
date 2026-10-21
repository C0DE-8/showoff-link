import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FiArrowUpRight, FiLogOut } from 'react-icons/fi'

export default function SiteLayout() {
  const { user, logout } = useAuth()
  return <div className="site-shell"><header className="site-header"><Link className="brand" to="/"><span className="brand-mark">s.</span><span>showoff<span className="brand-muted">links</span></span></Link><nav className="site-nav"><Link to="/#how-it-works">How it works</Link><Link to="/#features">Features</Link></nav><div className="header-actions">{user ? <><Link className="button button-quiet" to={user.role === 'admin' ? '/admin' : '/dashboard'}>{user.role === 'admin' ? 'Admin studio' : 'My workspace'} <FiArrowUpRight /></Link><button className="icon-button" onClick={logout} aria-label="Sign out"><FiLogOut /></button></> : <><Link className="button button-quiet" to="/login">Log in</Link><Link className="button button-dark" to="/register">Get started <FiArrowUpRight /></Link></>}</div></header><Outlet /><footer className="site-footer"><Link className="brand" to="/"><span className="brand-mark">s.</span><span>showoff<span className="brand-muted">links</span></span></Link><span className="footer-links"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/credits">Credits</Link></span><span>© {new Date().getFullYear()} Showoff Links</span></footer></div>
}
