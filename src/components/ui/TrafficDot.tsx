type Status = 'green' | 'amber' | 'red' | 'grey'

const COLOURS: Record<Status, string> = {
  green: 'bg-status-green',
  amber: 'bg-status-amber',
  red:   'bg-status-red',
  grey:  'bg-gray-400',
}

export function TrafficDot({ status }: { status: Status }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${COLOURS[status]}`} />
  )
}

/** Derive a traffic-light status from a margin percentage vs floor */
export function marginStatus(margin: number, floor: number): Status {
  if (margin >= floor * 1.1) return 'green'
  if (margin >= floor) return 'amber'
  return 'red'
}

/** Derive a traffic-light status for purchase cost vs rolling average */
export function costStatus(current: number, avg: number): Status {
  if (current <= avg) return 'green'
  if (current <= avg * 1.15) return 'amber'
  return 'red'
}
