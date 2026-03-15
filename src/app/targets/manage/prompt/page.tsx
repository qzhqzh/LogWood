import { redirect } from 'next/navigation'

export default function ManagePromptTargetsPage() {
  redirect('/targets/manage?type=prompt')
}
