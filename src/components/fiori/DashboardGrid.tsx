// Fiori analytic grid — auto-fill tiles, collapses to 1 col on mobile (CSS in globals).
export function DashboardGrid({ children }: { children: React.ReactNode }) {
  return <div className="fiori-grid">{children}</div>
}
