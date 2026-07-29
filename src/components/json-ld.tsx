/**
 * Server component that emits a `<script type="application/ld+json">` tag
 * for the supplied schema.org value.
 *
 * - Skips `undefined` properties via the `JSON.stringify` replacer so builders
 *   can use `?:` spreads without polluting the output.
 * - Escapes HTML-significant characters so user-controlled structured values
 *   cannot terminate the script element.
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
  const json = serializeJsonLd(value)
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}

export function serializeJsonLd(value: JsonLdValue | JsonLdValue[]): string {
  return JSON.stringify(value, replacer)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
