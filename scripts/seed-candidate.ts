import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.candidate.upsert({
    where: { slug: 'openclaw-watch' },
    update: {
      title: 'OpenClaw',
      summary: '本地优先的个人 AI 助手候选——值得先观察再决定是否晋升。',
      websiteUrl: 'https://github.com',
      status: 'evaluating',
      tags: JSON.stringify(['AI助手', '本地优先']),
    },
    create: {
      title: 'OpenClaw',
      slug: 'openclaw-watch',
      summary: '本地优先的个人 AI 助手候选——值得先观察再决定是否晋升。',
      websiteUrl: 'https://github.com',
      status: 'evaluating',
      tags: JSON.stringify(['AI助手', '本地优先']),
    },
  })
  console.log('seeded', await prisma.candidate.count())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
