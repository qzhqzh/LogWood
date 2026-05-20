# LogWood SEO 实施清单（FEAT-002 / FEAT-003 / FEAT-004）

> 本文档是 SEO 工作的**可执行清单**。策略与综合方案见 `docs/SEO_STRATEGY.md`，本文档只描述"做什么 / 怎么做 / 怎么验"。

---

## 上下文与起步指引（必读）

### 阅读顺序

新会话中接手本任务时，按顺序阅读：

1. `docs/SEO_STRATEGY.md`（综合 SEO 方案，单一权威指导）
2. `docs/seo-claude.md` + `docs/seo-codex.md`（原始 AI 建议，用于回查决策依据）
3. 本文件（执行清单）
4. `docs/PROJECT_PLAN.md`（项目背景）+ `docs/STYLE_GUIDE.md`（视觉规范）

### 执行顺序

`FEAT-002` → `FEAT-003` → `FEAT-004`，**严格按序**。FEAT-002 提供基础设施（`src/shared/seo/*`、`<JsonLd>` 组件、`buildMetadata` / builder 函数），FEAT-003 才能调用这些工具改造详情页；FEAT-004 是文档收口。

### 强制约束

| 项 | 约束 |
| --- | --- |
| 依赖 | **不引入任何新的 npm 依赖**。所有能力使用 Next.js 14 内置（`Metadata`、`MetadataRoute`、`next/og` `ImageResponse`）+ 已有依赖（`zod`、`sanitize-html`、`prisma`、`date-fns`、`clsx`、`tailwind-merge`、`lucide-react`）。 |
| Schema | **不修改 Prisma schema**。`Target` 缺 `updatedAt` 通过查询关联表兜底（最近一条 `published` review 的 `updatedAt`）。 |
| 路由 | **不假设不存在的路由**。`/search`、`/compare`、`/topics`、`/articles/columns/[slug]`、`/tags/[slug]` landing 一律列入"未来工作"。 |
| 视觉 | **遵守 `docs/STYLE_GUIDE.md`**。禁止硬编码 `text-gray-*` / `bg-[#xxxxxx]`，使用语义类（`cyber-card`、`gradient-text`、`text-muted`、`text-soft`、`text-coding`、`hover-text-coding`、`border-divider`、`surface-panel` 等）。 |
| 文本 | **不使用 em-dash**（U+2014），中文文案用全角标点。 |
| Git | 推送到 feature 分支，**绝不 push 到 main**。使用 `github_push_to_remote`，PR 通过 `github_create_pull_request` 创建。 |

### 沙箱约束

- Network mode 可能仍为 `INTEGRATIONS_ONLY`，无法 `npm install` / `npm run lint` / `npm run test` / `npm run build`。
- 验证以**静态阅读 + 路径检查**为主；CI / 用户本地负责运行实际命令。
- 在 PR description 与 `findings` 字段里**明确标注哪些验证项被推迟**。

---

## FEAT-002: SEO 基础设施

### 描述

抽出 `src/shared/seo/*` 工具集与 `<JsonLd>` 组件；修正 `src/app/layout.tsx` 全站 metadata；新增站点级动态默认 OG 图；修复首页 `WebSite` JSON-LD 的失效 SearchAction；调整 `sitemap.ts` 与 `robots.ts`；为低价值/管理/认证页注入 noindex；新增 `not-found.tsx`；新增 SEO 单元测试。

完成后所有非详情页面的 SEO 基础已正确，详情页升级在 FEAT-003 完成。

### Steps

#### S1. 创建 `src/shared/seo/` 工具集

**目录结构**：

| 文件 | 职责 |
| --- | --- |
| `src/shared/seo/site-config.ts` | 导出 `SITE_NAME`、`SITE_DESCRIPTION`、`SITE_KEYWORDS`、`SITE_LOCALE`、`TWITTER_CARD`，以及 `getSiteUrl()`。 |
| `src/shared/seo/url.ts` | `toAbsoluteUrl(pathOrUrl)`、`canonicalFor(path)`、`joinPath(...segments)`。 |
| `src/shared/seo/metadata.ts` | `buildMetadata(input)` 生成 Next.js 14 `Metadata` 对象。 |
| `src/shared/seo/json-ld.ts` | `buildOrganization`、`buildWebSite`、`buildBreadcrumbList`、`buildArticleJsonLd`、`buildSoftwareApplicationJsonLd`。 |
| `src/shared/seo/index.ts` | barrel export。 |

