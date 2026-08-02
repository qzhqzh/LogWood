import { redirect } from 'next/navigation'

/** Alias: /gallery → 收藏室的视觉视图 */
export default function GalleryAliasPage() {
  redirect('/skills?type=visual')
}
