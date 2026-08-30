import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { AssetRightsStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPublicUploadLocation, persistPublicUpload } from '@/lib/public-upload'

const PRIVATE_IMPORT_PREFIX = 'private-import://design-preview/'

function sha256(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function publishReviewedImport(asset: {
  storageUrl: string
  derivedSha256: string
}) {
  if (!asset.storageUrl.startsWith(PRIVATE_IMPORT_PREFIX)) return asset.storageUrl
  const fileName = asset.storageUrl.slice(PRIVATE_IMPORT_PREFIX.length)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileName) || fileName.includes('..')) {
    throw new Error('ERR_VISUAL_ASSET_PRIVATE_REF_INVALID')
  }
  const buffer = await readFile(path.join(process.cwd(), 'imports', 'design-preview', fileName))
  if (sha256(buffer) !== asset.derivedSha256) {
    throw new Error('ERR_VISUAL_ASSET_HASH_MISMATCH')
  }
  const publicFileName = `design-preview-${asset.derivedSha256.slice(0, 24)}.webp`
  const location = getPublicUploadLocation('apps', publicFileName)
  try {
    await access(location.absolutePath)
    return location.publicUrl
  } catch {
    return persistPublicUpload({ category: 'apps', fileName: publicFileName, buffer })
  }
}

export async function listVisualAssetsForManage() {
  return prisma.visualAsset.findMany({
    orderBy: [{ rightsStatus: 'asc' }, { importedAt: 'desc' }],
    include: {
      candidate: { select: { id: true, title: true, slug: true, status: true } },
      app: { select: { id: true, title: true, slug: true, status: true } },
    },
  })
}

export async function updateVisualAssetRights(input: {
  id: string
  rightsStatus: AssetRightsStatus
  rightsNote?: string
}) {
  const existing = await prisma.visualAsset.findUnique({ where: { id: input.id } })
  if (!existing) throw new Error('ERR_VISUAL_ASSET_NOT_FOUND')
  if (
    (input.rightsStatus === AssetRightsStatus.owned
      || input.rightsStatus === AssetRightsStatus.licensed)
    && !input.rightsNote?.trim()
  ) {
    throw new Error('ERR_VISUAL_ASSET_RIGHTS_NOTE_REQUIRED')
  }
  const publishable = input.rightsStatus === AssetRightsStatus.owned
    || input.rightsStatus === AssetRightsStatus.licensed
  const storageUrl = publishable ? await publishReviewedImport(existing) : existing.storageUrl

  return prisma.$transaction(async (tx) => {
    const asset = await tx.visualAsset.update({
      where: { id: input.id },
      data: {
        rightsStatus: input.rightsStatus,
        rightsNote: input.rightsNote?.trim() || null,
        storageUrl,
      },
    })
    if (publishable && existing.appId && storageUrl.startsWith('/uploads/')) {
      await tx.app.updateMany({
        where: {
          id: existing.appId,
          OR: [{ previewImageUrl: null }, { previewImageUrl: '' }],
        },
        data: { previewImageUrl: storageUrl },
      })
    }
    return asset
  })
}
