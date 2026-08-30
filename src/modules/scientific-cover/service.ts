import { createHash, randomBytes } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import journalProfileCatalog from '../../../.agents/skills/scientific-cover-forge/assets/journal-profiles.json'
import {
  CoverBriefSchema,
  JournalProfileSchema,
  RunManifestSchema,
  createSheets,
  initRun,
  registerRecord,
} from '../../../.agents/skills/scientific-cover-forge/scripts/cover-forge'
import type { PolicySnapshot } from '../../../.agents/skills/scientific-cover-forge/scripts/cover-forge'
import type { PromptTestResult } from '@/modules/prompt-runner'

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_EVIDENCE_FILE_BYTES = 24 * 1024 * 1024
const profiles = journalProfileCatalog.profiles.map((profile) => JournalProfileSchema.parse(profile))

const conciseText = (max: number) => z.string().trim().min(2).max(max)
const listItem = z.string().trim().min(2).max(1_000)

export const ScientificCoverRunInputSchema = z.object({
  profileId: z.string().regex(SAFE_ID),
  projectTitle: conciseText(200),
  articleType: conciseText(200),
  publisher: z.string().trim().max(200).default(''),
  journalName: z.string().trim().max(200).default(''),
  officialGuidelinesUrl: z.union([z.string().url(), z.literal('')]).default(''),
  claim: conciseText(2_000),
  novelty: conciseText(2_000),
  subjectName: conciseText(200),
  subjectRole: conciseText(500),
  outcomeName: conciseText(200),
  allowedRelationship: conciseText(500),
  mustShow: z.array(listItem).min(1).max(30),
  mustNotShow: z.array(listItem).min(1).max(30),
  uncertainties: z.array(listItem).max(30),
  forbiddenInferences: z.array(listItem).min(1).max(30),
  artDirection: z.object({
    mood: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
    palette: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
    medium: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
    avoid: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  }).strict(),
  concepts: z.array(z.object({
    title: conciseText(100),
    metaphor: conciseText(1_000),
    mapping: conciseText(1_000),
  }).strict()).length(3),
  redactedConfirmed: z.literal(true),
  toolCommercialUseConfirmed: z.boolean(),
}).strict()

const WebPlanCandidateSchema = z.object({
  candidateId: z.string().regex(SAFE_ID),
  promptId: z.string().regex(SAFE_ID),
  conceptId: z.string().regex(SAFE_ID),
  conceptTitle: z.string().min(1).max(100),
  compositionId: z.enum(['monument', 'transit']),
  compositionTitle: z.string().min(1).max(100),
  prompt: z.string().min(20).max(100_000),
}).strict()

const WebPlanSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  createdAt: z.string().datetime({ offset: true }),
  brief: ScientificCoverRunInputSchema,
  candidates: z.array(WebPlanCandidateSchema).length(6),
}).strict()

export type ScientificCoverRunInput = z.infer<typeof ScientificCoverRunInputSchema>
export type ScientificCoverPlanCandidate = z.infer<typeof WebPlanCandidateSchema>

export class ScientificCoverError extends Error {
  constructor(
    public readonly code:
      | 'ERR_SCIENTIFIC_COVER_NOT_FOUND'
      | 'ERR_SCIENTIFIC_COVER_BLOCKED'
      | 'ERR_SCIENTIFIC_COVER_POLICY_EXPIRED'
      | 'ERR_SCIENTIFIC_COVER_CANDIDATE_EXISTS'
      | 'ERR_SCIENTIFIC_COVER_PROMPT_INTEGRITY'
      | 'ERR_SCIENTIFIC_COVER_IMAGE_INVALID'
      | 'ERR_SCIENTIFIC_COVER_RESULT_INVALID'
      | 'ERR_SCIENTIFIC_COVER_JOURNAL_REQUIRED'
      | 'ERR_SCIENTIFIC_COVER_GUIDELINES_REQUIRED'
      | 'ERR_SCIENTIFIC_COVER_STORAGE_INVALID',
  ) {
    super(code)
    this.name = 'ScientificCoverError'
  }
}

