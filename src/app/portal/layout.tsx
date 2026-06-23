// The wholesale customer ordering portal is a distinct, customer-facing surface with
// its own hardcoded dark styling. The main app is light by default; this keeps the
// whole /portal subtree intentionally dark (the .dark class re-declares the dark palette
// for everything inside).
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</div>
}
