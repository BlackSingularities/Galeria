import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { IconCheck, IconAlert, IconInfo, IconClose } from './icons'

const ToastCtx = createContext(null)
const ConfirmCtx = createContext(null)

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const seq = useRef(0)

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), [])

  const push = useCallback((type, message) => {
    const id = ++seq.current
    setToasts(t => [...t, { id, type, message }])
    setTimeout(() => dismiss(id), 4500)
    return id
  }, [dismiss])

  const toast = useRef({
    success: (m) => push('success', m),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  }).current

  const confirm = useCallback((message, opts = {}) => new Promise((resolve) => {
    setConfirmState({ message, detail: opts.detail, danger: opts.danger, confirmLabel: opts.confirmLabel, resolve })
  }), [])

  const resolveConfirm = (result) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}

        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="toast-icon">
                {t.type === 'success' && <IconCheck />}
                {t.type === 'error' && <IconAlert />}
                {t.type === 'info' && <IconInfo />}
              </span>
              <span className="toast-msg">{t.message}</span>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Zamknij"><IconClose width={11} height={11} /></button>
            </div>
          ))}
        </div>

        {confirmState && (
          <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && resolveConfirm(false)}>
            <div className="modal confirm-modal" role="alertdialog" aria-modal="true">
              <h3 className="modal-title">{confirmState.message}</h3>
              {confirmState.detail && <p className="confirm-detail">{confirmState.detail}</p>}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => resolveConfirm(false)}>Anuluj</button>
                <button className={`btn ${confirmState.danger ? 'btn-danger' : ''}`} onClick={() => resolveConfirm(true)} autoFocus>
                  {confirmState.confirmLabel || 'Potwierdź'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
export const useConfirm = () => useContext(ConfirmCtx)
