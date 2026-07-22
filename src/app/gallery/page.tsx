import { redirect } from 'next/navigation'

/** Alias: /gallery → 画廊（现用 /app） */
export default function GalleryAliasPage() {
  redirect('/app')
}
