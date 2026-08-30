'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Copy, Expand, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GALLERY_FAMILIES,
  GALLERY_PROVENANCE,
  GALLERY_STYLES,
  galleryPromptFor,
  type GalleryFamily,
  type GalleryStyle,
} from '@/content/gallery-styles'

export type GalleryFamilyFilter = GalleryFamily | 'all'

export function filterGalleryStyles(
  styles: GalleryStyle[],
  family: GalleryFamilyFilter,
) {
  return family === 'all' ? styles : styles.filter((style) => style.family === family)
}

export function toggleGalleryComparison(
  selected: string[],
  slug: string,
  limit = 4,
) {
  if (selected.includes(slug)) return selected.filter((item) => item !== slug)
  if (selected.length >= limit) return selected
  return [...selected, slug]
}

type GalleryModal = 'full' | 'compare' | null

function familyTitle(family: GalleryFamily) {
  return GALLERY_FAMILIES.find((item) => item.id === family)?.title ?? family
}

interface GalleryFamilyFiltersProps {
  className: string
  family: GalleryFamilyFilter
  label: string
  onSelect: (family: GalleryFamilyFilter) => void
}

function GalleryFamilyFilters({
  className,
  family,
  label,
  onSelect,
}: GalleryFamilyFiltersProps) {
  return (
    <div className={className} role="group" aria-label={label}>
      <button type="button" aria-pressed={family === 'all'} onClick={() => onSelect('all')}>
        <span>ALL</span><small>{GALLERY_STYLES.length}</small>
      </button>
      {GALLERY_FAMILIES.map((item) => {
        const count = GALLERY_STYLES.filter((style) => style.family === item.id).length
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={family === item.id}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span><small>{count}</small>
          </button>
        )
      })}
    </div>
  )
}