export interface ScientificCoverProfileSummary {
  id: string
  publisher: string
  journal: string
  policyState: 'allowed' | 'permission_required' | 'prohibited' | 'manual_review'
  reviewAfter: string
  exactJournalProfile: boolean
  permissionEvidenceRequired: boolean
  toolCommercialUseConfirmationRequired: boolean
  sourceUrls: string[]
  spec: {
    width: number
    height: number
    dpi: number
    physical: string
    safeAreaLabels: string[]
    acceptedFormats: string[]
  } | null
}

export interface ScientificCoverCandidateSummary extends ScientificCoverPlanCandidate {
  generated: boolean
  imageUrl: string | null
  provider: string | null
  model: string | null
  modelVersion: string | null
  providerRequestId: string | null
  generatedAt: string | null
  actual: {
    width: number
    height: number
    format: string
    fileSize: number
  } | null
}

export interface ScientificCoverRunSummary {
  runId: string
  status: string
  createdAt: string
  runPath: string
  brief: ScientificCoverRunInput
  policy: {
    profileId: string
    publisher: string
    journal: string
    storedState: string
    effectiveState: string
    reviewAfter: string
    generationAllowed: boolean
    finalizationBlocked: boolean
    reasons: string[]
    sourceUrls: string[]
    spec: ScientificCoverProfileSummary['spec']
  }
  candidates: ScientificCoverCandidateSummary[]
  generatedCount: number
  contactSheetUrl: string | null
  continuationCommand: string
}

interface ServiceOptions {
  baseDirectory?: string
  now?: Date
}

const COMPOSITIONS = [
  {
    id: 'monument' as const,
    title: 'MONUMENT / 静态主景',
    instruction: 'Build one dominant central subject with quiet surrounding space, a clear silhouette, and immediate thumbnail recognition.',
  },
  {
    id: 'transit' as const,
    title: 'TRANSIT / 关系动线',
    instruction: 'Use a controlled diagonal or curved visual path to reveal the allowed relationship, while keeping the main subject unmistakable.',
  },
]

function publicSpec(profile: z.infer<typeof JournalProfileSchema>): ScientificCoverProfileSummary['spec'] {
  if (!profile.spec) return null
  return {
    width: profile.spec.minPixels.width,
    height: profile.spec.minPixels.height,
    dpi: profile.spec.dpi,
    physical: `${profile.spec.physicalWidth} × ${profile.spec.physicalHeight} ${profile.spec.physicalUnit}`,
    safeAreaLabels: profile.spec.safeAreas.map((area) => area.label),
    acceptedFormats: profile.spec.acceptedFormats,
  }
}

export function listScientificCoverProfiles(): ScientificCoverProfileSummary[] {
  return profiles.map((profile) => ({
    id: profile.id,
    publisher: profile.publisher,
    journal: profile.journal,
    policyState: profile.policyState,
    reviewAfter: profile.reviewAfter,
    exactJournalProfile: profile.exactJournalProfile,
    permissionEvidenceRequired: profile.permissionEvidenceRequired,
    toolCommercialUseConfirmationRequired: profile.toolCommercialUseConfirmationRequired,
    sourceUrls: profile.sourceUrls,
    spec: publicSpec(profile),
  }))
}

function profileFor(profileId: string) {
  const profile = profiles.find((entry) => entry.id === profileId)
  if (!profile) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  return profile
}

function ownerDirectory(ownerUserId: string) {
  return createHash('sha256').update(ownerUserId).digest('hex').slice(0, 24)
}

function artifactsBase(options: ServiceOptions = {}) {
  return path.resolve(
    options.baseDirectory
      ?? process.env.SCIENTIFIC_COVER_ARTIFACTS_DIR?.trim()
      ?? path.join(process.cwd(), 'artifacts', 'scientific-covers', 'web'),
  )
}

function assertSafeId(value: string) {
  if (!SAFE_ID.test(value)) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
}

function resolveInside(root: string, relativePath: string) {
  const target = path.resolve(root, relativePath)
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  }
  return target
}

async function existingRunDirectory(ownerUserId: string, runId: string, options: ServiceOptions = {}) {
  assertSafeId(runId)
  const directory = path.join(artifactsBase(options), ownerDirectory(ownerUserId), runId)
  try {
    const info = await lstat(directory)
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('invalid run directory')
    return await realpath(directory)
  } catch {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  }
}

