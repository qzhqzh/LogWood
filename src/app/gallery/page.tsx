import type { Metadata } from 'next'
import { JsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { StyleGallery } from '@/components/style-gallery'
import { buildBreadcrumbList, buildMetadata } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Gallery',
  description: '用同一场景观察绘画、版画、插画、数字媒介和摄影视觉语言，并复制风格配方进入 Prompt 工作台继续研究。',
  path: '/gallery',
  image: '/gallery/styles/watercolor.webp',
})

export default function GalleryPage() {
  return (
    <main className="ascii-app style-gallery-page">
      <div
        aria-hidden="true"
        className="hidden"
        dangerouslySetInnerHTML={{
          __html: `<!--
THESIS: Gallery is a comparative visual study: one fixed subject exposes what each style changes, refusing the anonymous popularity feed.
OWN-WORLD: Full-color artwork on a near-black phosphor contact sheet, strict monospace chrome, square rules, mint selection, and no overlay tint.
STORY: Filter a visual family, focus one work, understand its material cues and synthetic provenance, copy the recipe, then compare two to four styles.
FIRST VIEWPORT: A narrow family index, one dominant centered artwork, a truthful recipe inspector, and a horizontal same-subject contact sheet fill the screen.
FORM: Living Contact Sheet, grounded structure 7, seed e2dc0f47; artwork focus drives the rail, inspector, fullscreen view, and comparison plane.
FINISH: Unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`,
        }}
      />
      <JsonLd value={buildBreadcrumbList([
        { name: '首页', path: '/' },
        { name: 'Gallery', path: '/gallery' },
      ])} />
      <SiteNav
        active="gallery"
        actionLabel="Cover Forge"
        actionShortLabel="CF"
        actionHref="/gallery/cover-forge"
      />
      <StyleGallery />
      <SiteFooter />
    </main>
  )
}
