import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

export const PUBLIC_UPLOAD_CATEGORIES = [
  'apps',
  'articles',
  'skill-effects',
  'skills',
] as const

export type PublicUploadCategory = (typeof PUBLIC_UPLOAD_CATEGORIES)[number]

const SAFE_FILE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export function getPublicUploadLocation(
  category: PublicUploadCategory,
  fileName: string,
  rootDir = process.cwd(),
) {
  if (!SAFE_FILE_NAME.test(fileName) || fileName.includes('..')) {
    throw new Error('ERR_INVALID_UPLOAD_FILENAME')
  }

  const directory = path.join(rootDir, 'public', 'uploads', category)

  return {
    directory,
    absolutePath: path.join(directory, fileName),
    publicUrl: `/uploads/${category}/${fileName}`,
  }
}

export async function persistPublicUpload({
  category,
  fileName,
  buffer,
}: {
  category: PublicUploadCategory
  fileName: string
  buffer: Buffer
}) {
  const location = getPublicUploadLocation(category, fileName)

  await mkdir(location.directory, { recursive: true })
  await writeFile(location.absolutePath, buffer, { flag: 'wx' })

  return location.publicUrl
}
