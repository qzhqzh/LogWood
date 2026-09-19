export interface ThoughtAttribution {
  provider: string
  model: string
  modelVersion: string
  generatedAt: string
}

export interface ThoughtTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  replyTo?: string
  attribution?: ThoughtAttribution
}

export interface ThoughtArticlePreview {
  id: string
  title: string
  slug: string
  excerpt: string | null
  contentHtml: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  reviewStatus: 'pending' | 'approved' | 'changes_requested'
  currentVersion: number
  approvedVersion: number | null
  updatedAt: string
  publishedAt: string | null
  attribution?: ThoughtAttribution
}

export interface ThoughtSessionSummary {
  id: string
  title: string
  summary: string | null
  turnCount: number
  updatedAt: string
  article: Pick<
    ThoughtArticlePreview,
    'id' | 'title' | 'slug' | 'status' | 'currentVersion' | 'updatedAt'
  > | null
}

export interface ThoughtSession extends ThoughtSessionSummary {
  turns: ThoughtTurn[]
  article: ThoughtArticlePreview | null
}
