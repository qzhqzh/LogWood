import { redirect } from 'next/navigation'

export default function ManageEditorTargetsPage() {
  redirect('/targets/manage?type=editor')
}
