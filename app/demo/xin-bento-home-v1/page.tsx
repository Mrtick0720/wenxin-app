'use client'

/**
 * DEMO — Xin Bento customer Home (v1)
 * Route: /demo/xin-bento-home-v1
 *
 * Self-contained mobile-first demo. Mock data only — no APIs, no DB, no real auth.
 * Renders as a full-screen overlay (z above the owner GlobalBottomNav, z-[300])
 * so it does NOT touch or collide with the existing owner dashboard chrome.
 *
 * Product framing (see xin bento-app/docs): Meal Program Platform, NOT a
 * food-delivery marketplace. Two engines on one page:
 *   • Meal Program Engine — Student (Selectable: tomorrow's pick, T-2 lock)
 *   • Care Meal Engine     — Elderly (Managed: delivery confirmation, care note)
 */

import { useState } from 'react'

// ---------------------------------------------------------------- mock data
const family = {
  greetingName: 'Mei',
  familyName: 'Tan Family',
  todayLabel: 'Tuesday, 17 June',
}

const student = {
  recipient: 'Ming',
  relation: 'Your son · Std 4',
  program: 'Student Lunch Program',
  style: 'Selectable',
  tomorrow: { day: 'Wed 18 Jun', variant: 'Signature Bento', note: 'Grilled chicken · rice · greens', locked: true },
  nextDeadline: { day: 'Thu 19 Jun', closesText: 'closes tonight · 8:00 PM', needsPick: true },
}

const elderly = {
  recipient: 'Mama',
  relation: 'Your mother · Likas',
  program: 'Elderly Care Meal Program',
  style: 'Managed',
  today: { delivered: true, time: '12:15 PM', note: 'Mama enjoyed the fish porridge and finished it 🌷' },
  tomorrow: { planned: 'Chicken & soft greens porridge', day: 'Wed 18 Jun' },
}

// ---------------------------------------------------------------- tiny icons
function Icon({ name, active }: { name: string; active?: boolean }) {
  const c = active ? '#F0813A' : '#A8A29E'
  const sw = 1.8
  const common = { fill: 'none', stroke: c, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':
      return <svg width="24" height="24" viewBox="0 0 24 24"><path {...common} d="M4 11l8-6 8 6" /><path {...common} d="M6 10v9h12v-9" /></svg>
    case 'menu':
      return <svg width="24" height="24" viewBox="0 0 24 24"><rect {...common} x="4" y="5" width="16" height="14" rx="3" /><path {...common} d="M8 10h8M8 14h5" /></svg>
    case 'plan':
      return <svg width="24" height="24" viewBox="0 0 24 24"><rect {...common} x="4" y="5" width="16" height="15" rx="3" /><path {...common} d="M4 9h16M9 3v3M15 3v3" /></svg>
    case 'journal':
      return <svg width="24" height="24" viewBox="0 0 24 24"><path {...common} d="M6 4h11a2 2 0 012 2v14H8a2 2 0 01-2-2z" /><path {...common} d="M6 4a2 2 0 00-2 2v12a2 2 0 002 2" /><path {...common} d="M10 9h6M10 13h4" /></svg>
    case 'account':
      return <svg width="24" height="24" viewBox="0 0 24 24"><circle {...common} cx="12" cy="9" r="3.2" /><path {...common} d="M5.5 19a6.5 6.5 0 0113 0" /></svg>
    default:
      return null
  }
}

// ---------------------------------------------------------------- hero art
function HeroArt() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-28" aria-hidden>
      {/* sun */}
      <circle cx="98" cy="20" r="11" fill="#FFD27A" />
      <g stroke="#FFC24D" strokeWidth="2.2" strokeLinecap="round">
        <path d="M98 3v5M113 20h5M86 9l3 3M110 9l-3 3" />
      </g>
      {/* bento box */}
      <rect x="14" y="34" width="60" height="34" rx="9" fill="#FFFFFF" stroke="#FFB48A" strokeWidth="2.5" />
      <line x1="44" y1="36" x2="44" y2="66" stroke="#FFD9C2" strokeWidth="2.5" />
      <circle cx="29" cy="48" r="6" fill="#9BD27E" />
      <rect x="24" y="56" width="14" height="6" rx="3" fill="#FF9E73" />
      <circle cx="59" cy="46" r="5" fill="#FF8FA3" />
      <rect x="50" y="55" width="16" height="6" rx="3" fill="#FFCB6B" />
      {/* steam / sparkle */}
      <g stroke="#FFB48A" strokeWidth="2" strokeLinecap="round" opacity="0.8">
        <path d="M30 28c2-3-2-5 0-8M48 26c2-3-2-5 0-8" />
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------- small bits
function Chip({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'amber' | 'rose' | 'sky' }) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-600 ring-rose-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>
}

