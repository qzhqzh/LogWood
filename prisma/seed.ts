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
    tags: JSON.stringify(['选型', '实践方法']),
    columnSlug: 'vibe-coding',
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
    tags: JSON.stringify(['评测体系', '工程化']),
    columnSlug: 'vision',
  },
]

const articleColumns = [
  { name: 'vibe coding', slug: 'vibe-coding' },
  { name: 'Vision', slug: 'vision' },
  { name: 'Robot', slug: 'robot' },
] as const

const tags = [
  { name: '高效', slug: 'efficient', sentiment: 'good' },
  { name: '稳定', slug: 'stable', sentiment: 'good' },
  { name: '通用', slug: 'general-purpose', sentiment: 'neutral' },
  { name: '待观察', slug: 'to-be-observed', sentiment: 'neutral' },
  { name: '不稳定', slug: 'unstable', sentiment: 'bad' },
  { name: '工作流', slug: 'workflow', sentiment: 'good' },
  { name: '团队协作', slug: 'team-collaboration', sentiment: 'good' },
  { name: '体验一般', slug: 'so-so-experience', sentiment: 'bad' },
  { name: '方法论', slug: 'methodology', sentiment: 'good' },
  { name: '实战', slug: 'hands-on', sentiment: 'good' },
  { name: '信息过时', slug: 'outdated', sentiment: 'bad' },
] as const

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
  console.log('Seeding article columns...')

  for (const column of articleColumns) {
    await (prisma as any).articleColumn.upsert({
      where: { slug: column.slug },
      update: column,
      create: column,
    })
    console.log(`Created/Updated article column: ${column.name}`)
  }

  const columns = await (prisma as any).articleColumn.findMany({
    select: { id: true, slug: true },
  })
  const columnBySlug = new Map<string, string>(columns.map((c: { id: string; slug: string }) => [c.slug, c.id]))

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
    const columnId = article.columnSlug ? columnBySlug.get(article.columnSlug) : undefined
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        status: article.status,
        publishedAt: article.publishedAt,
        tags: article.tags,
        columnId,
      },
      create: {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        status: article.status,
        publishedAt: article.publishedAt,
        tags: article.tags,
        columnId,
      },
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

  console.log('Seeding skills...')

  const skills = [
    {
      title: 'Bento 导航岛',
      slug: 'bento-nav-island',
      category: 'frontend',
      summary: '一屏内完成主导航 + 快捷入口的紧凑组件提示词',
      prompt: `设计一个桌面端顶部导航「岛屿」：
- 左侧品牌字标 + 3 个主入口
- 右侧搜索按钮与「进入」CTA
- 中间可折叠的快捷操作条（最多 4 项）
- 使用 8px 网格，圆角 16，背景半透明毛玻璃
- 不要胶囊堆叠，不要紫色渐变默认皮肤
输出：结构说明 + Tailwind 类名草案 + 状态（hover/active）`,
      effectImageUrl: '/uploads/skill-effects/seed-bento-nav.png',
      effectNote: '紧凑岛屿导航：主入口与快捷条分层，不抢内容区。',
      tags: JSON.stringify(['导航', '组件', 'Tailwind']),
      status: 'published' as const,
      sortOrder: 10,
    },
    {
      title: '杂志风首屏排版',
      slug: 'editorial-hero-type',
      category: 'style',
      summary: '宽编辑排版首屏：品牌压过标题，一句支撑文案',
      prompt: `为个人策展站点写一份首屏版式提示词：
品牌名必须是第一视觉，标题不得压过品牌。
第一屏只保留：品牌、一句副标题、一句支撑句、一组 CTA、一张满幅背景图。
禁止：统计条、浮动徽章、卡片堆、紫白渐变模板感。
字体：衬线标题 + 无衬线正文；背景用低对比纹理而非纯色。
输出 HTML/CSS 结构骨架与字号阶梯。`,
      effectImageUrl: '/uploads/skill-effects/seed-editorial.png',
      effectNote: '品牌优先的编辑首屏：少元素、大气息。',
      tags: JSON.stringify(['排版', '首屏', '品牌']),
      status: 'published' as const,
      sortOrder: 20,
    },
    {
      title: '海报情绪图',
      slug: 'poster-mood-board',
      category: 'image',
      summary: '生成可当效果标本的海报向静帧',
      prompt: `Generate a vertical editorial poster still:
subject: hollow tree hollowed trunk as metaphor for letting go
palette: deep ink, warm amber rim light, cool cyan edge
style: photographic + subtle grain, no text overlay, no logos
composition: full-bleed, subject left-weighted, negative space right
aspect 4:5, high detail bark texture`,
      effectImageUrl: '/uploads/skill-effects/seed-poster.png',
      effectNote: '空心树洞气质静帧——留给效果对照，而非装饰底图。',
      tags: JSON.stringify(['图像', '海报', '情绪板']),
      status: 'published' as const,
      sortOrder: 10,
    },
    {
      title: '从灵感到可执行草稿',
      slug: 'idea-to-draft-board',
      category: 'workflow',
      summary: '把一句话灵感拆成可执行草稿板',
      prompt: `你是造物台助手。输入：用户的一句灵感。
输出固定四栏 Markdown：
1) 意图澄清（3 问）
2) 可交付物清单（最多 5）
3) 提示词草案（可直接复制）
4) 下一步 48h 行动
约束：不写空话，每栏 ≤120 字，中文。`,
      effectImageUrl: '/uploads/skill-effects/seed-workflow.png',
      effectNote: '四栏草稿板：澄清 → 交付 → 提示词 → 行动。',
      tags: JSON.stringify(['工作流', '造物台']),
      status: 'published' as const,
      sortOrder: 10,
    },
    {
      title: '克制的产品微文案',
      slug: 'restrained-product-microcopy',
      category: 'copy',
      summary: '按钮与空状态：礼貌、短、可行动',
      prompt: `为「Skill 室」写 UX 微文案：
- 空状态标题 + 一句说明 + 主按钮
- 复制成功 toast
- 上传失败错误句
语气：随意但礼貌，不卖萌，不 emoji 堆。
每条 ≤18 字（中文）。给出 3 套备选。`,
      effectNote: '无图标本：偏文案类，效果以落地文案为准。',
      tags: JSON.stringify(['文案', 'UX']),
      status: 'published' as const,
      sortOrder: 10,
    },
  ]

  for (const skill of skills) {
    await (prisma as any).skill.upsert({
      where: { slug: skill.slug },
      update: skill,
      create: skill,
    })
    console.log(`Created/Updated skill: ${skill.title}`)
  }

  console.log('Seeding tag pool...')

  await (prisma as any).tag.createMany({
    data: tags,
    skipDuplicates: true,
  })

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
