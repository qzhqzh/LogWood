import { redirect } from 'next/navigation'

interface CodingRedirectProps {
  searchParams: Promise<{ category?: string }>
}

/** Legacy /coding → 工具收藏 */
export default async function CodingRedirectPage({ searchParams }: CodingRedirectProps) {
  const { category } = await searchParams
  if (category) {
    redirect(`/tools?category=${category}`)
  }
  redirect('/tools')
}
