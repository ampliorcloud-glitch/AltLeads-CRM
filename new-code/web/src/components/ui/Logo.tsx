/**
 * AltLeads wordmark logo. "Alt" in brand blue, "Leads" in near-black.
 * Used in the sidebar and on the login screen.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'lg' ? 24 : size === 'sm' ? 15 : 18;
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span style={{ color: 'var(--color-brand)' }}>Alt</span>
      <span style={{ color: 'var(--color-gray-900)' }}>Leads</span>
    </span>
  );
}
