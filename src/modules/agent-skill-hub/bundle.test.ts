import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { buildSkillBundle, bundleFromForm, MAX_FILE_BYTES, readLimitedMultipart, SkillHubError } from './bundle'

const skillMd = `---
name: writing-lab
description: Diagnose an article's structure before revising it.
license: MIT
---
# Writing lab
Read references/STYLE.md first.
`

function files() {
  return [
    { path: 'SKILL.md', bytes: Buffer.from(skillMd) },
    { path: 'references/STYLE.md', bytes: Buffer.from('Notes for reviewers') },
  ]
}

describe('Skill Hub file bundle', () => {
  it('builds a verifiable ZIP with every relative file and stable source fingerprint', () => {
    const result = buildSkillBundle(files(), 'writing-lab')
    const archive = unzipSync(result.archive)
    expect(Buffer.from(archive['SKILL.md']).toString()).toBe(skillMd)
    expect(Buffer.from(archive['references/STYLE.md']).toString()).toBe('Notes for reviewers')
    expect(result).toMatchObject({ name: 'writing-lab', license: 'MIT' })
    expect(buildSkillBundle(files().reverse(), 'writing-lab').sourceHash).toBe(result.sourceHash)
    expect(JSON.parse(result.fileManifest)).toHaveLength(2)
  })

  it('rejects traversal, duplicate paths, invalid metadata, oversized files, and wrong folder names', () => {
    const invalid = [
      [{ path: '../SKILL.md', bytes: Buffer.from(skillMd) }],
      [...files(), { path: 'references/STYLE.md', bytes: Buffer.from('dupe') }],
      [{ path: 'SKILL.md', bytes: Buffer.from('No YAML') }],
      [{ path: 'SKILL.md', bytes: Buffer.from('a'.repeat(MAX_FILE_BYTES + 1)) }],
    ]
    for (const input of invalid) expect(() => buildSkillBundle(input)).toThrow(SkillHubError)
    expect(() => buildSkillBundle(files(), 'another-skill')).toThrow('ERR_SKILL_HUB_FOLDER_NAME')
    expect(() => buildSkillBundle([{ path: 'SKILL.md', bytes: Buffer.from('---\nname: writing-lab\ndescription: &x A\nother: *x\n---\n') }]))
      .toThrow('ERR_SKILL_HUB_FRONTMATTER')
  })

  it('parses a real multipart folder upload with a hard request-size guard', async () => {
    const form = new FormData()
    form.append('file', new Blob([skillMd]), 'SKILL.md')
    form.set('paths', '["SKILL.md"]')
    form.set('folderName', 'writing-lab')
    form.set('rightsConfirmed', 'true')
    const request = new Request('http://localhost/api/awesome/skills/hub', { method: 'POST', body: form })
    const bundle = await bundleFromForm(await readLimitedMultipart(request))
    expect(bundle.name).toBe('writing-lab')
    const oversized = new Request('http://localhost/api', {
      method: 'POST', body: form,
      headers: { 'Content-Length': String(11 * 1024 * 1024) },
    })
    await expect(readLimitedMultipart(oversized)).rejects.toThrow('ERR_SKILL_HUB_FILE_SIZE')
  })
})
