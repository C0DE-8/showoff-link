import { useEffect } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'

export default function ConfirmDialog({ open, title, message, confirmText = 'Confirm', danger = false, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])
  if (!open) return null
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section className="glass-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <span className={`dialog-icon ${danger ? 'dialog-icon-danger' : ''}`}><FiAlertTriangle /></span>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="dialog-actions"><button className="button button-quiet" onClick={onCancel}>Cancel</button><button className={`button ${danger ? 'button-danger' : 'button-dark'}`} onClick={onConfirm}>{confirmText}</button></div>
    </section>
  </div>
}