`getSiteUrl()` 优先级：`process.env.SITE_URL` → `process.env.NEXTAUTH_URL` → `'https://logwood.app'`。返回值不带尾斜杠。

`buildMetadata` 入参示例：

```ts
type BuildMetadataInput = {
  title?: string                 // 不带 '| LogWood' 后缀（layout 已配 template）
  description?: string           // builder 内部截断到 160
  path: string                   // 用于 canonical / openGraph.url
  image?: string | null          // 缺省回退到 '/opengraph-image'
  type?: 'website' | 'article'   // openGraph.type
  publishedTime?: Date | null
  modifiedTime?: Date | null
  noindex?: boolean
  keywords?: string[]
}
```

`buildSoftwareApplicationJsonLd` 当 `reviewCount === 0` 时**不输出** `aggregateRating` 字段。

#### S2. 新增 `src/components/json-ld.tsx`

服务端组件（不写 `'use client'`），渲染 `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value) }} />`，对 `value` 做 `JSON.stringify` 时跳过 undefined（用 replacer）。

#### S3. 改 `src/app/layout.tsx`

- 移除文件内硬编码 `BASE_URL`，改用 `getSiteUrl()`。
- `metadata.metadataBase = new URL(getSiteUrl())`。
- `metadata.openGraph.images = [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'LogWood - AI 编码工具评测社区' }]`。
- `metadata.twitter.images = ['/opengraph-image']`。
- `metadata.alternates = { canonical: getSiteUrl(), languages: { 'zh-CN': '/' } }`。
- `metadata.verification = process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined`。
- `<body>` 内（`<Providers>` 外或子组件树第一个节点）通过 `<JsonLd value={buildOrganization()} />` 渲染 Organization JSON-LD。
- 保留首屏 theme 初始化脚本不变。

#### S4. 新增 `src/app/opengraph-image.tsx`

- `runtime = 'edge'`、`size = { width: 1200, height: 630 }`、`contentType = 'image/png'`、`alt = 'LogWood - AI 编码工具评测社区'`。
- 使用 `next/og` 的 `ImageResponse`，dark gradient 背景 + cyan→purple 渐变品牌字。
- 不依赖外部字体，使用系统 fallback。
- 视觉与 `docs/STYLE_GUIDE.md` 的 dark/cyber/neon 调性一致（参考 `docs/SEO_STRATEGY.md` §7.1 的代码模板）。

#### S5. 改 `src/app/page.tsx`

- 移除文件内硬编码 `BASE_URL`，改用 `src/shared/seo`。
- `generateMetadata` 改用 `buildMetadata({ description: '已收录 X 款...', path: '/' })`，title 由 layout template 接管。
- 删除当前 `websiteJsonLd` 中的 `potentialAction.SearchAction`，改用 `buildWebSite()` builder。
- 用 `<JsonLd value={buildWebSite()} />` 替换原 `<script>` 注入。

#### S6. 改 `src/app/robots.ts`

- 引入 `getSiteUrl()`、`canonicalFor()`。
- `disallow` 增加 `/submit`、`/emojis`、`/tags`，保留所有现有项。
- `sitemap` 字段使用 `canonicalFor('/sitemap.xml')`。

#### S7. 改 `src/app/sitemap.ts`

- 引入 `getSiteUrl()`、`canonicalFor()`。
- 静态路由数组移除 `/submit`、`/emojis`、`/tags` 三项，保留 `/`、`/editor`、`/coding`、`/articles`、`/app`。
- target 查询改为：

```ts
prisma.target.findMany({
  select: {
    slug: true,
    type: true,
    createdAt: true,
    reviews: {
      select: { updatedAt: true },
      where: { status: 'published' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    },
  },
})
```

`lastModified = target.reviews[0]?.updatedAt ?? target.createdAt`。

- 所有 url 改用 `canonicalFor(path)`。

#### S8. 路由级 `noindex` layouts

为以下目录新增 `layout.tsx`，仅注入 `metadata: { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }` 并透传 `children`：

