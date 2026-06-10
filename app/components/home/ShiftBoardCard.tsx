import NavLink from '../NavLink'

// TODO: Replace PLACEHOLDER_SHIFTS with real staff scheduling data once a
// shifts table / API exists. Static UI placeholders only — same names as the
// previous hardcoded Shift Board.
const PLACEHOLDER_SHIFTS = [
  { name: 'Ah Ming', role: 'Kitchen', hours: '10:00 - 20:00', status: 'On Duty', avatarBg: 'bg-purple-500' },
  { name: 'Lina', role: 'Front', hours: '11:00 - 19:00', status: 'Incoming', avatarBg: 'bg-blue-500' },
] as const

export default function ShiftBoardCard() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold text-gray-800">Shift Board</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
        </svg>
      </div>
      <div className="space-y-2">
        {PLACEHOLDER_SHIFTS.map(shift => (
          <NavLink key={shift.name} href="/staff" className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 block">
            <span className={`w-9 h-9 rounded-full ${shift.avatarBg} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
              {shift.name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900 truncate">{shift.name}</span>
              <span className="block text-xs text-gray-500 truncate mt-0.5">{shift.role} · {shift.hours}</span>
            </span>
            <span className={`flex-shrink-0 text-xs font-medium rounded-full px-2.5 py-1 ${
              shift.status === 'On Duty' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {shift.status}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
