// Shared "gradient title + underline bar" pattern used across modals and empty states.
export default function PixelHeading({
  children,
  size = 11,
  letterSpacing = '1px',
  center = false,
  marginBottom = 24,
  underlineWidth = 36,
  plain = false,
  danger = false,
}) {
  return (
    <div style={{ marginBottom, textAlign: center ? 'center' : undefined }}>
      <div style={{
        fontFamily: plain ? "'Roboto', sans-serif" : "'Press Start 2P', monospace",
        fontSize: plain ? '14px' : `${size}px`,
        fontWeight: plain ? 700 : undefined,
        textTransform: plain ? 'uppercase' : undefined,
        color: danger ? 'var(--red)' : plain ? 'var(--text)' : undefined,
        background: !plain && !danger ? 'var(--accent-gradient)' : undefined,
        WebkitBackgroundClip: !plain && !danger ? 'text' : undefined,
        WebkitTextFillColor: !plain && !danger ? 'transparent' : undefined,
        backgroundClip: !plain && !danger ? 'text' : undefined,
        letterSpacing,
      }}>
        {children}
      </div>
      <div style={{
        width: `${underlineWidth}px`, height: '3px', borderRadius: '2px',
        marginTop: '12px',
        margin: center ? '12px auto 0' : '12px 0 0',
        background: danger ? 'var(--red)' : 'var(--accent-gradient)',
      }} />
    </div>
  )
}
