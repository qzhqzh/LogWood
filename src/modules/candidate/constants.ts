export const CANDIDATE_STATUSES = ['watching', 'evaluating', 'promoted', 'dropped'] as const

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  watching: '未处理',
  evaluating: '好灵感',
  promoted: '已转化',
  dropped: '不合适',
}

export function candidateStatusLabel(status: string): string {
  return CANDIDATE_STATUS_LABELS[status] || status
}
