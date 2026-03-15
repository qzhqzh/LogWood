import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createEmoji, listEmojis } from '@/modules/emoji'

const createEmojiSchema = z.object({
  name: z.string().min(1).max(30),
  symbol: z.string().min(1).max(16),
})

export async function GET(_request: NextRequest) {
  try {
    const emojis = await listEmojis()
    return NextResponse.json({ emojis })
  } catch (error) {
    console.error('GET /api/emojis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'ERR_UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createEmojiSchema.parse(body)
    const emoji = await createEmoji(validated)

    return NextResponse.json(emoji, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'ERR_EMOJI_VALIDATION', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && (error.message === 'ERR_EMOJI_NAME_REQUIRED' || error.message === 'ERR_EMOJI_SYMBOL_REQUIRED')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('POST /api/emojis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
