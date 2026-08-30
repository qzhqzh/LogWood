import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { isPrivateCandidatePreview } from '@/lib/private-candidate-preview'
import {
  CandidatePromoteTo,
  CandidateStatus,
  Prisma,
  TargetType,
} from '@prisma/client'
import { createApp, CreateAppInput } from '@/modules/app'
import { createSkill, CreateSkillInput } from '@/modules/skill'
import { createTarget } from '@/modules/target'
import { candidateStatusLabel } from './constants'

export {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  candidateStatusLabel,
} from './constants'

export const CANDIDATE_PRIVATE_TAG = 'visibility:private'

export type CandidateVisibility = 'public' | 'private'

export interface CreateCandidateInput {
  title: string
  ideaKey?: string
  summary?: string
  rawContent?: string
  websiteUrl?: string
  sourceUrl?: string
  logoUrl?: string
  previewImageUrl?: string
  tags?: string[]
  visibility?: CandidateVisibility
  status?: CandidateStatus
  sortOrder?: number
}

export interface UpdateCandidateInput extends CreateCandidateInput {
  id: string
}

export interface PromoteCandidateInput {
  id: string
  to: 'tool' | 'skill' | 'gallery'
  targetType?: TargetType
  skill?: CreateSkillInput
  app?: CreateAppInput
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || `candidate-${Date.now()}`
  )
}

function safeCandidateLink(value?: string): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  if (/^\/(?!\/)/.test(normalized)) return normalized
  try {
    const protocol = new URL(normalized).protocol
    if (protocol === 'http:' || protocol === 'https:') return normalized
  } catch {
    // Fall through to the stable validation error.
  }
  throw new Error('ERR_CANDIDATE_URL_INVALID')
}

async function ensureUniqueSlug(baseSlug: string, ignoreId?: string): Promise<string> {
  let slug = baseSlug
  let i = 1
  while (true) {
    const existing = await prisma.candidate.findUnique({ where: { slug } })
    if (!existing || existing.id === ignoreId) return slug
    i += 1
    slug = `${baseSlug}-${i}`
  }
}

function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

function candidateVisibility(tags: readonly string[]): CandidateVisibility {
  return tags.includes(CANDIDATE_PRIVATE_TAG) ? 'private' : 'public'
}

function candidateTagsForStorage(
  tags: readonly string[],
  visibility: CandidateVisibility,
): string[] {
  const visibleTags = tags.filter((tag) => tag !== CANDIDATE_PRIVATE_TAG)
  return visibility === 'private'
    ? [...visibleTags, CANDIDATE_PRIVATE_TAG]
    : visibleTags
}

function assertCandidatePreviewVisibility(
  visibility: CandidateVisibility,
  previewImageUrl: string | null,
) {
  if (
    visibility === 'private'
    && previewImageUrl
    && !isPrivateCandidatePreview(previewImageUrl)
  ) {
    throw new Error('ERR_CANDIDATE_PRIVATE_PREVIEW_REQUIRED')
  }
}

function mapCandidate<T extends { tags: string }>(
  candidate: T,
): Omit<T, 'tags'> & { tags: string[]; visibility: CandidateVisibility } {
  const storedTags = parseTags(candidate.tags)
  return {
    ...candidate,
    tags: storedTags.filter((tag) => tag !== CANDIDATE_PRIVATE_TAG),
    visibility: candidateVisibility(storedTags),
  }
}

export async function listCandidates(opts?: {
  status?: CandidateStatus
  statuses?: CandidateStatus[]
  includePromoted?: boolean
  search?: string
  authorUserId?: string
  limit?: number
}) {
  const where: Prisma.CandidateWhereInput = {}
  if (opts?.authorUserId) {
    where.authorUserId = opts.authorUserId
  } else {
    where.NOT = { tags: { contains: `"${CANDIDATE_PRIVATE_TAG}"` } }
  }
  if (opts?.statuses?.length) {
    where.status = { in: opts.statuses }
  } else if (opts?.status) {
    where.status = opts.status
  } else if (!opts?.includePromoted) {
    where.status = { in: [CandidateStatus.watching, CandidateStatus.evaluating] }
  }
  const search = opts?.search?.trim()
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { tags: { contains: search, mode: 'insensitive' } },
    ]
  }

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    ...(opts?.limit ? { take: opts.limit } : {}),
    include: {
      _count: { select: { reviews: { where: { status: 'published' } } } },
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  })

  return candidates.map((c) => {
    const ratings = c.reviews.map((r) => r.rating)
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null
    const { reviews, rawContent, ...rest } = c
    return {
      ...mapCandidate(rest),
      ...(opts?.authorUserId ? { rawContent } : {}),
      reviewCount: c._count.reviews,
      avgRating,
    }
  })
}

