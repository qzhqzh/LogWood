import { permanentRedirect } from 'next/navigation'

/** Preserve the historical gallery URL while serving the unified collection. */
export default function LegacyGalleryPage() {
  permanentRedirect('/skills?type=visual')
}
