'use client'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-slide-in" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}
