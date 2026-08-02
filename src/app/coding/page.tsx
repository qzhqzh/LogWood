import { redirect } from 'next/navigation'

interface CodingRedirectProps {
  searchParams: Promise<{ category?: string }>
}

/** Legacy /coding → 收藏室的工具视图 */
export default async function CodingRedirectPage({ searchParams }: CodingRedirectProps) {
  const { category } = await searchParams
  if (category) {
    redirect(`/skills?type=tool&category=${category}`)
  }
  redirect('/skills?type=tool&category=coding')
}
