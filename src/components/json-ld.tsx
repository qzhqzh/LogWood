/**
 * Server component that emits a `<script type="application/ld+json">` tag
 * for the supplied schema.org value.
 *
 * - Skips `undefined` properties via the `JSON.stringify` replacer so builders
 *   can use `?:` spreads without polluting the output.
 * - Does NOT escape `<`, `>`, `&` because Next.js renders the script via
 *   `dangerouslySetInnerHTML`; callers are responsible for ensuring the input
 *   is a structured value, not user-controlled HTML.
 *
 * Multiple JSON-LD blocks per page are allowed by Google; render this
 * component multiple times (e.g. BreadcrumbList + Article + WebSite).
 */
import type { JsonLdValue } from '@/shared/seo/json-ld'

interface JsonLdProps {
  value: JsonLdValue | JsonLdValue[]
}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'undefined' ? undefined : value
}

export function JsonLd({ value }: JsonLdProps) {
  const json = JSON.stringify(value, replacer)
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
