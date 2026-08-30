import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CoverBriefSchema,
  DEFAULT_PROFILES_PATH,
  JournalProfileSchema,
  RunManifestSchema,
  auditCandidate,
  createSheets,
  evaluatePolicy,
  finalizeRun,
  initRun,
  registerRecord,
  type CoverBrief,
  type JournalProfile,
} from './cover-forge'

const FIXED_NOW = new Date('2026-08-29T12:00:00.000Z')
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'scientific-cover-forge-'))
  temporaryDirectories.push(directory)
  return directory
}

function baseBrief(options: {
  profileId: string
  publisher: string
  journal: string
  officialGuidelinesUrl?: string
  toolCommercialUseConfirmed?: boolean
  permissionEvidence?: CoverBrief['journal']['permissionEvidence']
  references?: CoverBrief['references']
}): CoverBrief {
  return CoverBriefSchema.parse({
    schemaVersion: '1.0.0',
    runId: 'test-cover-run',
    projectTitle: 'A redacted scientific cover concept',
    journal: {
      profileId: options.profileId,
      publisher: options.publisher,
      name: options.journal,
      articleType: 'Research Article',
      officialGuidelinesUrl: options.officialGuidelinesUrl,
      permissionEvidence: options.permissionEvidence,
    },
    story: {
      claim: 'A porous host changes its internal environment to favor one reaction pathway.',
      novelty: 'The local environment reorganizes during the conceptual transformation.',
      entities: [
        { name: 'porous host', role: 'scientific host structure' },
        { name: 'reactant', role: 'incoming species' },
        { name: 'product', role: 'outgoing species' },
      ],
      relationships: [
        { from: 'reactant', to: 'porous host', type: 'enters' },
        { from: 'porous host', to: 'product', type: 'selectively transforms' },
      ],
    },
    truth: {
      mustShow: ['A distinct interior environment', 'An incoming-to-outgoing transformation'],
      mustNotShow: ['Charts, spectra, measured values, or microscopy-like evidence'],
      uncertainties: ['The atomic transition state is not directly observed'],
      forbiddenInferences: ['Do not imply perfect yield or universal selectivity'],
    },
    artDirection: {
      mood: ['precise'],
      palette: ['deep blue', 'warm amber'],
      medium: ['scientific editorial illustration'],
      avoid: ['text', 'logos', 'stock science collage'],
    },
    references: options.references ?? [],
    privacy: {
      redactedConfirmed: true,
      containsUnpublishedFullText: false,
      containsRawExperimentalData: false,
      containsPrimaryResearchImages: false,
    },
    compliance: {
      toolCommercialUseConfirmed: options.toolCommercialUseConfirmed ?? true,
      humanScientificReviewRequired: true,
    },
  })
}

function allowedTestProfile(): JournalProfile {
  return JournalProfileSchema.parse({
    id: 'test-journal-allowed',
    publisher: 'Test Publisher',
    journal: 'Test Journal',
    policyState: 'allowed',
    sourceUrls: ['https://example.org/test-journal-guidelines'],
    verifiedAt: '2026-08-29',
    reviewAfter: '2099-12-31',
    policyNotes: ['Test-only exact profile'],
    disclosure: {
      required: true,
      template: 'Generated with [provider] using [model] and reviewed by the authors.',
    },
    toolCommercialUseConfirmationRequired: true,
    permissionEvidenceRequired: false,
    exactJournalProfile: true,
    spec: {
      physicalWidth: 2,
      physicalHeight: 2.6666667,
      physicalUnit: 'in',
      dpi: 300,
      minPixels: { width: 600, height: 800 },
      acceptedFormats: ['png', 'jpeg', 'tiff'],
      allowAlpha: false,
      colorSpace: 'srgb',
      safeAreas: [
        {
          id: 'masthead',
          label: 'Generic masthead reserve',
          x: 0,
          y: 0,
          width: 1,
          height: 0.2,
        },
      ],
    },
  })
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function initializeAllowedRun(root: string): Promise<string> {
  const profile = allowedTestProfile()
  const profilesPath = path.join(root, 'profiles.json')
  const briefPath = path.join(root, 'brief.json')
  const runPath = path.join(root, 'run')
  await writeJson(profilesPath, { schemaVersion: '1.0.0', profiles: [profile] })
  await writeJson(
    briefPath,
    baseBrief({
      profileId: profile.id,
      publisher: profile.publisher,
      journal: profile.journal,
      officialGuidelinesUrl: profile.sourceUrls[0],
    }),
  )
  await initRun({ briefPath, profilesPath, outPath: runPath, now: FIXED_NOW })
  return runPath
}

async function createRaster(filePath: string, width: number, height: number, index: number): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: {
        r: 20 + (index * 31) % 200,
        g: 50 + (index * 47) % 180,
        b: 80 + (index * 59) % 160,
      },
    },
  })
    .png()
    .toFile(filePath)
}

