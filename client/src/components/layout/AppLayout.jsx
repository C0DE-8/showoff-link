import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FiGrid, FiLogOut, FiSettings, FiUsers, FiZap, FiMenu } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'

export default function AppLayout({ admin = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const leave = () => { logout(); navigate('/') }
  return <div className="app-shell"><aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><Link to="/" className="brand side-brand"><span className="brand-mark">s.</span><span>showoff<span className="brand-muted">links</span></span></Link><div className="side-label">WORKSPACE</div><NavLink end to={admin ? '/admin' : '/dashboard'} className="side-link"><FiGrid /> Overview</NavLink>{admin && <><div className="side-label">MANAGE</div><a className="side-link selected" href="#people"><FiUsers /> People <span className="side-pill">Admin</span></a><a className="side-link" href="#topups"><FiZap /> Top-ups</a><a className="side-link" href="#settings"><FiSettings /> Settings</a></>}<div className="sidebar-bottom"><div className="mini-profile"><div className="avatar">{user?.full_name?.[0] || user?.email?.[0] || 'S'}</div><div className="profile-lines"><strong>{user?.full_name || user?.email}</strong><span>@{user?.tagname || (admin ? 'admin' : 'creator')}</span></div><button className="icon-button" onClick={leave} aria-label="Sign out"><FiLogOut /></button></div></div></aside><main className="app-main"><header className="app-topbar"><button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-label="Open menu"><FiMenu /></button><div><span className="top-eyebrow">{admin ? 'ADMIN STUDIO' : 'YOUR SPACE'}</span><h1>{admin ? 'Control room' : 'Dashboard'}</h1></div><div className="top-right"><span className="online-dot" /> All systems ready <div className="avatar avatar-small">{user?.full_name?.[0] || 'S'}</div></div></header><div className="page-content"><Outlet /></div></main></div>
}