- `src/app/submit/layout.tsx`
- `src/app/emojis/layout.tsx`
- `src/app/tags/layout.tsx`
- `src/app/auth/layout.tsx`（同时覆盖 `/auth/signin` 与 `/auth/error`）
- `src/app/articles/manage/layout.tsx`
- `src/app/app/manage/layout.tsx`
- `src/app/comments/manage/layout.tsx`
- `src/app/targets/manage/layout.tsx`

每个文件内容形态：

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

不引入额外样式或包装组件。

#### S9. 新增 `src/app/not-found.tsx`

- 服务器组件。
- `export const metadata: Metadata = { title: '页面未找到', robots: { index: false, follow: true } }`。
- `<main className="min-h-screen ...">` 包裹，使用 `cyber-card`、`gradient-text`、`text-muted` 等语义类。
- 提供 3 个 CTA：回到首页 / AI Coding / 社区文章。

#### S10. 修改 `.env.example`

在 `NEXTAUTH_URL` 注释下方追加：

```bash
# Optional: public site URL used for metadataBase, canonical, sitemap, og:url. Falls back to NEXTAUTH_URL.
# SITE_URL="https://logwood.example.com"

# Optional: Google Search Console verification token.
# GOOGLE_SITE_VERIFICATION=""
```

不修改其他行。

#### S11. 新增单元测试（vitest）

`vitest.config.ts` include 规则是 `src/**/*.test.ts`，无需修改配置。

| 文件 | 覆盖 |
| --- | --- |
| `src/shared/seo/url.test.ts` | `toAbsoluteUrl` / `canonicalFor` / `joinPath` 边界（已是绝对 URL、尾斜杠、中文 slug） |
| `src/shared/seo/metadata.test.ts` | `buildMetadata` 默认 OG 图 absolute、description 截断 160、noindex 输出、type='article' 字段、canonical 绝对 URL |
| `src/shared/seo/json-ld.test.ts` | builder 输出形状（用 `zod` schema）；BreadcrumbList position 从 1；WebSite 不含 SearchAction；SoftwareApplication aggregateRating 仅在 reviewCount > 0 时输出 |
| `src/app/sitemap.test.ts` | mock prisma；不含 `/submit` `/emojis` `/tags`；target lastModified 优先 review.updatedAt |
| `src/app/robots.test.ts` | disallow 列表、sitemap 字段绝对 URL |

mock prisma 参考现有 `src/modules/tag/service.test.ts` 的 `vi.mock` 写法。

#### S12. 不修改 `next.config.js`

避免误改 `images.remotePatterns`。

### Acceptance Criteria

| 条目 | 检查方法 |
| --- | --- |
| `src/shared/seo/{site-config,url,metadata,json-ld,index}.ts` 全部存在 | `ls src/shared/seo/*.ts` |
| `src/components/json-ld.tsx` 存在且为服务端组件 | `grep -c "'use client'" src/components/json-ld.tsx` 应为 0 |
| `src/app/layout.tsx` 输出 `metadataBase`、Organization JSON-LD、默认 OG 图、env 驱动的 verification | `grep -n metadataBase src/app/layout.tsx` |
| `src/app/opengraph-image.tsx` 存在并使用 `next/og` ImageResponse | `grep -n "from 'next/og'" src/app/opengraph-image.tsx` |
| `src/app/page.tsx` 不再输出 `potentialAction.SearchAction` | `grep -c potentialAction src/app/page.tsx` 应为 0 |
| `src/app/sitemap.ts` 不再包含 `/submit` `/emojis` `/tags` 静态路由 | `grep -E "/submit\|/emojis\|/tags" src/app/sitemap.ts` 不应在 staticRoutes 数组里 |
| `src/app/robots.ts` disallow 包含 `/submit` `/emojis` `/tags`；sitemap 字段为 absolute URL | `grep -E "/submit\|/emojis\|/tags" src/app/robots.ts` |
| 8 个 noindex layout 全部新建 | `ls src/app/{submit,emojis,tags,auth,articles/manage,app/manage,comments/manage,targets/manage}/layout.tsx` |
| `src/app/not-found.tsx` 存在 | `ls src/app/not-found.tsx` |
| `.env.example` 增加 `SITE_URL` 与 `GOOGLE_SITE_VERIFICATION` 注释示例 | `grep -E "SITE_URL\|GOOGLE_SITE_VERIFICATION" .env.example` |
| 至少 4 个 SEO 单元测试新增 | `ls src/shared/seo/*.test.ts src/app/{sitemap,robots}.test.ts` |
| `package.json` 无新增依赖 | `git diff package.json` 仅可能因排序变化，不应有 dependencies/devDependencies 新增 |

