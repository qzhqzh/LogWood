'use client'

import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { HostedSkillShelf, type PublishedSkill } from '@/components/hosted-skill-shelf'
import type {
  listHubTokens, listMyHubSkills, listPendingHubSkills,
} from '@/modules/agent-skill-hub/service'
import styles from './hub.module.css'

type MySkill = Awaited<ReturnType<typeof listMyHubSkills>>[number]
type PendingSkill = Awaited<ReturnType<typeof listPendingHubSkills>>[number]
type HubToken = Awaited<ReturnType<typeof listHubTokens>>[number]

const ERROR_MESSAGES: Record<string, string> = {
  ERR_SKILL_HUB_PATH: '文件路径不安全或重复；检查目录结构和隐藏文件。',
  ERR_SKILL_HUB_FILE_COUNT: '请选择一个包含 SKILL.md 的文件夹，文件数不能超过 80 个。',
  ERR_SKILL_HUB_FILE_SIZE: '文件包超过限制：单文件 3 MB，总计 8 MB。',
  ERR_SKILL_HUB_SKILL_MD: '根目录需要一个 UTF-8 编码的 SKILL.md。',
  ERR_SKILL_HUB_FRONTMATTER: 'SKILL.md 的 YAML 顶部需要合法的 name 和 description。',
  ERR_SKILL_HUB_FOLDER_NAME: '文件夹名必须与 SKILL.md 顶部的 name 一致。',
  ERR_SKILL_HUB_RIGHTS: '提交前请确认拥有发布与再分发这些文件的权利。',
  ERR_SKILL_HUB_PENDING: '已有待审核版本；请等审核结束后再同步新的改动。',
  ERR_SKILL_HUB_REJECTED: '该文件内容已被退回，请根据审核意见修改后再提交。',
  ERR_SKILL_HUB_QUEUE_LIMIT: '你已有 10 个待审版本，请先等审核完成。',
  ERR_SKILL_HUB_CONFLICT: '并发提交产生版本冲突，刷新页面后重试。',
  ERR_SKILL_HUB_TOKEN_LIMIT: '最多保留 5 个有效凭证，请先撤销旧凭证。',
  ERR_UNAUTHORIZED: '登录状态或发布凭证已失效，请重新登录。',
}

function downloadUrl(slug: string, version?: string) {
  return `/api/awesome/skills/hub/${encodeURIComponent(slug)}/download${version ? `?version=${encodeURIComponent(version)}` : ''}`
}

function errorFor(code?: string) {
  return ERROR_MESSAGES[code || ''] || '操作没有完成，请稍后重试。'
}

function fileManifest(json: string): { path: string; size: number }[] {
  try { return JSON.parse(json) as { path: string; size: number }[] } catch { return [] }
}

