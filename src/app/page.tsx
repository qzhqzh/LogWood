import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/json-ld'
import { PromptGlitchTitle } from '@/components/prompt-glitch-title'
import { SiteNav } from '@/components/site-nav'
import { SITE_NAME, SITE_TAGLINE, buildMetadata, buildWebSite } from '@/shared/seo'

export const metadata: Metadata = buildMetadata({
  title: `${SITE_NAME} - ${SITE_TAGLINE}`,
  description: '进入可执行、可测试、可验证的 Prompt 工作台。',
  path: '/',
})

// The entry screen is intentionally rendered per request. This prevents an
// upstream CDN from retaining a previous visual release as immutable HTML.
export const dynamic = 'force-dynamic'

const signalFragments = [
  '·  ···  ─────  ·  ···',
  '···  ──  ·  ·····  ───',
  '────  ··  ····  ──  ·',
  '··  ─────  ···  ────',
]

const constellationPoints = Array.from({ length: 7 }, (_, index) => index)

export default function HomePage() {
  return (
    <main className="ascii-app ascii-entry-page">
      <JsonLd value={buildWebSite()} />
      <div className="ascii-entry-corners" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <SiteNav active="skills" />

      <section className="ascii-entry-hero" aria-labelledby="entry-title">
        <div className="ascii-entry-hero__mark" aria-hidden="true">K</div>
        <div className="ascii-entry-hero__geometry" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="ascii-entry-hero__signals" aria-hidden="true">
          {signalFragments.map((fragment, index) => <span key={index}>{fragment}</span>)}
        </div>
        <div className="ascii-entry-hero__constellation ascii-entry-hero__constellation--left" aria-hidden="true">
          {constellationPoints.map((point) => <i key={point} />)}
        </div>
        <div className="ascii-entry-hero__constellation ascii-entry-hero__constellation--right" aria-hidden="true">
          {constellationPoints.map((point) => <i key={point} />)}
        </div>
        <div className="ascii-entry-hero__alert" aria-hidden="true">
          <strong>△</strong><span>······</span>
        </div>
        <div className="ascii-entry-hero__content">
          <div id="entry-title">
            <PromptGlitchTitle className="ascii-entry-hero__title" />
          </div>
          <p><span aria-hidden="true">[</span> PROMPTS, PROVEN. <span aria-hidden="true">]</span></p>
          <Link href="/workbench" className="ascii-entry-link" aria-label="进入 Prompt 工作台">
            <strong>[ ENTER ]</strong>
          </Link>
        </div>
      </section>

      <footer className="ascii-entry-status" aria-label="站点状态">
        <span><i aria-hidden="true" /> STATUS <strong>READY</strong></span>
        <span>SIGNAL <b aria-hidden="true">||||||||||||||||||||</b></span>
        <span>ARCHIVE <strong>ONLINE</strong></span>
      </footer>
    </main>
  )
}