export async function listAllCandidatesForAdmin() {
  const candidates = await prisma.candidate.findMany({
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    include: {
      _count: { select: { reviews: { where: { status: 'published' } } } },
    },
  })
  return candidates.map((c) => ({
    ...mapCandidate(c),
    reviewCount: c._count.reviews,
  }))
}

export async function getCandidateBySlug(
  slug: string,
  opts?: { viewerUserId?: string; isAdmin?: boolean },
) {
  const candidate = await prisma.candidate.findUnique({
    where: { slug },
    include: {
      _count: { select: { reviews: { where: { status: 'published' } } } },
      reviews: {
        where: { status: 'published' },
        select: { rating: true },
      },
    },
  })
  if (!candidate) return null

  const storedTags = parseTags(candidate.tags)
  if (
    candidateVisibility(storedTags) === 'private'
    && !opts?.isAdmin
    && opts?.viewerUserId !== candidate.authorUserId
  ) {
    return null
  }

  const ratings = candidate.reviews.map((r) => r.rating)
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null
  const { reviews, ...rest } = candidate
  return {
    ...mapCandidate(rest),
    reviewCount: candidate._count.reviews,
    avgRating,
  }
}

export async function getCandidateById(id: string) {
  const candidate = await prisma.candidate.findUnique({ where: { id } })
  return candidate ? mapCandidate(candidate) : null
}

async function updateCandidateFromObservedState(
  id: string,
  observedStatus: CandidateStatus,
  data: Prisma.CandidateUpdateManyMutationInput,
  observedTags?: string,
) {
  const result = await prisma.candidate.updateMany({
    where: {
      id,
      status: observedStatus,
      ...(observedTags === undefined ? {} : { tags: observedTags }),
    },
    data,
  })
  const latest = await prisma.candidate.findUnique({ where: { id } })
  if (result.count !== 1) {
    if (!latest) throw new Error('ERR_CANDIDATE_NOT_FOUND')
    if (latest.status === CandidateStatus.promoted) {
      throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
    }
    throw new Error('ERR_CANDIDATE_STATE_CONFLICT')
  }
  if (!latest) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  return mapCandidate(latest)
}

export async function organizeCandidate(input: {
  id: string
  tags?: string[]
  status?: CandidateStatus
}) {
  const existing = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (input.status === CandidateStatus.promoted) {
    throw new Error('ERR_CANDIDATE_PROMOTION_REQUIRED')
  }
  if (existing.status === CandidateStatus.promoted && input.status) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }

  const existingTags = parseTags(existing.tags)

  return updateCandidateFromObservedState(input.id, existing.status, {
    ...(input.tags ? {
      tags: JSON.stringify(candidateTagsForStorage(
        input.tags,
        candidateVisibility(existingTags),
      )),
    } : {}),
    ...(input.status ? { status: input.status } : {}),
  }, existing.tags)
}

export async function findCandidateDuplicate(input: {
  ideaKey: string
  title: string
  sourceUrl?: string
  authorUserId: string
}) {
  const conditions: Prisma.CandidateWhereInput[] = [
    { slug: buildCandidateIdeaSlug(input.ideaKey, input.authorUserId) },
  ]
  if (input.sourceUrl) {
    conditions.push({ sourceUrl: input.sourceUrl.trim() })
  } else {
    conditions.push({ title: { equals: input.title.trim(), mode: 'insensitive' } })
  }

  const candidate = await prisma.candidate.findFirst({
    where: {
      authorUserId: input.authorUserId,
      OR: conditions,
    },
  })
  return candidate ? mapCandidate(candidate) : null
}

function buildCandidateIdeaSlug(ideaKey: string, authorUserId: string): string {
  const identity = `${authorUserId}:${ideaKey}`
  return `idea-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`
}

