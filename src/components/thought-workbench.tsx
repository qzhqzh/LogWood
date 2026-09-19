'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'
import type { ThoughtSession, ThoughtSessionSummary } from '@/modules/thought/types'
import styles from './thought-workbench.module.css'

type MobilePane = 'dialogue' | 'article' | 'history'
type BusyAction = 'chat' | 'record' | 'draft' | 'publish' | null

interface ThoughtWorkbenchProps {
  isAdmin: boolean
  initialSessionId?: string
  runtime: {
    configured: boolean
    provider: string
    model?: string
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  ERR_THOUGHT_AI_NOT_CONFIGURED: '讨论已经保存，但思想协作者尚未配置。你可以继续只记录，或检查服务端 DeepSeek 配置。',
  ERR_THOUGHT_AI_AUTH: '讨论已经保存，但模型凭据被拒绝。修复服务端凭据后可安全重试回应。',
  ERR_THOUGHT_AI_UNAVAILABLE: '讨论已经保存，但模型暂时没有回应。可以稍后安全重试，不会重复记录。',
  ERR_THOUGHT_AI_INVALID_RESPONSE: '讨论已经保存，但这次模型回应无法使用。可以安全重试。',
  ERR_THOUGHT_SESSION_FULL: '这次讨论已经很长。请先整理成文章，再开始一段新讨论。',
  ERR_THOUGHT_SESSION_CORRUPT: '这条讨论记录无法读取，请到收集箱检查原始记录。',
  ERR_FORGE_AI_NOT_CONFIGURED: '文章整理模型尚未配置，讨论记录没有丢失。',
  ERR_FORGE_AI_AUTH: '文章整理模型的凭据被拒绝，讨论记录没有丢失。',
  ERR_FORGE_AI_UNAVAILABLE: '文章整理模型暂时不可用，可稍后使用同一次请求安全重试。',
  ERR_FORGE_AI_INVALID_RESPONSE: '模型没有返回可验证的文章结构，可安全重试。',
  ERR_FORGE_IN_PROGRESS: '这次文章整理仍在处理中，请稍后重试。',
  ERR_ARTICLE_VERSION_STALE: '文章在你确认后出现了新版本。请重新检查当前预览再发表。',
}

const STARTERS = [
  '我最近反复想到的一件事是……',
  '有一个判断我还没想清楚：……',
  '今天遇到的事情让我意识到……',
] as const

function summaryFromSession(session: ThoughtSession): ThoughtSessionSummary {
  return {
    id: session.id,
    title: session.title,
    summary: session.summary,
    turnCount: session.turnCount,
    updatedAt: session.updatedAt,
    article: session.article ? {
      id: session.article.id,
      title: session.article.title,
      slug: session.article.slug,
      status: session.article.status,
      currentVersion: session.article.currentVersion,
      updatedAt: session.article.updatedAt,
    } : null,
  }
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ThoughtWorkbench({
  isAdmin,
  initialSessionId,
  runtime,
}: ThoughtWorkbenchProps) {
  const [sessions, setSessions] = useState<ThoughtSessionSummary[]>([])
  const [current, setCurrent] = useState<ThoughtSession | null>(null)
  const [composer, setComposer] = useState('')
  const [mobilePane, setMobilePane] = useState<MobilePane>('dialogue')
  const [busy, setBusy] = useState<BusyAction>(null)
  const [loadingSessions, setLoadingSessions] = useState(isAdmin)
  const [loadingCurrent, setLoadingCurrent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState<{
    requestId: string
    content: string
    sessionId: string
  } | null>(null)
  const [draftRetryKey, setDraftRetryKey] = useState<string | null>(null)
  const [publishArmed, setPublishArmed] = useState(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/thoughts/sessions', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'ERR_THOUGHT_LOAD')
        if (cancelled) return
        setSessions(data.sessions || [])
        if (initialSessionId) {
          const detail = await fetch(`/api/thoughts/sessions/${initialSessionId}`, { cache: 'no-store' })
          const detailData = await detail.json()
          if (detail.ok && !cancelled) setCurrent(detailData.session)
        }
      } catch {
        if (!cancelled) setError('思想记录暂时无法读取，请刷新页面重试。')
      } finally {
        if (!cancelled) setLoadingSessions(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [initialSessionId, isAdmin])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [current?.turnCount, busy])

  useEffect(() => {
    setPublishArmed(false)
  }, [current?.article?.currentVersion])

  function mergeSession(session: ThoughtSession) {
    setCurrent(session)
    const summary = summaryFromSession(session)
    setSessions((previous) => [
      summary,
      ...previous.filter((item) => item.id !== session.id),
    ])
  }

  async function selectSession(id: string) {
    try {
      setLoadingCurrent(true)
      setError(null)
      setNotice(null)
      const response = await fetch(`/api/thoughts/sessions/${id}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ERR_THOUGHT_LOAD')
      setCurrent(data.session)
      setMobilePane('dialogue')
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ''
      setError(ERROR_MESSAGES[code] || '这条讨论暂时无法读取，请稍后重试。')
    } finally {
      setLoadingCurrent(false)
    }
  }

  function newDiscussion() {
    setCurrent(null)
    setComposer('')
    setError(null)
    setNotice('新讨论会在你第一次发送或记录时自动保存。')
    setRetryMessage(null)
    setDraftRetryKey(null)
    setMobilePane('dialogue')
  }

  async function submitMessage(
    action: 'chat' | 'record',
    retry?: { requestId: string; content: string; sessionId: string },
  ) {
    const content = (retry?.content || composer).trim()
    if (content.length < 2 || busy) return
    const requestId = retry?.requestId || crypto.randomUUID()
    const sessionId = retry?.sessionId || current?.id

    try {
      setBusy(action)
      setError(null)
      setNotice(action === 'record' ? '正在保存这句话…' : '已先保存，思想协作者正在回应…')
      const response = await fetch('/api/thoughts/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, requestId, content, action }),
      })
      const data = await response.json()
      if (data.session) mergeSession(data.session)
      if (!response.ok) {
        if (data.saved && data.session) {
          setComposer('')
          setRetryMessage({ requestId, content, sessionId: data.session.id })
        }
        throw new Error(data.error || 'ERR_THOUGHT_MESSAGE')
      }
      setComposer('')
      setRetryMessage(null)
      setNotice(action === 'record' ? '已记下。' : '这轮讨论已保存。')
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ''
      setError(ERROR_MESSAGES[code] || '这次操作没有完成，请稍后重试。')
      setNotice(null)
    } finally {
      setBusy(null)
    }
  }

  async function makeDraft() {
    if (!current || busy) return
    const requestKey = draftRetryKey || crypto.randomUUID()
    try {
      setBusy('draft')
      setError(null)
      setNotice(current.article ? '正在用完整讨论更新文章版本…' : '正在把完整讨论整理成文章…')
      const response = await fetch('/api/thoughts/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: JSON.stringify({ sessionId: current.id }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDraftRetryKey(requestKey)
        throw new Error(data.error || data.code || 'ERR_FORGE_FAILED')
      }
      mergeSession(data.session)
      setDraftRetryKey(null)
      setNotice(data.result?.note || '文章草稿已更新。')
      setMobilePane('article')
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ''
      setError(ERROR_MESSAGES[code] || '文章整理没有完成；讨论记录仍然安全保存。')
      setNotice(null)
    } finally {
      setBusy(null)
    }
  }

  async function publishArticle() {
    const article = current?.article
    if (!current || !article || busy) return
    try {
      setBusy('publish')
      setError(null)
      setNotice(`正在确认并公开文章 v${article.currentVersion}…`)
      const response = await fetch('/api/thoughts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: current.id,
          articleId: article.id,
          expectedVersion: article.currentVersion,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ERR_ARTICLE_PUBLISH')
      mergeSession(data.session)
      setPublishArmed(false)
      setNotice(`文章 v${data.article.currentVersion} 已公开。`)
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ''
      setError(ERROR_MESSAGES[code] || '文章没有发表，请重新检查当前版本。')
      setNotice(null)
    } finally {
      setBusy(null)
    }
  }

  if (!isAdmin) {
    return (
      <section className={styles.signedOut}>
        <MessageSquare aria-hidden />
        <div>
          <h2>思想讨论只保存在作者空间</h2>
          <p>登录管理员账号后，可以持续讨论、自动保存并整理成待确认的文章。</p>
        </div>
        <Link href="/auth/signin?callbackUrl=/forge">登录后开始</Link>
      </section>
    )
  }

  const article = current?.article
  const isWorking = busy !== null

  return (
    <section className={styles.frame} data-mobile-pane={mobilePane}>
      <nav className={styles.mobileTabs} aria-label="思想工作台面板">
        <button type="button" onClick={() => setMobilePane('dialogue')} aria-pressed={mobilePane === 'dialogue'}>
          <MessageSquare aria-hidden />讨论
        </button>
        <button type="button" onClick={() => setMobilePane('article')} aria-pressed={mobilePane === 'article'}>
          <FileText aria-hidden />文章
        </button>
        <button type="button" onClick={() => setMobilePane('history')} aria-pressed={mobilePane === 'history'}>
          <BookOpen aria-hidden />记录
        </button>
      </nav>

      <aside className={styles.historyPanel} aria-label="历史讨论">
        <div className={styles.panelHeader}>
          <div>
            <span>DISCUSSIONS</span>
            <strong>{sessions.length} 条记录</strong>
          </div>
          <button type="button" onClick={newDiscussion} className={styles.iconButton} title="开始新讨论">
            <Plus aria-hidden />
            <span className={styles.srOnly}>开始新讨论</span>
          </button>
        </div>
        <div className={styles.runtimeLine} data-ready={runtime.configured}>
          <span aria-hidden />
          <p>{runtime.configured ? `${runtime.provider} · ${runtime.model || '已连接'}` : 'AI 未配置 · 仍可只记录'}</p>
        </div>
        <div className={styles.sessionList} aria-busy={loadingSessions || loadingCurrent}>
          {loadingSessions ? <p className={styles.loadingCopy}>正在读取思想记录…</p> : null}
          {!loadingSessions && sessions.length === 0 ? (
            <p className={styles.emptyCopy}>还没有记录。先在中间说一句不完整的话。</p>
          ) : null}
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={session.id === current?.id ? styles.sessionActive : styles.sessionButton}
              onClick={() => void selectSession(session.id)}
            >
              <strong>{session.title}</strong>
              <span>{session.turnCount} 轮 · {timeLabel(session.updatedAt)}</span>
              {session.article ? <small>{session.article.status === 'published' ? '已发表' : `文章 v${session.article.currentVersion}`}</small> : null}
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.dialoguePanel} aria-label="当前讨论">
        <header className={styles.dialogueHeader}>
          <div>
            <span>{current ? 'SAVED SESSION' : 'NEW SESSION'}</span>
            <h2>{current?.title || '先说一句不完整的话'}</h2>
          </div>
          <p>{current ? `${current.turnCount} 条消息已自动保存` : '第一次发送后自动进入私有记录'}</p>
        </header>

        <div className={styles.transcript} aria-live="polite" aria-busy={busy === 'chat'}>
          {!current ? (
            <div className={styles.opening}>
              <p>不必先想好标题，也不用先决定它能不能成为文章。把判断、犹豫、经历或一个反复出现的问题说出来。</p>
              <div className={styles.starters}>
                {STARTERS.map((starter) => (
                  <button type="button" key={starter} onClick={() => setComposer(starter)}>{starter}</button>
                ))}
              </div>
            </div>
          ) : null}
          {current?.turns.map((turn) => (
            <article key={turn.id} className={turn.role === 'user' ? styles.userMessage : styles.assistantMessage}>
              <header>
                <strong>{turn.role === 'user' ? '你' : '思想协作者'}</strong>
                <time dateTime={turn.createdAt}>{timeLabel(turn.createdAt)}</time>
              </header>
              <p>{turn.content}</p>
              {turn.attribution ? <small>{turn.attribution.provider} / {turn.attribution.model}</small> : null}
            </article>
          ))}
          {busy === 'chat' ? (
            <div className={styles.thinking} role="status"><span aria-hidden />正在顺着这个念头往下想…</div>
          ) : null}
          <div ref={transcriptEndRef} />
        </div>

        <div className={styles.composer}>
          {(notice || error) ? (
            <div className={error ? styles.errorNotice : styles.statusNotice} role={error ? 'alert' : 'status'}>
              {error || notice}
            </div>
          ) : null}
          {retryMessage ? (
            <button
              type="button"
              className={styles.retryButton}
              disabled={isWorking}
              onClick={() => void submitMessage('chat', retryMessage)}
            >
              <RotateCcw aria-hidden />安全重试这次回应
            </button>
          ) : null}
          <label>
            <span className={styles.srOnly}>继续说</span>
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void submitMessage('chat')
                }
              }}
              rows={4}
              maxLength={4000}
              placeholder="继续说。可以是一个判断、一段经历，或者一句‘我不同意’……"
              disabled={isWorking}
            />
          </label>
          <div className={styles.composerActions}>
            <span>{composer.length}/4000 · Ctrl/⌘ + Enter 发送</span>
            <div>
              <button type="button" className={styles.secondaryButton} disabled={isWorking || composer.trim().length < 2} onClick={() => void submitMessage('record')}>
                <Save aria-hidden />{busy === 'record' ? '记录中…' : '只记下'}
              </button>
              <button type="button" className={styles.primaryButton} disabled={isWorking || composer.trim().length < 2} onClick={() => void submitMessage('chat')}>
                <ArrowUp aria-hidden />{busy === 'chat' ? '回应中…' : '发送并继续讨论'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className={styles.articlePanel} aria-label="文章预览">
        <div className={styles.panelHeader}>
          <div>
            <span>ARTICLE DRAFT</span>
            <strong>{article ? `VERSION ${article.currentVersion}` : 'NOT CREATED'}</strong>
          </div>
          <FileText aria-hidden />
        </div>

        {!current ? (
          <div className={styles.articleEmpty}>
            <p>先完成一轮讨论。文章不会抢在思想前面。</p>
          </div>
        ) : null}

        {current && !article ? (
          <div className={styles.articleEmpty}>
            <p>当核心判断已经出现，就把完整讨论整理为一篇可独立阅读的文章。</p>
            <button type="button" className={styles.primaryButton} disabled={isWorking || current.turnCount < 1} onClick={() => void makeDraft()}>
              <FileText aria-hidden />{busy === 'draft' ? '正在整理…' : '整理成文章'}
            </button>
          </div>
        ) : null}

        {article ? (
          <>
            <div className={styles.articleMeta}>
              <span data-status={article.status}>{article.status === 'published' ? '已公开' : '待确认'}</span>
              <span>v{article.currentVersion}</span>
              {article.attribution ? <span>{article.attribution.provider}</span> : null}
            </div>
            <article className={styles.articlePreview}>
              <h2>{article.title}</h2>
              {article.excerpt ? <p className={styles.excerpt}>{article.excerpt}</p> : null}
              <div dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
            </article>
            <div className={styles.articleActions}>
              <button type="button" className={styles.secondaryButton} disabled={isWorking} onClick={() => void makeDraft()}>
                <RotateCcw aria-hidden />{busy === 'draft' ? '正在更新…' : '用当前讨论更新草稿'}
              </button>
              {article.status === 'published' ? (
                <Link href={`/articles/${encodeURIComponent(article.slug)}`} className={styles.primaryLink}>查看已发表文章</Link>
              ) : publishArmed ? (
                <div className={styles.publishCheck}>
                  <p>你将公开当前预览的 v{article.currentVersion}。后续修改会重新回到草稿。</p>
                  <div>
                    <button type="button" className={styles.secondaryButton} onClick={() => setPublishArmed(false)}>再看一下</button>
                    <button type="button" className={styles.publishButton} disabled={isWorking} onClick={() => void publishArticle()}>
                      <Check aria-hidden />{busy === 'publish' ? '正在发表…' : `确认公开 v${article.currentVersion}`}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.publishButton} disabled={isWorking} onClick={() => setPublishArmed(true)}>
                  <Check aria-hidden />检查后确认发表
                </button>
              )}
              <Link href="/articles/manage" className={styles.manageLink}>需要精修时打开文章管理</Link>
            </div>
          </>
        ) : null}
      </aside>
    </section>
  )
}
