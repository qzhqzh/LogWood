'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid2X2, Rows3, X } from 'lucide-react'

export interface VisualGalleryItem {
  id: string
  title: string
  summary: string
  href: string
  imageUrl: string | null
  tags: string[]
  origin: { title: string; href: string } | null
}

export function VisualGalleryGrid({ items }: { items: VisualGalleryItem[] }) {
  const [density, setDensity] = useState<'standard' | 'compact'>('standard')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const activeItem = activeIndex === null ? null : items[activeIndex]

  const close = useCallback(() => {
    setActiveIndex(null)
    requestAnimationFrame(() => previousFocus.current?.focus())
  }, [])

  const move = useCallback((delta: number) => {
    setActiveIndex((index) => {
      if (index === null) return index
      return (index + delta + items.length) % items.length
    })
  }, [items.length])

  useEffect(() => {
    if (activeIndex === null) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowLeft') move(-1)
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]'))
          .filter((element) => !element.hasAttribute('disabled'))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeIndex, close, move])

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-4">
        <p className="text-sm text-muted">选择图片可进入键盘可达的大图检查；详情页保留来源与讨论。</p>
        <div role="group" aria-label="画廊密度" className="flex gap-2">
          <button
            type="button"
            aria-pressed={density === 'standard'}
            onClick={() => setDensity('standard')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${density === 'standard' ? 'border-cyan-400 text-cyan-200' : 'border-divider text-muted'}`}
          >
            <Grid2X2 className="h-4 w-4" aria-hidden />
            标准
          </button>
          <button
            type="button"
            aria-pressed={density === 'compact'}
            onClick={() => setDensity('compact')}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${density === 'compact' ? 'border-cyan-400 text-cyan-200' : 'border-divider text-muted'}`}
          >
            <Rows3 className="h-4 w-4" aria-hidden />
            紧凑
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${density === 'compact' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {items.map((item, index) => (
          <article key={item.id} className="overflow-hidden rounded-xl border border-divider bg-[var(--color-surface-1)]">
            {item.imageUrl ? (
              <button
                type="button"
                onClick={(event) => {
                  previousFocus.current = event.currentTarget
                  setActiveIndex(index)
                }}
                className="group relative block aspect-[4/3] w-full overflow-hidden bg-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
                aria-label={`大图查看：${item.title}`}
              >
                <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
              </button>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-surface-2)] px-6 text-center text-sm text-soft">暂无可检查图片</div>
            )}
            <div className={density === 'compact' ? 'p-4' : 'p-5'}>
              <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">
                <Link href={item.href} className="hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">{item.title}</Link>
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.summary}</p>
              {item.origin ? (
                <p className="mt-3 text-xs text-amber-200/90">
                  来源：<Link href={item.origin.href} className="hover:text-amber-100">{item.origin.title}</Link>
                </p>
              ) : null}
              {density === 'standard' && item.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-md border border-divider px-2 py-1 text-xs text-soft">{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {activeItem && activeIndex !== null ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="visual-lightbox-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div className="relative flex h-full w-full max-w-7xl flex-col">
            <div className="flex min-h-14 items-center justify-between gap-4 text-white">
              <div className="min-w-0">
                <h2 id="visual-lightbox-title" className="truncate text-base font-semibold">{activeItem.title}</h2>
                <p className="text-xs text-white/65">{activeIndex + 1} / {items.length} · 左右方向键切换 · Esc 关闭</p>
              </div>
              <button ref={closeRef} type="button" onClick={close} aria-label="关闭大图" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              {activeItem.imageUrl ? <Image src={activeItem.imageUrl} alt={activeItem.title} fill unoptimized priority className="object-contain" /> : null}
              <button type="button" onClick={() => move(-1)} aria-label="上一张" className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-3">
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button type="button" onClick={() => move(1)} aria-label="下一张" className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-3">
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </div>
            <div className="flex min-h-16 items-center justify-between gap-4 text-sm text-white/75">
              <p className="line-clamp-2">{activeItem.summary}</p>
              <Link href={activeItem.href} className="shrink-0 border-b border-white/60 py-2 text-white hover:border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white">打开详情</Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