const passingScores = {
  scientificFidelity: 5,
  metaphorMapping: 4,
  originality: 4,
  composition: 4,
  thumbnailReadability: 4,
  technicalReadiness: 5,
  rightsSafety: 5,
}

async function addStage(options: {
  root: string
  runPath: string
  stage: 'initial' | 'refine-1' | 'refine-2'
  count: number
  finalCandidateUndersized?: boolean
  vetoCandidateId?: string
}): Promise<string[]> {
  const promptId = `prompt-${options.stage}`
  await registerRecord(
    options.runPath,
    {
      schemaVersion: '1.0.0',
      kind: 'prompt',
      id: promptId,
      stage: options.stage,
      conceptId: `concept-${options.stage}`,
      content: `A complete text-free scientific cover render prompt for stage ${options.stage}.`,
    },
    FIXED_NOW,
  )
  const ids: string[] = []
  for (let index = 1; index <= options.count; index += 1) {
    const id = `${options.stage}-${String(index).padStart(2, '0')}`
    ids.push(id)
    const undersized = options.finalCandidateUndersized && options.stage === 'refine-2' && index === 1
    const source = path.join(options.root, `${id}.png`)
    await createRaster(source, undersized ? 500 : 600, undersized ? 700 : 800, index)
    await registerRecord(
      options.runPath,
      {
        schemaVersion: '1.0.0',
        kind: 'candidate',
        id,
        stage: options.stage,
        promptId,
        sourceFile: source,
        provider: 'openai-imagegen',
        model: 'test-image-model',
        modelVersion: 'test-image-model-1',
        generatedAt: FIXED_NOW.toISOString(),
        desired: { width: 600, height: 800, quality: options.stage === 'initial' ? 'draft' : 'final' },
      },
      FIXED_NOW,
    )
    await registerRecord(
      options.runPath,
      {
        schemaVersion: '1.0.0',
        kind: 'review',
        id: `review-${id}`,
        candidateId: id,
        scores: passingScores,
        vetoes: id === options.vetoCandidateId ? ['invented-evidence'] : [],
        findings: ['Scientific mapping and composition inspected at full size and thumbnail size.'],
        nextEdit: 'Preserve the mapping and refine only one declared visual property.',
      },
      FIXED_NOW,
    )
  }
  return ids
}

async function recordDecision(
  runPath: string,
  stage: 'initial-selection' | 'refine-1-selection' | 'final-selection',
  ids: string[],
): Promise<void> {
  await registerRecord(
    runPath,
    {
      schemaVersion: '1.0.0',
      kind: 'decision',
      id: `decision-${stage}`,
      stage,
      selectedCandidateIds: ids,
      reviewer: 'human-author',
      rationale: 'The selected candidate preserves scientific meaning and cover hierarchy.',
      decidedAt: FIXED_NOW.toISOString(),
    },
    FIXED_NOW,
  )
}

