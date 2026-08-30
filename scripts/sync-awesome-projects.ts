import { CandidateStatus, PrismaClient } from '@prisma/client'
import {
  AWESOME_PROJECTS,
  awesomeCandidateTags,
  awesomeDossierJson,
  backfillAwesomeDossierJson,
  backfillAwesomeTags,
} from '../src/content/awesome-projects'

const prisma = new PrismaClient()

async function main() {
  const projectBySlug = new Map(AWESOME_PROJECTS.map((project) => [project.slug, project]))
  const existing = await prisma.candidate.findMany({
    where: {
      slug: { in: AWESOME_PROJECTS.map((project) => project.slug) },
      tags: { contains: '"awesome"' },
    },
    select: { id: true, slug: true, rawContent: true, tags: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    let backfilled = 0
    for (const candidate of existing) {
      const project = projectBySlug.get(candidate.slug)
      if (!project) continue

      const rawContent = backfillAwesomeDossierJson(candidate.rawContent, project)
      const tags = backfillAwesomeTags(candidate.tags, project)
      const data = {
        ...(rawContent && rawContent !== candidate.rawContent ? { rawContent } : {}),
        ...(tags && tags !== candidate.tags ? { tags } : {}),
      }
      if (Object.keys(data).length === 0) continue

      await tx.candidate.update({ where: { id: candidate.id }, data })
      backfilled += 1
    }

    const inserted = await tx.candidate.createMany({
      data: AWESOME_PROJECTS.map((project) => ({
        title: project.title,
        slug: project.slug,
        summary: project.summary,
        rawContent: awesomeDossierJson(project),
        websiteUrl: project.websiteUrl,
        sourceUrl: project.sourceUrl,
        tags: JSON.stringify(awesomeCandidateTags(project)),
        status: CandidateStatus.watching,
        sortOrder: project.sortOrder,
      })),
      skipDuplicates: true,
    })

    return { inserted: inserted.count, backfilled }
  })

  console.log(
    `AWESOME candidates ready: ${result.inserted} inserted, ${result.backfilled} metadata-backfilled; existing content and scores preserved`,
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
