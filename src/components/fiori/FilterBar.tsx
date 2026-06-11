// Fiori filter bar — presentational for slice 1.
// TODO(slice 2): make fields real <select>/<input> and wire "Go" to re-query.
function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="fiori-field-label">{label}</span>
      <span className="fiori-field">{value}</span>
    </label>
  )
}

export function FilterBar() {
  return (
    <div className="fiori-filterbar flex items-end gap-4 flex-wrap">
      <Field label="Posting Date" value="Last 12 weeks" />
      <Field label="Document Type" value="A/R Invoice" />
      <Field label="Customer Group" value="All" />
      <Field label="Item Group" value="All" />
      <div className="ml-auto flex items-center gap-4">
        <button type="button" className="fiori-details">Adapt Filters</button>
        <button type="button" className="fiori-go">Go</button>
      </div>
    </div>
  )
}