export function StyleGallery() {
  const [family, setFamily] = useState<GalleryFamilyFilter>('all')
  const [activeSlug, setActiveSlug] = useState('watercolor')
  const [compareSlugs, setCompareSlugs] = useState<string[]>([])
  const [modal, setModal] = useState<GalleryModal>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const restoreFocusAfterClose = useRef(false)

  const visibleStyles = filterGalleryStyles(GALLERY_STYLES, family)
  const activeStyle = GALLERY_STYLES.find((style) => style.slug === activeSlug)
    ?? visibleStyles[0]
    ?? GALLERY_STYLES[0]
  const comparedStyles = compareSlugs
    .map((slug) => GALLERY_STYLES.find((style) => style.slug === slug))
    .filter((style): style is GalleryStyle => Boolean(style))

  const moveActive = useCallback((delta: number) => {
    const pool = filterGalleryStyles(GALLERY_STYLES, family)
    setActiveSlug((current) => {
      const currentIndex = Math.max(0, pool.findIndex((style) => style.slug === current))
      return pool[(currentIndex + delta + pool.length) % pool.length]?.slug ?? current
    })
    setCopyState('idle')
  }, [family])

  const closeModal = useCallback(() => {
    restoreFocusAfterClose.current = true
    setModal(null)
  }, [])

  useEffect(() => {
    if (modal || !restoreFocusAfterClose.current) return
    restoreFocusAfterClose.current = false
    const frame = requestAnimationFrame(() => previousFocus.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [modal])

  useEffect(() => {
    if (!modal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal()
      if (modal === 'full' && event.key === 'ArrowLeft') moveActive(-1)
      if (modal === 'full' && event.key === 'ArrowRight') moveActive(1)
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]'),
        ).filter((element) => !element.hasAttribute('disabled'))
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
  }, [closeModal, modal, moveActive])

  function selectFamily(nextFamily: GalleryFamilyFilter) {
    const nextStyles = filterGalleryStyles(GALLERY_STYLES, nextFamily)
    setFamily(nextFamily)
    setCopyState('idle')
    if (!nextStyles.some((style) => style.slug === activeSlug)) {
      setActiveSlug(nextStyles[0]?.slug ?? GALLERY_STYLES[0].slug)
    }
  }

  function selectStyle(style: GalleryStyle) {
    setActiveSlug(style.slug)
    setCopyState('idle')
  }

  function toggleCompare(slug: string) {
    setCompareSlugs((current) => toggleGalleryComparison(current, slug))
  }

  function openModal(nextModal: Exclude<GalleryModal, null>, trigger: HTMLElement) {
    previousFocus.current = trigger
    setModal(nextModal)
  }

  function openStyleModal(style: GalleryStyle, trigger: HTMLElement) {
    selectStyle(style)
    openModal('full', trigger)
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(galleryPromptFor(activeStyle))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <>
      <section className="style-gallery__shell" aria-label="视觉风格画廊">
        <aside className="style-gallery__index">
          <div>
            <h1>GALLERY</h1>
            <p>ONE SUBJECT.<br />MANY VISUAL LANGUAGES.</p>
          </div>
          <GalleryFamilyFilters
            className="style-gallery__families"
            family={family}
            label="按画风家族筛选"
            onSelect={selectFamily}
          />
        </aside>

        <section
          className="style-gallery__stage"
          aria-labelledby="gallery-active-title"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') moveActive(-1)
            if (event.key === 'ArrowRight') moveActive(1)
          }}
        >
          <div className="style-gallery__stage-heading">
            <span>{family === 'all' ? 'ALL STYLES' : familyTitle(family)}</span>
            <span>{String(GALLERY_STYLES.findIndex((style) => style.slug === activeStyle.slug) + 1).padStart(2, '0')} / {GALLERY_STYLES.length}</span>
          </div>
          <button
            type="button"
            className="style-gallery__hero"
            aria-label={`全屏查看 ${activeStyle.titleZh}`}
            onClick={(event) => openModal('full', event.currentTarget)}
          >
            <span key={activeStyle.slug} className="style-gallery__hero-image">
              <Image
                src={activeStyle.imageUrl}
                alt={`${activeStyle.titleZh}效果：月夜植物温室中的朱红旅人`}
                fill
                priority={activeStyle.slug === 'watercolor'}
                sizes="(max-width: 62rem) 100vw, 64vw"
              />
            </span>
            <span className="style-gallery__expand" aria-hidden="true"><Expand /></span>
          </button>
          <div className="style-gallery__caption">
            <div>
              <strong>{activeStyle.title}</strong>
              <span>{activeStyle.titleZh} · {activeStyle.medium}</span>
            </div>
            <p>{activeStyle.effect}</p>
          </div>
        </section>

        <nav className="style-gallery__rail" aria-label="快速选择画风">
          {visibleStyles.map((style) => (
            <button
              key={style.slug}
              type="button"
              aria-current={activeStyle.slug === style.slug ? 'true' : undefined}
              onClick={() => selectStyle(style)}
            >
              <span className="style-gallery__rail-image">
                <Image src={style.imageUrl} alt="" fill sizes="144px" />
              </span>
              <span>{style.title}</span>
            </button>
          ))}
        </nav>

        <aside className="style-gallery__inspector" aria-label="当前画风说明">
          <div className="style-gallery__inspector-title">
            <div>
              <span>{familyTitle(activeStyle.family)}</span>
              <h2 id="gallery-active-title">{activeStyle.title}</h2>
            </div>
            <span>SYNTHETIC</span>
          </div>

          <p className="style-gallery__inspector-summary">{activeStyle.effect}</p>

          <div className="style-gallery__recipe">
            <p>STYLE RECIPE</p>
            <code>{activeStyle.promptFragment}</code>
          </div>

          <ul className="style-gallery__cues" aria-label="画风关键线索">
            {activeStyle.cues.map((cue) => <li key={cue}>{cue}</li>)}
          </ul>

          <div className="style-gallery__actions">
            <button type="button" onClick={copyPrompt}>
              {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copyState === 'copied' ? 'COPIED' : copyState === 'failed' ? 'COPY FAILED' : 'COPY RECIPE'}
            </button>
            <button
              type="button"
              aria-pressed={compareSlugs.includes(activeStyle.slug)}
              aria-disabled={!compareSlugs.includes(activeStyle.slug) && compareSlugs.length >= 4}
              disabled={!compareSlugs.includes(activeStyle.slug) && compareSlugs.length >= 4}
              onClick={() => toggleCompare(activeStyle.slug)}
            >
              {compareSlugs.includes(activeStyle.slug) ? 'REMOVE' : 'COMPARE'} {String(compareSlugs.length).padStart(2, '0')}/04
            </button>
            <Link href="/workbench">PROMPT WORKBENCH</Link>
          </div>
          <p className="style-gallery__copy-status" role="status" aria-live="polite">
            {copyState === 'failed' ? '浏览器未允许写入剪贴板，请重试。' : copyState === 'copied' ? '完整风格配方已复制；可在工作台继续修改。' : '预填充仅用于观察风格差异，不代表已完成稳定性验证。'}
          </p>

          <dl className="style-gallery__provenance">
            <div><dt>MODEL</dt><dd>{GALLERY_PROVENANCE.provider} / {GALLERY_PROVENANCE.model}</dd></div>
            <div><dt>VERSION</dt><dd>{GALLERY_PROVENANCE.modelVersion}</dd></div>
            <div><dt>GENERATED</dt><dd>{GALLERY_PROVENANCE.generatedAt}</dd></div>
            <div><dt>SOURCE</dt><dd>{GALLERY_PROVENANCE.source}</dd></div>
            <div><dt>RIGHTS</dt><dd>{GALLERY_PROVENANCE.rights}</dd></div>
            <div><dt>STATUS</dt><dd>{GALLERY_PROVENANCE.status}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="style-gallery__atlas" aria-labelledby="style-atlas-title">
        <header>
          <div>
            <h2 id="style-atlas-title">STYLE ATLAS</h2>
            <p>同一场景、同一构图，只改变媒介与视觉语法。</p>
          </div>
        </header>
        <div className="style-gallery__atlas-toolbar">
          <GalleryFamilyFilters
            className="style-gallery__atlas-filters"
            family={family}
            label="在风格图谱中筛选画风家族"
            onSelect={selectFamily}
          />
          <output aria-live="polite">
            {visibleStyles.length} / {GALLERY_STYLES.length} SHOWN
          </output>
        </div>
        <div className="style-gallery__atlas-grid">
          {visibleStyles.map((style) => {
            const selected = compareSlugs.includes(style.slug)
            const compareDisabled = !selected && compareSlugs.length >= 4
            return (
              <article key={style.slug} className={activeStyle.slug === style.slug ? 'is-active' : ''}>
                <button
                  type="button"
                  className="style-gallery__atlas-image"
                  onClick={(event) => openStyleModal(style, event.currentTarget)}
                  aria-label={`查看 ${style.titleZh} 详情`}
                >
                  <Image
                    src={style.imageUrl}
                    alt={`${style.titleZh}风格示例`}
                    width={512}
                    height={512}
                    sizes="(max-width: 40rem) 50vw, (max-width: 72rem) 33vw, 20vw"
                  />
                </button>
                <div>
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={compareDisabled}
                    onClick={() => toggleCompare(style.slug)}
                    aria-label={`${selected ? '移出' : '加入'}对比：${style.titleZh}`}
                  >
                    {selected ? <Check aria-hidden="true" /> : <span aria-hidden="true">+</span>}
                  </button>
                  <p><strong>{style.title}</strong><span>{style.titleZh}</span></p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {compareSlugs.length > 0 ? (
        <aside className="style-gallery__compare-tray" aria-label="画风对比选择">
          <span>COMPARE {String(compareSlugs.length).padStart(2, '0')}/04</span>
          <div>
            {comparedStyles.map((style) => (
              <button key={style.slug} type="button" onClick={() => toggleCompare(style.slug)} aria-label={`移出对比：${style.titleZh}`}>
                <Image src={style.imageUrl} alt="" width={40} height={40} />
                <X aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={compareSlugs.length < 2}
            onClick={(event) => openModal('compare', event.currentTarget)}
          >
            {compareSlugs.length < 2 ? 'SELECT ONE MORE' : 'VIEW COMPARE'}
          </button>
          <button type="button" onClick={() => setCompareSlugs([])}>CLEAR</button>
        </aside>
      ) : null}

      {modal ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-dialog-title"
          className="style-gallery__dialog"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <div className={modal === 'compare' ? 'is-compare' : 'is-full'}>
            <header>
              <div>
                <h2 id="gallery-dialog-title">{modal === 'compare' ? 'STYLE COMPARE' : activeStyle.title}</h2>
                <p>{modal === 'compare' ? `${comparedStyles.length} VISUAL LANGUAGES / SAME SUBJECT` : `${activeStyle.titleZh} · ${activeStyle.medium}`}</p>
              </div>
              <button ref={closeRef} type="button" onClick={closeModal} aria-label="关闭"><X aria-hidden="true" /></button>
            </header>

            {modal === 'full' ? (
              <div className="style-gallery__dialog-full">
                <button className="style-gallery__dialog-nav style-gallery__dialog-nav--previous" type="button" onClick={() => moveActive(-1)} aria-label="上一种画风"><ChevronLeft aria-hidden="true" /></button>
                <figure key={activeStyle.slug}>
                  <Image src={activeStyle.imageUrl} alt={`${activeStyle.titleZh}风格示例`} fill priority sizes="94vw" />
                </figure>
                <aside className="style-gallery__dialog-detail" aria-label="当前画风快速详情">
                  <p>{activeStyle.effect}</p>
                  <ul aria-label="画风关键线索">
                    {activeStyle.cues.map((cue) => <li key={cue}>{cue}</li>)}
                  </ul>
                  <code>{activeStyle.promptFragment}</code>
                  <dl>
                    <div><dt>MODEL</dt><dd>{GALLERY_PROVENANCE.provider} / {GALLERY_PROVENANCE.model}</dd></div>
                    <div><dt>SOURCE</dt><dd>{GALLERY_PROVENANCE.source}</dd></div>
                    <div><dt>STATUS</dt><dd>{GALLERY_PROVENANCE.status}</dd></div>
                  </dl>
                  <div className="style-gallery__dialog-actions">
                    <button type="button" onClick={copyPrompt}>
                      {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      {copyState === 'copied' ? 'COPIED' : copyState === 'failed' ? 'COPY FAILED' : 'COPY RECIPE'}
                    </button>
                    <button
                      type="button"
                      aria-pressed={compareSlugs.includes(activeStyle.slug)}
                      disabled={!compareSlugs.includes(activeStyle.slug) && compareSlugs.length >= 4}
                      onClick={() => toggleCompare(activeStyle.slug)}
                    >
                      {compareSlugs.includes(activeStyle.slug) ? 'REMOVE COMPARE' : 'ADD TO COMPARE'}
                    </button>
                  </div>
                </aside>
                <button className="style-gallery__dialog-nav style-gallery__dialog-nav--next" type="button" onClick={() => moveActive(1)} aria-label="下一种画风"><ChevronRight aria-hidden="true" /></button>
              </div>
            ) : (
              <div className="style-gallery__dialog-compare">
                {comparedStyles.map((style) => (
                  <article key={style.slug}>
                    <Image src={style.imageUrl} alt={`${style.titleZh}风格示例`} width={512} height={512} sizes="(max-width: 62rem) 78vw, 25vw" />
                    <div><strong>{style.title}</strong><span>{style.titleZh} · {style.medium}</span></div>
                    <p>{style.effect}</p>
                    <code>{style.promptFragment}</code>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
