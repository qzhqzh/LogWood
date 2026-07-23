'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn, useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { SiteFooter } from '@/components/site-footer'

type SubjectType = 'target' | 'skill' | 'app' | 'candidate'
type ProtocolKey = 'skill' | 'model' | 'software' | 'resource'
type EvaluationStatus = 'draft' | 'published' | 'archived'
type EvaluationVerdict = 'verified' | 'conditional' | 'failed' | 'inconclusive'
type Reproducibility = 'untested' | 'single_run' | 'repeated' | 'reproduced'
type EvidenceType = 'url' | 'image' | 'log' | 'code' | 'file' | 'note'

interface SubjectOption {
  id: string
  label: string
  protocol: ProtocolKey
}

interface EvaluationItem {
  id: string
  title: string
  protocol: ProtocolKey
  protocolVersion: number
  status: EvaluationStatus
  verdict: EvaluationVerdict
  reproducibility: Reproducibility
  targetId?: string | null
  skillId?: string | null
  appId?: string | null
  candidateId?: string | null
  subjectVersion?: string | null
  task: string
  environment?: Record<string, string> | null
  input?: string | null
  procedure?: string | null
  output?: string | null
  evidence?: Array<{ type: EvidenceType; label: string; url?: string; note?: string }> | null
  scores?: Record<string, number> | null
  strengths?: string | null
  limitations?: string | null
  conclusion: string
  repeatCount: number
  testedAt: string
}

interface TargetResponseItem {
  id: string
  name: string
  type: string
}

interface NamedResponseItem {
  id: string
  title: string
}

interface ProtocolDefinition {
  label: string
  dimensions: Array<{ key: string; label: string }>
}

const dimension = (key: string, label: string) => ({ key, label })

const PROTOCOLS: Record<ProtocolKey, ProtocolDefinition> = {
  skill: {
    label: 'Skill 评测',
    dimensions: [
      dimension('instruction_following', '指令遵循'),
      dimension('output_quality', '输出质量'),
      dimension('reproducibility', '可复现性'),
      dimension('ease_of_use', '易上手程度'),
      dimension('compatibility', '兼容性'),
      dimension('cost_efficiency', '成本效率'),
      dimension('adaptability', '可修改性'),
      dimension('failure_boundaries', '失败边界'),
    ],
  },
  model: {
    label: '模型评测',
    dimensions: [
      dimension('task_success', '任务完成率'),
      dimension('reasoning_quality', '推理与生成质量'),
      dimension('stability', '稳定性'),
      dimension('speed', '速度'),
      dimension('cost', '成本'),
      dimension('context_tools', '上下文与工具调用'),
      dimension('controllability', '可控性'),
      dimension('privacy_safety', '隐私与安全边界'),
    ],
  },
  software: {
    label: '软件 / 服务评测',
    dimensions: [
      dimension('functional_value', '核心功能价值'),
      dimension('stability', '稳定性'),
      dimension('learning_cost', '学习成本'),
      dimension('integration', '集成能力'),
      dimension('performance', '性能'),
      dimension('price_value', '价格与价值'),
      dimension('privacy_control', '隐私与数据控制'),
      dimension('migration_cost', '迁移与替代成本'),
    ],
  },
  resource: {
    label: '资源评测',
    dimensions: [
      dimension('authority', '权威性'),
      dimension('freshness', '时效性'),
      dimension('depth', '深度'),
      dimension('usability', '可用性'),
      dimension('reproducibility', '可复现性'),
      dimension('time_value', '时间价值'),
      dimension('source_transparency', '来源透明度'),
    ],
  },
}

const STATUS_LABELS: Record<EvaluationStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

