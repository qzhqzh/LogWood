import { PrismaClient, TargetType } from '@prisma/client'

const prisma = new PrismaClient()

const targets = [
  {
    name: 'Cursor',
    slug: 'cursor',
    type: TargetType.editor,
    logoUrl: 'https://cursor.sh/favicon.ico',
    description: 'AI-first code editor built for pair programming with AI',
    websiteUrl: 'https://cursor.sh',
    developer: 'Anysphere',
    features: JSON.stringify(['代码补全', '代码解释', '调试辅助', '重构建议', '多语言支持', '上下文理解']),
  },
  {
    name: 'Windsurf',
    slug: 'windsurf',
    type: TargetType.editor,
    logoUrl: 'https://codeium.com/favicon.ico',
    description: 'AI-native IDE by Codeium with deep codebase understanding',
    websiteUrl: 'https://codeium.com/windsurf',
    developer: 'Codeium',
    features: JSON.stringify(['代码补全', '代码解释', '调试辅助', '重构建议', '多语言支持']),
  },
  {
    name: 'Zed',
    slug: 'zed',
    type: TargetType.editor,
    logoUrl: 'https://zed.dev/favicon.ico',
    description: 'High-performance, multiplayer code editor with AI features',
    websiteUrl: 'https://zed.dev',
    developer: 'Zed Industries',
    features: JSON.stringify(['代码补全', '多语言支持']),
  },
  {
    name: 'VS Code + Copilot',
    slug: 'vscode-copilot',
    type: TargetType.editor,
    logoUrl: 'https://code.visualstudio.com/favicon.ico',
    description: 'Visual Studio Code with GitHub Copilot extension',
    websiteUrl: 'https://code.visualstudio.com',
    developer: 'Microsoft',
    features: JSON.stringify(['代码补全', '代码解释', '调试辅助', '多语言支持']),
  },
  {
    name: 'GitHub Copilot',
    slug: 'github-copilot',
    type: TargetType.coding,
    logoUrl: 'https://github.githubassets.com/favicons/favicon.svg',
    description: 'AI pair programmer that suggests code and entire functions',
    websiteUrl: 'https://github.com/features/copilot',
    developer: 'GitHub',
    features: JSON.stringify(['代码补全', '代码解释', '单元测试', '多语言支持']),
  },
  {
    name: 'Claude Code',
    slug: 'claude-code',
    type: TargetType.coding,
    logoUrl: 'https://www.anthropic.com/images/icons/apple-touch-icon.png',
    description: 'Anthropic\'s AI coding assistant powered by Claude',
    websiteUrl: 'https://www.anthropic.com',
    developer: 'Anthropic',
    features: JSON.stringify(['代码补全', '代码解释', '调试辅助', '重构建议', '文档生成', '多语言支持', '上下文理解']),
  },
  {
    name: 'Amazon CodeWhisperer',
    slug: 'codewhisperer',
    type: TargetType.coding,
    logoUrl: 'https://aws.amazon.com/favicon.ico',
    description: 'AI coding companion that provides real-time code recommendations',
    websiteUrl: 'https://aws.amazon.com/codewhisperer',
    developer: 'Amazon',
    features: JSON.stringify(['代码补全', '安全扫描', '多语言支持']),
  },
  {
    name: 'Tabnine',
    slug: 'tabnine',
    type: TargetType.coding,
    logoUrl: 'https://www.tabnine.com/favicon.ico',
    description: 'AI code completion that runs locally and in the cloud',
    websiteUrl: 'https://www.tabnine.com',
    developer: 'Tabnine',
    features: JSON.stringify(['代码补全', '多语言支持']),
  },
]

async function main() {
  console.log('Seeding targets...')

  for (const target of targets) {
    await prisma.target.upsert({
      where: { slug: target.slug },
      update: target,
      create: target,
    })
    console.log(`Created/Updated: ${target.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