async function readJson(filePath: string, maxBytes = 5 * 1024 * 1024) {
  const info = await lstat(filePath)
  if (info.isSymbolicLink() || !info.isFile() || info.size > maxBytes) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

function targetJournal(input: ScientificCoverRunInput, profile: z.infer<typeof JournalProfileSchema>) {
  if (profile.exactJournalProfile) {
    return { publisher: profile.publisher, name: profile.journal }
  }
  const publisher = input.publisher || profile.publisher
  const name = input.journalName
  if (!publisher || !name) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_JOURNAL_REQUIRED')
  }
  return { publisher, name }
}

function runIdentifier(now: Date) {
  const stamp = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `cover-${stamp}-${randomBytes(4).toString('hex')}`
}

function promptGeometry(profile: z.infer<typeof JournalProfileSchema>) {
  if (!profile.spec) return 'Portrait cover concept. Exact journal canvas is not yet verified; do not describe the result as submission-ready.'
  const safeAreas = profile.spec.safeAreas.length
    ? profile.spec.safeAreas.map((area) => `${area.label}: x ${area.x}, y ${area.y}, width ${area.width}, height ${area.height}`).join('; ')
    : 'No profile-specific safe-area overlay recorded.'
  return `Portrait canvas ratio ${profile.spec.minPixels.width}:${profile.spec.minPixels.height}. Reserve safe areas without drawing journal marks: ${safeAreas}`
}

function compilePlan(input: ScientificCoverRunInput, profile: z.infer<typeof JournalProfileSchema>, now: Date) {
  const candidates: ScientificCoverPlanCandidate[] = []
  input.concepts.forEach((concept, conceptIndex) => {
    COMPOSITIONS.forEach((composition, compositionIndex) => {
      const index = conceptIndex * COMPOSITIONS.length + compositionIndex + 1
      const suffix = String(index).padStart(2, '0')
      candidates.push(WebPlanCandidateSchema.parse({
        candidateId: `initial-${suffix}`,
        promptId: `prompt-initial-${suffix}`,
        conceptId: `concept-${conceptIndex + 1}`,
        conceptTitle: concept.title,
        compositionId: composition.id,
        compositionTitle: composition.title,
        prompt: [
          'USE CASE',
          'Original, text-free scientific journal cover concept artwork. This is a qualitative editorial metaphor, not observed evidence or a graphical abstract.',
          '',
          'SCIENTIFIC STORY',
          `Claim: ${input.claim}`,
          `Novelty: ${input.novelty}`,
          `Central subject: ${input.subjectName} — ${input.subjectRole}.`,
          `Allowed relationship: ${input.subjectName} ${input.allowedRelationship} ${input.outcomeName}.`,
          '',
          'APPROVED METAPHOR',
          `${concept.metaphor}`,
          `Fact mapping: ${concept.mapping}`,
          '',
          'COMPOSITION',
          composition.instruction,
          promptGeometry(profile),
          'Keep the focal subject legible at thumbnail size and leave editorial breathing room.',
          '',
          'ART DIRECTION',
          `Mood: ${input.artDirection.mood.join(', ')}.`,
          `Palette: ${input.artDirection.palette.join(', ')}.`,
          `Medium: ${input.artDirection.medium.join(', ')}.`,
          '',
          'TRUTH CONSTRAINTS',
          `Must show: ${input.mustShow.join('; ')}.`,
          `Must not show: ${input.mustNotShow.join('; ')}.`,
          `Uncertainties: ${input.uncertainties.join('; ') || 'None declared beyond the truth boundary.'}.`,
          `Forbidden inferences: ${input.forbiddenInferences.join('; ')}.`,
          '',
          'OUTPUT CONSTRAINTS',
          `Avoid: ${input.artDirection.avoid.join(', ')}.`,
          'No text, letters, numerals, labels, captions, equations, plots, axes, journal logos, publisher marks, signatures, watermarks, real-person likenesses, or recognizable brands. Do not imitate a named artist or an existing cover. Do not resemble microscopy, radiology, histology, gels, blots, spectra, or other primary research imagery.',
        ].join('\n'),
      }))
    })
  })
  return WebPlanSchema.parse({
    schemaVersion: '1.0.0',
    createdAt: now.toISOString(),
    brief: input,
    candidates,
  })
}

