export const CANDIDATE_STATUSES = ['watching', 'evaluating', 'promoted', 'dropped'] as const

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  watching: '观察中',
  evaluating: '评测中',
  promoted: '已晋升',
  dropped: '已放弃',
}

export function candidateStatusLabel(status: string): string {
  return CANDIDATE_STATUS_LABELS[status] || status
}