export function AgentSkillHub({ published, mine, queue, tokens, signedIn, admin }: {
  published: PublishedSkill[]
  mine: MySkill[]
  queue: PendingSkill[]
  tokens: HubToken[]
  signedIn: boolean
  admin: boolean
}) {
  const folderRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [paths, setPaths] = useState<string[]>([])
  const [skippedHidden, setSkippedHidden] = useState(0)
  const [folderName, setFolderName] = useState('')
  const [query, setQuery] = useState('')
  const [changelog, setChangelog] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [tokenLabel, setTokenLabel] = useState('我的电脑')
  const [oneTimeToken, setOneTimeToken] = useState('')
  const [activeTokens, setActiveTokens] = useState(tokens)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [siteOrigin, setSiteOrigin] = useState('https://your-logwood-site')

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '')
    folderRef.current?.setAttribute('directory', '')
    setSiteOrigin(window.location.origin)
  }, [])

  const visible = useMemo(() => published.filter((skill) => (
    `${skill.name} ${skill.description} ${skill.owner.name || ''}`.toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  )), [published, query])

  function selectFolder(input: HTMLInputElement) {
    const selected = Array.from(input.files || [])
    const chosen = selected.filter((file) => !file.webkitRelativePath.split('/').some((part) => part.startsWith('.')))
    setSkippedHidden(selected.length - chosen.length)
    const relative = chosen.map((file) => file.webkitRelativePath)
    const roots = new Set(relative.map((path) => path.split('/')[0]))
    if (roots.size !== 1 || relative.some((path) => !path.includes('/'))) {
      setError('请使用“选择文件夹”挑选同一个 Skill 目录。')
      setFiles([])
      return
    }
    const name = relative[0].split('/')[0]
    setFiles(chosen)
    setPaths(relative.map((path) => path.slice(name.length + 1)))
    setFolderName(name)
    setError('')
    setNotice('')
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!files.length || !paths.includes('SKILL.md')) {
      setError('选择包含根目录 SKILL.md 的文件夹。')
      return
    }
    setPending(true); setError(''); setNotice('')
    try {
      const form = new FormData()
      files.forEach((file) => form.append('file', file, file.name))
      form.set('paths', JSON.stringify(paths))
      form.set('folderName', folderName)
      form.set('changelog', changelog)
      form.set('rightsConfirmed', String(rightsConfirmed))
      const response = await fetch('/api/awesome/skills/hub', { method: 'POST', body: form })
      const result = await response.json() as { error?: string; version?: string; unchanged?: boolean }
      if (!response.ok) throw new Error(errorFor(result.error))
      setNotice(result.unchanged
        ? `文件未变化，当前 ${result.version} 版本已在仓库中。`
        : `已提交 ${result.version}，等待管理员审核；审核前不会公开下载。`)
      if (!result.unchanged) setTimeout(() => window.location.reload(), 1400)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '上传失败。')
    } finally { setPending(false) }
  }

  async function createToken() {
    setPending(true); setError(''); setOneTimeToken('')
    try {
      const response = await fetch('/api/awesome/skills/hub/tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: tokenLabel }),
      })
      const result = await response.json() as { error?: string; token?: string; id?: string; label?: string; expiresAt?: string }
      if (!response.ok) throw new Error(errorFor(result.error))
      setOneTimeToken(result.token || '')
      if (result.id && result.label && result.expiresAt) {
        setActiveTokens((current) => [{ id: result.id!, label: result.label!, expiresAt: new Date(result.expiresAt!), createdAt: new Date() }, ...current])
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '创建凭证失败。') }
    finally { setPending(false) }
  }

  async function revokeToken(id: string) {
    setPending(true); setError(''); setOneTimeToken('')
    try {
      const response = await fetch('/api/awesome/skills/hub/tokens', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(errorFor(result.error))
      setActiveTokens((current) => current.filter((item) => item.id !== id))
      setNotice('发布凭证已撤销。')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '撤销失败。') }
    finally { setPending(false) }
  }

  async function review(id: string, approve: boolean) {
    setPending(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/awesome/skills/hub/review/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve, note: reviewNotes[id] || '' }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(errorFor(result.error))
      window.location.reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '审核失败。') }
    finally { setPending(false) }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p>AWESOME / SKILLS / HUB</p>
        <h1>Skill Hub</h1>
        <span>提交文件夹 · 同步变更 · 审核版本 · 下载 ZIP。本站只托管与分发，不安装或执行上传的 Skill。</span>
        <div><Link href="/awesome/skills">返回外部 Skill 目录 ↗</Link><a href="#publish">提交 Skill ↓</a></div>
      </header>

      <section className={styles.discovery} aria-label="浏览可下载 Skill">
        <label>搜索已发布 Skill <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、描述或发布者" /></label>
        <p>{published.length} 个已发布 · {queue.length && admin ? `${queue.length} 个待审核 · ` : ''}每次下载对应固定版本和 SHA-256。</p>
      </section>
      <HostedSkillShelf skills={visible} />

      <section className={styles.panel} id="publish">
        <div className={styles.sectionTitle}><div><p>PUBLISH / SYNC</p><h2>提交你的 Skill</h2></div></div>
        {!signedIn ? <p>提交需要登录。<Link href="/auth/signin?callbackUrl=%2Fawesome%2Fskills%2Fhub">前往登录 →</Link></p> : (
          <form onSubmit={publish} className={styles.form}>
            <p>选择一个包含根目录 `SKILL.md` 的文件夹。其 `name` 需与文件夹同名；初次提交为 1.0.0，此后只为变化的文件生成新版本。</p>
            <label>Skill 文件夹<input ref={folderRef} type="file" multiple onChange={(event) => selectFolder(event.target)} required /></label>
            {files.length ? <small>{folderName} · {files.length} 个文件 · {paths.includes('SKILL.md') ? '已找到 SKILL.md' : '缺少 SKILL.md'}{skippedHidden ? ` · 已排除 ${skippedHidden} 个隐藏文件` : ''}</small> : null}
            <label>本次改动说明（可选）<textarea maxLength={1000} value={changelog} onChange={(event) => setChangelog(event.target.value)} placeholder="这版改了什么？" rows={2} /></label>
            <label className={styles.consent}><input type="checkbox" required checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />我有权发布并允许他人下载、使用这些文件；已检查敏感信息。</label>
            <button type="submit" disabled={pending}>{pending ? '正在检查文件…' : '提交待审核版本 →'}</button>
            <small>仅存储文件包；不执行其中的脚本。单文件 ≤ 3 MB，整包 ≤ 8 MB，最多 80 个文件。</small>
          </form>
        )}
      </section>

      {signedIn ? <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><p>MY RELEASES</p><h2>我的提交</h2></div></div>
        {mine.length ? <div className={styles.rows}>{mine.map((skill) => <div key={skill.slug} className={styles.row}>
          <strong>{skill.name}</strong><span>{skill.releases[0]?.version} · {skill.releases[0]?.status}</span>
          {skill.releases[0]?.reviewNote ? <small>审核意见：{skill.releases[0].reviewNote}</small> : null}
          {skill.releases[0] ? <a href={downloadUrl(skill.slug, skill.releases[0].version)}>下载此版本 ↓</a> : null}
        </div>)}</div> : <p className={styles.empty}>还没有提交过 Skill。</p>}
      </section> : null}

      {signedIn ? <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><p>CLI / SYNC</p><h2>本地同步凭证</h2></div></div>
        <p>命令行 `sync` 只向本站提交新增或变化的文件，不会自动安装远程 Skill。凭证仅在创建时显示一次，90 天后过期。<a href="/api/awesome/skills/hub/cli">下载独立 CLI 脚本 ↓</a></p>
        <div className={styles.tokenForm}><label>凭证用途<input maxLength={64} value={tokenLabel} onChange={(event) => setTokenLabel(event.target.value)} /></label><button type="button" disabled={pending} onClick={createToken}>生成发布凭证</button></div>
        {oneTimeToken ? <div className={styles.oneTime} role="status"><strong>现在复制并安全保存（刷新后不再显示）：</strong><code>{oneTimeToken}</code></div> : null}
        <pre className={styles.code}>{`export LOGWOOD_SKILLHUB_URL=${siteOrigin}\nread -rs LOGWOOD_SKILLHUB_TOKEN\nexport LOGWOOD_SKILLHUB_TOKEN\nnode skillhub.mjs sync ./你的-skill-目录 --confirm-rights`}</pre>
        {activeTokens.map((token) => <div className={styles.tokenRow} key={token.id}><span>{token.label} · 到期 {new Date(token.expiresAt).toLocaleDateString('zh-CN')}</span><button type="button" disabled={pending} onClick={() => revokeToken(token.id)}>撤销</button></div>)}
      </section> : null}

      {admin ? <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><p>MODERATION</p><h2>待审核版本 · {queue.length}</h2></div></div>
        {queue.length ? <div className={styles.reviewGrid}>{queue.map((item) => <article key={item.id} className={styles.reviewCard}>
          <h3>{item.package.name} / {item.version}</h3>
          <p>提交者：{item.package.owner.name || '未命名用户'} · 许可证：{item.license || '未声明'}</p>
          <p>{item.description}</p>
          <small>{fileManifest(item.fileManifest).map((file) => file.path).join(' · ')}</small>
          <a href={downloadUrl(item.package.slug, item.version)}>下载待审 ZIP 检查 ↗</a>
          <details><summary>查看 SKILL.md</summary><pre>{item.instructions}</pre></details>
          <label>审核说明<input maxLength={1000} value={reviewNotes[item.id] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
          <div className={styles.reviewActions}><button type="button" disabled={pending} onClick={() => review(item.id, true)}>批准发布</button><button type="button" disabled={pending} onClick={() => review(item.id, false)}>退回</button></div>
        </article>)}</div> : <p className={styles.empty}>没有等待审核的版本。</p>}
      </section> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.success} role="status">{notice}</p> : null}
    </div>
  )
}
