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
  {
    name: 'Claude 3.7 Sonnet',
    slug: 'claude-3-7-sonnet',
    type: TargetType.model,
    logoUrl: 'https://www.anthropic.com/images/icons/apple-touch-icon.png',
    description: '适合代码生成、复杂推理与长上下文理解的通用模型',
    websiteUrl: 'https://www.anthropic.com/claude',
    developer: 'Anthropic',
    features: JSON.stringify(['长上下文', '代码生成', '推理能力', '多轮对话']),
  },
  {
    name: 'PromptLayer Prompt Library',
    slug: 'promptlayer-prompt-library',
    type: TargetType.prompt,
    logoUrl: 'https://promptlayer.com/favicon.ico',
    description: '面向应用开发的 Prompt 模板与版本管理目标',
    websiteUrl: 'https://promptlayer.com',
    developer: 'PromptLayer',
    features: JSON.stringify(['Prompt 模板', '版本管理', '团队协作']),
  },
]

const articles = [
  {
    title: '2026 AI Editor 选型指南：Cursor、Windsurf、Zed 怎么选',
    slug: 'ai-editor-selection-guide-2026',
    excerpt: '从团队协作、代码库规模、插件生态和成本四个维度，快速判断哪款 AI Editor 更适合你。',
    content: `## 为什么你需要一份选型框架

当团队从单人试用走向多人协作时，AI Editor 的差异会被迅速放大。

## 四个关键维度

1. 大仓库上下文理解能力
2. 多语言与框架覆盖
3. 团队协作与权限能力
4. 成本与扩展性

## 结论

先用 2 周试点，采集效率指标后再做组织级切换。`,
    status: 'published' as const,
    publishedAt: new Date(),
  },
  {
    title: 'AI Coding 助手评测方法论：如何做可复现的基准测试',
    slug: 'ai-coding-benchmark-methodology',
    excerpt: '避免主观印象，建立任务集、评分标准和复现实验流程，让评测可比较、可追踪。',
    content: `## 目标

构建一套稳定、可迭代的 AI Coding 评测基线。

## 任务集建议

- Bug 修复
- 新功能实现
- 测试补全
- 重构与文档

## 评分指标

- 首次可运行率
- 任务完成时长
- 代码变更质量
- 回归问题数量`,
    status: 'published' as const,
    publishedAt: new Date(),
  },
]

const apps = [
  {
    name: 'PR Review Radar',
    slug: 'pr-review-radar',
    appUrl: 'https://example.com/pr-review-radar',
    title: 'PR Review Radar',
    summary: '帮助团队聚合 PR 风险、审查建议与发布前检查项。',
    description: 'PR Review Radar 是一个围绕代码审查工作流构建的应用，整合了 AI 风险提示、变更摘要、测试提醒和上线检查列表，适合研发团队在提测和合并前进行统一审查。',
    previewImageUrl: null,
    tags: JSON.stringify(['review', 'workflow', 'team']),
    status: 'published' as const,
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

  console.log('Seeding articles...')

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: article,
      create: article,
    })
    console.log(`Created/Updated article: ${article.title}`)
  }

  console.log('Seeding apps...')

  for (const app of apps) {
    await prisma.app.upsert({
      where: { slug: app.slug },
      update: app,
      create: app,
    })
    console.log(`Created/Updated app: ${app.title}`)
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
