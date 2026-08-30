#!/usr/bin/env bun

import { createHash } from 'node:crypto'
import { createReadStream, constants as fsConstants } from 'node:fs'
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { z } from 'zod'

const SCHEMA_VERSION = '1.0.0' as const
const MAX_JSON_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BYTES = 100 * 1024 * 1024
const MAX_IMAGE_PIXELS = 100_000_000
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..')
export const DEFAULT_PROFILES_PATH = path.join(SKILL_DIR, 'assets', 'journal-profiles.json')

const IdSchema = z.string().regex(SAFE_ID, 'Use lowercase letters, digits, and hyphens (max 64 chars)')
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const DateTimeSchema = z.string().datetime({ offset: true })
const StageSchema = z.enum(['initial', 'refine-1', 'refine-2'])
const DecisionStageSchema = z.enum(['initial-selection', 'refine-1-selection', 'final-selection'])
const PolicyStateSchema = z.enum(['allowed', 'permission_required', 'prohibited', 'manual_review'])

const ReferenceSchema = z
  .object({
    id: IdSchema,
    source: z.string().min(1).max(2_000),
    role: z.enum(['subject', 'style', 'layout', 'palette']),
    useMode: z.enum(['analysis-only', 'model-input']),
    rights: z.enum(['owned', 'licensed', 'public-domain', 'unknown']),
    credit: z.string().max(1_000).optional(),
    notes: z.string().max(2_000).optional(),
  })
  .strict()

export const CoverBriefSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    runId: IdSchema,
    projectTitle: z.string().min(3).max(200),
    journal: z
      .object({
        profileId: IdSchema,
        publisher: z.string().min(1).max(200),
        name: z.string().min(1).max(200),
        articleType: z.string().min(1).max(200),
        officialGuidelinesUrl: z.string().url().optional(),
        permissionEvidence: z
          .object({
            reference: z.string().min(1).max(2_000),
            confirmedBy: z.string().min(1).max(200),
            confirmedAt: DateTimeSchema,
          })
          .strict()
          .optional(),
      })
      .strict(),
    story: z
      .object({
        claim: z.string().min(10).max(2_000),
        novelty: z.string().min(10).max(2_000),
        entities: z
          .array(
            z
              .object({
                name: z.string().min(1).max(200),
                role: z.string().min(1).max(500),
              })
              .strict(),
          )
          .min(1)
          .max(30),
        relationships: z
          .array(
            z
              .object({
                from: z.string().min(1).max(200),
                to: z.string().min(1).max(200),
                type: z.string().min(1).max(500),
              })
              .strict(),
          )
          .min(1)
          .max(50),
      })
      .strict(),
    truth: z
      .object({
        mustShow: z.array(z.string().min(1).max(1_000)).min(1).max(30),
        mustNotShow: z.array(z.string().min(1).max(1_000)).min(1).max(30),
        uncertainties: z.array(z.string().min(1).max(1_000)).max(30),
        forbiddenInferences: z.array(z.string().min(1).max(1_000)).min(1).max(30),
      })
      .strict(),
    artDirection: z
      .object({
        mood: z.array(z.string().min(1).max(100)).min(1).max(20),
        palette: z.array(z.string().min(1).max(100)).min(1).max(20),
        medium: z.array(z.string().min(1).max(200)).min(1).max(20),
        avoid: z.array(z.string().min(1).max(300)).min(1).max(30),
      })
      .strict(),
    references: z.array(ReferenceSchema).max(20).default([]),
    privacy: z
      .object({
        redactedConfirmed: z.literal(true),
        containsUnpublishedFullText: z.literal(false),
        containsRawExperimentalData: z.literal(false),
        containsPrimaryResearchImages: z.literal(false),
      })
      .strict(),
    compliance: z
      .object({
        toolCommercialUseConfirmed: z.boolean(),
        humanScientificReviewRequired: z.literal(true),
      })
      .strict(),
  })
  .strict()
  .superRefine((brief, context) => {
    brief.references.forEach((reference, index) => {
      if (reference.useMode === 'model-input' && !['owned', 'licensed', 'public-domain'].includes(reference.rights)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['references', index, 'rights'],
          message: 'A model-input reference must be owned, licensed, or public-domain',
        })
      }
    })
  })

const SafeAreaSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).max(200),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .superRefine((area, context) => {
    if (area.x + area.width > 1 || area.y + area.height > 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Safe area must fit inside the canvas' })
    }
  })

const JournalSpecSchema = z
  .object({
    physicalWidth: z.number().positive(),
    physicalHeight: z.number().positive(),
    physicalUnit: z.enum(['in', 'mm']),
    dpi: z.number().int().positive().max(2_400),
    minPixels: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
    acceptedFormats: z.array(z.enum(['png', 'jpeg', 'tiff', 'eps', 'psd'])).min(1),
    allowAlpha: z.boolean(),
    colorSpace: z.enum(['srgb', 'cmyk', 'gray']),
    safeAreas: z.array(SafeAreaSchema),
  })
  .strict()

export const JournalProfileSchema = z
  .object({
    id: IdSchema,
    publisher: z.string().min(1).max(200),
    journal: z.string().min(1).max(200),
    policyState: PolicyStateSchema,
    sourceUrls: z.array(z.string().url()).max(10),
    verifiedAt: DateSchema,
    reviewAfter: DateSchema,
    policyNotes: z.array(z.string().min(1).max(2_000)).min(1),
    disclosure: z
      .object({
        required: z.boolean(),
        template: z.string().min(1).max(4_000).nullable(),
      })
      .strict(),
    toolCommercialUseConfirmationRequired: z.boolean(),
    permissionEvidenceRequired: z.boolean(),
    exactJournalProfile: z.boolean(),
    spec: JournalSpecSchema.nullable(),
  })
  .strict()

const JournalProfilesSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    profiles: z.array(JournalProfileSchema).min(1),
  })
  .strict()

const PromptRecordSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    kind: z.literal('prompt'),
    id: IdSchema,
    stage: StageSchema,
    conceptId: IdSchema,
    content: z.string().min(20).max(100_000),
  })
  .strict()

const DesiredRenderSchema = z
  .object({
    width: z.number().int().positive().max(8_192),
    height: z.number().int().positive().max(8_192),
    quality: z.enum(['draft', 'standard', 'final']),
  })
  .strict()

const CandidateRecordSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    kind: z.literal('candidate'),
    id: IdSchema,
    stage: StageSchema,
    promptId: IdSchema,
    sourceFile: z.string().min(1).max(4_000),
    provider: z.string().min(1).max(200),
    model: z.string().min(1).max(200).optional(),
    modelVersion: z.string().min(1).max(200).optional(),
    modelNotExposed: z.boolean().optional(),
    providerRequestId: z.string().min(1).max(500).optional(),
    generatedAt: DateTimeSchema,
    seed: z.union([z.string().max(200), z.number().int()]).optional(),
    desired: DesiredRenderSchema.optional(),
  })
  .strict()

const ReviewScoresSchema = z
  .object({
    scientificFidelity: z.number().int().min(1).max(5),
    metaphorMapping: z.number().int().min(1).max(5),
    originality: z.number().int().min(1).max(5),
    composition: z.number().int().min(1).max(5),
    thumbnailReadability: z.number().int().min(1).max(5),
    technicalReadiness: z.number().int().min(1).max(5),
    rightsSafety: z.number().int().min(1).max(5),
  })
  .strict()

const ReviewRecordSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    kind: z.literal('review'),
    id: IdSchema,
    candidateId: IdSchema,
    scores: ReviewScoresSchema,
    vetoes: z.array(z.string().min(1).max(100)).max(20),
    findings: z.array(z.string().min(1).max(2_000)).min(1).max(30),
    nextEdit: z.string().min(1).max(2_000),
  })
  .strict()

const DecisionRecordSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    kind: z.literal('decision'),
    id: IdSchema,
    stage: DecisionStageSchema,
    selectedCandidateIds: z.array(IdSchema).min(1).max(2),
    reviewer: z.string().min(1).max(200),
    rationale: z.string().min(3).max(2_000),
    decidedAt: DateTimeSchema,
  })
  .strict()

export const RegisterRecordSchema = z.discriminatedUnion('kind', [
  PromptRecordSchema,
  CandidateRecordSchema,
  ReviewRecordSchema,
  DecisionRecordSchema,
])

const ImageMetadataSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.string().min(1),
    density: z.number().positive().nullable(),
    colorSpace: z.string().min(1).nullable(),
    channels: z.number().int().positive().nullable(),
    hasAlpha: z.boolean(),
    hasIcc: z.boolean(),
    fileSize: z.number().int().nonnegative(),
  })
  .strict()

const PromptEntrySchema = PromptRecordSchema.omit({ kind: true, content: true }).extend({
  file: z.string().min(1),
  sha256: z.string().length(64),
})

const CandidateEntrySchema = CandidateRecordSchema.omit({ kind: true, sourceFile: true }).extend({
  file: z.string().min(1),
  sha256: z.string().length(64),
  actual: ImageMetadataSchema,
})

const ReviewEntrySchema = ReviewRecordSchema.omit({ kind: true }).extend({ file: z.string().min(1) })
const DecisionEntrySchema = DecisionRecordSchema.omit({ kind: true }).extend({ file: z.string().min(1) })

const ArtifactEntrySchema = z
  .object({
    id: IdSchema,
    kind: z.enum(['contact-sheet', 'safe-area-preview', 'audit', 'handoff', 'final', 'disclosure']),
    file: z.string().min(1),
    sha256: z.string().length(64).optional(),
    createdAt: DateTimeSchema,
  })
  .strict()

const PolicySnapshotSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    createdAt: DateTimeSchema,
    profile: JournalProfileSchema,
    storedState: PolicyStateSchema,
    effectiveState: PolicyStateSchema,
    expired: z.boolean(),
    generationAllowed: z.boolean(),
    finalizationBlocked: z.boolean(),
    reasons: z.array(z.string().min(1)),
  })
  .strict()

const ManifestStatusSchema = z.enum([
  'blocked',
  'concepting',
  'concept-only',
  'awaiting-initial-selection',
  'refining-round-1',
  'refining-round-2',
  'ready-for-finalization',
  'finalized',
])

const FinalEntrySchema = z
  .object({
    candidateId: IdSchema,
    masterFile: z.string().min(1),
    submissionFile: z.string().min(1),
    safeAreaPreviewFile: z.string().min(1),
    reportFile: z.string().min(1),
    disclosureFile: z.string().min(1).optional(),
    finalizedAt: DateTimeSchema,
  })
  .strict()

export const RunManifestSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    runId: IdSchema,
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    status: ManifestStatusSchema,
    briefFile: z.literal('brief.json'),
    truthSheetFile: z.literal('truth-sheet.json'),
    policySnapshotFile: z.literal('policy-snapshot.json'),
    generationAllowed: z.boolean(),
    finalizationBlocked: z.boolean(),
    blockedReasons: z.array(z.string()),
    prompts: z.array(PromptEntrySchema),
    candidates: z.array(CandidateEntrySchema),
    reviews: z.array(ReviewEntrySchema),
    decisions: z.array(DecisionEntrySchema),
    artifacts: z.array(ArtifactEntrySchema),
    final: FinalEntrySchema.nullable(),
  })
  .strict()

export type CoverBrief = z.infer<typeof CoverBriefSchema>
export type JournalProfile = z.infer<typeof JournalProfileSchema>
export type PolicySnapshot = z.infer<typeof PolicySnapshotSchema>
export type RegisterRecord = z.infer<typeof RegisterRecordSchema>
export type RunManifest = z.infer<typeof RunManifestSchema>
type CandidateEntry = z.infer<typeof CandidateEntrySchema>
type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>

export type AuditCheck = {
  id: string
  severity: 'pass' | 'warn' | 'fail'
  message: string
}

export type AuditResult = {
  schemaVersion: typeof SCHEMA_VERSION
  candidateId: string
  auditedAt: string
  profileId: string
  eligibleForFinalization: boolean
  checks: AuditCheck[]
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`).join('; ')
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function assertRegularFile(filePath: string, maxBytes: number): Promise<void> {
  const info = await lstat(filePath)
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Expected a regular non-symlink file: ${filePath}`)
  if (info.size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${filePath}`)
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const absolute = path.resolve(filePath)
  await assertRegularFile(absolute, MAX_JSON_BYTES)
  const source = await readFile(absolute, 'utf8')
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`Invalid JSON in ${absolute}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function writeExclusive(filePath: string, content: string | Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content, { flag: 'wx' })
}

