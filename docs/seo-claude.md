# LogWood SEO 优化方案 (Claude 版)

> 生成时间: 2026-05-19
> 项目: LogWood — AI 编码工具评测社区
> 技术栈: Next.js 14 (App Router) + TypeScript + PostgreSQL

---

## 一、现状分析

### 已有配置
- `src/app/layout.tsx` 设置了基础 `title` 和 `description`
- `<html lang="zh-CN">` 已设置
- `src/app/favicon.svg` 存在（但未确认是否在 metadata 中声明）

### 完全缺失的项目
- robots.txt
- sitemap.xml / sitemap.ts
- Open Graph 标签 (og:title, og:description, og:image)
- Twitter Card 标签
- canonical URL
- JSON-LD 结构化数据
- 各页面独立 metadata (仅根 layout 有)
- 语义化 HTML 标记审查

---

## 二、优化方案（按优先级排列）

### P0：完善全局 metadata（Root Layout）

**目标**: 在 `src/app/layout.tsx` 中补充完整的 Metadata 对象。

```typescript
export const metadata: Metadata = {
  // 基础
  title: {
    default: 'LogWood - AI 编码工具评测社区',
    template: '%s | LogWood',
  },
  description: '专注于 AI Coding 生态的评测社区，统一收录 AI Editor、AI Coding、AI Model 与 AI Prompt 工具和实践内容',
  keywords: ['AI编码工具', 'AI编程', 'AI代码评测', 'AI Editor', 'AI Coding', 'Claude', 'Cursor', 'Copilot', 'Prompt工具'],
  authors: [{ name: 'LogWood Team' }],
  creator: 'LogWood',
  publisher: 'LogWood',
  formatDetection: {
    email: false,
    telephone: false,
  },

  // 搜索引擎
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 验证（占位，后续填入）
  verification: {
    google: 'YOUR_GOOGLE_SITE_VERIFICATION',
    // baidu: 'YOUR_BAIDU_VERIFICATION',
  },

  // 图标
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },

  // Open Graph — 提升社交分享与 AI 搜索可见性
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: process.env.NEXTAUTH_URL || 'https://logwood.app',
    siteName: 'LogWood',
    title: 'LogWood - AI 编码工具评测社区',
    description: '专注于 AI Coding 生态的评测社区',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LogWood - AI 编码工具评测社区',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'LogWood - AI 编码工具评测社区',
    description: '专注于 AI Coding 生态的评测社区',
    images: ['/og-image.png'],
  },

  // Canonical
  alternates: {
    canonical: process.env.NEXTAUTH_URL,
  },
}
```

**新增文件**: `public/og-image.png` — 1200×630px 社交分享图

---

### P0：添加 robots.txt

**文件**: `src/app/robots.ts`（动态生成）

```typescript
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://logwood.app'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',              // 禁止抓取 API
        '/app/manage/',       // 管理页面
        '/comments/manage/',  // 评论管理
        '/targets/manage/',   // 目标管理
        '/auth/',             // 认证页面
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

---

### P0：添加 sitemap.xml

**文件**: `src/app/sitemap.ts`（动态生成，含动态内容）

```typescript
import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://logwood.app'

  // 静态页面
  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${baseUrl}/review`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/editor`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/coding`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/articles`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    { url: `${baseUrl}/emojis`, lastModefied: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/tags`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
  ]

  // 动态内容
  const reviews = await prisma.review.findMany({
    select: { id: true, updatedAt: true },
    where: { status: { not: 'archived' } },
  })
  const articles = await prisma.article.findMany({
    select: { slug: true, updatedAt: true },
    where: { published: true },
  })
  const targets = await prisma.target.findMany({
    select: { slug: true, updatedAt: true },
    where: { archivedAt: null },
  })

  const reviewRoutes = reviews.map((r) => ({
    url: `${baseUrl}/review/${r.id}`,
    lastModified: r.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const articleRoutes = articles.map((a) => ({
    url: `${baseUrl}/articles/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const targetRoutes = targets.map((t) => ({
    url: `${baseUrl}/${getCategoryPrefix(t)}/${t.slug}`,
    lastModified: t.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...reviewRoutes, ...articleRoutes, ...targetRoutes]
}

// 根据 target 类型返回 URL 前缀（需根据实际路由调整）
function getCategoryPrefix(target: { slug: string }): string {
  // 根据 slug 或关联关系推断 editor/coding/model/prompt
  return 'editor' // 占位，按实际业务逻辑实现
}
```

---

### P1：各页面独立 metadata（generateMetadata）

每个公开页面都应导出 `generateMetadata` 函数，使用 Prisma 查询实时数据。

#### 首页 `src/app/page.tsx`
```typescript
export async function generateMetadata(): Promise<Metadata> {
  const recentReviews = await prisma.review.count({
    where: { status: { not: 'archived' } },
  })
  return {
    title: 'LogWood - AI 编码工具评测社区',
    description: `已收录 ${recentReviews}+ 条 AI 工具评测，涵盖 AI Editor、AI Coding、AI Model 与 AI Prompt`,
    openGraph: { title: 'LogWood - AI 编码工具评测社区' },
  }
}
```

#### Review 详情页 `src/app/review/[id]/page.tsx`（需新建或补充）
```typescript
export async function generateMetadata({ params }: { params: { id: string } }) {
  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: { target: true, user: true },
  })
  if (!review) return { title: 'Not Found' }

  const title = `${review.target.name} - ${review.title} | LogWood`
  return {
    title,
    description: review.content.slice(0, 160),
    openGraph: { title, description: review.content.slice(0, 200) },
    alternates: { canonical: `${process.env.NEXTAUTH_URL}/review/${review.id}` },
  }
}
```

#### Article 详情页 `src/app/articles/[slug]/page.tsx`
```typescript
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
  })
  if (!article) return { title: 'Not Found' }
  return {
    title: `${article.title} | LogWood`,
    description: article.content.slice(0, 160),
    openGraph: {
      title: article.title,
      description: article.content.slice(0, 200),
    },
    alternates: { canonical: `${process.env.NEXTAUTH_URL}/articles/${article.slug}` },
  }
}
```

#### Target 详情页（editor/coding/model/prompt 下的 `[slug]/page.tsx`）
```typescript
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const target = await prisma.target.findFirst({
    where: { slug: params.slug },
  })
  if (!target) return { title: 'Not Found' }
  return {
    title: `${target.name} - AI 工具详情 | LogWood`,
    description: target.description?.slice(0, 160) || `${target.name} 工具评测`,
    openGraph: { title: target.name, description: target.description?.slice(0, 200) },
  }
}
```

---

### P1：添加 JSON-LD 结构化数据

JSON-LD 是 Google 和 AI 搜索（Perplexity、ChatGPT Search、Google AI Overview）理解页面内容的核心方式。

#### 首页 — WebSite + Organization Schema

放在 `src/app/page.tsx` 的组件中：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "LogWood",
  "description": "AI 编码工具评测社区",
  "url": "https://logwood.app",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://logwood.app/review?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

#### Review 详情页 — Review Schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": {
    "@type": "SoftwareApplication",
    "name": "${targetName}",
    "applicationCategory": "DeveloperApplication"
  },
  "reviewBody": "${reviewContent}",
  "author": { "@type": "Person", "name": "${authorName}" },
  "datePublished": "${createdAt}",
  "url": "${canonicalUrl}"
}
</script>
```