### Verification（可运行命令）

```bash
ls src/shared/seo/site-config.ts \
   src/shared/seo/url.ts \
   src/shared/seo/metadata.ts \
   src/shared/seo/json-ld.ts \
   src/shared/seo/index.ts \
   src/components/json-ld.tsx \
   src/app/opengraph-image.tsx \
   src/app/not-found.tsx

grep -n potentialAction src/app/page.tsx          # 应无输出
grep -n metadataBase src/app/layout.tsx           # 应至少 1 行
grep -n "/submit\|/emojis\|/tags" src/app/sitemap.ts  # 不在 staticRoutes 里
grep -rn "noindex\|index: false" \
  src/app/submit/layout.tsx \
  src/app/emojis/layout.tsx \
  src/app/tags/layout.tsx \
  src/app/auth/layout.tsx \
  src/app/articles/manage/layout.tsx \
  src/app/app/manage/layout.tsx \
  src/app/comments/manage/layout.tsx \
  src/app/targets/manage/layout.tsx

git diff package.json                              # 应无 dependencies 增加

# 在能联网的环境中：
npm run lint
npm run test
npm run build
```

---

## FEAT-003: 详情/列表页 SEO 增强

### 描述

所有列表页（articles / app / editor / coding）和所有详情页（articles/[slug]、app/[slug]、editor/[slug]、coding/[slug]、model/[slug]、prompt/[slug]）改用 `src/shared/seo` 工具与 `<JsonLd>` 组件；文章详情升级为完整 BlogPosting；详情页全部加 BreadcrumbList JSON-LD；详情页加可见面包屑组件；文章正文渲染时把 `<h1>` 降级为 `<h2>`；为这些改动新增单元测试。

### Steps

#### S1. 抽出 `src/modules/article/sanitize.ts`

```ts
import sanitizeHtml from 'sanitize-html'

export function sanitizeArticleHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'h6',
      'pre', 'code', 'a', 'hr', 'img', 'figure', 'figcaption', 'video',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      video: ['src', 'controls', 'preload', 'class', 'width', 'height'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      h1: 'h2',
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }),
    },
  })
}
```

注意：`allowedTags` **不包含** `h1`，配合 `transformTags.h1: 'h2'` 让 H1 内容降级为 H2 而不被剥离。

`src/app/articles/[slug]/page.tsx` 改为 `import { sanitizeArticleHtml } from '@/modules/article/sanitize'`，移除文件内 inline `sanitizeHtml(...)` 调用。

#### S2. 新增 `src/components/breadcrumbs.tsx`

服务端组件（无 `'use client'`），props `{ items: Array<{ name: string; href?: string }> }`，最后一项不加链接。视觉使用 `text-muted` / `text-soft` / `text-coding` / `hover-text-coding` 等语义类，`<nav aria-label="breadcrumb">` 包裹。

参考实现见 `docs/SEO_STRATEGY.md` §6.1。

**重要**：本组件只渲染**可见面包屑**；JSON-LD 由调用方通过 `<JsonLd value={buildBreadcrumbList(...)} />` 单独输出，**不在本组件内渲染**。

#### S3. 升级文章详情 `src/app/articles/[slug]/page.tsx`

- `generateMetadata` 改用 `buildMetadata({ title: article.title, description, path: '/articles/' + encodeArticleSlug(article.slug), image: article.coverImageUrl, type: 'article', publishedTime: article.publishedAt ?? article.createdAt, modifiedTime: article.updatedAt })`。
- canonical 用 `article.slug`（而非 `params.slug`）。
- JSON-LD 改用 `buildArticleJsonLd({ url, title, description, image, publishedAt, updatedAt, author, keywords: article.tags as string[], articleSection: article.column?.name })`，输出 `@type='BlogPosting'`。`article.tags` 是 JSON 字符串，需 `JSON.parse` 后传入。
- 在 `<main>` 顶部用 `<JsonLd>` 同时输出 `BreadcrumbList`：