async function writeJsonExclusive(filePath: string, value: unknown): Promise<void> {
  await writeExclusive(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
  await rename(temporary, filePath)
}

async function sha256File(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function resolveInside(root: string, relativePath: string): string {
  const target = path.resolve(root, relativePath)
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes run directory: ${relativePath}`)
  return target
}

async function resolveRunDirectory(runPath: string): Promise<string> {
  const absolute = path.resolve(runPath)
  const info = await lstat(absolute)
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Expected a non-symlink run directory: ${absolute}`)
  return await realpath(absolute)
}

async function loadManifest(runDirectory: string): Promise<RunManifest> {
  const value = await readJsonFile(resolveInside(runDirectory, 'run-manifest.json'))
  const parsed = RunManifestSchema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid run manifest: ${formatZodError(parsed.error)}`)
  return parsed.data
}

async function saveManifest(runDirectory: string, manifest: RunManifest, now = new Date()): Promise<void> {
  const next = RunManifestSchema.parse({ ...manifest, updatedAt: now.toISOString(), status: deriveStatus(manifest) })
  await writeJsonAtomic(resolveInside(runDirectory, 'run-manifest.json'), next)
}

async function inspectImage(filePath: string): Promise<z.infer<typeof ImageMetadataSchema>> {
  await assertRegularFile(filePath, MAX_IMAGE_BYTES)
  const fileInfo = await stat(filePath)
  const metadata = await sharp(filePath, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).metadata()
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error(`Unsupported or incomplete raster image: ${filePath}`)
  return ImageMetadataSchema.parse({
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    density: metadata.density ?? null,
    colorSpace: metadata.space ?? null,
    channels: metadata.channels ?? null,
    hasAlpha: metadata.hasAlpha ?? false,
    hasIcc: Boolean(metadata.icc),
    fileSize: fileInfo.size,
  })
}

function reviewDeadlinePassed(reviewAfter: string, now: Date): boolean {
  return now.getTime() > Date.parse(`${reviewAfter}T23:59:59.999Z`)
}

export function evaluatePolicy(profile: JournalProfile, brief: CoverBrief, now = new Date()): PolicySnapshot {
  const expired = reviewDeadlinePassed(profile.reviewAfter, now)
  const effectiveState = expired ? 'manual_review' : profile.policyState
  const reasons: string[] = []
  let generationAllowed = true

  if (effectiveState === 'prohibited') {
    generationAllowed = false
    reasons.push('Target policy prohibits generative-AI cover artwork')
  }
  if (effectiveState === 'permission_required' && !brief.journal.permissionEvidence) {
    reasons.push('Prior editor and publisher permission evidence is missing')
  }
  if (effectiveState === 'manual_review') reasons.push(expired ? 'Policy profile is expired' : 'Target policy requires manual review')
  if (!profile.exactJournalProfile || !profile.spec) reasons.push('Exact journal export specification is missing')
  if (profile.toolCommercialUseConfirmationRequired && !brief.compliance.toolCommercialUseConfirmed) {
    reasons.push('Renderer commercial-publication terms have not been confirmed')
  }
  if (profile.permissionEvidenceRequired && !brief.journal.permissionEvidence) {
    if (!reasons.includes('Prior editor and publisher permission evidence is missing')) {
      reasons.push('Required permission evidence is missing')
    }
  }

  return PolicySnapshotSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
    profile,
    storedState: profile.policyState,
    effectiveState,
    expired,
    generationAllowed,
    finalizationBlocked: effectiveState !== 'allowed' || reasons.length > 0,
    reasons,
  })
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function validateBriefAgainstProfile(brief: CoverBrief, profile: JournalProfile): void {
  if (profile.exactJournalProfile) {
    if (normalize(brief.journal.publisher) !== normalize(profile.publisher)) {
      throw new Error(`Brief publisher does not match profile ${profile.id}`)
    }
    if (normalize(brief.journal.name) !== normalize(profile.journal)) {
      throw new Error(`Brief journal does not match profile ${profile.id}`)
    }
  } else if (profile.id === 'unverified-manual-review' && !brief.journal.officialGuidelinesUrl) {
    throw new Error('Manual-review runs require the exact official journal guidelines URL')
  }
}

function truthSheet(brief: CoverBrief) {
  return {
    schemaVersion: SCHEMA_VERSION,
    claim: brief.story.claim,
    novelty: brief.story.novelty,
    entities: brief.story.entities,
    relationships: brief.story.relationships,
    mustShow: brief.truth.mustShow,
    mustNotShow: brief.truth.mustNotShow,
    uncertainties: brief.truth.uncertainties,
    forbiddenInferences: brief.truth.forbiddenInferences,
  }
}

function humanIllustratorBrief(brief: CoverBrief, snapshot: PolicySnapshot): string {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join('\n')
  return `# Human illustrator handoff\n\n` +
    `Target: ${brief.journal.name} (${brief.journal.publisher})\n\n` +
    `Generative rendering was not started. Policy reason: ${snapshot.reasons.join('; ') || snapshot.effectiveState}.\n\n` +
    `## Scientific story\n\n${brief.story.claim}\n\nNovelty: ${brief.story.novelty}\n\n` +
    `## Must show\n\n${list(brief.truth.mustShow)}\n\n` +
    `## Must not show\n\n${list(brief.truth.mustNotShow)}\n\n` +
    `## Uncertainty and forbidden inference\n\n${list([...brief.truth.uncertainties, ...brief.truth.forbiddenInferences])}\n\n` +
    `## Production constraints\n\n- Create original, text-free cover artwork.\n- Keep masthead areas visually quiet.\n- Do not depict measurements or primary research imagery.\n- Verify current journal specifications and rights before submission.\n`
}

export async function initRun(options: {
  briefPath: string
  outPath: string
  profilesPath?: string
  now?: Date
}): Promise<{ runDirectory: string; manifest: RunManifest; policy: PolicySnapshot }> {
  const now = options.now ?? new Date()
  const rawBrief = await readJsonFile(options.briefPath)
  const briefResult = CoverBriefSchema.safeParse(rawBrief)
  if (!briefResult.success) throw new Error(`Invalid CoverBriefV1: ${formatZodError(briefResult.error)}`)
  const brief = briefResult.data

  const rawProfiles = await readJsonFile(options.profilesPath ?? DEFAULT_PROFILES_PATH)
  const profilesResult = JournalProfilesSchema.safeParse(rawProfiles)
  if (!profilesResult.success) throw new Error(`Invalid journal profiles: ${formatZodError(profilesResult.error)}`)
  const profile = profilesResult.data.profiles.find((candidate) => candidate.id === brief.journal.profileId)
  if (!profile) throw new Error(`Unknown journal profile: ${brief.journal.profileId}`)
  validateBriefAgainstProfile(brief, profile)

  const output = path.resolve(options.outPath)
  if (await exists(output)) throw new Error(`Run directory already exists: ${output}`)
  await mkdir(path.dirname(output), { recursive: true })
  const parentInfo = await lstat(path.dirname(output))
  if (parentInfo.isSymbolicLink()) throw new Error(`Refusing a symlinked run parent: ${path.dirname(output)}`)
  await mkdir(output)
  for (const directory of ['prompts', 'candidates', 'reviews', 'decisions', 'contact-sheets', 'previews', 'audits', 'final']) {
    await mkdir(path.join(output, directory))
  }

  const policy = evaluatePolicy(profile, brief, now)
  const manifest = RunManifestSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    runId: brief.runId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: policy.generationAllowed ? (policy.finalizationBlocked ? 'concept-only' : 'concepting') : 'blocked',
    briefFile: 'brief.json',
    truthSheetFile: 'truth-sheet.json',
    policySnapshotFile: 'policy-snapshot.json',
    generationAllowed: policy.generationAllowed,
    finalizationBlocked: policy.finalizationBlocked,
    blockedReasons: policy.reasons,
    prompts: [],
    candidates: [],
    reviews: [],
    decisions: [],
    artifacts: [],
    final: null,
  })

  await writeJsonExclusive(path.join(output, 'brief.json'), brief)
  await writeJsonExclusive(path.join(output, 'truth-sheet.json'), truthSheet(brief))
  await writeJsonExclusive(path.join(output, 'policy-snapshot.json'), policy)
  await writeJsonExclusive(path.join(output, 'run-manifest.json'), manifest)
  if (!policy.generationAllowed) {
    await writeExclusive(path.join(output, 'human-illustrator-brief.md'), humanIllustratorBrief(brief, policy))
  }

  return { runDirectory: output, manifest, policy }
}