export async function createCandidate(input: CreateCandidateInput, authorUserId?: string) {
  if (input.status === CandidateStatus.promoted) {
    throw new Error('ERR_CANDIDATE_PROMOTION_REQUIRED')
  }
  const slug = input.ideaKey
    ? buildCandidateIdeaSlug(input.ideaKey, authorUserId || 'system')
    : await ensureUniqueSlug(slugify(input.title))
  const visibility = input.visibility ?? 'public'
  const previewImageUrl = safeCandidateLink(input.previewImageUrl)
  assertCandidatePreviewVisibility(visibility, previewImageUrl)
  return prisma.candidate
    .create({
      data: {
        title: input.title.trim(),
        slug,
        summary: input.summary?.trim() || null,
        rawContent: input.rawContent?.trim() || null,
        websiteUrl: safeCandidateLink(input.websiteUrl),
        sourceUrl: safeCandidateLink(input.sourceUrl),
        logoUrl: safeCandidateLink(input.logoUrl),
        previewImageUrl,
        tags: JSON.stringify(candidateTagsForStorage(
          input.tags || [],
          visibility,
        )),
        status: input.status ?? CandidateStatus.watching,
        sortOrder: input.sortOrder ?? 0,
        authorUserId,
      },
    })
    .then(mapCandidate)
}

export async function updateCandidate(input: UpdateCandidateInput) {
  const existing = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (
    input.status === CandidateStatus.promoted
    && existing.status !== CandidateStatus.promoted
  ) {
    throw new Error('ERR_CANDIDATE_PROMOTION_REQUIRED')
  }
  if (
    existing.status === CandidateStatus.promoted
    && input.status !== undefined
    && input.status !== CandidateStatus.promoted
  ) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }

  let slug = existing.slug
  if (input.title.trim() !== existing.title && !existing.slug.startsWith('idea-')) {
    slug = await ensureUniqueSlug(slugify(input.title), existing.id)
  }
  const existingTags = parseTags(existing.tags)
  const visibility = input.visibility ?? candidateVisibility(existingTags)
  const previewImageUrl = safeCandidateLink(input.previewImageUrl)
  assertCandidatePreviewVisibility(visibility, previewImageUrl)

  return updateCandidateFromObservedState(input.id, existing.status, {
    title: input.title.trim(),
    slug,
    summary: input.summary?.trim() || null,
    rawContent: input.rawContent === undefined
      ? existing.rawContent
      : input.rawContent.trim() || null,
    websiteUrl: safeCandidateLink(input.websiteUrl),
    sourceUrl: safeCandidateLink(input.sourceUrl),
    logoUrl: safeCandidateLink(input.logoUrl),
    previewImageUrl,
    tags: JSON.stringify(candidateTagsForStorage(
      input.tags ?? existingTags,
      visibility,
    )),
    status: input.status ?? existing.status,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  }, existing.tags)
}

export async function updateCandidatePreview(input: {
  id: string
  previewImageUrl: string
}) {
  const existing = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (existing.status === CandidateStatus.promoted) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }
  const previewImageUrl = safeCandidateLink(input.previewImageUrl)
  assertCandidatePreviewVisibility(
    candidateVisibility(parseTags(existing.tags)),
    previewImageUrl,
  )

  return updateCandidateFromObservedState(input.id, existing.status, {
    previewImageUrl,
  }, existing.tags)
}

export async function updateCandidateDraftContent(input: {
  id: string
  rawContent: string
}) {
  const existing = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (existing.status === CandidateStatus.promoted) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }
  if (candidateVisibility(parseTags(existing.tags)) !== 'private') {
    throw new Error('ERR_CANDIDATE_PRIVATE_DRAFT_REQUIRED')
  }

  return updateCandidateFromObservedState(input.id, existing.status, {
    rawContent: input.rawContent.trim() || null,
  }, existing.tags)
}

export async function deleteCandidate(
  id: string,
  db: Pick<Prisma.TransactionClient, 'candidate'> = prisma,
) {
  const existing = await db.candidate.findUnique({ where: { id } })
  if (!existing) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (
    existing.status === CandidateStatus.dropped
    || existing.status === CandidateStatus.promoted
    || existing.promotedTo
    || existing.promotedTargetId
    || existing.promotedSkillId
    || existing.promotedAppId
  ) {
    throw new Error('ERR_CANDIDATE_HISTORY_PROTECTED')
  }
  return db.candidate.delete({ where: { id }, select: { id: true, slug: true } })
}