```ts
buildBreadcrumbList([
  { name: '首页', path: '/' },
  { name: '社区文章', path: '/articles' },
  { name: article.column?.name ?? '文章', path: '/articles' },
  { name: article.title, path: `/articles/${encodeArticleSlug(article.slug)}` },
])
```

- 在 `<article>` 顶部新增 `<Breadcrumbs items={...}>`（去掉最后一项 href，与 JSON-LD 对齐）。
- 正文渲染调用 `sanitizeArticleHtml(article.content)`。

#### S4. 文章列表 `src/app/articles/page.tsx`

- `generateMetadata` 改用 `buildMetadata({ title: 'AI 编码实践文章', description: '阅读开发者分享的 AI Coding 实践经验、工具对比与使用技巧', path: '/articles' })`。
- 输出 `<JsonLd value={buildBreadcrumbList([{ name: '首页', path: '/' }, { name: '社区文章', path: '/articles' }])} />`，**不渲染可见面包屑**（列表页本身就是聚合入口）。
- 专栏筛选 URL（`/articles?column=...`）保持现状，canonical 指向 `/articles`。

#### S5. 应用工坊列表 `src/app/app/page.tsx`

- `generateMetadata` 改用 `buildMetadata({ title: '应用工坊', description: '精选社区开发的 AI Coding 应用实践', path: '/app' })`。
- 输出 BreadcrumbList JSON-LD。

#### S6. App 详情 `src/app/app/[slug]/page.tsx`

- `generateMetadata` 改用 `buildMetadata({ title: app.title, description: app.summary.slice(0, 160), path: '/app/' + app.slug, image: app.previewImageUrl })`。
- JSON-LD 改用 `buildSoftwareApplicationJsonLd({ name: app.title, description: app.summary, url, applicationCategory: 'WebApplication', downloadUrl: app.appUrl })`。
- 加 `BreadcrumbList`：`[首页, 应用工坊, app.title]`。
- 详情页顶部加可见 `<Breadcrumbs>`。

#### S7. AI Coding 列表 `src/app/editor/page.tsx`、`src/app/coding/page.tsx`

- 改用 `buildMetadata`，path 分别为 `/editor` 与 `/coding`。
- 输出 BreadcrumbList JSON-LD（`/editor` 是 `[首页, AI Editor]`；`/coding` 是 `[首页, AI Coding]`）。

#### S8. 工具详情 `src/app/{editor,coding,model,prompt}/[slug]/page.tsx`

- 改用 `buildMetadata`，path 用 `/${target.type}/${target.slug}`。
- 保留现有 `SoftwareApplication` 字段，改用 `buildSoftwareApplicationJsonLd` builder（`aggregateRating` 仅在 `reviewCount > 0` 输出）。
- 顶部输出 BreadcrumbList JSON-LD：
  - `/editor/[slug]`：`[首页, AI Editor, target.name]`
  - `/coding/[slug]`：`[首页, AI Coding, target.name]`
  - `/model/[slug]`：`[首页, AI Coding, AI Model, target.name]`，"AI Model" item 指向 `/coding?category=model`
  - `/prompt/[slug]`：`[首页, AI Coding, AI Prompt, target.name]`，"AI Prompt" item 指向 `/coding?category=prompt`
- 加可见 `<Breadcrumbs>` 在 H1 上方。

#### S9. 详情页可选动态 OG 图（增强项，可推迟）

为最有 SEO 价值的两个页面添加：

- `src/app/articles/[slug]/opengraph-image.tsx`：`{ params: { slug } }` → 读取 `getArticleBySlug(decodeArticleSlug(slug))` → 渲染含 `article.title` 与 `column.name` 的 1200x630 图。**不指定 runtime**（默认 nodejs，prisma 可用）。
- `src/app/editor/[slug]/opengraph-image.tsx`：同理读取 target。

实施过程中如发现 Prisma + ImageResponse 兼容问题，可推迟，仅保留站点级 `/opengraph-image`，并在 `docs/SEO_STRATEGY.md` 末尾追加一条记录。

#### S10. 替换散落的 `<script type="application/ld+json">`