function allRecordIds(manifest: RunManifest): Set<string> {
  return new Set([
    ...manifest.prompts.map((record) => record.id),
    ...manifest.candidates.map((record) => record.id),
    ...manifest.reviews.map((record) => record.id),
    ...manifest.decisions.map((record) => record.id),
    ...manifest.artifacts.map((record) => record.id),
  ])
}

function candidateLimit(stage: z.infer<typeof StageSchema>): number {
  return stage === 'initial' ? 6 : stage === 'refine-1' ? 4 : 2
}

function expectedCandidateStage(stage: z.infer<typeof DecisionStageSchema>): z.infer<typeof StageSchema> {
  return stage === 'initial-selection' ? 'initial' : stage === 'refine-1-selection' ? 'refine-1' : 'refine-2'
}

function decisionFor(manifest: RunManifest, stage: z.infer<typeof DecisionStageSchema>) {
  return manifest.decisions.find((decision) => decision.stage === stage)
}

function deriveStatus(manifest: RunManifest): z.infer<typeof ManifestStatusSchema> {
  if (!manifest.generationAllowed) return 'blocked'
  if (manifest.final) return 'finalized'
  if (!manifest.candidates.length) return manifest.finalizationBlocked ? 'concept-only' : 'concepting'
  if (!decisionFor(manifest, 'initial-selection')) {
    const initialCount = manifest.candidates.filter((candidate) => candidate.stage === 'initial').length
    if (initialCount < candidateLimit('initial')) return manifest.finalizationBlocked ? 'concept-only' : 'concepting'
    return 'awaiting-initial-selection'
  }
  if (!decisionFor(manifest, 'refine-1-selection')) return 'refining-round-1'
  if (!decisionFor(manifest, 'final-selection')) return 'refining-round-2'
  return manifest.finalizationBlocked ? 'concept-only' : 'ready-for-finalization'
}

function extensionFor(format: string): string {
  if (format === 'jpeg') return 'jpg'
  if (format === 'tiff') return 'tif'
  if (['png', 'webp'].includes(format)) return format
  throw new Error(`Unsupported candidate raster format: ${format}`)
}

function validateCandidateStagePrerequisite(manifest: RunManifest, stage: z.infer<typeof StageSchema>): void {
  if (stage === 'refine-1' && !decisionFor(manifest, 'initial-selection')) {
    throw new Error('Round-one refinement requires an initial human decision')
  }
  if (stage === 'refine-2' && !decisionFor(manifest, 'refine-1-selection')) {
    throw new Error('Round-two refinement requires a round-one human decision')
  }
}

function validateDecision(manifest: RunManifest, decision: z.infer<typeof DecisionRecordSchema>): void {
  if (decisionFor(manifest, decision.stage)) throw new Error(`Decision already exists for ${decision.stage}`)
  const candidateStage = expectedCandidateStage(decision.stage)
  const stageCandidates = manifest.candidates.filter((candidate) => candidate.stage === candidateStage)
  const expectedCount = candidateStage === 'initial' ? 6 : candidateStage === 'refine-2' ? 2 : null
  if (expectedCount !== null && stageCandidates.length !== expectedCount) {
    throw new Error(`${decision.stage} requires exactly ${expectedCount} ${candidateStage} candidates`)
  }
  if (candidateStage === 'refine-1' && (stageCandidates.length < 1 || stageCandidates.length > 4)) {
    throw new Error('Round-one selection requires between one and four refinement candidates')
  }
  if (decision.stage !== 'initial-selection' && decision.selectedCandidateIds.length !== 1) {
    throw new Error(`${decision.stage} must select exactly one candidate`)
  }
  const stageIds = new Set(stageCandidates.map((candidate) => candidate.id))
  for (const selectedId of decision.selectedCandidateIds) {
    if (!stageIds.has(selectedId)) throw new Error(`Selected candidate ${selectedId} is not in stage ${candidateStage}`)
  }
  for (const candidate of stageCandidates) {
    const review = manifest.reviews.find((entry) => entry.candidateId === candidate.id)
    if (!review) throw new Error(`Candidate ${candidate.id} has no registered review`)
  }
  for (const selectedId of decision.selectedCandidateIds) {
    const review = manifest.reviews.find((entry) => entry.candidateId === selectedId)
    if (review && review.vetoes.length > 0) throw new Error(`Candidate ${selectedId} has unresolved vetoes: ${review.vetoes.join(', ')}`)
  }
}

