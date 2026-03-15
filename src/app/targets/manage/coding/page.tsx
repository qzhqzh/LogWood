import { redirect } from 'next/navigation'

export default function ManageCodingTargetsPage() {
  redirect('/targets/manage?type=coding')
}