export async function createScientificCoverRun(
  rawInput: unknown,
  ownerUserId: string,
  options: ServiceOptions = {},
): Promise<ScientificCoverRunSummary> {
  const input = ScientificCoverRunInputSchema.parse(rawInput)
  const now = options.now ?? new Date()
  const profile = profileFor(input.profileId)
  const journal = targetJournal(input, profile)
  if (!profile.exactJournalProfile && !input.officialGuidelinesUrl) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_GUIDELINES_REQUIRED')
  }

  const runId = runIdentifier(now)
  const base = artifactsBase(options)
  const ownerRoot = path.join(base, ownerDirectory(ownerUserId))
  await mkdir(ownerRoot, { recursive: true })
  const ownerInfo = await lstat(ownerRoot)
  if (ownerInfo.isSymbolicLink() || !ownerInfo.isDirectory()) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_STORAGE_INVALID')
  }
  const runDirectory = path.join(ownerRoot, runId)
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'logwood-cover-brief-'))
  try {
    const brief = CoverBriefSchema.parse({
      schemaVersion: '1.0.0',
      runId,
      projectTitle: input.projectTitle,
      journal: {
        profileId: profile.id,
        publisher: journal.publisher,
        name: journal.name,
        articleType: input.articleType,
        officialGuidelinesUrl: input.officialGuidelinesUrl || profile.sourceUrls[0],
      },
      story: {
        claim: input.claim,
        novelty: input.novelty,
        entities: [
          { name: input.subjectName, role: input.subjectRole },
          { name: input.outcomeName, role: 'scientific outcome or resulting state declared by the author' },
        ],
        relationships: [{
          from: input.subjectName,
          to: input.outcomeName,
          type: input.allowedRelationship,
        }],
      },
      truth: {
        mustShow: input.mustShow,
        mustNotShow: input.mustNotShow,
        uncertainties: input.uncertainties,
        forbiddenInferences: input.forbiddenInferences,
      },
      artDirection: input.artDirection,
      references: [],
      privacy: {
        redactedConfirmed: input.redactedConfirmed,
        containsUnpublishedFullText: false,
        containsRawExperimentalData: false,
        containsPrimaryResearchImages: false,
      },
      compliance: {
        toolCommercialUseConfirmed: input.toolCommercialUseConfirmed,
        humanScientificReviewRequired: true,
      },
    })
    const briefPath = path.join(temporary, 'brief.json')
    await writeFile(briefPath, `${JSON.stringify(brief, null, 2)}\n`, { flag: 'wx' })
    await initRun({ briefPath, outPath: runDirectory, now })

    const plan = compilePlan(input, profile, now)
    for (const candidate of plan.candidates) {
      await registerRecord(runDirectory, {
        schemaVersion: '1.0.0',
        kind: 'prompt',
        id: candidate.promptId,
        stage: 'initial',
        conceptId: candidate.conceptId,
        content: candidate.prompt,
      }, now)
    }
    await writeFile(
      path.join(runDirectory, 'web-plan.json'),
      `${JSON.stringify(plan, null, 2)}\n`,
      { flag: 'wx' },
    )
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
  return getScientificCoverRun(ownerUserId, runId, options)
}

async function readRun(ownerUserId: string, runId: string, options: ServiceOptions = {}) {
  const runDirectory = await existingRunDirectory(ownerUserId, runId, options)
  const [briefRaw, manifestRaw, policyRaw, planRaw] = await Promise.all([
    readJson(path.join(runDirectory, 'brief.json')),
    readJson(path.join(runDirectory, 'run-manifest.json')),
    readJson(path.join(runDirectory, 'policy-snapshot.json')),
    readJson(path.join(runDirectory, 'web-plan.json')),
  ])
  return {
    runDirectory,
    brief: CoverBriefSchema.parse(briefRaw),
    manifest: RunManifestSchema.parse(manifestRaw),
    policy: policySnapshotSchema().parse(policyRaw),
    plan: WebPlanSchema.parse(planRaw),
  }
}