export async function registerRecord(runPath: string, rawRecord: unknown, now = new Date()): Promise<RunManifest> {
  const runDirectory = await resolveRunDirectory(runPath)
  const manifest = await loadManifest(runDirectory)
  const recordResult = RegisterRecordSchema.safeParse(rawRecord)
  if (!recordResult.success) throw new Error(`Invalid register record: ${formatZodError(recordResult.error)}`)
  const record = recordResult.data
  if (!manifest.generationAllowed && record.kind === 'candidate' && record.provider !== 'manual-illustrator') {
    throw new Error('This run is blocked from generative rendering; only manual-illustrator candidates may be registered')
  }
  if (allRecordIds(manifest).has(record.id)) throw new Error(`Record ID already exists: ${record.id}`)

  if (record.kind === 'prompt') {
    validateCandidateStagePrerequisite(manifest, record.stage)
    const relative = `prompts/${record.id}.txt`
    await writeExclusive(resolveInside(runDirectory, relative), `${record.content.trim()}\n`)
    manifest.prompts.push({
      schemaVersion: SCHEMA_VERSION,
      id: record.id,
      stage: record.stage,
      conceptId: record.conceptId,
      file: relative,
      sha256: sha256Text(`${record.content.trim()}\n`),
    })
  } else if (record.kind === 'candidate') {
    validateCandidateStagePrerequisite(manifest, record.stage)
    const prompt = manifest.prompts.find((entry) => entry.id === record.promptId)
    if (!prompt) throw new Error(`Unknown prompt: ${record.promptId}`)
    if (prompt.stage !== record.stage) throw new Error('Candidate and prompt stages must match')
    const count = manifest.candidates.filter((candidate) => candidate.stage === record.stage).length
    if (count >= candidateLimit(record.stage)) throw new Error(`Candidate limit reached for ${record.stage}`)
    if (record.provider === 'manual-illustrator' && (record.model || record.modelVersion || record.providerRequestId || record.seed !== undefined)) {
      throw new Error('Manual illustrator records must not claim a model, version, request ID, or seed')
    }
    if (record.provider === 'manual-illustrator' && record.modelNotExposed) {
      throw new Error('Manual illustrator records must not set modelNotExposed')
    }
    if (record.provider !== 'manual-illustrator' && !record.model && !record.modelNotExposed) {
      throw new Error('Generated candidates require a model name or modelNotExposed: true')
    }
    if (record.model && record.modelNotExposed) throw new Error('Do not provide a model name and modelNotExposed together')

    const source = path.resolve(record.sourceFile)
    const actual = await inspectImage(source)
    const relative = `candidates/${record.id}.${extensionFor(actual.format)}`
    const target = resolveInside(runDirectory, relative)
    await copyFile(source, target, fsConstants.COPYFILE_EXCL)
    const copiedMetadata = await inspectImage(target)
    manifest.candidates.push({
      schemaVersion: SCHEMA_VERSION,
      id: record.id,
      stage: record.stage,
      promptId: record.promptId,
      provider: record.provider,
      model: record.model,
      modelVersion: record.modelVersion,
      modelNotExposed: record.modelNotExposed,
      providerRequestId: record.providerRequestId,
      generatedAt: record.generatedAt,
      seed: record.seed,
      desired: record.desired,
      file: relative,
      sha256: await sha256File(target),
      actual: copiedMetadata,
    })
  } else if (record.kind === 'review') {
    const candidate = manifest.candidates.find((entry) => entry.id === record.candidateId)
    if (!candidate) throw new Error(`Unknown candidate: ${record.candidateId}`)
    if (manifest.reviews.some((entry) => entry.candidateId === record.candidateId)) {
      throw new Error(`Candidate ${record.candidateId} already has a review; create a new candidate to resolve a veto`)
    }
    const relative = `reviews/${record.id}.json`
    const stored = { ...record }
    await writeJsonExclusive(resolveInside(runDirectory, relative), stored)
    manifest.reviews.push({
      schemaVersion: SCHEMA_VERSION,
      id: record.id,
      candidateId: record.candidateId,
      scores: record.scores,
      vetoes: record.vetoes,
      findings: record.findings,
      nextEdit: record.nextEdit,
      file: relative,
    })
  } else {
    validateDecision(manifest, record)
    const relative = `decisions/${record.id}.json`
    await writeJsonExclusive(resolveInside(runDirectory, relative), record)
    manifest.decisions.push({
      schemaVersion: SCHEMA_VERSION,
      id: record.id,
      stage: record.stage,
      selectedCandidateIds: record.selectedCandidateIds,
      reviewer: record.reviewer,
      rationale: record.rationale,
      decidedAt: record.decidedAt,
      file: relative,
    })
  }

  await saveManifest(runDirectory, manifest, now)
  return await loadManifest(runDirectory)
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character)
}

async function createContactSheet(runDirectory: string, candidates: CandidateEntry[], output: string): Promise<void> {
  const columns = 3
  const cardWidth = 420
  const cardHeight = 620
  const imageWidth = 380
  const imageHeight = 520
  const gap = 24
  const margin = 32
  const rows = Math.ceil(candidates.length / columns)
  const width = margin * 2 + columns * cardWidth + (columns - 1) * gap
  const height = margin * 2 + rows * cardHeight + (rows - 1) * gap
  const composites: sharp.OverlayOptions[] = []

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    const column = index % columns
    const row = Math.floor(index / columns)
    const left = margin + column * (cardWidth + gap)
    const top = margin + row * (cardHeight + gap)
    const image = await sharp(resolveInside(runDirectory, candidate.file), { limitInputPixels: MAX_IMAGE_PIXELS })
      .resize(imageWidth, imageHeight, { fit: 'contain', background: '#f4efe4' })
      .png()
      .toBuffer()
    composites.push({ input: image, left: left + 20, top: top + 18 })
    const modelLabel = [candidate.provider, candidate.model].filter(Boolean).join(' / ')
    const label = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${cardWidth - 2}" height="${cardHeight - 2}" fill="none" stroke="#6f746f" stroke-width="2"/>
      <text x="20" y="568" fill="#f4efe4" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(candidate.id)}</text>
      <text x="20" y="597" fill="#aeb4ae" font-family="Arial, sans-serif" font-size="15">${escapeXml(modelLabel)}</text>
    </svg>`)
    composites.push({ input: label, left, top })
  }

  await sharp({ create: { width, height, channels: 3, background: '#151918' } })
    .composite(composites)
    .png()
    .toFile(output)
}

async function createSafeAreaPreview(
  imagePath: string,
  output: string,
  profile: JournalProfile,
): Promise<void> {
  if (!profile.spec) throw new Error('A safe-area preview requires an exact journal specification')
  const metadata = await inspectImage(imagePath)
  const width = Math.min(900, metadata.width)
  const height = Math.round((metadata.height / metadata.width) * width)
  const areas = profile.spec.safeAreas
    .map((area, index) => {
      const x = Math.round(area.x * width)
      const y = Math.round(area.y * height)
      const areaWidth = Math.round(area.width * width)
      const areaHeight = Math.round(area.height * height)
      const textY = Math.max(24, y + 28 + index * 22)
      return `<rect x="${x}" y="${y}" width="${areaWidth}" height="${areaHeight}" fill="#c8414140" stroke="#ff6b6b" stroke-width="4" stroke-dasharray="14 10"/>
        <text x="${x + 14}" y="${textY}" fill="#ffffff" stroke="#111111" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(area.label)}</text>`
    })
    .join('\n')
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="#ffcf56" stroke-width="4"/>
    ${areas}
    <text x="18" y="${height - 22}" fill="#ffffff" stroke="#111111" stroke-width="3" paint-order="stroke" font-family="Arial, sans-serif" font-size="17">Generic placement preview — no journal logo is embedded</text>
  </svg>`)
  await sharp(imagePath, { limitInputPixels: MAX_IMAGE_PIXELS })
    .resize(width, height, { fit: 'fill' })
    .composite([{ input: overlay }])
    .png()
    .toFile(output)
}