const ERROR_LABELS: Record<string, string> = {
  ERR_EVALUATION_PROTOCOL_MISMATCH: '评测协议与对象类型不匹配。',
  ERR_EVALUATION_SCORES: '维度评分必须使用当前协议字段，范围为 0-10。',
  ERR_EVALUATION_SCORES_INCOMPLETE: '发布正式评测前必须填写全部维度评分。',
  ERR_EVALUATION_PUBLICATION_INCOMPLETE: '发布前请补齐标题、测试任务和总体结论。',
  ERR_EVALUATION_EVIDENCE_REQUIRED: '发布前必须填写输出结果或至少一条证据。',
  ERR_EVALUATION_REPRODUCIBILITY_REQUIRED: '发布前必须选择复现级别。',
  ERR_EVALUATION_REPEAT_COUNT: '重复次数与复现级别不一致。',
}

const EVIDENCE_TYPES = new Set<EvidenceType>(['url', 'image', 'log', 'code', 'file', 'note'])

function evidenceToText(items?: EvaluationItem['evidence']): string {
  return (items || [])
    .map((item) => [item.type, item.label, item.url || '', item.note || ''].join('|'))
    .join('\n')
}

function parseEvidence(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [typeRaw, labelRaw, urlRaw, ...noteParts] = line.split('|')
      const rawType = typeRaw?.trim() as EvidenceType
      const type: EvidenceType = EVIDENCE_TYPES.has(rawType) ? rawType : 'note'
      return {
        type,
        label: (labelRaw || typeRaw || '证据').trim(),
        url: urlRaw?.trim() || undefined,
        note: noteParts.join('|').trim() || undefined,
      }
    })
}

function protocolForTarget(type: string): ProtocolKey {
  if (type === 'model') return 'model'
  if (type === 'editor' || type === 'coding') return 'software'
  return 'resource'
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="text-sm text-soft">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  required = false,
  mono = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  required?: boolean
  mono?: boolean
}) {
  return (
    <label className="block text-sm text-soft">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className={`mt-2 w-full cyber-input rounded-lg px-3 py-2 ${mono ? 'font-mono text-xs' : ''}`}
      />
    </label>
  )
}

