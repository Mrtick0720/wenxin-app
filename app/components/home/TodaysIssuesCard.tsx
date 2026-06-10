import NavLink from '../NavLink'

export type IssueTone = 'red' | 'yellow' | 'blue'

export interface IssueRow {
  tone: IssueTone
  title: string
  detail: string
  link: string
}

const TONE_STYLES: Record<IssueTone, { bg: string; title: string; detail: string; icon: string }> = {
  red: { bg: 'bg-red-50', title: 'text-red-700', detail: 'text-red-500', icon: 'text-red-500' },
  yellow: { bg: 'bg-yellow-50', title: 'text-yellow-800', detail: 'text-yellow-700', icon: 'text-yellow-600' },
  blue: { bg: 'bg-blue-50', title: 'text-blue-700', detail: 'text-blue-500', icon: 'text-blue-500' },
}

const TONE_ICONS: Record<IssueTone, React.ReactNode> = {
  red: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  yellow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  blue: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
}

interface TodaysIssuesCardProps {
  issues: IssueRow[]
  dateLabel: string
}

export default function TodaysIssuesCard({ issues, dateLabel }: TodaysIssuesCardProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-semibold text-gray-800">Today&apos;s Issues</span>
        <span className="text-xs text-gray-400">{dateLabel}</span>
      </div>
      {issues.length === 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-green-500 font-medium">✓ No Issues Today</div>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, i) => {
            const tone = TONE_STYLES[issue.tone]
            return (
              <NavLink key={i} href={issue.link} className={`${tone.bg} rounded-xl px-4 py-3 flex items-center gap-3 block`}>
                <span className={`flex-shrink-0 ${tone.icon}`}>{TONE_ICONS[issue.tone]}</span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${tone.title} truncate`}>{issue.title}</span>
                  <span className={`block text-xs ${tone.detail} truncate mt-0.5`}>{issue.detail}</span>
                </span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
