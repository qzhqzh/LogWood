import { redirect } from 'next/navigation'

export default function EditorListRedirectPage() {
  redirect('/tools?category=editor')
}