// ================================================================ page
export default function XinBentoHomeDemo() {
  const [tab, setTab] = useState<'all' | 'child' | 'parent'>('all')
  const [toast, setToast] = useState<string | null>(null)
  const ping = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 1900)
  }

  const showChild = tab === 'all' || tab === 'child'
  const showParent = tab === 'all' || tab === 'parent'

  return (
    <div
      className="fixed inset-0 z-[500] overflow-y-auto"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
      }}
    >
      <div className="min-h-full bg-gradient-to-b from-[#FFF4E8] via-[#FFF9F3] to-[#FBFBFD] text-stone-800">
        <div
          className="mx-auto max-w-md px-5 pb-28"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
        >
          {/* ---------------------------------------------- 1. Header */}
          <header className="flex items-start justify-between pt-2">
            <div>
              <div className="text-lg font-extrabold tracking-tight text-[#F0813A]">
                xin bento<span className="text-stone-400 font-bold"> 🍱</span>
              </div>
              <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-stone-800">
                Good morning,<br />{family.greetingName} 👋
              </h1>
              <p className="mt-1 text-sm text-stone-500">{family.todayLabel}</p>
            </div>
            <button
              onClick={() => ping('Account is mocked in this demo')}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-base font-bold text-[#F0813A] shadow-sm ring-1 ring-black/5"
              aria-label="Family account"
            >
              T
            </button>
          </header>

          {/* warm hero illustration area */}
          <div className="mt-4 flex items-center justify-between rounded-3xl bg-gradient-to-br from-[#FFE3C7] to-[#FFD9E2] px-5 py-4 ring-1 ring-black/5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700/70">{family.familyName}</p>
              <p className="mt-1 text-[15px] font-bold text-stone-700">2 meal programs, all cared for ✨</p>
            </div>
            <HeroArt />
          </div>

          {/* ---------------------------------------------- 2. Main status card */}
          <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-2xl">☀️</div>
              <div>
                <h2 className="text-lg font-extrabold text-stone-800">Today is taken care of</h2>
                <p className="text-sm text-stone-500">Both programs are on track</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-amber-50/70 p-3">
                <p className="text-xs font-semibold text-amber-700/80">Ming · Student</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-bold text-stone-700">
                  <span className="text-emerald-500">✓</span> Tomorrow arranged
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50/70 p-3">
                <p className="text-xs font-semibold text-rose-500/90">Mama · Care</p>
                <p className="mt-1 flex items-center gap-1 text-sm font-bold text-stone-700">
                  <span className="text-emerald-500">✓</span> Lunch delivered
                </p>
              </div>
            </div>

            {/* the single thing that needs the user */}
            <button
              onClick={() => ping('Opening Thursday’s lunch selection…')}
              className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[#FFF3E6] px-4 py-3 text-left ring-1 ring-amber-200/70 active:scale-[0.99] transition"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-white text-xs">1</span>
                Choose Ming’s Thursday lunch · before 8:00 PM
              </span>
              <span className="text-amber-500">›</span>
            </button>
          </section>

          {/* ---------------------------------------------- 3. Program switcher */}
          <div className="mt-6 flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
            {([
              ['all', 'Both'],
              ['child', 'Ming'],
              ['parent', 'Mama'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
                  tab === key ? 'bg-[#F0813A] text-white shadow' : 'text-stone-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ---------------------------------------------- 4. Student card (Selectable) */}
          {showChild && (
            <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-xl">🎒</div>
                  <div>
                    <p className="text-[15px] font-extrabold text-stone-800">{student.program}</p>
                    <p className="text-xs text-stone-500">{student.recipient} · {student.relation}</p>
                  </div>
                </div>
                <Chip tone="amber">{student.style}</Chip>
              </div>

              <div className="mt-4 rounded-2xl bg-amber-50/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/70">Tomorrow · {student.tomorrow.day}</p>
                  <Chip tone="green">Locked ✓</Chip>
                </div>
                <p className="mt-2 text-lg font-extrabold text-stone-800">{student.tomorrow.variant}</p>
                <p className="text-sm text-stone-500">{student.tomorrow.note}</p>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#FFF3E6] px-4 py-3 ring-1 ring-amber-200/60">
                <span className="text-lg">⏳</span>
                <p className="text-sm font-semibold text-amber-800">
                  {student.nextDeadline.day} selection {student.nextDeadline.closesText}
                </p>
              </div>

              <button
                onClick={() => ping('View / change selection (mock)')}
                className="mt-4 w-full rounded-2xl bg-[#F0813A] py-3 text-sm font-bold text-white shadow-sm active:scale-[0.99] transition"
              >
                View / Change Selection
              </button>
            </section>
          )}

          {/* ---------------------------------------------- 5. Elderly card (Managed) */}
          {showParent && (
            <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-xl">🌷</div>
                  <div>
                    <p className="text-[15px] font-extrabold text-stone-800">{elderly.program}</p>
                    <p className="text-xs text-stone-500">{elderly.recipient} · {elderly.relation}</p>
                  </div>
                </div>
                <Chip tone="rose">{elderly.style}</Chip>
              </div>

              {/* today delivered */}
              <div className="mt-4 rounded-2xl bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-extrabold text-emerald-700">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white text-xs">✓</span>
                    Today’s lunch delivered
                  </span>
                  <span className="text-sm font-semibold text-emerald-600">{elderly.today.time}</span>
                </div>
                <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm italic text-stone-600">
                  “{elderly.today.note}”
                </p>
              </div>

              {/* tomorrow arranged */}
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-rose-50/60 p-4">
                <span className="text-lg">🍲</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-500/80">Tomorrow · {elderly.tomorrow.day}</p>
                  <p className="text-sm font-bold text-stone-700">{elderly.tomorrow.planned}</p>
                </div>
              </div>

              <button
                onClick={() => ping('Opening care log (mock)')}
                className="mt-4 w-full rounded-2xl bg-rose-400 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.99] transition"
              >
                View Care Log
              </button>
            </section>
          )}

          {/* ---------------------------------------------- 6. Upcoming timeline */}
          <section className="mt-6">
            <h3 className="px-1 text-sm font-extrabold uppercase tracking-wide text-stone-400">Upcoming</h3>
            <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              {[
                { dot: 'bg-emerald-400', title: 'Today · Mama’s lunch delivered', sub: '12:15 PM · confirmed with photo', tag: <Chip tone="green">Done</Chip> },
                { dot: 'bg-amber-400', title: 'Tomorrow · Ming’s Signature Bento', sub: 'Wed 18 Jun · locked & arranged', tag: <Chip tone="amber">Planned</Chip> },
                { dot: 'bg-rose-400', title: 'Next deadline · Thursday selection', sub: 'Closes tonight · 8:00 PM', tag: <Chip tone="rose">Action</Chip> },
              ].map((row, i, arr) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${row.dot}`} />
                    {i < arr.length - 1 && <span className="mt-1 h-8 w-px bg-stone-200" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-stone-700">{row.title}</p>
                      {row.tag}
                    </div>
                    <p className="text-xs text-stone-400">{row.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-stone-400">
            Xin Bento — meals managed with care, not a marketplace.
          </p>
        </div>

        {/* ---------------------------------------------- 7. Bottom navigation */}
        <nav
          className="fixed bottom-0 left-1/2 z-[510] w-full max-w-md -translate-x-1/2 border-t border-stone-100 bg-white/95 backdrop-blur"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
        >
          <div className="flex items-stretch justify-around px-2 pt-2">
            {[
              ['home', 'Home'],
              ['menu', 'Menu'],
              ['plan', 'Plan'],
              ['journal', 'Journal'],
              ['account', 'Account'],
            ].map(([key, label], i) => {
              const active = i === 0
              return (
                <button
                  key={key}
                  onClick={() => !active && ping(`${label} is mocked in this demo`)}
                  className="flex flex-1 flex-col items-center gap-1 py-1"
                >
                  <Icon name={key} active={active} />
                  <span className={`text-[11px] font-semibold ${active ? 'text-[#F0813A]' : 'text-stone-400'}`}>{label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* ---------------------------------------------- toast */}
        {toast && (
          <div className="fixed bottom-24 left-1/2 z-[520] -translate-x-1/2 rounded-full bg-stone-800/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