所有 `dangerouslySetInnerHTML` 注入 ld+json 的地方都改用 `<JsonLd value={...} />`。验证：

```bash
grep -rn "type=\"application/ld+json\"" src/app  # 仅出现在 src/components/json-ld.tsx 内
```

#### S11. 新增单元测试

| 文件 | 覆盖 |
| --- | --- |
| `src/modules/article/sanitize.test.ts` | `<h1>` → `<h2>`；保留 `<h2>` `<h3>`；外链 rel 默认 `noopener noreferrer nofollow`；`<script>` 剥离 |
| `src/shared/seo/json-ld.test.ts`（FEAT-002 已建）追加 | 用 zod 定义 `BlogPostingSchema` / `BreadcrumbListSchema` / `SoftwareApplicationSchema`，对 builder 输出 `.parse()` 通过 |

### Acceptance Criteria

| 条目 | 检查方法 |
| --- | --- |
| `src/components/breadcrumbs.tsx` 存在且仅渲染可见面包屑 | `ls` + `grep -c "JsonLd\|application/ld+json" src/components/breadcrumbs.tsx` 应为 0 |
| 所有详情页输出 BreadcrumbList JSON-LD 与可见面包屑 | `grep -n buildBreadcrumbList src/app/articles/\[slug\]/page.tsx src/app/app/\[slug\]/page.tsx src/app/editor/\[slug\]/page.tsx src/app/coding/\[slug\]/page.tsx src/app/model/\[slug\]/page.tsx src/app/prompt/\[slug\]/page.tsx` 每个文件至少 1 处 |
| 文章详情 JSON-LD 升级为 `BlogPosting` | `grep -n BlogPosting src/shared/seo/json-ld.ts` 至少 1 处 |
| 文章正文 `<h1>` 渲染时降级为 `<h2>` | `grep -n "h1: 'h2'\|transformTags" src/modules/article/sanitize.ts` |
| 文章详情移除 inline `sanitizeHtml`，改用 `sanitizeArticleHtml` | `grep -n sanitizeArticleHtml src/app/articles/\[slug\]/page.tsx` |
| 散落的 `application/ld+json` `<script>` 全部经由 `<JsonLd>` | `grep -rn "type=\"application/ld+json\"" src/app` 应为空 |
| `package.json` 无新增依赖 | `git diff package.json` |

### Verification

```bash
ls src/components/breadcrumbs.tsx \
   src/modules/article/sanitize.ts \
   src/modules/article/sanitize.test.ts

grep -n BlogPosting src/shared/seo/json-ld.ts
grep -n "h1: 'h2'" src/modules/article/sanitize.ts
grep -rn "type=\"application/ld+json\"" src/app    # 应为 0 行
grep -n potentialAction src/app                     # 应为 0 行（防回归）

# 在能联网的环境中：
npm run lint
npm run test
npm run build
```

---

## FEAT-004: 文档同步

### 描述

基于 FEAT-002 / FEAT-003 的实际落地，更新 `docs/PROJECT_PLAN.md` 变更记录与下阶段计划；在 `README.md` 增加 `## SEO` 章节；在 `docs/SEO_STRATEGY.md` 末尾追加"当前实现速览"章节。本 feature 不改任何源代码。

### Steps

#### S1. 整理实际改动清单

通过 `git diff --name-status main` 与最新提交对比，列出：

1. 新增文件
2. 修改文件
3. 行为变更摘要
4. 新增测试

#### S2. 更新 `docs/PROJECT_PLAN.md`

第 8 节"变更记录"顶部新增日期段（用今天的日期，格式 `YYYY-MM-DD`），标题简短描述"全站 SEO 基础设施落地"，至少覆盖：

- 新增 `src/shared/seo/*` 工具与 `<JsonLd>` 组件
- 修复首页 WebSite JSON-LD 的失效 SearchAction
- sitemap 移除 `/submit` `/emojis` `/tags`，target lastmod 用最近 published review.updatedAt 兜底
- robots 同步加 disallow，sitemap 字段输出 absolute URL
- 站点级 metadataBase + Twitter Card + Organization JSON-LD + 默认动态 OG 图
- 文章详情升级为 BlogPosting JSON-LD
- 所有详情/列表页注入 BreadcrumbList JSON-LD，详情页加可见面包屑
- 低价值/管理/认证页通过路由级 layout.tsx 注入 noindex
- 新增站点级 `not-found.tsx`
- 新增 SEO 单元测试若干
- 新增可选环境变量 `SITE_URL` / `GOOGLE_SITE_VERIFICATION`

