import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

export async function GET() {
  const body = await readFile(path.join(process.cwd(), 'scripts', 'skillhub.mjs'))
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Disposition': 'attachment; filename="skillhub.mjs"',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
