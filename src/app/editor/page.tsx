import { redirect } from 'next/navigation'

export default function EditorListRedirectPage() {
  redirect('/skills?type=tool&category=editor')
}
