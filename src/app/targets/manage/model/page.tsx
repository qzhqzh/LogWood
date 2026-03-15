import { redirect } from 'next/navigation'

export default function ManageModelTargetsPage() {
  redirect('/targets/manage?type=model')
}
