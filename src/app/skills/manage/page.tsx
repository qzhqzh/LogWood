import { Suspense } from 'react'
import ManageSkillsPage from './manage-client'

export default function ManageSkillsPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center">
          <div className="cyber-card rounded-2xl p-8 text-muted">加载中...</div>
        </main>
      }
    >
      <ManageSkillsPage />
    </Suspense>
  )
}
