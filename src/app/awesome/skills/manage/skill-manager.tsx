'use client'

import React, { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  AWESOME_SKILL_CATEGORIES,
  AWESOME_SKILL_COMPATIBILITY,
  AWESOME_SKILL_EFFORTS,
  AWESOME_SKILL_KINDS,
  AWESOME_SKILL_MATURITY,
  AWESOME_SKILL_PERMISSIONS,
  AWESOME_SKILL_SCHEMA,
} from '@/content/awesome-skills'
import type {
  listManagedAgentSkills,
  ManagedSkillInput,
} from '@/modules/candidate/skill-catalog-management'
import styles from './skill-manager.module.css'

type ManagedSkill = Awaited<ReturnType<typeof listManagedAgentSkills>>[number]
type MultiField = 'kinds' | 'compatibility' | 'permissions'

const STATUS_LABELS = {
  watching: '已收录',
  evaluating: '评估中',
  dropped: '已归档',
} as const

function emptySkill(): ManagedSkillInput {
  return {
    title: '',
    summary: '',
    websiteUrl: '',
    sourceUrl: '',
    status: 'watching',
    dossier: {
      schema: AWESOME_SKILL_SCHEMA,
      upstreamName: '',
      category: 'creation',
      kinds: ['instructions'],
      compatibility: ['generic'],
      permissions: ['read-only'],
      maturity: 'collected',
      effort: '30-min',
      license: 'REVIEW REQUIRED',
      licenseStatus: 'review',
      artifact: '',
      whyItMatters: '',
      firstLook: '',
      auditNote: '',
      skillUrl: '',
    },
  }
}

