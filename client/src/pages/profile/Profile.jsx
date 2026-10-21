import { useEffect, useState } from 'react'
import { FiCheck, FiSave, FiUser } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { userApi } from '../../api/client'

export default function Profile() {
  const { user } = useAuth(); const [profile, setProfile] = useState(user); const [tag, setTag] = useState(user?.tagname || ''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { userApi.profile().then(({ data }) => { setProfile(data.profile); setTag(data.profile.tagname || '') }).catch(() => setError('Could not load your profile.')) }, [])
  const save = async e => { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const { data } = await userApi.updateTagname(tag); setTag(data.tagname); setMessage(data.message || 'Your tag is updated.') } catch (err) { setError(err.response?.data?.error || 'Could not update your tag.') } finally { setBusy(false) } }
  return <section className="form-panel"><div className="form-page-heading"><span className="create-icon"><FiUser /></span><div><div className="section-kicker">YOUR ACCOUNT</div><h2>Profile & settings</h2><p>Make your public tag feel like you.</p></div></div>{message && <div className="success-message">{message}</div>}{error && <div className="form-error">{error}</div>}<div className="profile-summary"><div className="avatar profile-avatar">{profile?.full_name?.[0] || 'S'}</div><div><strong>{profile?.full_name}</strong><span>{profile?.email}</span></div><span className="status-pill status-good"><i/>Verified</span></div><form className="workspace-form narrow-form" onSubmit={save}><label>Public tag<input value={tag} onChange={e => setTag(e.target.value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, ''))} minLength="3" required/><small>Your friends can use this tag to send a private note, photo or voice message.</small></label><button className="button button-dark" disabled={busy}><FiSave />{busy ? 'Saving…' : 'Save changes'}<FiCheck /></button></form></section>
}
