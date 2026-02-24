import { NextRequest, NextResponse } from 'next/server'
import { listTargets, getTargetBySlug, getFeatures } from '@/modules/target'
import { TargetType } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as TargetType | null
    const feature = searchParams.get('feature')
    const slug = searchParams.get('slug')
    const features = searchParams.get('features') === 'true'

    if (features) {
      const featureList = await getFeatures()
      return NextResponse.json({ features: featureList })
    }

    if (type && slug) {
      const target = await getTargetBySlug(type, slug)
      if (!target) {
        return NextResponse.json(
          { error: 'ERR_TARGET_NOT_FOUND' },
          { status: 404 }
        )
      }
      return NextResponse.json({ target })
    }

    const filter: { type?: TargetType; feature?: string } = {}
    if (type && (type === 'editor' || type === 'coding')) {
      filter.type = type
    }
    if (feature) {
      filter.feature = feature
    }

    const targets = await listTargets(Object.keys(filter).length > 0 ? filter : undefined)

    return NextResponse.json({ targets })
  } catch (error) {
    console.error('GET /api/targets error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
