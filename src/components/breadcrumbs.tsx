import Link from 'next/link'

/**
 * Visible breadcrumb trail. JSON-LD is NOT emitted from this component;
 * callers must render `<JsonLd value={buildBreadcrumbList(...)} />` separately
 * so the visible labels and the structured-data labels stay in sync at the
 * call site.
 *
 * Convention: the trailing item should omit `href` (it represents the current
 * page) so it renders as plain text and not as a redundant self-link.
 */
export interface BreadcrumbsItem {
  name: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbsItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-soft hover-text-coding transition-colors"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className={isLast ? 'text-coding' : 'text-soft'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.name}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-soft px-1">
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