#### Article 详情页 — Article Schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${articleTitle}",
  "description": "${articleDescription}",
  "author": { "@type": "Person", "name": "${authorName}" },
  "datePublished": "${createdAt}",
  "dateModified": "${updatedAt}",
  "publisher": {
    "@type": "Organization",
    "name": "LogWood"
  }
}
</script>
```

#### Target 详情页 — SoftwareApplication Schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "${targetName}",
  "description": "${targetDescription}",
  "applicationCategory": "DeveloperApplication",
  "url": "${targetUrl}",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "${avgRating}",
    "reviewCount": "${reviewCount}"
  }
}
</script>
```

---

### P2：HTML 语义化增强

搜索引擎和 AI 爬虫依赖语义标签理解页面结构。建议检查以下页面：

| 页面 | 当前可能 | 建议 |
|------|----------|------|
| Review 详情页 | 可能是 `<div>` 堆叠 | 用 `<article>` 包裹评测内容 |
| Article 详情页 | 可能是 `<div>` 堆叠 | 用 `<article>` 包裹文章 |
| 主布局 | `<main>` 可能缺失 | 在 layout 中用 `<main>` 包裹 children |
| 导航栏 | 可能是 `<div>` | 用 `<nav>` 包裹 |
| 页脚 | 可能是 `<div>` | 用 `<footer>` 包裹 |
| 侧边栏 | 可能是 `<div>` | 用 `<aside>` 包裹 |

---

### P2：性能优化（间接影响 SEO）

Google Core Web Vitals 影响排名：

1. **图片优化**: 使用 `next/image` 替代 `<img>`，自动 WebP/AVIF
2. **字体优化**: 使用 `next/font` 加载字体，避免 FOIT/FOUT
3. **服务端渲染**: 确保页面尽可能 SSR（Next.js App Router 默认 SSR）
4. **代码分割**: 大组件用 `next/dynamic` 延迟加载

---

### P2：国际化 SEO（可选）

如果未来做多语言：
- 配置 `alternates.languages` 在 metadata 中
- 添加 hreflang 标签
- URL 路径方案：`/zh-CN/`, `/en/`

---

## 三、实施优先级与预估工作量

| 优先级 | 任务 | 预估工作量 |
|--------|------|------------|
| P0 | 完善 Root Layout metadata | ~10 分钟 |
| P0 | 添加 robots.ts | ~5 分钟 |
| P0 | 添加 sitemap.ts | ~20 分钟 |
| P1 | 各页面 generateMetadata | ~1 小时 |
| P1 | JSON-LD 结构化数据 | ~40 分钟 |
| P2 | HTML 语义化审查与修复 | ~30 分钟 |
| P2 | 性能优化 (图片/字体) | ~30 分钟 |
| P2 | 生成 OG Image | ~15 分钟 |

**总计**: 约 2.5 - 3 小时

---

## 四、验证方式

实施后通过以下方式验证：

1. **Google Search Console**: 提交 sitemap，检查索引状态
2. **robots.txt 验证**: 访问 `https://logwood.app/robots.txt`
3. **sitemap 验证**: 访问 `https://logwood.app/sitemap.xml`
4. **Rich Results Test**: https://search.google.com/test/rich-results — 验证 JSON-LD
5. **Open Graph 检查**: https://www.opengraph.xyz/ — 验证社交分享效果
6. **Lighthouse**: Chrome DevTools 中运行 Lighthouse SEO 审计
7. **百度站长平台**: 提交 sitemap 验证（如果需要百度收录）
