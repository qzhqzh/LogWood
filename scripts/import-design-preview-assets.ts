import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { AssetRightsStatus, CandidateStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  createCandidate,
  findCandidateDuplicate,
  promoteCandidate,
} from '@/modules/candidate'

interface ManifestItem {
  order: number
  title: string
  sourceFile: string
  originalSha256: string
  derivedFile: string
  derivedSha256: string
  width: number
  height: number
  mimeType: string
  rightsStatus: 'review_required'
}

interface Manifest {
  version: number
  sourceCollection: string
  sourceRepository: string
  items: ManifestItem[]
}

function sha256(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function main() {
  const importDir = path.resolve(process.argv[2] || 'imports/design-preview')
  const manifest = JSON.parse(
    await readFile(path.join(importDir, 'manifest.json'), 'utf8'),
  ) as Manifest
  const ownerEmail = (
    process.env.DESIGN_PREVIEW_IMPORT_USER_EMAIL
    || process.env.LOGWOOD_MCP_USER_EMAIL
    || ''
  ).trim().toLowerCase()
  if (!ownerEmail.includes('@')) throw new Error('ERR_DESIGN_IMPORT_OWNER_REQUIRED')
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } })
  if (!owner) throw new Error('ERR_DESIGN_IMPORT_OWNER_NOT_FOUND')

  let created = 0
  let reused = 0
  for (const item of manifest.items) {
    const buffer = await readFile(path.join(importDir, item.derivedFile))
    if (sha256(buffer) !== item.derivedSha256) throw new Error('ERR_DESIGN_IMPORT_HASH_MISMATCH')
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(item.derivedFile)) {
      throw new Error('ERR_DESIGN_IMPORT_FILENAME_INVALID')
    }
    const privateStorageRef = `private-import://design-preview/${item.derivedFile}`

    const ideaKey = `design-preview:${item.originalSha256}`
    let candidate = await findCandidateDuplicate({
      ideaKey,
      title: item.title,
      authorUserId: owner.id,
    })
    if (!candidate) {
      candidate = await createCandidate({
        title: item.title,
        ideaKey,
        summary: '病理 AI 产品界面概念稿；等待确认视觉取舍、来源权利与可复用范围。',
        rawContent: JSON.stringify({
          sourceCollection: manifest.sourceCollection,
          sourceFile: item.sourceFile,
          originalSha256: item.originalSha256,
          derivedSha256: item.derivedSha256,
          rightsStatus: item.rightsStatus,
        }),
        previewImageUrl: undefined,
        tags: ['病理 AI', '视觉概念', '待权利确认'],
        status: CandidateStatus.evaluating,
        sortOrder: item.order,
      }, owner.id)
      created += 1
    } else {
      reused += 1
    }

    let appId = candidate.promotedAppId
    if (!appId && candidate.status !== CandidateStatus.promoted) {
      const promoted = await promoteCandidate({
        id: candidate.id,
        to: 'gallery',
        app: {
          name: item.title,
          appUrl: '/skills?type=visual',
          title: item.title,
          summary: '病理 AI 产品界面概念稿，保留为可追溯视觉候选。',
          description: '来自 design-preview 的概念稿。当前仅作为草稿资产保存；权利状态、事实文案和产品能力均需人工确认后才能发布。',
          previewImageUrl: undefined,
          tags: ['病理 AI', '视觉概念', '来源可追溯'],
          status: 'draft',
        },
      })
      appId = promoted.promoted.id
    }

    await prisma.visualAsset.upsert({
      where: { originalSha256: item.originalSha256 },
      update: {
        candidateId: candidate.id,
        appId,
        derivedSha256: item.derivedSha256,
      },
      create: {
        candidateId: candidate.id,
        appId,
        sourceCollection: manifest.sourceCollection,
        sourcePath: `${manifest.sourceRepository}/images/${item.sourceFile}`,
        storageUrl: privateStorageRef,
        originalSha256: item.originalSha256,
        derivedSha256: item.derivedSha256,
        width: item.width,
        height: item.height,
        mimeType: item.mimeType,
        rightsStatus: AssetRightsStatus.review_required,
        rightsNote: '导入时未取得可公开发布的权利证明。',
      },
    })
  }

  console.log(JSON.stringify({ imported: manifest.items.length, created, reused }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
