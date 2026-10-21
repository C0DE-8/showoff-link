import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'

const ToastContext = createContext(null)
const icons = { success: FiCheckCircle, error: FiAlertCircle, info: FiInfo }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const timers = useRef(new Map())
  const dismissToast = useCallback((id) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])
  const showToast = useCallback((message, type = 'info') => {
    const id = ++nextId.current
    setToasts((items) => [...items, { id, message, type }].slice(-4))
    timers.current.set(id, window.setTimeout(() => dismissToast(id), 4200))
  }, [dismissToast])
  const Icon = (type) => icons[type] || icons.info
  return <ToastContext.Provider value={{ showToast }}>
    {children}
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const ToastIcon = Icon(toast.type)
        return <div className={`glass-toast toast-${toast.type}`} key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}>
          <ToastIcon className="toast-icon" />
          <span>{toast.message}</span>
          <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification"><FiX /></button>
        </div>
      })}
    </div>
  </ToastContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
