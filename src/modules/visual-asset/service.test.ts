import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetRightsStatus } from '@prisma/client'

const prismaMock = vi.hoisted(() => {
  const tx = {
    visualAsset: { update: vi.fn() },
    app: { updateMany: vi.fn() },
  }
  return {
    tx,
    visualAsset: { findUnique: vi.fn() },
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/public-upload', () => ({
  getPublicUploadLocation: vi.fn(() => ({
    absolutePath: '/tmp/existing-visual.webp',
    publicUrl: '/uploads/apps/existing-visual.webp',
  })),
  persistPublicUpload: vi.fn(),
}))

import { updateVisualAssetRights } from './service'

describe('visual-asset/service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires an auditable note before an asset becomes publishable', async () => {
    prismaMock.visualAsset.findUnique.mockResolvedValue({
      id: 'asset-1', storageUrl: '/uploads/apps/a.webp', appId: 'app-1',
    })

    await expect(updateVisualAssetRights({
      id: 'asset-1',
      rightsStatus: AssetRightsStatus.licensed,
    })).rejects.toThrow('ERR_VISUAL_ASSET_RIGHTS_NOTE_REQUIRED')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('stores reviewed rights and connects an already-public asset to its App preview', async () => {
    prismaMock.visualAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      appId: 'app-1',
      storageUrl: '/uploads/apps/a.webp',
      derivedSha256: 'a'.repeat(64),
    })
    prismaMock.tx.visualAsset.update.mockResolvedValue({
      id: 'asset-1', rightsStatus: AssetRightsStatus.owned,
    })

    await updateVisualAssetRights({
      id: 'asset-1',
      rightsStatus: AssetRightsStatus.owned,
      rightsNote: '  原图由作者本人生成并确认可发布。  ',
    })

    expect(prismaMock.tx.visualAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: {
        rightsStatus: AssetRightsStatus.owned,
        rightsNote: '原图由作者本人生成并确认可发布。',
        storageUrl: '/uploads/apps/a.webp',
      },
    })
    expect(prismaMock.tx.app.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'app-1',
        OR: [{ previewImageUrl: null }, { previewImageUrl: '' }],
      },
      data: { previewImageUrl: '/uploads/apps/a.webp' },
    })
  })

  it('keeps review-required imports private and disconnected from public previews', async () => {
    prismaMock.visualAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      appId: 'app-1',
      storageUrl: 'private-import://design-preview/pathology-ai-concept-01.webp',
      derivedSha256: 'a'.repeat(64),
    })
    prismaMock.tx.visualAsset.update.mockResolvedValue({ id: 'asset-1' })

    await updateVisualAssetRights({
      id: 'asset-1',
      rightsStatus: AssetRightsStatus.review_required,
      rightsNote: '等待权利确认。',
    })

    expect(prismaMock.tx.visualAsset.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        storageUrl: 'private-import://design-preview/pathology-ai-concept-01.webp',
      }),
    }))
    expect(prismaMock.tx.app.updateMany).not.toHaveBeenCalled()
  })
})