function addArtifact(manifest: RunManifest, artifact: ArtifactEntry): void {
  if (allRecordIds(manifest).has(artifact.id)) throw new Error(`Artifact ID already exists: ${artifact.id}`)
  manifest.artifacts.push(artifact)
}

export async function createSheets(options: {
  runPath: string
  stage?: z.infer<typeof StageSchema>
  candidateId?: string
  now?: Date
}): Promise<string[]> {
  if (!options.stage && !options.candidateId) throw new Error('Provide --stage and/or --candidate')
  const now = options.now ?? new Date()
  const runDirectory = await resolveRunDirectory(options.runPath)
  const manifest = await loadManifest(runDirectory)
  const outputs: string[] = []

  if (options.stage) {
    const candidates = manifest.candidates.filter((candidate) => candidate.stage === options.stage)
    if (!candidates.length) throw new Error(`No candidates registered for ${options.stage}`)
    const relative = `contact-sheets/${options.stage}.png`
    const output = resolveInside(runDirectory, relative)
    if (await exists(output)) throw new Error(`Contact sheet already exists: ${output}`)
    await createContactSheet(runDirectory, candidates, output)
    addArtifact(manifest, {
      id: `contact-sheet-${options.stage}`,
      kind: 'contact-sheet',
      file: relative,
      sha256: await sha256File(output),
      createdAt: now.toISOString(),
    })
    outputs.push(output)
  }

  if (options.candidateId) {
    const candidate = manifest.candidates.find((entry) => entry.id === options.candidateId)
    if (!candidate) throw new Error(`Unknown candidate: ${options.candidateId}`)
    const policy = PolicySnapshotSchema.parse(await readJsonFile(resolveInside(runDirectory, manifest.policySnapshotFile)))
    const relative = `previews/${candidate.id}-safe-area.png`
    const output = resolveInside(runDirectory, relative)
    if (await exists(output)) throw new Error(`Safe-area preview already exists: ${output}`)
    await createSafeAreaPreview(resolveInside(runDirectory, candidate.file), output, policy.profile)
    addArtifact(manifest, {
      id: `safe-area-${candidate.id}`,
      kind: 'safe-area-preview',
      file: relative,
      sha256: await sha256File(output),
      createdAt: now.toISOString(),
    })
    outputs.push(output)
  }

  await saveManifest(runDirectory, manifest, now)
  return outputs
}

function auditCheck(checks: AuditCheck[], id: string, severity: AuditCheck['severity'], message: string): void {
  checks.push({ id, severity, message })
}