export async function promoteCandidate(input: PromoteCandidateInput) {
  const candidate = await prisma.candidate.findUnique({ where: { id: input.id } })
  if (!candidate) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  if (candidate.status === CandidateStatus.promoted) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }
  if (candidateVisibility(parseTags(candidate.tags)) === 'private') {
    throw new Error('ERR_CANDIDATE_PRIVATE_DRAFT')
  }

  if (input.to === 'tool') {
    return prisma.$transaction(async (tx) => {
      const target = await createTarget({
        name: candidate.title,
        type: input.targetType || TargetType.coding,
        logoUrl: candidate.logoUrl || undefined,
        description: candidate.summary || undefined,
        websiteUrl: candidate.websiteUrl || undefined,
        previewImageUrl: candidate.previewImageUrl || undefined,
        sourceUrl: candidate.sourceUrl || undefined,
        features: parseTags(candidate.tags),
      }, tx)
      const updatedCandidate = await markCandidatePromoted(tx, candidate, {
        promotedTo: CandidatePromoteTo.tool,
        promotedTargetId: target.id,
      })
      return {
        candidate: updatedCandidate,
        promoted: { type: 'tool' as const, id: target.id, slug: target.slug },
      }
    })
  }

  if (input.to === 'skill') {
    const sourceUrl = candidate.sourceUrl || candidate.websiteUrl
    return prisma.$transaction(async (tx) => {
      const skillInput: CreateSkillInput = input.skill ?? {
        title: candidate.title,
        category: 'other',
        summary: candidate.summary || candidate.title,
        prompt: [
          `待复用内容：${candidate.summary || candidate.title}`,
          sourceUrl ? `来源：${sourceUrl}` : null,
        ].filter(Boolean).join('\n\n'),
        effectImageUrl: candidate.previewImageUrl || candidate.logoUrl || undefined,
        sourceUrl: sourceUrl || undefined,
        tags: parseTags(candidate.tags),
        status: 'draft',
      }
      const skill = await createSkill(skillInput, candidate.authorUserId || undefined, tx)

      const updatedCandidate = await markCandidatePromoted(tx, candidate, {
        promotedTo: CandidatePromoteTo.skill,
        promotedSkillId: skill.id,
      })
      return {
        candidate: updatedCandidate,
        promoted: { type: 'skill' as const, id: skill.id, slug: skill.slug },
      }
    })
  }

  const previewImageUrl = input.app?.previewImageUrl
    || candidate.previewImageUrl
    || candidate.logoUrl
  if (!previewImageUrl) {
    throw new Error('ERR_CANDIDATE_IMAGE_REQUIRED')
  }

  const appInput: CreateAppInput = input.app
    ? { ...input.app, previewImageUrl }
    : {
        name: candidate.title,
        appUrl: candidate.websiteUrl
          || candidate.sourceUrl
          || `/candidates/${candidate.slug}`,
        title: candidate.title,
        summary: candidate.summary || candidate.title,
        description: candidate.summary || candidate.title,
        previewImageUrl,
        tags: parseTags(candidate.tags),
        status: 'published',
      }
  return prisma.$transaction(async (tx) => {
    const app = await createApp(appInput, candidate.authorUserId || undefined, tx)

    const updatedCandidate = await markCandidatePromoted(tx, candidate, {
        promotedTo: CandidatePromoteTo.gallery,
        promotedAppId: app.id,
    })
    return {
      candidate: updatedCandidate,
      promoted: { type: 'gallery' as const, id: app.id, slug: app.slug },
    }
  })
}

async function markCandidatePromoted(
  tx: Prisma.TransactionClient,
  candidate: { id: string; status: CandidateStatus },
  data: Pick<Prisma.CandidateUncheckedUpdateManyInput, 'promotedTo'>
    & Partial<Pick<
      Prisma.CandidateUncheckedUpdateManyInput,
      'promotedTargetId' | 'promotedSkillId' | 'promotedAppId'
    >>,
) {
  const result = await tx.candidate.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
    },
    data: {
      status: CandidateStatus.promoted,
      ...data,
    },
  })
  if (result.count !== 1) {
    throw new Error('ERR_CANDIDATE_ALREADY_PROMOTED')
  }

  const updatedCandidate = await tx.candidate.findUnique({ where: { id: candidate.id } })
  if (!updatedCandidate) throw new Error('ERR_CANDIDATE_NOT_FOUND')
  return mapCandidate(updatedCandidate)
}

export async function countActiveCandidates() {
  return prisma.candidate.count({
    where: { status: { in: [CandidateStatus.watching, CandidateStatus.evaluating] } },
  })
}
