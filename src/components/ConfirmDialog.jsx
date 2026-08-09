import PixelHeading from './PixelHeading'

// Pixel-styled replacement for native alert()/confirm(), matching the app's own modal look.
export default function ConfirmDialog({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const isAlert = !onCancel

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(52,71,103,0.25)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300,
    }}>
      <div className="pixel-panel fade-up" style={{ width: '100%', maxWidth: '380px', padding: '32px 30px' }}>
        <PixelHeading danger={danger} marginBottom={16}>
          {title || (isAlert ? 'NOTICE' : 'CONFIRM')}
        </PixelHeading>

        <div style={{
          fontFamily: "'Roboto', sans-serif", fontSize: '14px', fontWeight: 300,
          color: 'var(--text)', lineHeight: 1.7, marginBottom: '28px', whiteSpace: 'pre-wrap',
        }}>
          {message}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-pixel"
            onClick={onConfirm}
            style={{ flex: 1, ...(danger ? { background: 'var(--red)', borderColor: 'var(--red)' } : {}) }}
            autoFocus
          >
            {confirmLabel}
          </button>
          {!isAlert && (
            <button className="btn-ghost" onClick={onCancel} style={{ flex: 1 }}>{cancelLabel}</button>
          )}
        </div>
      </div>
    </div>
  )
}