export async function auditCandidate(runPath: string, candidateId: string, now = new Date()): Promise<AuditResult> {
  const runDirectory = await resolveRunDirectory(runPath)
  const manifest = await loadManifest(runDirectory)
  const candidate = manifest.candidates.find((entry) => entry.id === candidateId)
  if (!candidate) throw new Error(`Unknown candidate: ${candidateId}`)
  const policy = PolicySnapshotSchema.parse(await readJsonFile(resolveInside(runDirectory, manifest.policySnapshotFile)))
  const profile = policy.profile
  const checks: AuditCheck[] = []
  let actual = candidate.actual

  try {
    const candidatePath = resolveInside(runDirectory, candidate.file)
    actual = await inspectImage(candidatePath)
    const currentHash = await sha256File(candidatePath)
    auditCheck(
      checks,
      'candidate-integrity',
      currentHash === candidate.sha256 ? 'pass' : 'fail',
      currentHash === candidate.sha256
        ? 'Candidate file matches its registered SHA-256 hash'
        : 'Candidate file changed after registration',
    )
  } catch (error) {
    auditCheck(
      checks,
      'candidate-integrity',
      'fail',
      `Candidate file cannot be verified: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const prompt = manifest.prompts.find((entry) => entry.id === candidate.promptId)
  if (!prompt) {
    auditCheck(checks, 'prompt-integrity', 'fail', `Registered prompt ${candidate.promptId} is missing`)
  } else {
    try {
      const promptPath = resolveInside(runDirectory, prompt.file)
      await assertRegularFile(promptPath, MAX_JSON_BYTES)
      const currentHash = await sha256File(promptPath)
      auditCheck(
        checks,
        'prompt-integrity',
        currentHash === prompt.sha256 ? 'pass' : 'fail',
        currentHash === prompt.sha256 ? 'Prompt file matches its registered SHA-256 hash' : 'Prompt file changed after registration',
      )
    } catch (error) {
      auditCheck(
        checks,
        'prompt-integrity',
        'fail',
        `Prompt file cannot be verified: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (reviewDeadlinePassed(profile.reviewAfter, now)) {
    auditCheck(checks, 'policy-current', 'fail', `Policy profile expired after ${profile.reviewAfter}`)
  } else if (policy.effectiveState !== 'allowed') {
    auditCheck(checks, 'policy-current', 'fail', `Policy state is ${policy.effectiveState}`)
  } else {
    auditCheck(checks, 'policy-current', 'pass', `Policy profile is current through ${profile.reviewAfter}`)
  }

  manifest.blockedReasons.forEach((reason, index) => {
    auditCheck(checks, `policy-${index + 1}`, 'fail', reason)
  })
  if (!profile.exactJournalProfile || !profile.spec) {
    auditCheck(checks, 'exact-spec', 'fail', 'Exact journal technical specification is missing')
  } else {
    auditCheck(checks, 'exact-spec', 'pass', `Using exact profile ${profile.id}`)
    const spec = profile.spec
    const enoughPixels = actual.width >= spec.minPixels.width && actual.height >= spec.minPixels.height
    auditCheck(
      checks,
      'pixel-dimensions',
      enoughPixels ? 'pass' : 'fail',
      `${actual.width}×${actual.height}; required at least ${spec.minPixels.width}×${spec.minPixels.height}`,
    )
    const targetRatio = spec.minPixels.width / spec.minPixels.height
    const actualRatio = actual.width / actual.height
    const ratioDelta = Math.abs(actualRatio - targetRatio) / targetRatio
    auditCheck(
      checks,
      'aspect-ratio',
      ratioDelta <= 0.01 ? 'pass' : 'fail',
      `Aspect-ratio delta is ${(ratioDelta * 100).toFixed(2)}%; tolerance is 1.00%`,
    )
    auditCheck(
      checks,
      'format',
      spec.acceptedFormats.includes(actual.format as never) ? 'pass' : 'fail',
      `Candidate format is ${actual.format}; accepted: ${spec.acceptedFormats.join(', ')}`,
    )
    auditCheck(
      checks,
      'alpha',
      !actual.hasAlpha || spec.allowAlpha ? 'pass' : 'fail',
      actual.hasAlpha ? 'Candidate contains transparency' : 'Candidate is opaque',
    )
    if (spec.colorSpace !== 'srgb') {
      auditCheck(checks, 'color-space', 'fail', `Automatic ${spec.colorSpace} production conversion is intentionally unsupported`)
    } else {
      auditCheck(
        checks,
        'color-space',
        actual.colorSpace === 'srgb' ? 'pass' : 'warn',
        `Detected color space: ${actual.colorSpace ?? 'unknown'}; final export targets sRGB`,
      )
    }
    auditCheck(
      checks,
      'icc-profile',
      actual.hasIcc ? 'pass' : 'warn',
      actual.hasIcc ? 'Embedded ICC profile detected' : 'No embedded ICC profile detected',
    )
  }

  const finalDecision = decisionFor(manifest, 'final-selection')
  if (!finalDecision || finalDecision.selectedCandidateIds[0] !== candidate.id) {
    auditCheck(checks, 'human-final-selection', 'fail', 'Candidate is not the recorded final human selection')
  } else {
    auditCheck(checks, 'human-final-selection', 'pass', `Selected by ${finalDecision.reviewer}`)
  }
  const review = manifest.reviews.find((entry) => entry.candidateId === candidate.id)
  if (!review) auditCheck(checks, 'structured-review', 'fail', 'No structured review exists')
  else if (review.vetoes.length) auditCheck(checks, 'structured-review', 'fail', `Unresolved vetoes: ${review.vetoes.join(', ')}`)
  else auditCheck(checks, 'structured-review', 'pass', 'Structured review has no vetoes')

  return {
    schemaVersion: SCHEMA_VERSION,
    candidateId,
    auditedAt: now.toISOString(),
    profileId: profile.id,
    eligibleForFinalization: !checks.some((check) => check.severity === 'fail'),
    checks,
  }
}

export async function persistAudit(runPath: string, candidateId: string, now = new Date()): Promise<{ file: string; audit: AuditResult }> {
  const runDirectory = await resolveRunDirectory(runPath)
  const manifest = await loadManifest(runDirectory)
  const audit = await auditCandidate(runDirectory, candidateId, now)
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14)
  const relative = `audits/${candidateId}-${stamp}.json`
  const output = resolveInside(runDirectory, relative)
  await writeJsonExclusive(output, audit)
  addArtifact(manifest, {
    id: `audit-${candidateId}-${stamp}`,
    kind: 'audit',
    file: relative,
    sha256: await sha256File(output),
    createdAt: now.toISOString(),
  })
  await saveManifest(runDirectory, manifest, now)
  return { file: output, audit }
}

function productionHandoff(candidateId: string, audit: AuditResult): string {
  const failures = audit.checks.filter((check) => check.severity === 'fail')
  return `# Production handoff required\n\nCandidate: ${candidateId}\n\nThis candidate was not finalized. Resolve these gates without overwriting the source candidate:\n\n${failures
    .map((failure) => `- **${failure.id}**: ${failure.message}`)
    .join('\n')}\n\nDo not upscale an undersized image or change DPI metadata to simulate detail. Create a new production candidate, register it with a new ID, review it, and record a new human decision where the workflow permits.\n`
}

function replaceDisclosureTokens(template: string, candidate: CandidateEntry): string {
  const model = candidate.modelNotExposed
    ? 'an image model not exposed by the runtime'
    : [candidate.model, candidate.modelVersion].filter(Boolean).join(' / ') || 'no model (human illustrator)'
  return template.replaceAll('[provider]', candidate.provider).replaceAll('[model]', model)
}

async function renderSubmission(
  input: string,
  output: string,
  width: number,
  height: number,
  dpi: number,
  format: 'png' | 'jpeg' | 'tiff',
): Promise<void> {
  let pipeline = sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS })
    .resize(width, height, { fit: 'cover', position: 'centre', withoutEnlargement: true })
    .toColourspace('srgb')
    .withMetadata({ density: dpi })
  if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9 })
  else if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
  else pipeline = pipeline.tiff({ quality: 100, compression: 'lzw' })
  await pipeline.toFile(output)
}

