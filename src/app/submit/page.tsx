'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CustomSelect } from '@/components/custom-select'

const CATEGORIES = [
  '代码补全',
  '代码解释',
  '调试辅助',
  '重构建议',
  '单元测试',
  '文档生成',
  '多语言支持',
  '上下文理解',
]

interface Target {
  id: string
  name: string
  type: string
  slug: string
}

function SubmitForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedTargetId = searchParams.get('targetId')

  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    targetId: preselectedTargetId || '',
    category: '',
    rating: 5,
    content: '',
  })

  useEffect(() => {
    const fetchTargets = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/targets')
        const data = await res.json()
        setTargets(data.targets || [])
      } catch (err) {
        console.error('Failed to fetch targets:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTargets()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '提交失败')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const targetGroups = [
    {
      label: 'AI Editor',
      options: targets.filter(t => t.type === 'editor').map(t => ({ value: t.id, label: t.name })),
    },
    {
      label: 'AI Coding',
      options: targets.filter(t => t.type === 'coding').map(t => ({ value: t.id, label: t.name })),
    },
  ]

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="text-7xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold font-['Orbitron'] gradient-text mb-4">评测发布成功！</h2>
        <p className="text-gray-400">正在跳转到首页...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-cyan-400 mb-3 tracking-wide">
          选择工具 <span className="text-pink-500">*</span>
        </label>
        {loading ? (
          <div className="text-gray-500 cyber-card rounded-xl p-4">加载中...</div>
        ) : (
          <CustomSelect
            groups={targetGroups}
            value={formData.targetId}
            onChange={(value) => setFormData({ ...formData, targetId: value })}
            placeholder="请选择 AI 工具..."
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-cyan-400 mb-3 tracking-wide">
          功能分类 <span className="text-pink-500">*</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFormData({ ...formData, category: cat })}
              className={`px-4 py-2 rounded-xl text-sm transition-all duration-300 ${
                formData.category === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'cyber-card text-gray-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-cyan-400 mb-3 tracking-wide">
          评分 <span className="text-pink-500">*</span>
        </label>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setFormData({ ...formData, rating })}
              className={`w-14 h-14 rounded-xl text-2xl transition-all duration-300 ${
                rating <= formData.rating
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-yellow-500/25'
                  : 'cyber-card text-gray-500 hover:text-yellow-400'
              }`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-3">
          当前评分: <span className="text-yellow-400 font-bold">{formData.rating}</span> 分
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-cyan-400 mb-3 tracking-wide">
          评测内容 <span className="text-pink-500">*</span>
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="请分享你的使用体验（50-2000字）..."
          className="w-full px-4 py-4 cyber-input rounded-xl min-h-[200px]"
          minLength={50}
          maxLength={2000}
          required
        />
        <p className="text-sm text-gray-500 mt-3">
          <span className={formData.content.length < 50 ? 'text-pink-400' : 'text-cyan-400'}>
            {formData.content.length}
          </span>
          {' '}/ 2000 字
          {formData.content.length > 0 && formData.content.length < 50 && (
            <span className="text-pink-400 ml-2">（至少需要 50 字）</span>
          )}
        </p>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={submitting || !formData.targetId || !formData.category || formData.content.length < 50}
          className="flex-1 cyber-button py-4 rounded-xl font-bold text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> 提交中...
            </span>
          ) : (
            '发布评测'
          )}
        </button>
        <Link
          href="/"
          className="px-8 py-4 cyber-card rounded-xl text-gray-400 hover:text-white transition-colors"
        >
          取消
        </Link>
      </div>
    </form>
  )
}

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] grid-bg relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <nav className="border-b border-cyan-500/20 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">LW</span>
              </div>
              <span className="text-2xl font-bold font-['Orbitron'] gradient-text">LogWood</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/editor" className="text-gray-400 hover:text-cyan-400 transition-colors font-medium tracking-wide">
                AI Editor
              </Link>
              <Link href="/coding" className="text-gray-400 hover:text-purple-400 transition-colors font-medium tracking-wide">
                AI Coding
              </Link>
              <Link href="/submit" className="cyber-button px-5 py-2 rounded-lg font-semibold tracking-wide">
                发布评测
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="cyber-card rounded-3xl p-8">
          <div className="text-center mb-8">
            <div className="inline-block mb-4 px-4 py-1 border border-pink-500/30 rounded-full bg-pink-500/5">
              <span className="text-pink-400 text-sm tracking-widest uppercase">SHARE YOUR EXPERIENCE</span>
            </div>
            <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">发布评测</h1>
          </div>
          <Suspense fallback={<div className="text-center py-8 text-gray-500">加载中...</div>}>
            <SubmitForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
