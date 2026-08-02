import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  getPublicUploadLocation,
  PUBLIC_UPLOAD_CATEGORIES,
} from './public-upload'

describe('lib/public-upload', () => {
  it.each(PUBLIC_UPLOAD_CATEGORIES)(
    'keeps the %s disk directory and public URL aligned',
    (category) => {
      const location = getPublicUploadLocation(
        category,
        'preview-123.png',
        '/srv/logwood',
      )

      expect(location.directory).toBe(
        path.join('/srv/logwood', 'public', 'uploads', category),
      )
      expect(location.absolutePath).toBe(
        path.join('/srv/logwood', 'public', 'uploads', category, 'preview-123.png'),
      )
      expect(location.publicUrl).toBe(
        `/uploads/${category}/preview-123.png`,
      )
    },
  )

  it('maps Skill previews to the skills directory', () => {
    const location = getPublicUploadLocation(
      'skills',
      'skill.png',
      '/srv/logwood',
    )

    expect(location.absolutePath).toBe(
      path.join('/srv/logwood', 'public', 'uploads', 'skills', 'skill.png'),
    )
    expect(location.publicUrl).toBe('/uploads/skills/skill.png')
  })

  it.each(['../escape.png', 'nested/file.png', '/absolute.png', '']) (
    'rejects unsafe filename %s',
    (fileName) => {
      expect(() =>
        getPublicUploadLocation('articles', fileName, '/srv/logwood'),
      ).toThrow('ERR_INVALID_UPLOAD_FILENAME')
    },
  )
})
