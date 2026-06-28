'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { Toast } from './Toast'

type ToastType = 'success' | 'error'

type GlobalToastContextType = {
  showToast: (message: string, type?: ToastType) => void
}

const GlobalToastContext = createContext<GlobalToastContextType>({ showToast: () => {} })

export function GlobalToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type, key: Date.now() })
  }, [])

  return (
    <GlobalToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </GlobalToastContext.Provider>
  )
}

export function useGlobalToast() {
  return useContext(GlobalToastContext)
}
