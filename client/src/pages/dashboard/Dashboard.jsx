import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowUpRight, FiGift, FiImage, FiMic, FiSettings, FiShoppingBag, FiType, FiZap } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import * as userApi from '../../api/user'

export default function Dashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(user)
  const [error, setError] = useState('')

  useEffect(() => {
    userApi.getProfile()
      .then(({ data }) => setProfile(data.profile))
      .catch(() => setError('Your profile could not be refreshed.'))
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] || 'friend'

  return (
    <div className="dashboard-home">
      <header className="dashboard-greeting">
        <div>
          <div className="section-kicker">YOUR SPACE</div>
          <h2>Welcome back, {firstName}</h2>
          <p>Make a small moment feel personal.</p>
        </div>
        <span className="dashboard-tag-pill">@{profile?.tagname || '…'}</span>
      </header>

      {error && <p className="inline-error" role="status">{error}</p>}

      <section className="balance-card-react" aria-label="Available token balance">
        <div className="balance-card-copy">
          <span className="balance-label-react">Available balance</span>
          <strong className="balance-amount-react">{profile?.tokens ?? '—'} <small>tokens</small></strong>
        </div>
        <div className="balance-actions-react">
          <Link className="balance-action-primary" to="/tokens"><FiZap /> Top up</Link>
          <Link className="balance-action" to="/gift-tokens"><FiGift /> Gift</Link>
          <Link className="balance-action" to="/skins"><FiShoppingBag /> Store</Link>
        </div>
      </section>

      <section className="dashboard-bento-section">
        <div className="dashboard-section-heading">
          <div className="section-kicker">MAKE A MOMENT</div>
          <h3>What would you like to send?</h3>
        </div>
        <div className="dashboard-bento-grid">
          <Link to="/create/note" className="dashboard-bento-card bento-note">
            <span className="bento-card-icon"><FiType /></span>
            <span className="bento-card-copy"><span className="bento-card-label">TEXT CAPSULE</span><strong>Write a note</strong><small>Send words made just for them.</small></span>
            <FiArrowUpRight className="bento-card-arrow" />
          </Link>
          <Link to="/create/image" className="dashboard-bento-card bento-image">
            <span className="bento-card-icon"><FiImage /></span>
            <span className="bento-card-copy"><span className="bento-card-label">IMAGE CANVAS</span><strong>Share a photo</strong><small>Wrap a favorite memory.</small></span>
            <FiArrowUpRight className="bento-card-arrow" />
          </Link>
          <Link to="/create/voice" className="dashboard-bento-card bento-voice">
            <span className="bento-card-icon"><FiMic /></span>
            <span className="bento-card-copy"><span className="bento-card-label">VOICE NOTE</span><strong>Record a hello</strong><small>Let them hear it from you.</small></span>
            <FiArrowUpRight className="bento-card-arrow" />
          </Link>
          <Link to="/profile" className="dashboard-bento-card bento-profile">
            <span className="bento-card-icon"><FiSettings /></span>
            <span className="bento-card-copy"><span className="bento-card-label">YOUR ACCOUNT</span><strong>Profile &amp; settings</strong><small>Manage your personal space.</small></span>
            <FiArrowUpRight className="bento-card-arrow" />
          </Link>
        </div>
      </section>
    </div>
  )
}
