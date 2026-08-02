export const CANDIDATE_STATUSES = ['watching', 'evaluating', 'promoted', 'dropped'] as const

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  watching: '未处理',
  evaluating: '观察中',
  promoted: '已入藏',
  dropped: '已淘汰',
}

export function candidateStatusLabel(status: string): string {
  return CANDIDATE_STATUS_LABELS[status] || status
}
