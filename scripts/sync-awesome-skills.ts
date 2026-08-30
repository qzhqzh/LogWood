import { CandidateStatus, PrismaClient } from '@prisma/client'
import {
  AWESOME_SKILLS,
  awesomeSkillCandidateTags,
  awesomeSkillDossierJson,
  backfillAwesomeSkillDossierJson,
  backfillAwesomeSkillTags,
} from '../src/content/awesome-skills'

const prisma = new PrismaClient()

async function main() {
  const skillBySlug = new Map(AWESOME_SKILLS.map((skill) => [skill.slug, skill]))
  const existing = await prisma.candidate.findMany({
    where: { slug: { in: AWESOME_SKILLS.map((skill) => skill.slug) } },
    select: { id: true, slug: true, rawContent: true, tags: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    let backfilled = 0
    let collisions = 0

    for (const candidate of existing) {
      const skill = skillBySlug.get(candidate.slug)
      if (!skill) continue

      let parsedTags: unknown
      try {
        parsedTags = JSON.parse(candidate.tags)
      } catch {
        parsedTags = null
      }
      if (!Array.isArray(parsedTags) || !parsedTags.includes('catalog:skill')) {
        collisions += 1
        continue
      }

      const rawContent = backfillAwesomeSkillDossierJson(candidate.rawContent, skill)
      const tags = backfillAwesomeSkillTags(candidate.tags, skill)
      const data = {
        ...(rawContent && rawContent !== candidate.rawContent ? { rawContent } : {}),
        ...(tags && tags !== candidate.tags ? { tags } : {}),
      }
      if (Object.keys(data).length === 0) continue

      await tx.candidate.update({ where: { id: candidate.id }, data })
      backfilled += 1
    }

    const inserted = await tx.candidate.createMany({
      data: AWESOME_SKILLS.map((skill) => ({
        title: skill.title,
        slug: skill.slug,
        summary: skill.summary,
        rawContent: awesomeSkillDossierJson(skill),
        websiteUrl: skill.websiteUrl,
        sourceUrl: skill.sourceUrl,
        tags: JSON.stringify(awesomeSkillCandidateTags(skill)),
        status: CandidateStatus.watching,
        sortOrder: skill.sortOrder,
      })),
      skipDuplicates: true,
    })

    return { inserted: inserted.count, backfilled, collisions }
  })

  console.log(
    `AWESOME skills ready: ${result.inserted} inserted, ${result.backfilled} metadata-backfilled, ${result.collisions} slug collisions preserved; existing content and scores preserved`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