export async function finalizeRun(options: {
  runPath: string
  candidateId: string
  format?: 'png' | 'jpeg' | 'tiff'
  now?: Date
}): Promise<{ ok: boolean; audit: AuditResult; files: string[] }> {
  const now = options.now ?? new Date()
  const runDirectory = await resolveRunDirectory(options.runPath)
  const manifest = await loadManifest(runDirectory)
  if (manifest.final) throw new Error('Run is already finalized')
  const candidate = manifest.candidates.find((entry) => entry.id === options.candidateId)
  if (!candidate) throw new Error(`Unknown candidate: ${options.candidateId}`)
  const policy = PolicySnapshotSchema.parse(await readJsonFile(resolveInside(runDirectory, manifest.policySnapshotFile)))
  const audit = await auditCandidate(runDirectory, options.candidateId, now)
  const profile = policy.profile
  const spec = profile.spec

  if (!audit.eligibleForFinalization || !spec) {
    const relative = 'production-handoff.md'
    const output = resolveInside(runDirectory, relative)
    if (!(await exists(output))) {
      await writeExclusive(output, productionHandoff(options.candidateId, audit))
      addArtifact(manifest, {
        id: 'production-handoff',
        kind: 'handoff',
        file: relative,
        sha256: await sha256File(output),
        createdAt: now.toISOString(),
      })
      await saveManifest(runDirectory, manifest, now)
    }
    return { ok: false, audit, files: [output] }
  }

  const format = options.format ?? 'png'
  if (!spec.acceptedFormats.includes(format)) throw new Error(`${format} is not accepted by profile ${profile.id}`)
  const extension = format === 'jpeg' ? 'jpg' : format === 'tiff' ? 'tif' : 'png'
  const masterRelative = 'final/master.png'
  const submissionRelative = `final/submission.${extension}`
  const previewRelative = 'final/safe-area-preview.png'
  const reportRelative = 'final/finalization-report.json'
  const disclosureRelative = profile.disclosure.required ? 'final/disclosure-draft.md' : undefined
  const targets = [masterRelative, submissionRelative, previewRelative, reportRelative, disclosureRelative].filter(Boolean) as string[]
  for (const relative of targets) {
    if (await exists(resolveInside(runDirectory, relative))) throw new Error(`Final output already exists: ${relative}`)
  }

  const input = resolveInside(runDirectory, candidate.file)
  const master = resolveInside(runDirectory, masterRelative)
  await renderSubmission(input, master, spec.minPixels.width, spec.minPixels.height, spec.dpi, 'png')
  const submission = resolveInside(runDirectory, submissionRelative)
  if (format === 'png') await copyFile(master, submission, fsConstants.COPYFILE_EXCL)
  else await renderSubmission(input, submission, spec.minPixels.width, spec.minPixels.height, spec.dpi, format)
  const preview = resolveInside(runDirectory, previewRelative)
  await createSafeAreaPreview(master, preview, profile)

  const outputMetadata = await inspectImage(submission)
  const report = {
    schemaVersion: SCHEMA_VERSION,
    candidateId: candidate.id,
    finalizedAt: now.toISOString(),
    profileId: profile.id,
    input: { file: candidate.file, sha256: candidate.sha256, actual: candidate.actual },
    output: {
      file: submissionRelative,
      sha256: await sha256File(submission),
      actual: outputMetadata,
    },
    transforms: [
      `Downsample/crop to exact ${spec.minPixels.width}×${spec.minPixels.height} canvas without enlargement`,
      `Export in sRGB with ${spec.dpi} dpi metadata after pixel requirements passed`,
      'No journal logo, text, or masthead embedded',
    ],
    audit,
  }
  await writeJsonExclusive(resolveInside(runDirectory, reportRelative), report)

  if (disclosureRelative && profile.disclosure.template) {
    await writeExclusive(
      resolveInside(runDirectory, disclosureRelative),
      `# AI-use disclosure draft\n\n${replaceDisclosureTokens(profile.disclosure.template, candidate)}\n\nVerify this wording against the current journal guidance before submission.\n`,
    )
  }

  const final: z.infer<typeof FinalEntrySchema> = {
    candidateId: candidate.id,
    masterFile: masterRelative,
    submissionFile: submissionRelative,
    safeAreaPreviewFile: previewRelative,
    reportFile: reportRelative,
    disclosureFile: disclosureRelative,
    finalizedAt: now.toISOString(),
  }
  manifest.final = final
  for (let index = 0; index < targets.length; index += 1) {
    const relative = targets[index]
    const output = resolveInside(runDirectory, relative)
    addArtifact(manifest, {
      id: `final-${index + 1}`,
      kind: relative.includes('disclosure') ? 'disclosure' : 'final',
      file: relative,
      sha256: await sha256File(output),
      createdAt: now.toISOString(),
    })
  }
  await saveManifest(runDirectory, manifest, now)
  return { ok: true, audit, files: targets.map((relative) => resolveInside(runDirectory, relative)) }
}

function parseArguments(argv: string[]): { command?: string; values: Map<string, string> } {
  const [command, ...tokens] = argv
  const values = new Map<string, string>()
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index]
    const value = tokens[index + 1]
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Expected --key value, received: ${tokens.slice(index).join(' ')}`)
    }
    if (values.has(key.slice(2))) throw new Error(`Duplicate argument: ${key}`)
    values.set(key.slice(2), value)
  }
  return { command, values }
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key)
  if (!value) throw new Error(`Missing --${key}`)
  return value
}

function usage(): string {
  return `Scientific Cover Forge\n\n` +
    `Commands:\n` +
    `  init --brief FILE --out DIR [--profiles FILE]\n` +
    `  register --run DIR --record FILE\n` +
    `  sheet --run DIR [--stage initial|refine-1|refine-2] [--candidate ID]\n` +
    `  audit --run DIR --candidate ID\n` +
    `  finalize --run DIR --candidate ID [--format png|jpeg|tiff]\n`
}

async function main(): Promise<void> {
  const { command, values } = parseArguments(process.argv.slice(2))
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(usage())
    return
  }
  if (command === 'init') {
    const result = await initRun({
      briefPath: required(values, 'brief'),
      outPath: required(values, 'out'),
      profilesPath: values.get('profiles'),
    })
    process.stdout.write(`${JSON.stringify({ runDirectory: result.runDirectory, policy: result.policy }, null, 2)}\n`)
    return
  }
  if (command === 'register') {
    const record = await readJsonFile(required(values, 'record'))
    const manifest = await registerRecord(required(values, 'run'), record)
    process.stdout.write(`${JSON.stringify({ status: manifest.status, updatedAt: manifest.updatedAt }, null, 2)}\n`)
    return
  }
  if (command === 'sheet') {
    const rawStage = values.get('stage')
    const stage = rawStage ? StageSchema.parse(rawStage) : undefined
    const outputs = await createSheets({ runPath: required(values, 'run'), stage, candidateId: values.get('candidate') })
    process.stdout.write(`${JSON.stringify({ outputs }, null, 2)}\n`)
    return
  }
  if (command === 'audit') {
    const result = await persistAudit(required(values, 'run'), required(values, 'candidate'))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.audit.eligibleForFinalization) process.exitCode = 2
    return
  }
  if (command === 'finalize') {
    const formatValue = values.get('format') ?? 'png'
    const format = z.enum(['png', 'jpeg', 'tiff']).parse(formatValue)
    const result = await finalizeRun({
      runPath: required(values, 'run'),
      candidateId: required(values, 'candidate'),
      format,
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.ok) process.exitCode = 2
    return
  }
  throw new Error(`Unknown command: ${command}\n\n${usage()}`)
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
