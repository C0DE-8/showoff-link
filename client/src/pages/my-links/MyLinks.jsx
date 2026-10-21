import { useCallback, useEffect, useState } from 'react'
import { FiArrowUpRight, FiClock, FiCopy, FiImage, FiMic, FiRefreshCw, FiType } from 'react-icons/fi'
import * as userApi from '../../api/user'
import { useToast } from '../../context/ToastContext'

const icons = { note: FiType, image: FiImage, voice: FiMic }
const routeFor = { note: 'note', image: 'image', voice: 'voice' }

export default function MyLinks() {
  const [links, setLinks] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await userApi.getLinks()
      setLinks(data.links || [])
    } catch (error) {
      showToast(error.response?.data?.error || 'Could not load your links.', 'error')
    } finally { setLoading(false) }
  }, [showToast])
  useEffect(() => { userApi.getLinks().then(({ data }) => setLinks(data.links || [])).catch((error) => showToast(error.response?.data?.error || 'Could not load your links.', 'error')).finally(() => setLoading(false)) }, [showToast])
  const visibleLinks = links.filter((link) => filter === 'all' || (filter === 'active' ? Boolean(link.is_active) : !link.is_active))
  const makeUrl = (link) => `${window.location.origin}/${routeFor[link.content_type]}/${encodeURIComponent(link.id)}`
  const copyLink = async (link) => {
    try { await navigator.clipboard.writeText(makeUrl(link)); showToast('Share link copied.', 'success') }
    catch { showToast('Could not copy the share link.', 'error') }
  }
  const activeCount = links.filter((link) => link.is_active).length
  return <section className="form-panel wide-panel links-panel">
    <div className="form-page-heading"><span className="create-icon"><FiClock /></span><div><div className="section-kicker">YOUR SHARED MOMENTS</div><h2>My links</h2><p>Keep an eye on what’s still open and how many views are left.</p></div><button className="icon-button links-refresh" onClick={load} aria-label="Refresh links" title="Refresh links"><FiRefreshCw /></button></div>
    <div className="links-summary"><span><strong>{links.length}</strong> total links</span><span><i className="active-dot"/><strong>{activeCount}</strong> still active</span></div>
    <div className="links-filters" role="tablist" aria-label="Filter links">{[['all','All links'],['active','Active'],['ended','Ended']].map(([key,label])=><button role="tab" aria-selected={filter===key} className={filter===key?'filter-chip filter-chip-active':'filter-chip'} onClick={()=>setFilter(key)} key={key}>{label}</button>)}</div>
    {loading ? <div className="table-loading"><span className="spinner"/> Loading your links…</div> : visibleLinks.length === 0 ? <div className="links-empty"><span className="empty-mark">✳</span><strong>{filter==='all'?'Your first link starts here.':'No links in this view.'}</strong><span>{filter==='all'?'Create a note, photo or voice message and it will appear here.':'Try another filter or create a new moment.'}</span></div> : <div className="link-history-list">{visibleLinks.map((link) => {
      const Icon = icons[link.content_type] || FiType
      const hasTotal = link.views_allowed !== null && link.views_allowed !== undefined
      const progress = hasTotal ? Math.min(100, (Number(link.views_used) / Math.max(1, Number(link.views_allowed))) * 100) : null
      return <article className="history-item" key={`${link.content_type}-${link.id}`}>
        <span className={`history-icon history-${link.content_type}`}><Icon /></span>
        <div className="history-main"><div className="history-title-row"><strong>{link.label || `${link.content_type} message`}</strong><span className={`history-status ${link.is_active?'history-status-active':'history-status-ended'}`}><i/>{link.is_active?'Active':'Ended'}</span></div><div className="history-meta"><span>{link.content_type}</span><span>·</span><span>{link.created_at ? new Date(link.created_at).toLocaleDateString() : 'Recently'}</span>{link.recipient_tagname&&<><span>·</span><span>For @{link.recipient_tagname}</span></>}</div><div className="history-views">{hasTotal?<><span>{link.views_used} of {link.views_allowed} views used</span><div className="views-track"><i style={{width:`${progress}%`}}/></div><span>{link.views_remaining} left</span></>:<span>{link.views_remaining} {Number(link.views_remaining)===1?'view':'views'} remaining</span>}</div></div>
        <div className="history-actions"><button className="icon-button" onClick={()=>copyLink(link)} aria-label="Copy share link" title="Copy link"><FiCopy /></button>{link.is_active&&<a className="icon-button" href={makeUrl(link)} target="_blank" rel="noreferrer" aria-label="Open share link" title="Open link"><FiArrowUpRight /></a>}</div>
      </article>
    })}</div>}
  </section>
}
