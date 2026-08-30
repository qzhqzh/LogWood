import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import type { PromptTestResult } from '@/modules/prompt-runner'
import {
  createScientificCoverRun,
  getScientificCoverCandidateAsset,
  getScientificCoverContactSheetAsset,
  getScientificCoverPrompt,
  getScientificCoverRun,
  persistScientificCoverCandidate,
  ScientificCoverError,
} from './service'

const NOW = new Date('2026-08-29T12:00:00.000Z')
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
})

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'logwood-scientific-cover-'))
  temporaryDirectories.push(directory)
  return directory
}

function runInput(profileId = 'acs-jacs-au-2026-08') {
  return {
    profileId,
    projectTitle: 'Porous host cover concept',
    articleType: 'Research Article',
    publisher: '',
    journalName: '',
    officialGuidelinesUrl: '',
    claim: 'A porous host changes its internal environment to favor one reaction pathway.',
    novelty: 'The local environment reorganizes during the conceptual transformation.',
    subjectName: 'porous host',
    subjectRole: 'scientific host structure',
    outcomeName: 'selective transformation',
    allowedRelationship: 'is associated with',
    mustShow: ['A distinct interior environment', 'An incoming-to-outgoing transformation'],
    mustNotShow: ['Measured values or microscopy-like evidence'],
    uncertainties: ['The transition state is not directly observed'],
    forbiddenInferences: ['Do not imply perfect yield'],
    artDirection: {
      mood: ['precise'],
      palette: ['deep blue', 'warm amber'],
      medium: ['scientific editorial illustration'],
      avoid: ['text', 'logos', 'stock science collage'],
    },
    concepts: [
      {
        title: 'Interior climate',
        metaphor: 'A porous monument holds a distinct illuminated interior climate.',
        mapping: 'The monument maps to the host and the interior light maps to its local environment.',
      },
      {
        title: 'Selective passage',
        metaphor: 'A controlled path changes character while passing through one central structure.',
        mapping: 'The path maps to transformation and the structure maps to the host.',
      },
      {
        title: 'Reorganized chamber',
        metaphor: 'Layered chambers reorganize around one restrained transition.',
        mapping: 'The chambers map to the local environment without asserting atomic structure.',
      },
    ],
    redactedConfirmed: true as const,
    toolCommercialUseConfirmed: true,
  }
}

async function imageResult(): Promise<{ result: PromptTestResult; data: Buffer }> {
  const data = await sharp({
    create: { width: 60, height: 80, channels: 3, background: '#244f56' },
  }).png().toBuffer()
  return {
    data,
    result: {
      kind: 'image',
      image: {
        dataUrl: `data:image/png;base64,${data.toString('base64')}`,
        mimeType: 'image/png',
        width: 60,
        height: 80,
      },
      requestId: 'provider-request-001',
      attribution: {
        provider: 'CPA',
        model: 'gemini-image',
        modelVersion: 'gemini-image-2026-08',
        generatedAt: NOW,
      },
    },
  }
}

describe('scientific cover web service', () => {
  it('registers exactly three concepts by two compositions in an owner-scoped run', async () => {
    const baseDirectory = await temporaryDirectory()
    const run = await createScientificCoverRun(runInput(), 'owner-a', { baseDirectory, now: NOW })

    expect(run.runId).toMatch(/^cover-20260829-[a-f0-9]{8}$/)
    expect(run.policy).toMatchObject({
      profileId: 'acs-jacs-au-2026-08',
      journal: 'JACS Au',
      generationAllowed: true,
      finalizationBlocked: false,
    })
    expect(run.candidates).toHaveLength(6)
    expect(new Set(run.candidates.map((candidate) => candidate.conceptId)).size).toBe(3)
    expect(new Set(run.candidates.map((candidate) => candidate.compositionId))).toEqual(
      new Set(['monument', 'transit']),
    )
    expect(run.candidates.every((candidate) => candidate.prompt.includes('No text, letters'))).toBe(true)

    await expect(getScientificCoverRun('owner-b', run.runId, { baseDirectory, now: NOW }))
      .rejects.toMatchObject({ code: 'ERR_SCIENTIFIC_COVER_NOT_FOUND' })
  })

  it('creates a text-only evidence run but blocks image generation for Nature', async () => {
    const baseDirectory = await temporaryDirectory()
    const run = await createScientificCoverRun(
      { ...runInput('nature-generative-ai-prohibited-2026-08'), toolCommercialUseConfirmed: false },
      'owner-a',
      { baseDirectory, now: NOW },
    )

    expect(run.policy.generationAllowed).toBe(false)
    expect(run.policy.reasons).toContain('Target policy prohibits generative-AI cover artwork')
    await expect(getScientificCoverPrompt(
      'owner-a',
      run.runId,
      run.candidates[0].candidateId,
      { baseDirectory, now: NOW },
    )).rejects.toBeInstanceOf(ScientificCoverError)
  })

  it('persists provider provenance and creates a verified six-up contact sheet', async () => {
    const baseDirectory = await temporaryDirectory()
    const run = await createScientificCoverRun(runInput(), 'owner-a', { baseDirectory, now: NOW })
    const { result, data } = await imageResult()

    for (const candidate of run.candidates) {
      await persistScientificCoverCandidate(
        'owner-a',
        run.runId,
        candidate.candidateId,
        result,
        { baseDirectory, now: NOW },
      )
    }

    const completed = await getScientificCoverRun('owner-a', run.runId, { baseDirectory, now: NOW })
    expect(completed.generatedCount).toBe(6)
    expect(completed.contactSheetUrl).toContain('/contact-sheet')
    expect(completed.candidates[0]).toMatchObject({
      generated: true,
      provider: 'CPA',
      model: 'gemini-image',
      modelVersion: 'gemini-image-2026-08',
      providerRequestId: 'provider-request-001',
      actual: { width: 60, height: 80, format: 'png' },
    })

    const candidateAsset = await getScientificCoverCandidateAsset(
      'owner-a',
      run.runId,
      run.candidates[0].candidateId,
      { baseDirectory, now: NOW },
    )
    expect(candidateAsset.data.equals(data)).toBe(true)
    expect((await getScientificCoverContactSheetAsset(
      'owner-a',
      run.runId,
      { baseDirectory, now: NOW },
    )).data.length).toBeGreaterThan(1_000)
  })
})
