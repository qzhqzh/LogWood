export interface ReviewSubjectProjection {
  target?: {
    name: string
    slug: string
    type: string
  } | null
  skill?: {
    title: string
    slug: string
  } | null
  app?: {
    title: string
    slug: string
  } | null
  candidate?: {
    title: string
    slug: string
  } | null
}

export interface ReviewSubjectPresentation {
  title: string
  href: string
  kind: string
}

const TARGET_KIND_LABELS: Record<string, string> = {
  editor: '软件',
  coding: '工具',
  model: '模型',
  prompt: '提示资源',
}

/**
 * Converts the current polymorphic Review relations into one stable UI shape.
 *
 * This is intentionally a presentation adapter rather than a new persistence
 * model. It lets the public UI converge before Target, App and Candidate are
 * physically migrated into the future Resource model.
 */
export function getReviewSubjectPresentation(
  subject: ReviewSubjectProjection,
): ReviewSubjectPresentation | null {
  if (subject.skill) {
    return {
      title: subject.skill.title,
      href: `/skills/${subject.skill.slug}`,
      kind: 'Skill',
    }
  }

  if (subject.candidate) {
    return {
      title: subject.candidate.title,
      href: `/candidates/${subject.candidate.slug}`,
      kind: '灵感',
    }
  }

  if (subject.app) {
    return {
      title: subject.app.title,
      href: `/app/${subject.app.slug}`,
      kind: '项目',
    }
  }

  if (subject.target) {
    return {
      title: subject.target.name,
      href: `/${subject.target.type}/${subject.target.slug}`,
      kind: TARGET_KIND_LABELS[subject.target.type] || '资源',
    }
  }

  return null
}
