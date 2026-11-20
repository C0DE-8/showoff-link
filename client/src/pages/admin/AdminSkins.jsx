import { useEffect, useState } from 'react'
import { FiEdit2, FiImage, FiTrash2 } from 'react-icons/fi'
import { getSkins } from '../../api/skin'
import * as adminApi from '../../api/admin'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function AdminSkins() {
  const [skins, setSkins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getSkins()
      setSkins(data.skins || [])
    } catch (loadError) {
      setError(loadError.response?.data?.error || 'Could not load platform skins.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getSkins()
      .then(({ data }) => {
        if (!cancelled) setSkins(data.skins || [])
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.response?.data?.error || 'Could not load platform skins.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const updateSkin = async (event) => {
    event.preventDefault()
    if (!editTarget) return
    const form = new FormData(event.currentTarget)
    setBusyId(editTarget.id)
    setError('')
    try {
      await adminApi.updateSkin(editTarget.id, form)
      setMessage('Skin updated successfully.')
      setEditTarget(null)
      await load()
    } catch (updateError) {
      setError(updateError.response?.data?.error || 'Could not update this skin.')
    } finally {
      setBusyId(null)
    }
  }

  const removeSkin = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    setError('')
    try {
      await adminApi.deleteSkin(deleteTarget.id)
      setMessage('Skin deleted successfully.')
      setDeleteTarget(null)
      await load()
    } catch (deleteError) {
      setError(deleteError.response?.data?.error || 'Could not delete this skin.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">PLATFORM APPEARANCE</div>
          <h3>Manage skins</h3>
          <p>Edit names and token costs, replace artwork, or remove skins.</p>
        </div>
        <span className="feature-icon"><FiImage /></span>
      </div>
      {error && <div className="form-error">{error}</div>}
      {message && <div className="success-message admin-success">{message}</div>}
      {loading ? (
        <div className="table-loading"><span className="spinner" /> Loading skins…</div>
      ) : skins.length === 0 ? (
        <div className="empty-state"><strong>No platform skins yet.</strong></div>
      ) : (
        <div className="skin-grid admin-skin-grid">
          {skins.map((skin) => (
            <article className="skin-card" key={skin.id}>
              <div className="skin-preview">
                {skin.image_url ? <img src={skin.image_url} alt={`${skin.name} skin`} /> : <FiImage />}
              </div>
              <div className="skin-card-bottom">
                <div><strong>{skin.name}</strong><span>{skin.token_cost} tokens</span></div>
                <div className="admin-skin-actions">
                  <button className="icon-button" disabled={busyId === skin.id} onClick={() => setEditTarget(skin)} title="Edit skin" aria-label={`Edit ${skin.name}`}><FiEdit2 /></button>
                  <button className="icon-button danger-icon" disabled={busyId === skin.id} onClick={() => setDeleteTarget(skin)} title="Delete skin" aria-label={`Delete ${skin.name}`}><FiTrash2 /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editTarget && (
        <div className="preview-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditTarget(null) }}>
          <section className="preview-modal admin-skin-edit" role="dialog" aria-modal="true" aria-label="Edit skin">
            <header className="preview-modal-head"><div><span className="section-kicker">EDIT PLATFORM SKIN</span><h2>{editTarget.name}</h2></div></header>
            <form className="skin-form" onSubmit={updateSkin}>
              <label>Skin name<input name="name" defaultValue={editTarget.name} required /></label>
              <label>Token cost<input name="token_cost" type="number" min="0" defaultValue={editTarget.token_cost} required /></label>
              <label className="file-field">Replace image (optional)<input name="skinGraphic" type="file" accept="image/*" /></label>
              <div className="admin-skin-edit-actions">
                <button type="button" className="button button-quiet" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="button button-dark" disabled={busyId === editTarget.id}>{busyId === editTarget.id ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete this skin?" message={deleteTarget ? `Delete ${deleteTarget.name}? It will also be removed from every member's inventory.` : ''} confirmText="Delete skin" danger onCancel={() => setDeleteTarget(null)} onConfirm={removeSkin} />
    </section>
  )
}
