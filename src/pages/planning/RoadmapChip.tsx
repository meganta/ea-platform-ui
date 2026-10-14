export function Chip({ tone, children }: { tone?: string; children: any }) {
  return <span className={`rm-chip ${tone || 'muted'}`}>{children}</span>
}
