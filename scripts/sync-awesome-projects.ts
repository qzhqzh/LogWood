import { CandidateStatus, PrismaClient } from '@prisma/client'
import {
  AWESOME_PROJECTS,
  awesomeCandidateTags,
  awesomeDossierJson,
} from '../src/content/awesome-projects'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.candidate.createMany({
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

  console.log(`AWESOME candidates ready: ${result.count} inserted, existing rows preserved`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