async function completeWorkflow(root: string, undersizedFinal = false): Promise<{ runPath: string; finalId: string }> {
  const runPath = await initializeAllowedRun(root)
  const initial = await addStage({ root, runPath, stage: 'initial', count: 6 })
  await recordDecision(runPath, 'initial-selection', [initial[0]])
  const refineOne = await addStage({ root, runPath, stage: 'refine-1', count: 2 })
  await recordDecision(runPath, 'refine-1-selection', [refineOne[0]])
  const refineTwo = await addStage({ root, runPath, stage: 'refine-2', count: 2, finalCandidateUndersized: undersizedFinal })
  await recordDecision(runPath, 'final-selection', [refineTwo[0]])
  return { runPath, finalId: refineTwo[0] }
}

describe('scientific-cover-forge', () => {
  it('rejects model-input references with unknown rights', () => {
    expect(() =>
      baseBrief({
        profileId: 'unverified-manual-review',
        publisher: 'Unknown',
        journal: 'Unknown Journal',
        officialGuidelinesUrl: 'https://example.org/guidelines',
        references: [
          {
            id: 'unlicensed-cover',
            source: 'https://example.org/cover.png',
            role: 'style',
            useMode: 'model-input',
            rights: 'unknown',
          },
        ],
      }),
    ).toThrow(/must be owned, licensed, or public-domain/)
  })

  it('blocks Nature generation and keeps Elsevier concept-only without permission', async () => {
    const root = await temporaryDirectory()
    const natureBriefPath = path.join(root, 'nature-brief.json')
    const natureRun = path.join(root, 'nature-run')
    await writeJson(
      natureBriefPath,
      baseBrief({
        profileId: 'nature-generative-ai-prohibited-2026-08',
        publisher: 'Springer Nature',
        journal: 'Nature',
        officialGuidelinesUrl: 'https://research-figure-guide.nature.com/covers/',
        toolCommercialUseConfirmed: false,
      }),
    )
    const nature = await initRun({ briefPath: natureBriefPath, profilesPath: DEFAULT_PROFILES_PATH, outPath: natureRun, now: FIXED_NOW })
    expect(nature.policy.generationAllowed).toBe(false)
    expect(nature.manifest.status).toBe('blocked')
    expect(await readFile(path.join(natureRun, 'human-illustrator-brief.md'), 'utf8')).toContain('Generative rendering was not started')

    const elsevierBriefPath = path.join(root, 'elsevier-brief.json')
    const elsevierRun = path.join(root, 'elsevier-run')
    await writeJson(
      elsevierBriefPath,
      baseBrief({
        profileId: 'elsevier-permission-required-2026-08',
        publisher: 'Elsevier',
        journal: 'Example Elsevier Journal',
        officialGuidelinesUrl: 'https://example.org/elsevier-journal-guidelines',
      }),
    )
    const elsevier = await initRun({ briefPath: elsevierBriefPath, profilesPath: DEFAULT_PROFILES_PATH, outPath: elsevierRun, now: FIXED_NOW })
    expect(elsevier.policy.generationAllowed).toBe(true)
    expect(elsevier.policy.finalizationBlocked).toBe(true)
    expect(elsevier.manifest.status).toBe('concept-only')
    expect(elsevier.policy.reasons).toContain('Prior editor and publisher permission evidence is missing')
  })

  it('enforces six initial candidates and rejects a vetoed human selection', async () => {
    const root = await temporaryDirectory()
    const runPath = await initializeAllowedRun(root)
    const initial = await addStage({ root, runPath, stage: 'initial', count: 6, vetoCandidateId: 'initial-01' })
    const extraSource = path.join(root, 'initial-07.png')
    await createRaster(extraSource, 600, 800, 7)
    await expect(
      registerRecord(runPath, {
        schemaVersion: '1.0.0',
        kind: 'candidate',
        id: 'initial-07',
        stage: 'initial',
        promptId: 'prompt-initial',
        sourceFile: extraSource,
        provider: 'openai-imagegen',
        model: 'test-image-model',
        generatedAt: FIXED_NOW.toISOString(),
      }),
    ).rejects.toThrow(/Candidate limit reached/)
    await expect(recordDecision(runPath, 'initial-selection', [initial[0]])).rejects.toThrow(/unresolved vetoes/)
  })

  it('does not request initial selection before the six-candidate set is complete', async () => {
    const root = await temporaryDirectory()
    const runPath = await initializeAllowedRun(root)
    await addStage({ root, runPath, stage: 'initial', count: 1 })
    const manifest = RunManifestSchema.parse(JSON.parse(await readFile(path.join(runPath, 'run-manifest.json'), 'utf8')))
    expect(manifest.status).toBe('concepting')
  })

  it('runs the complete 6 + 2 + 2 workflow, contact sheet, audit, and exact final export', async () => {
    const root = await temporaryDirectory()
    const { runPath, finalId } = await completeWorkflow(root)
    const sheets = await createSheets({ runPath, stage: 'initial', candidateId: finalId, now: FIXED_NOW })
    expect(sheets).toHaveLength(2)
    for (const file of sheets) expect((await sharp(file).metadata()).width).toBeGreaterThan(0)

    const audit = await auditCandidate(runPath, finalId, FIXED_NOW)
    expect(audit.eligibleForFinalization).toBe(true)
    expect(audit.checks.some((check) => check.severity === 'fail')).toBe(false)

    const result = await finalizeRun({ runPath, candidateId: finalId, format: 'png', now: FIXED_NOW })
    expect(result.ok).toBe(true)
    const submission = path.join(runPath, 'final', 'submission.png')
    const metadata = await sharp(submission).metadata()
    expect({ width: metadata.width, height: metadata.height }).toEqual({ width: 600, height: 800 })
    const manifest = RunManifestSchema.parse(JSON.parse(await readFile(path.join(runPath, 'run-manifest.json'), 'utf8')))
    expect(manifest.status).toBe('finalized')
    expect(manifest.final?.candidateId).toBe(finalId)
    expect(await readFile(path.join(runPath, 'final', 'disclosure-draft.md'), 'utf8')).toContain('openai-imagegen')
  }, 30_000)

  it('detects a candidate replaced after registration even when dimensions stay unchanged', async () => {
    const root = await temporaryDirectory()
    const { runPath, finalId } = await completeWorkflow(root)
    const replacement = await sharp({
      create: { width: 600, height: 800, channels: 3, background: { r: 2, g: 4, b: 8 } },
    })
      .png()
      .toBuffer()
    await writeFile(path.join(runPath, 'candidates', `${finalId}.png`), replacement)

    const audit = await auditCandidate(runPath, finalId, FIXED_NOW)
    expect(audit.eligibleForFinalization).toBe(false)
    expect(audit.checks).toContainEqual({
      id: 'candidate-integrity',
      severity: 'fail',
      message: 'Candidate file changed after registration',
    })
  }, 30_000)

  it('refuses to fake resolution and emits a production handoff', async () => {
    const root = await temporaryDirectory()
    const { runPath, finalId } = await completeWorkflow(root, true)
    const audit = await auditCandidate(runPath, finalId, FIXED_NOW)
    expect(audit.eligibleForFinalization).toBe(false)
    expect(audit.checks.find((check) => check.id === 'pixel-dimensions')?.severity).toBe('fail')

    const result = await finalizeRun({ runPath, candidateId: finalId, now: FIXED_NOW })
    expect(result.ok).toBe(false)
    const handoff = await readFile(path.join(runPath, 'production-handoff.md'), 'utf8')
    expect(handoff).toContain('Do not upscale an undersized image')
  }, 30_000)

  it('downgrades an expired allowed profile to manual review', () => {
    const profile = allowedTestProfile()
    const expired = JournalProfileSchema.parse({ ...profile, reviewAfter: '2026-08-28' })
    const brief = baseBrief({ profileId: expired.id, publisher: expired.publisher, journal: expired.journal })
    const policy = evaluatePolicy(expired, brief, FIXED_NOW)
    expect(policy.effectiveState).toBe('manual_review')
    expect(policy.finalizationBlocked).toBe(true)
    expect(policy.reasons).toContain('Policy profile is expired')
  })
})
