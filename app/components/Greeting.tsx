'use client'

export default function Greeting() {
  const hour = new Date().getHours()

  let greeting = 'Good morning'
  let icon = '🌅'

  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning'
    icon = '🌤️'
  } else if (hour >= 12 && hour < 14) {
    greeting = 'Good noon'
    icon = '☀️'
  } else if (hour >= 14 && hour < 19) {
    greeting = 'Good afternoon'
    icon = '🌤️'
  } else if (hour >= 19 && hour < 23) {
    greeting = 'Good evening'
    icon = '🌙'
  } else {
    greeting = 'Working late'
    icon = '🌃'
  }

  const today = new Date()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dateStr = `${months[today.getMonth()]} ${today.getDate()} ${weekdays[today.getDay()]}`

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{icon} {greeting}, Bruce</h1>
      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
        {dateStr} · <span className="text-green-500 font-medium">● Open</span>
      </p>
    </div>
  )
}