export default function ManageEvaluationsPage() {
  const searchParams = useSearchParams()
  const requestedEditId = searchParams.get('edit')
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [subjects, setSubjects] = useState<Record<SubjectType, SubjectOption[]>>({
    target: [], skill: [], app: [], candidate: [],
  })
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [subjectType, setSubjectType] = useState<SubjectType>('skill')
  const [subjectId, setSubjectId] = useState('')
  const [protocol, setProtocol] = useState<ProtocolKey>('skill')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<EvaluationStatus>('draft')
  const [verdict, setVerdict] = useState<EvaluationVerdict>('inconclusive')
  const [reproducibility, setReproducibility] = useState<Reproducibility>('untested')
  const [subjectVersion, setSubjectVersion] = useState('')
  const [testedAt, setTestedAt] = useState(new Date().toISOString().slice(0, 10))
  const [repeatCount, setRepeatCount] = useState(1)
  const [task, setTask] = useState('')
  const [environment, setEnvironment] = useState<Record<string, string>>({})
  const [input, setInput] = useState('')
  const [procedure, setProcedure] = useState('')
  const [output, setOutput] = useState('')
  const [evidenceText, setEvidenceText] = useState('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [strengths, setStrengths] = useState('')
  const [limitations, setLimitations] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subjectOptions = subjects[subjectType]
  const dimensions = PROTOCOLS[protocol].dimensions
  const canSubmit = Boolean(
    title.trim().length >= 2 &&
    subjectId &&
    task.trim().length >= 3 &&
    conclusion.trim().length >= 3,
  )

  function resetForm() {
    setEditingId(null)
    setSubjectType('skill')
    setSubjectId('')
    setProtocol('skill')
    setTitle('')
    setStatus('draft')
    setVerdict('inconclusive')
    setReproducibility('untested')
    setSubjectVersion('')
    setTestedAt(new Date().toISOString().slice(0, 10))
    setRepeatCount(1)
    setTask('')
    setEnvironment({})
    setInput('')
    setProcedure('')
    setOutput('')
    setEvidenceText('')
    setScores({})
    setStrengths('')
    setLimitations('')
    setConclusion('')
    setError(null)
  }

  function resolveEvaluationSubject(item: EvaluationItem): { type: SubjectType; id: string } {
    if (item.skillId) return { type: 'skill', id: item.skillId }
    if (item.targetId) return { type: 'target', id: item.targetId }
    if (item.appId) return { type: 'app', id: item.appId }
    return { type: 'candidate', id: item.candidateId || '' }
  }

  function startEditing(item: EvaluationItem) {
    const subject = resolveEvaluationSubject(item)
    setEditingId(item.id)
    setSubjectType(subject.type)
    setSubjectId(subject.id)
    setProtocol(item.protocol)
    setTitle(item.title)
    setStatus(item.status)
    setVerdict(item.verdict)
    setReproducibility(item.reproducibility)
    setSubjectVersion(item.subjectVersion || '')
    setTestedAt(new Date(item.testedAt).toISOString().slice(0, 10))
    setRepeatCount(item.repeatCount)
    setTask(item.task)
    setEnvironment(item.environment || {})
    setInput(item.input || '')
    setProcedure(item.procedure || '')
    setOutput(item.output || '')
    setEvidenceText(evidenceToText(item.evidence))
    setScores(Object.fromEntries(Object.entries(item.scores || {}).map(([key, value]) => [key, String(value)])))
    setStrengths(item.strengths || '')
    setLimitations(item.limitations || '')
    setConclusion(item.conclusion)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadData() {
    const [targetRes, skillRes, appRes, candidateRes, evaluationRes] = await Promise.all([
      fetch('/api/targets', { cache: 'no-store' }),
      fetch('/api/skills?admin=1', { cache: 'no-store' }),
      fetch('/api/apps?manage=true', { cache: 'no-store' }),
      fetch('/api/candidates?admin=1', { cache: 'no-store' }),
      fetch('/api/evaluations?admin=1&pageSize=100', { cache: 'no-store' }),
    ])
    const [targetData, skillData, appData, candidateData, evaluationData] = await Promise.all([
      targetRes.json(), skillRes.json(), appRes.json(), candidateRes.json(), evaluationRes.json(),
    ])
    const failed = [targetRes, skillRes, appRes, candidateRes, evaluationRes].find((response) => !response.ok)
    if (failed) throw new Error('加载评测工作台数据失败')

    const targetItems = (targetData.targets || []) as TargetResponseItem[]
    const skillItems = (skillData.skills || []) as NamedResponseItem[]
    const appItems = (appData.apps || []) as NamedResponseItem[]
    const candidateItems = (candidateData.candidates || []) as NamedResponseItem[]

    setSubjects({
      target: targetItems.map((item) => ({
        id: item.id,
        label: `${item.name} · ${item.type}`,
        protocol: protocolForTarget(item.type),
      })),
      skill: skillItems.map((item) => ({ id: item.id, label: item.title, protocol: 'skill' })),
      app: appItems.map((item) => ({ id: item.id, label: item.title, protocol: 'resource' })),
      candidate: candidateItems.map((item) => ({ id: item.id, label: item.title, protocol: 'resource' })),
    })
    setEvaluations((evaluationData.evaluations || []) as EvaluationItem[])
  }

  useEffect(() => {
    if (!isAdmin) return
    loadData().catch((loadError) => setError(loadError instanceof Error ? loadError.message : '加载失败'))
  }, [isAdmin])

  useEffect(() => {
    if (!requestedEditId || evaluations.length === 0) return
    const item = evaluations.find((evaluation) => evaluation.id === requestedEditId)
    if (item) startEditing(item)
  }, [requestedEditId, evaluations])

  useEffect(() => {
    if (!subjectId) return
    const selected = subjectOptions.find((item) => item.id === subjectId)
    if (selected && selected.protocol !== protocol) {
      setProtocol(selected.protocol)
      setScores({})
    }
  }, [protocol, subjectId, subjectOptions])

  async function submitEvaluation(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) {
      setError('请至少填写评测对象、标题、任务和结论。')
      return
    }

    const parsedScores = Object.fromEntries(
      dimensions
        .map((item) => [item.key, scores[item.key]] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== undefined && entry[1] !== '')
        .map(([key, value]) => [key, Number(value)]),
    )

    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/evaluations', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          subjectType,
          subjectId,
          title,
          protocol,
          protocolVersion: 2,
          status,
          verdict,
          reproducibility,
          subjectVersion: subjectVersion.trim() || undefined,
          testedAt: new Date(`${testedAt}T12:00:00`).toISOString(),
          repeatCount,
          task,
          environment,
          input: input.trim() || undefined,
          procedure: procedure.trim() || undefined,
          output: output.trim() || undefined,
          evidence: parseEvidence(evidenceText),
          scores: parsedScores,
          strengths: strengths.trim() || undefined,
          limitations: limitations.trim() || undefined,
          conclusion,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(ERROR_LABELS[data.error] || data.error || '保存失败')
      resetForm()
      await loadData()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center">
        <div className="cyber-card rounded-2xl p-8 text-muted">检查登录状态...</div>
      </main>
    )
  }

  if (sessionStatus !== 'authenticated' || !isAdmin) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] grid-bg flex items-center justify-center px-4">
        <div className="cyber-card rounded-2xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">需要管理员</h1>
          <p className="text-muted mb-6">正式评测工作台当前仅对管理员开放。</p>
          <button
            type="button"
            onClick={() => signIn(undefined, { callbackUrl: '/evaluations/manage' })}
            className="cyber-button px-5 py-2 rounded-lg"
          >
            前往登录
          </button>
        </div>
      </main>
    )
  }

  const environmentFields = [
    ['model', '模型'],
    ['modelVersion', '模型版本'],
    ['software', '软件 / 工具'],
    ['softwareVersion', '软件版本'],
    ['operatingSystem', '操作系统'],
    ['hardware', '硬件'],
  ] as const

  return (
    <main className="min-h-screen bg-[var(--color-bg)] grid-bg relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs tracking-[0.25em] text-emerald-300 uppercase mb-2">EVALUATION V2</p>
            <h1 className="text-3xl font-bold font-['Orbitron'] gradient-text">正式评测工作台</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/evaluations" className="text-cyan-300 hover:text-cyan-200">公开评测</Link>
            <Link href="/" className="text-soft hover:text-muted">首页</Link>
          </div>
        </div>

        <form onSubmit={submitEvaluation} className="cyber-card rounded-2xl p-5 sm:p-7 mb-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">
              {editingId ? '编辑正式评测' : '新建正式评测'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-soft hover:text-muted">
                取消编辑
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className="text-sm text-soft">
              对象类型
              <select
                value={subjectType}
                onChange={(event) => {
                  const nextType = event.target.value as SubjectType
                  setSubjectType(nextType)
                  setSubjectId('')
                  setProtocol(nextType === 'skill' ? 'skill' : 'resource')
                  setScores({})
                }}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
              >
                <option value="skill">Skill</option>
                <option value="target">历史资源</option>
                <option value="candidate">灵感</option>
                <option value="app">项目 / 案例</option>
              </select>
            </label>
            <label className="text-sm text-soft">
              评测对象
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
                required
              >
                <option value="">请选择</option>
                {subjectOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-soft">
              协议
              <input
                value={PROTOCOLS[protocol].label}
                readOnly
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2 opacity-80"
              />
            </label>
            <label className="text-sm text-soft">
              状态
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as EvaluationStatus)}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <TextField label="标题" value={title} onChange={setTitle} required />
            <TextField
              label="对象版本"
              value={subjectVersion}
              onChange={setSubjectVersion}
              placeholder="例如 2026-07、v1.3.0"
            />
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <label className="text-sm text-soft">
              结论等级
              <select
                value={verdict}
                onChange={(event) => setVerdict(event.target.value as EvaluationVerdict)}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
              >
                <option value="inconclusive">证据不足</option>
                <option value="verified">已验证</option>
                <option value="conditional">有条件推荐</option>
                <option value="failed">未通过</option>
              </select>
            </label>
            <label className="text-sm text-soft">
              复现级别
              <select
                value={reproducibility}
                onChange={(event) => setReproducibility(event.target.value as Reproducibility)}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
              >
                <option value="untested">未复现</option>
                <option value="single_run">单次运行</option>
                <option value="repeated">重复运行</option>
                <option value="reproduced">独立复现</option>
              </select>
            </label>
            <label className="text-sm text-soft">
              重复次数
              <input
                type="number"
                min={1}
                max={999}
                value={repeatCount}
                onChange={(event) => setRepeatCount(Number(event.target.value))}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
              />
            </label>
            <label className="text-sm text-soft">
              测试日期
              <input
                type="date"
                value={testedAt}
                onChange={(event) => setTestedAt(event.target.value)}
                className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <TextAreaField label="测试任务" value={task} onChange={setTask} required />

          <section>
            <h3 className="font-semibold text-[var(--color-text-strong)] mb-3">测试环境</h3>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {environmentFields.map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={environment[key] || ''}
                  onChange={(value) => setEnvironment((current) => ({ ...current, [key]: value }))}
                />
              ))}
            </div>
            <div className="mt-3">
              <TextAreaField
                label="环境备注"
                value={environment.notes || ''}
                onChange={(value) => setEnvironment((current) => ({ ...current, notes: value }))}
                rows={2}
              />
            </div>
          </section>

          <div className="grid lg:grid-cols-3 gap-4">
            <TextAreaField label="输入与前置条件" value={input} onChange={setInput} rows={6} />
            <TextAreaField label="执行过程" value={procedure} onChange={setProcedure} rows={6} />
            <TextAreaField label="输出与结果" value={output} onChange={setOutput} rows={6} />
          </div>

          <section>
            <h3 className="font-semibold text-[var(--color-text-strong)] mb-1">维度评分（0-10）</h3>
            <p className="text-xs text-soft mb-3">草稿可以留空；发布时必须填写当前协议的全部维度。</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {dimensions.map((item) => (
                <label key={item.key} className="text-sm text-soft">
                  {item.label}
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={scores[item.key] || ''}
                    onChange={(event) => setScores((current) => ({ ...current, [item.key]: event.target.value }))}
                    className="mt-2 w-full cyber-input rounded-lg px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </section>

          <TextAreaField
            label="证据（每行：类型|标题|URL|备注）"
            value={evidenceText}
            onChange={setEvidenceText}
            rows={4}
            placeholder="url|代码提交|https://github.com/...|对应第二次运行"
            mono
          />

          <div className="grid lg:grid-cols-2 gap-4">
            <TextAreaField label="成功点" value={strengths} onChange={setStrengths} />
            <TextAreaField label="失败、限制与边界" value={limitations} onChange={setLimitations} />
          </div>
          <TextAreaField label="总体结论" value={conclusion} onChange={setConclusion} rows={5} required />

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="cyber-button px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '保存中...' : editingId ? '保存修改' : '创建正式评测'}
          </button>
        </form>

        <section>
          <h2 className="text-2xl font-bold font-['Orbitron'] gradient-text mb-4">已有评测</h2>
          <div className="space-y-3">
            {evaluations.map((item) => (
              <div key={item.id} className="cyber-card rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--color-text-strong)] truncate">{item.title}</p>
                  <p className="text-xs text-soft mt-1">
                    {PROTOCOLS[item.protocol].label} · {STATUS_LABELS[item.status]} · {new Date(item.testedAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                {item.status === 'published' && (
                  <Link href={`/evaluations/${item.id}`} className="text-sm text-cyan-300 hover:text-cyan-200">
                    查看
                  </Link>
                )}
                <button type="button" onClick={() => startEditing(item)} className="text-sm text-amber-300 hover:text-amber-200">
                  编辑
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  )
}
