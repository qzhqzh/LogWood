import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sourceDir = path.resolve(
  process.argv[2] || '/home/zhuqin/star/app/design-preview/images',
)
const outputDir = path.resolve(
  process.argv[3] || path.join(process.cwd(), 'imports/design-preview'),
)
const duplicateFile = 'design-10-resized-1024x768.png'
const duplicateOf = 'ChatGPT Image 2026年6月4日 19_32_08 (10).png'

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

await mkdir(outputDir, { recursive: true })
const sourceFiles = (await readdir(sourceDir))
  .filter((file) => file.endsWith('.png'))
  .sort((left, right) => left.localeCompare(right, 'zh-CN'))

const items = []
for (const [index, sourceFile] of sourceFiles.filter((file) => file !== duplicateFile).entries()) {
  const sourceBuffer = await readFile(path.join(sourceDir, sourceFile))
  const originalSha256 = sha256(sourceBuffer)
  const derivedBuffer = await sharp(sourceBuffer)
    .rotate()
    .webp({ quality: 88, effort: 6 })
    .toBuffer()
  const derivedSha256 = sha256(derivedBuffer)
  const fileName = `${String(index + 1).padStart(2, '0')}-${derivedSha256.slice(0, 16)}.webp`
  const metadata = await sharp(derivedBuffer).metadata()
  await writeFile(path.join(outputDir, fileName), derivedBuffer)
  items.push({
    order: index + 1,
    title: `病理 AI 界面概念 ${String(index + 1).padStart(2, '0')}`,
    sourceFile,
    originalSha256,
    derivedFile: fileName,
    derivedSha256,
    width: metadata.width,
    height: metadata.height,
    mimeType: 'image/webp',
    rightsStatus: 'review_required',
  })
}

const duplicateBuffer = await readFile(path.join(sourceDir, duplicateFile))
await writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify({
    version: 1,
    sourceCollection: 'design-preview/pathology-ai-concepts',
    sourceRepository: 'design-preview',
    items,
    excluded: [{
      sourceFile: duplicateFile,
      originalSha256: sha256(duplicateBuffer),
      reason: 'near_duplicate_resized_copy',
      duplicateOf,
    }],
  }, null, 2)}\n`,
)

console.log(`Prepared ${items.length} assets in ${outputDir}`)
