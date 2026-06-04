'use client'

export default function Greeting() {
  const hour = new Date().getHours()

  let greeting = '早上好'
  if (hour >= 12 && hour < 14) greeting = '中午好'
  else if (hour >= 14 && hour < 18) greeting = '下午好'
  else if (hour >= 18) greeting = '晚上好'

  const today = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 ${weekdays[today.getDay()]}`

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{greeting}，Bruce 👋</h1>
      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
        {dateStr} · <span className="text-green-500 font-medium">● 营业中</span>
      </p>
    </div>
  )
}
