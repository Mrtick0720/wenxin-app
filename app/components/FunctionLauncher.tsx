'use client'

import { useState } from 'react'
import Link from 'next/link'

const modules = [
  { href: '/dine-in', label: 'Dine-in', desc: 'Tables and service status' },
  { href: '/bento', label: 'Bento', desc: 'Orders, production, delivery' },
  { href: '/tasks', label: 'Approvals', desc: 'Tasks and approvals' },
  { href: '/purchase', label: 'Purchase', desc: 'Orders, receiving, suppliers' },
  { href: '/staff', label: 'Staff', desc: 'Schedule, attendance, HR' },
  { href: '/finance', label: 'Finance', desc: 'Revenue, cost, expenses' },
  { href: '/inventory', label: 'Inventory', desc: 'Stock and low-stock alerts' },
  { href: '/reports', label: 'Reports', desc: 'Revenue and trends' },
]

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export default function FunctionLauncher() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-50 h-14 w-14 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Open function launcher"
      >
        <GridIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close function launcher"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/25"
          />
          <div className="absolute left-0 right-0 bottom-0 max-h-[82vh] rounded-t-3xl bg-white px-4 pt-4 pb-7 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Function Launcher</div>
                <div className="text-xs text-gray-400">Wenxin operations</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {modules.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3 active:bg-orange-50"
                >
                  <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                  <div className="mt-1 text-xs text-gray-400">{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
