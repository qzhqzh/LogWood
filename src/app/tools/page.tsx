import { permanentRedirect } from 'next/navigation'

interface LegacyToolsPageProps {
  searchParams: Promise<{ category?: string }>
}

/** Preserve the historical list URL while serving the unified collection. */
export default async function LegacyToolsPage({ searchParams }: LegacyToolsPageProps) {
  const { category } = await searchParams
  permanentRedirect(`/skills?type=tool${category ? `&category=${encodeURIComponent(category)}` : ''}`)
}
