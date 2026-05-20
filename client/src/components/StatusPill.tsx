export function StatusPill({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status-pill ${tone || String(children).toLowerCase().replace(/\s+/g, "-")}`}>{children}</span>;
}