export function AgentSkillManager({ initialSkills }: { initialSkills: ManagedSkill[] }) {
  const [skills, setSkills] = useState(initialSkills)
  const [draft, setDraft] = useState<ManagedSkillInput>(emptySkill)
  const [selected, setSelected] = useState<{ id: string; updatedAt: string } | null>(null)
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('all')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const visible = useMemo(() => skills.filter((skill) => {
    if (stage !== 'all' && skill.dossier?.maturity !== stage) return false
    if (!query.trim()) return true
    const needle = query.trim().toLocaleLowerCase()
    return [skill.title, skill.summary || '', skill.slug, skill.dossier?.upstreamName || '']
      .some((value) => value.toLocaleLowerCase().includes(needle))
  }), [skills, query, stage])

  function setField<K extends keyof ManagedSkillInput>(key: K, value: ManagedSkillInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setDossierField<K extends keyof ManagedSkillInput['dossier']>(
    key: K,
    value: ManagedSkillInput['dossier'][K],
  ) {
    setDraft((current) => ({ ...current, dossier: { ...current.dossier, [key]: value } }))
  }

  function toggleDossierOption(key: MultiField, value: string) {
    setDraft((current) => {
      const values: string[] = current.dossier[key]
      return {
        ...current,
        dossier: {
          ...current.dossier,
          [key]: values.includes(value)
            ? values.filter((item) => item !== value)
            : [...values, value],
        },
      }
    })
  }

  function startEditing(skill: ManagedSkill) {
    if (!skill.dossier || skill.status === 'promoted') {
      setError('这条记录的结构化资料缺失或已晋升，请先从原始数据修复；不会覆盖它。')
      return
    }
    setSelected({ id: skill.id, updatedAt: skill.updatedAt })
    setDraft({
      title: skill.title,
      summary: skill.summary || '',
      websiteUrl: skill.websiteUrl || '',
      sourceUrl: skill.sourceUrl || '',
      status: skill.status as ManagedSkillInput['status'],
      dossier: { ...skill.dossier, promptSlug: skill.dossier.promptSlug || undefined },
    })
    setNotice('')
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/awesome/skills/manage', {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, ...(selected || {}) }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        const messages: Record<string, string> = {
          ERR_SKILL_CATALOG_VALIDATION: '字段未填全或格式无效；检查来源地址、说明和至少一个权限/兼容选项。',
          ERR_SKILL_CATALOG_DUPLICATE: '目录中已有同名条目；请打开现有记录编辑。',
          ERR_SKILL_CATALOG_SOURCE_DUPLICATE: '该 Skill 文件已在目录中，请打开现有记录编辑。',
          ERR_SKILL_CATALOG_CONFLICT: '这条记录已被另一处修改；请刷新页面后重新打开，避免覆盖。',
          ERR_SKILL_CATALOG_NOT_FOUND: '条目已不存在或不属于 Agent Skill 目录。',
          ERR_SKILL_CATALOG_PROMPT_NOT_PUBLISHED: '关联的 Prompt 必须是已发布条目；也可以先留空。',
        }
        throw new Error(messages[payload.error || ''] || '保存失败，请稍后重试。')
      }
      const refreshed = await fetch('/api/awesome/skills/manage', { cache: 'no-store' })
      if (!refreshed.ok) throw new Error('已保存，但更新列表失败，请刷新页面。')
      const result = await refreshed.json() as { skills: ManagedSkill[] }
      setSkills(result.skills)
      setSelected(null)
      setDraft(emptySkill())
      setNotice('已保存。新条目进入目录，不会自动安装或执行 Skill。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p>AWESOME / SKILL CATALOG / MANAGE</p>
          <h1>Skill 库管理中心</h1>
          <span>这里只管理 Agent Skill 的来源、权限与评估记录；可执行 Prompt 仍在独立提示库中。</span>
        </div>
        <div className={styles.headerLinks}>
          <Link href="/awesome/skills">返回 Skill 目录 ↗</Link>
          <Link href="/skills/manage">管理可执行 Prompt ↗</Link>
          <a href="/api/awesome/skills/manage?export=1" download>导出目录 JSON ↓</a>
        </div>
      </header>

      <div className={styles.stats} aria-label="目录状态">
        <span>{skills.length} TOTAL</span>
        <span>{skills.filter((skill) => skill.dossier && skill.dossier.maturity !== 'collected').length} INSPECTED</span>
        <span>{skills.filter((skill) => skill.dossier?.licenseStatus === 'review').length} LICENSE REVIEW</span>
        <span>{skills.filter((skill) => skill.status === 'dropped').length} ARCHIVED</span>
      </div>

      <div className={styles.columns}>
        <section className={styles.inventory} aria-labelledby="inventory-title">
          <div className={styles.sectionTitle}>
            <h2 id="inventory-title">目录清单</h2>
            <button type="button" disabled={pending} onClick={() => { setSelected(null); setDraft(emptySkill()); setError(''); setNotice('') }}>+ 新收录</button>
          </div>
          <div className={styles.inventoryControls}>
            <label htmlFor="catalog-search">搜索名称、来源或 slug</label>
            <input id="catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如 Sepia" />
            <label htmlFor="catalog-stage">成熟度</label>
            <select id="catalog-stage" value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="all">全部阶段</option>
              {AWESOME_SKILL_MATURITY.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <ul className={styles.inventoryList}>
            {visible.map((skill) => (
              <li key={skill.id} className={selected?.id === skill.id ? styles.selected : ''}>
                <div>
                  <strong>{skill.title}</strong>
                  <small>{skill.dossier?.upstreamName || '元数据需修复'}</small>
                  <span>{skill.dossier?.maturity.toUpperCase() || 'UNKNOWN'} · {STATUS_LABELS[skill.status as keyof typeof STATUS_LABELS] || skill.status}</span>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" disabled={pending} onClick={() => startEditing(skill)}>编辑</button>
                  <Link href={`/awesome/skills?skill=${encodeURIComponent(skill.slug)}`}>公开页 ↗</Link>
                </div>
              </li>
            ))}
            {visible.length === 0 ? <li className={styles.empty}>没有符合筛选条件的 Skill。</li> : null}
          </ul>
        </section>

        <section className={styles.editor} aria-labelledby="catalog-editor-title">
          <div className={styles.sectionTitle}>
            <h2 id="catalog-editor-title">{selected ? '编辑 Skill 档案' : '新建 Skill 档案'}</h2>
            <span>{selected ? 'ID 和 URL slug 保持不变' : '先记录，再独立审核与试用'}</span>
          </div>
          <form onSubmit={save} className={styles.form}>
            <div className={styles.formGrid}>
              <label>名称<input required minLength={2} value={draft.title} onChange={(event) => setField('title', event.target.value)} /></label>
              <label>上游名称<input required minLength={2} value={draft.dossier.upstreamName} onChange={(event) => setDossierField('upstreamName', event.target.value)} placeholder="owner/repository · skill" /></label>
              <label className={styles.full}>一句话说明<input required minLength={8} value={draft.summary} onChange={(event) => setField('summary', event.target.value)} /></label>
              <label>项目来源 URL<input required type="url" value={draft.sourceUrl} onChange={(event) => setField('sourceUrl', event.target.value)} /></label>
              <label>Skill 文件 URL<input required type="url" value={draft.dossier.skillUrl} onChange={(event) => setDossierField('skillUrl', event.target.value)} /></label>
              <label>项目主页 URL<input required type="url" value={draft.websiteUrl} onChange={(event) => setField('websiteUrl', event.target.value)} /></label>
              <label>交付产物<input required value={draft.dossier.artifact} onChange={(event) => setDossierField('artifact', event.target.value)} /></label>
              <label>领域<select value={draft.dossier.category} onChange={(event) => setDossierField('category', event.target.value)}>{AWESOME_SKILL_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label>目录状态<select value={draft.status} onChange={(event) => setField('status', event.target.value as ManagedSkillInput['status'])}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>成熟度<select value={draft.dossier.maturity} onChange={(event) => setDossierField('maturity', event.target.value)}>{AWESOME_SKILL_MATURITY.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label>试用成本<select value={draft.dossier.effort} onChange={(event) => setDossierField('effort', event.target.value)}>{AWESOME_SKILL_EFFORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label>许可证<input required value={draft.dossier.license} onChange={(event) => setDossierField('license', event.target.value)} /></label>
              <label>许可状态<select value={draft.dossier.licenseStatus} onChange={(event) => setDossierField('licenseStatus', event.target.value as ManagedSkillInput['dossier']['licenseStatus'])}><option value="review">待核对</option><option value="clear">已确认</option><option value="restricted">受限制</option></select></label>
            </div>

            {([
              ['kinds', '包内能力', AWESOME_SKILL_KINDS],
              ['compatibility', '兼容平台', AWESOME_SKILL_COMPATIBILITY],
              ['permissions', '所需权限', AWESOME_SKILL_PERMISSIONS],
            ] as const).map(([key, title, options]) => (
              <fieldset key={key} className={styles.choiceGroup}>
                <legend>{title}（至少选择一项）</legend>
                <div>{options.map((option) => (
                  <label key={option.id}>
                    <input type="checkbox" checked={draft.dossier[key].includes(option.id)} onChange={() => toggleDossierOption(key, option.id)} />
                    {option.label}
                  </label>
                ))}</div>
              </fieldset>
            ))}

            <div className={styles.notes}>
              <label>为什么值得收录<textarea required minLength={10} rows={3} value={draft.dossier.whyItMatters} onChange={(event) => setDossierField('whyItMatters', event.target.value)} /></label>
              <label>第一次试用方案<textarea required minLength={10} rows={3} value={draft.dossier.firstLook} onChange={(event) => setDossierField('firstLook', event.target.value)} /></label>
              <label>审计与版本备注<textarea required minLength={10} rows={3} value={draft.dossier.auditNote} onChange={(event) => setDossierField('auditNote', event.target.value)} placeholder="版本/提交、权限、许可边界与尚未验证的结论" /></label>
              <label>关联的已发布 Prompt slug（可选）<input value={draft.dossier.promptSlug || ''} onChange={(event) => setDossierField('promptSlug', event.target.value)} /></label>
            </div>

            <div className={styles.actions}>
              <button type="submit" disabled={pending}>{pending ? '保存中…' : selected ? '保存修改' : '收录 Skill'}</button>
              {selected ? <button type="button" disabled={pending} onClick={() => { setSelected(null); setDraft(emptySkill()); setError('') }}>取消编辑</button> : null}
              <span>归档仅标记 ARCHIVED；公开目录仍可查看，记录与评分不删除。</span>
            </div>
            {error ? <p role="alert" className={styles.error}>{error}</p> : null}
            {notice ? <p role="status" className={styles.success}>{notice}</p> : null}
          </form>
        </section>
      </div>
    </div>
  )
}
