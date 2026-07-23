import { Suspense } from 'react'
import ManageEvaluationsPage from './manage-client'

export default function ManageEvaluationsPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center">
          <div className="cyber-card rounded-2xl p-8 text-muted">加载评测工作台...</div>
        </main>
      }
    >
      <ManageEvaluationsPage />
    </Suspense>
  )
}