第 9 节"下阶段计划"追加未来工作（与 `docs/SEO_STRATEGY.md` §11 一致）：

- 实现 `/search` 后补回 `WebSite.SearchAction`
- 为 `Target` 加 `updatedAt` 字段
- 专栏 / 标签 landing 页路径化（`/articles/columns/[slug]`、`/topics/[slug]`）
- 公开页从 `force-dynamic` 迁移到 ISR / `revalidatePath`

#### S3. 更新 `README.md`

在 `## Theme System (Light/Dark)` 之后、`## Run With Docker Compose` 之前新增 `## SEO` 节：

- 一句话总览
- 关键文件列表（设计文档 + 工具集 + 站点级注入 + 详情页）
- 关键环境变量（`NEXTAUTH_URL` / `SITE_URL` / `GOOGLE_SITE_VERIFICATION`）
- 验证速查链接（指向 `docs/SEO_STRATEGY.md` §12）
- 维护约束：变更前先读 `docs/SEO_STRATEGY.md`；新增依赖须先评估对 SEO 的影响

#### S4. 在 `docs/SEO_STRATEGY.md` 末尾追加"当前实现速览"

记录已经实施的能力（按文件维度），与 README 的 SEO 节一致但更详细，包含：

- `curl -s http://localhost:3000/robots.txt` 的预期输出片段
- `curl -s http://localhost:3000/sitemap.xml | head -40` 的预期 URL 范例
- 浏览器 view-source 任意文章详情页应能看到的 3 块 `<script type="application/ld+json">`
- 访问 `/opengraph-image` 应返回 `image/png` 1200x630 的提示

#### S5. 静态校验

```bash
grep -E 'TODO|FIXME' docs/SEO_STRATEGY.md README.md docs/PROJECT_PLAN.md  # 应为 0 行
grep -P '\x{2014}' docs/SEO_STRATEGY.md docs/SEO_IMPLEMENTATION_PLAN.md README.md docs/PROJECT_PLAN.md  # 应为 0 行（U+2014 em-dash 检查）
```

### Acceptance Criteria

| 条目 | 检查方法 |
| --- | --- |
| `docs/PROJECT_PLAN.md` 第 8 节顶部含新日期段，覆盖 FEAT-002/003 关键改动 ≥ 10 条 | `head -80 docs/PROJECT_PLAN.md` |
| 第 9 节"下阶段计划"新增 ≥ 4 条 SEO 后续项 | `grep -A20 '下阶段计划' docs/PROJECT_PLAN.md` |
| `README.md` 新增 `## SEO` 章节 | `grep -n '^## SEO' README.md` |
| `docs/SEO_STRATEGY.md` 末尾追加"当前实现速览" | `grep -n '当前实现速览' docs/SEO_STRATEGY.md` |
| 无 TODO / FIXME / em-dash 残留 | 见 S5 |

### Verification

```bash
head -80 docs/PROJECT_PLAN.md
grep -n '^## SEO' README.md
grep -n '当前实现速览' docs/SEO_STRATEGY.md
grep -E 'TODO|FIXME' docs/PROJECT_PLAN.md README.md docs/SEO_STRATEGY.md docs/SEO_IMPLEMENTATION_PLAN.md
grep -P '\x{2014}' docs/SEO_STRATEGY.md docs/SEO_IMPLEMENTATION_PLAN.md README.md docs/PROJECT_PLAN.md
```

---

## 全任务完成标志

1. 三个 FEAT 全部 `completed`。
2. 单分支推送到远端：`feat/seo-comprehensive-optimization`（或类似命名）。
3. PR 标题：`feat(seo): comprehensive SEO infrastructure and content upgrades`（≤ 70 字）。
4. PR description：列出三个 FEAT 的概要、新增/修改文件清单、用户验证 6 步速查（链接到 `docs/SEO_STRATEGY.md` §12）、未来工作。
5. 不直接 push 到 `main`。