function policySnapshotSchema() {
  return z.object({
    schemaVersion: z.literal('1.0.0'),
    createdAt: z.string().datetime({ offset: true }),
    profile: JournalProfileSchema,
    storedState: z.enum(['allowed', 'permission_required', 'prohibited', 'manual_review']),
    effectiveState: z.enum(['allowed', 'permission_required', 'prohibited', 'manual_review']),
    expired: z.boolean(),
    generationAllowed: z.boolean(),
    finalizationBlocked: z.boolean(),
    reasons: z.array(z.string()),
  }).strict()
}

function candidateUrl(runId: string, candidateId: string) {
  return `/api/scientific-covers/runs/${encodeURIComponent(runId)}/candidates/${encodeURIComponent(candidateId)}`
}

export async function getScientificCoverRun(
  ownerUserId: string,
  runId: string,
  options: ServiceOptions = {},
): Promise<ScientificCoverRunSummary> {
  const { runDirectory, brief, manifest, policy, plan } = await readRun(ownerUserId, runId, options)
  const candidates = plan.candidates.map((planned) => {
    const generated = manifest.candidates.find((candidate) => candidate.id === planned.candidateId)
    return {
      ...planned,
      generated: Boolean(generated),
      imageUrl: generated ? candidateUrl(runId, generated.id) : null,
      provider: generated?.provider ?? null,
      model: generated?.model ?? null,
      modelVersion: generated?.modelVersion ?? null,
      providerRequestId: generated?.providerRequestId ?? null,
      generatedAt: generated?.generatedAt ?? null,
      actual: generated ? {
        width: generated.actual.width,
        height: generated.actual.height,
        format: generated.actual.format,
        fileSize: generated.actual.fileSize,
      } : null,
    }
  })
  const relativeRunPath = path.relative(process.cwd(), runDirectory) || runDirectory
  const hasContactSheet = manifest.artifacts.some((artifact) => artifact.id === 'contact-sheet-initial')
  return {
    runId,
    status: manifest.status,
    createdAt: manifest.createdAt,
    runPath: relativeRunPath,
    brief: plan.brief,
    policy: {
      profileId: policy.profile.id,
      publisher: brief.journal.publisher,
      journal: brief.journal.name,
      storedState: policy.storedState,
      effectiveState: policy.effectiveState,
      reviewAfter: policy.profile.reviewAfter,
      generationAllowed: policy.generationAllowed,
      finalizationBlocked: policy.finalizationBlocked,
      reasons: policy.reasons,
      sourceUrls: policy.profile.sourceUrls,
      spec: publicSpec(policy.profile),
    },
    candidates,
    generatedCount: manifest.candidates.filter((candidate) => candidate.stage === 'initial').length,
    contactSheetUrl: hasContactSheet
      ? `/api/scientific-covers/runs/${encodeURIComponent(runId)}/contact-sheet`
      : null,
    continuationCommand: `bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts audit --run ${relativeRunPath} --candidate <candidate-id>`,
  }
}

function policyExpired(policy: PolicySnapshot, now: Date) {
  return now.getTime() > Date.parse(`${policy.profile.reviewAfter}T23:59:59.999Z`)
}

export async function getScientificCoverPrompt(
  ownerUserId: string,
  runId: string,
  candidateId: string,
  options: ServiceOptions = {},
) {
  assertSafeId(candidateId)
  const now = options.now ?? new Date()
  const { runDirectory, manifest, policy, plan } = await readRun(ownerUserId, runId, options)
  if (!policy.generationAllowed) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_BLOCKED')
  if (policyExpired(policy, now)) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_POLICY_EXPIRED')
  if (manifest.candidates.some((candidate) => candidate.id === candidateId)) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_CANDIDATE_EXISTS')
  }
  const planned = plan.candidates.find((candidate) => candidate.candidateId === candidateId)
  if (!planned) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  const prompt = manifest.prompts.find((entry) => entry.id === planned.promptId)
  if (!prompt) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  const promptPath = resolveInside(runDirectory, prompt.file)
  const content = await readFile(promptPath, 'utf8')
  const hash = createHash('sha256').update(content).digest('hex')
  if (hash !== prompt.sha256) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_PROMPT_INTEGRITY')
  return { prompt: content.trim(), planned }
}

function decodeGeneratedImage(dataUrl: string, mimeType: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/)
  if (!match || match[1] !== mimeType) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_IMAGE_INVALID')
  const encoded = match[2].replace(/[\r\n]/g, '')
  if (encoded.length === 0 || encoded.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES / 3) * 4 + 4) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_IMAGE_INVALID')
  }
  const data = Buffer.from(encoded, 'base64')
  if (
    data.length === 0
    || data.length > MAX_GENERATED_IMAGE_BYTES
    || data.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')
  ) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_IMAGE_INVALID')
  }
  return data
}

export async function persistScientificCoverCandidate(
  ownerUserId: string,
  runId: string,
  candidateId: string,
  result: PromptTestResult,
  options: ServiceOptions = {},
) {
  if (result.kind !== 'image') throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_RESULT_INVALID')
  const now = options.now ?? new Date()
  const { planned } = await getScientificCoverPrompt(ownerUserId, runId, candidateId, options)
  const data = decodeGeneratedImage(result.image.dataUrl, result.image.mimeType)
  const extension = result.image.mimeType === 'image/jpeg' ? 'jpg' : result.image.mimeType.split('/')[1]
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'logwood-cover-image-'))
  try {
    const sourceFile = path.join(temporary, `${candidateId}.${extension}`)
    await writeFile(sourceFile, data, { flag: 'wx' })
    const runDirectory = await existingRunDirectory(ownerUserId, runId, options)
    const manifest = await registerRecord(runDirectory, {
      schemaVersion: '1.0.0',
      kind: 'candidate',
      id: candidateId,
      stage: 'initial',
      promptId: planned.promptId,
      sourceFile,
      provider: result.attribution.provider,
      model: result.attribution.model,
      modelVersion: result.attribution.modelVersion,
      providerRequestId: result.requestId,
      generatedAt: result.attribution.generatedAt.toISOString(),
    }, now)
    const initialCandidates = manifest.candidates.filter((candidate) => candidate.stage === 'initial')
    if (
      initialCandidates.length === 6
      && !manifest.artifacts.some((artifact) => artifact.id === 'contact-sheet-initial')
    ) {
      await createSheets({ runPath: runDirectory, stage: 'initial', now })
    }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
  return getScientificCoverRun(ownerUserId, runId, options)
}

async function verifiedEvidenceFile(filePath: string, expectedHash?: string) {
  const info = await lstat(filePath)
  if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  }
  const data = await readFile(filePath)
  if (expectedHash && createHash('sha256').update(data).digest('hex') !== expectedHash) {
    throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_PROMPT_INTEGRITY')
  }
  return data
}

export async function getScientificCoverCandidateAsset(
  ownerUserId: string,
  runId: string,
  candidateId: string,
  options: ServiceOptions = {},
) {
  assertSafeId(candidateId)
  const { runDirectory, manifest } = await readRun(ownerUserId, runId, options)
  const candidate = manifest.candidates.find((entry) => entry.id === candidateId)
  if (!candidate) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  const mimeType = candidate.actual.format === 'jpeg'
    ? 'image/jpeg'
    : candidate.actual.format === 'webp'
      ? 'image/webp'
      : 'image/png'
  return {
    data: await verifiedEvidenceFile(resolveInside(runDirectory, candidate.file), candidate.sha256),
    mimeType,
  }
}

export async function getScientificCoverContactSheetAsset(
  ownerUserId: string,
  runId: string,
  options: ServiceOptions = {},
) {
  const { runDirectory, manifest } = await readRun(ownerUserId, runId, options)
  const artifact = manifest.artifacts.find((entry) => entry.id === 'contact-sheet-initial')
  if (!artifact) throw new ScientificCoverError('ERR_SCIENTIFIC_COVER_NOT_FOUND')
  return {
    data: await verifiedEvidenceFile(resolveInside(runDirectory, artifact.file), artifact.sha256),
    mimeType: 'image/png',
  }
}
