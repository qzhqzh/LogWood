# LogWood SEO 综合策略

> 文档定位：本仓库 SEO 工作的**单一权威指导**。所有后续 SEO 改动（包括 PR 评审、新页面接入）必须以本文档为准。
>
> 输入来源：`docs/seo-claude.md`（旧快照式建议）+ `docs/seo-codex.md`（已感知现状的进阶建议）+ 本仓库实际代码勘测（`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/sitemap.ts`、`src/app/robots.ts`、各业务详情页、`prisma/schema.prisma`）。
>
> 维护规则：
> - 本文档与代码不一致时，**先更新文档，再调整代码**（与 `docs/STYLE_GUIDE.md` 第 6 节同源约束）。
> - 任何新页面/路由接入前，先在本文档对应章节登记结构化数据策略与 metadata 模板。
> - 配套实施清单见 `docs/SEO_IMPLEMENTATION_PLAN.md`（可执行的 FEAT-002 / FEAT-003 / FEAT-004 任务卡）。

---

## 0. TL;DR

LogWood 的 SEO 已有"骨架"（站点级 metadata、`/robots.txt`、`/sitemap.xml`、首页 WebSite JSON-LD、详情页 SoftwareApplication / Article JSON-LD、中文 `lang`），但存在 4 类**确切的事实性问题**，必须修：

1. 首页 `WebSite.potentialAction.SearchAction` 指向 `/editor?q=...`，但 `/editor` 并不读取 `q` 参数，结构化数据与页面能力不一致 → **删除该字段**，等真正实现 `/search` 后再补回。
2. `/sitemap.xml` 包含 `/submit`、`/emojis`、`/tags` 三个低价值页（提交表单、表情管理、标签池操作页），且这些页在 `robots.ts` 里未 `disallow`、页面级也没有 `noindex` → **三处同时清理**。
3. `layout.tsx` 缺 `metadataBase`，全站 `openGraph.images` / `twitter.images` 为空，详情页 OG 也只有 `app/[slug]` 在有 preview 时输出图片；社交分享和图片理解能力被严重浪费。
4. 文章详情页正文允许富文本编辑器插入 `<h1>`，外层标题已经是 H1 → **可能产生双 H1**；正文图片 alt 默认是文件名；外链一律 `nofollow`（即使是管理员撰写的可信引用），削弱引用关系表达。

外加 1 条**架构性短板**：`Target` 模型没有 `updatedAt` 字段，sitemap 用 `createdAt` 表达"最后修改时间"，工具评分变化、新增评测都不会被搜索引擎感知到。本期不做 DB 迁移，**用最近一条 `published` 状态 review 的 `updatedAt` 作为 fallback**；DB 字段补充列入"未来工作"。

执行边界（强制）：
- **不引入任何新的 npm 依赖**（沙箱网络限制 INTEGRATIONS_ONLY，同时也是设计选择，避免 SEO 工具链膨胀）。所有 SEO 能力使用 Next.js 14 内置的 `Metadata`、`MetadataRoute`、`next/og` 的 `ImageResponse`，以及已存在的依赖（`zod`、`sanitize-html`、`prisma`、`date-fns`）。
- **不假设不存在的路由**：`/search`、`/compare/[a]-vs-[b]`、`/topics/[slug]`、`/articles/columns/[slug]`、`/tags/[slug]` landing 这些路由当前都没有，对它们的相关建议一律归入"未来工作"，不在本期实现里硬塞。
- **不修改 Prisma schema**：本期通过查询关联表兜底，避免 DB 迁移成本。

---

## 1. 现状与目标

### 1.1 已有 SEO 能力（事实清单）

| 维度 | 现状 | 文件 |
| --- | --- | --- |
| 站点级 metadata | `title.template`、`description`、`keywords`、`authors`、`creator`、`publisher`、`robots`、`googleBot`、`icons`、`openGraph` 基础字段、`twitter`、根 `canonical` 已存在 | `src/app/layout.tsx` |
| 中文语言声明 | `<html lang="zh-CN">` 已设置 | `src/app/layout.tsx` |
| robots | `/api/`、所有 `*/manage/`、`/auth/` 已 disallow；指向 `/sitemap.xml` | `src/app/robots.ts` |
| sitemap | 静态路由 + 动态 `target` / `article` / `app`；按 published 过滤；URL 拼接基于 `NEXTAUTH_URL` | `src/app/sitemap.ts` |
| 首页 JSON-LD | `WebSite` schema（含失效 SearchAction） | `src/app/page.tsx` |
| 工具详情 JSON-LD | `SoftwareApplication` + `aggregateRating` | `src/app/{editor,coding,model,prompt}/[slug]/page.tsx` |
| App 详情 JSON-LD | `SoftwareApplication` + `previewImageUrl` OG | `src/app/app/[slug]/page.tsx` |
| 文章详情 JSON-LD | 基础 `Article`（缺 `mainEntityOfPage`、`image`、`keywords`、`articleSection`、`publisher.logo`） | `src/app/articles/[slug]/page.tsx` |
| 文章正文净化 | `sanitize-html`，外链统一 `nofollow noopener noreferrer` | `src/app/articles/[slug]/page.tsx` |

### 1.2 关键缺口（按影响排序）

1. **错误结构化数据**：首页 SearchAction 指向不存在的搜索能力（`seo-codex.md` P0 #1）。
2. **缺 `metadataBase`**：导致相对 URL 在 metadata 里不确定，`canonical` 在反向代理后表现不稳。
3. **缺默认 OG 图**：分享体验差，社交平台抓取大量站内页都只能拿到纯文字预览。
4. **低价值页污染索引**：`/submit`、`/emojis`、`/tags` 三页同时存在于 sitemap 且无 noindex（`seo-codex.md` P0 #4）。
5. **文章正文语义不稳**：H1 嵌套、图片 alt 缺失、外链一律 nofollow（`seo-codex.md` P0 #3）。
6. **`Target` 缺 `updatedAt`**：sitemap lastmod 永远卡在工具录入日，影响抓取频率（`seo-codex.md` P1 #8）。
7. **缺 `BreadcrumbList` 结构化数据**：详情页层级关系无法被搜索引擎结构化理解（`seo-codex.md` P1 #9）。
8. **缺规范的 SEO 工具集**：`BASE_URL` 在多个文件里硬编码重复定义，URL 拼接没有统一去尾斜杠/encode 行为，未来维护成本高。

### 1.3 目标

- **可索引页面准确率提升**：低价值页 100% 移出 sitemap、同步 noindex；详情页 100% 走规范 canonical。
- **结构化数据完整度提升**：首页 + 文章 + 工具 + App 详情每页至少 2 类 JSON-LD（实体 + 面包屑）。
- **社交分享达标率 100%**：所有可索引页都能产出 1200x630 的 OG 图（实体图优先，默认图兜底）。
- **可维护性**：抽出 `src/shared/seo/*` 工具集，未来新增页面通过统一 builder 接入。
- **可观测**：单元测试覆盖 metadata builder、sitemap 输出、JSON-LD 形状（用 `zod` 做 schema 校验）。

---

## 2. 综合方案：对两份原始文档的逐条裁决

> 标记说明：
> - **采纳**：完全按建议执行，本期落地。
> - **部分采纳**：核心思路保留，落地形式调整（说明理由）。
> - **不采纳**：不执行（说明理由）。
> - **推迟**：本期不做，列入未来工作。

### 2.1 来自 `docs/seo-claude.md` 的建议

| 建议 | 裁决 | 理由 / 落地映射 |
| --- | --- | --- |
| P0 完善 Root Layout metadata（title/description/keywords/authors/robots/icons/openGraph/twitter/canonical） | **部分采纳** | 现状已基本存在；本期补 `metadataBase`、`alternates.languages`、默认 OG `images: ['/opengraph-image']`、`verification` 改为 env 驱动。映射：`src/app/layout.tsx`。 |
| P0 `verification.google: 'YOUR_GOOGLE_SITE_VERIFICATION'` 占位符 | **不采纳** | 字面字符串占位会被搜索引擎读到无效 token；改为 `process.env.GOOGLE_SITE_VERIFICATION` 驱动，**未配置时不输出 meta 标签**。映射：`src/app/layout.tsx` + `.env.example`。 |
| P0 `public/og-image.png` 静态图（1200×630） | **不采纳** | 二进制入仓不利于设计迭代且需要外部图片工具；改用 Next.js 14 内置 `next/og` 的 `ImageResponse` 在 `src/app/opengraph-image.tsx` 动态生成。无新依赖。映射：`src/app/opengraph-image.tsx`。 |
| P0 添加 `robots.ts` | **采纳** | 现状已有；本期补 disallow `/submit`、`/emojis`、`/tags`，sitemap 字段输出绝对 URL。映射：`src/app/robots.ts`。 |
| P0 添加 `sitemap.ts`（含 review 详情页） | **部分采纳** | 现状已有 sitemap；不采纳"列出每条 review 详情"，因为本仓库没有 `/review/[id]` 详情页（`/review` 是 redirect）；继续在工具/文章/App 详情粒度收录。映射：`src/app/sitemap.ts`。 |
| P0 sitemap `getCategoryPrefix` 占位返回 `'editor'` | **不采纳** | 占位逻辑会把所有 target 都路由到 `/editor/*`，产生死链。当前 sitemap 已正确使用 `t.type` 作为前缀。 |
| P1 各页面独立 `generateMetadata` | **采纳** | 现状大部分页已实现；本期把所有页面收敛到 `buildMetadata()` 工具函数。映射：`src/shared/seo/metadata.ts` + 所有 `page.tsx`。 |
| P1 Review 详情页 metadata（`/review/[id]/page.tsx`） | **不采纳** | 本仓库当前不存在 `/review/[id]` 路由（`/review` 是重定向到 AI Coding）；review 是嵌入式内容（`/:type/[slug]` 工具详情页内展示）。本期不创建该路由。 |
| P1 首页 / Review / Article / Target JSON-LD（基础 schema） | **部分采纳** | 现状已有大部分；不采纳 `Review` 顶层 schema（无对应路由）；本期升级 `Article` 为完整 `BlogPosting`，工具/App 保留 `SoftwareApplication`，新增 `Organization`（站点级）、`BreadcrumbList`（详情/列表级）。映射：`src/shared/seo/json-ld.ts`。 |
| P1 首页 `WebSite.SearchAction` 指向 `/review?q=...` | **不采纳** | `/review` 是重定向页，且并不实现搜索；保留会污染结构化数据。本期**移除 SearchAction**，等 `/search` 落地后再补。 |
| P2 HTML 语义化（`<main>` / `<nav>` / `<article>` / `<aside>` / `<footer>`） | **部分采纳** | 现状导航/页脚已用 `<nav>` / `<footer>`；首页/详情页都有 `<main>`。本期补：文章详情正文已经在 `<article>` 内（确认即可），新增 `not-found.tsx` 包 `<main>`，新增可见面包屑组件。 |
| P2 性能优化（图片 → `next/image`、字体 → `next/font`、SSR、`next/dynamic`） | **部分采纳** | 现状已大量使用 `next/image`；不引入 `next/font` 因为 `Orbitron` 当前由 Tailwind 引用 system fallback，迁移有视觉风险。本期不做字体迁移，列入"未来工作"。 |
| P2 国际化 SEO（hreflang / 多语言路径） | **推迟** | 当前界面只有中文，内容字段允许多语言但没有路径化的多语言 URL。本期只在 `alternates.languages` 留 `'zh-CN': '/'` 占位。 |
| P2 生成 OG Image | **采纳** | 见上文：动态 `ImageResponse` 而非静态 PNG。 |

### 2.2 来自 `docs/seo-codex.md` 的建议

| 建议 | 裁决 | 理由 / 落地映射 |
| --- | --- | --- |
| P0 #1 修复或删除首页 SearchAction | **采纳**（取删除方案） | 实现 `/search` 在本期范围外，删除是唯一正确选择。映射：`src/app/page.tsx`。 |
| P0 #2 增加 `metadataBase` + 默认 OG 图 + `toAbsoluteUrl()` 工具 | **采纳** | 完全采纳。映射：`src/app/layout.tsx`、`src/app/opengraph-image.tsx`、`src/shared/seo/{site-config,url}.ts`。 |
| P0 #3 文章正文语义化（Markdown 渲染、H1 降级、图片 alt、外链 rel） | **部分采纳** | 本期落地：(a) 正文 H1 通过 `sanitize-html` 的 `transformTags` 降级为 H2；(b) 抽出 `src/modules/article/sanitize.ts` 便于测试；(c) 外链 rel 保持当前 `noopener noreferrer nofollow`（兼容现有数据，不改变行为，避免本期发文 SEO 行为骤变；放宽规则需另起 ADR）。**不采纳**："引入 Markdown 解析器"，因为会引入新依赖且与当前富文本数据流冲突，列入"未来工作"。 |
| P0 #4 移除 sitemap 中 `/submit`、`/emojis`、`/tags`，并对其加 noindex | **采纳** | 完全采纳。映射：`src/app/sitemap.ts`、`src/app/{submit,emojis,tags}/layout.tsx`（新增）、`src/app/robots.ts`。 |
| P1 #5 文章 JSON-LD 升级为完整 BlogPosting（`mainEntityOfPage` / `image` / `keywords` / `articleSection` / `publisher.logo`） | **采纳** | 完全采纳。映射：`src/shared/seo/json-ld.ts` `buildArticleJsonLd()` + `src/app/articles/[slug]/page.tsx`。 |
| P1 #6 canonical 使用规范 slug（`article.slug` 而非 `params.slug`）、统一 `canonicalFor()` 工具 | **采纳** | 完全采纳。映射：`src/shared/seo/url.ts`、各详情页。 |
| P1 #7 query 页 canonical 策略：路径化 `/articles/columns/[slug]` 或保留 canonical 到列表页 | **部分采纳** | 本期保留"canonical 到列表页 + query 页 noindex"的短期策略；路径化专栏页（`/articles/columns/[slug]`、`/coding/editor`、`/model`、`/prompt`）列入"未来工作"，因为涉及路由架构调整 + 内容索引重建。 |
| P1 #8 给 `Target` 增加 `updatedAt` 字段以提升 sitemap lastmod 精度 | **推迟** | 涉及 Prisma migration 与现有数据回填，本期范围外。短期方案：sitemap 用最近一条 `published` review 的 `updatedAt` fallback 到 `target.createdAt`。映射：`src/app/sitemap.ts`。 |
| P1 #9 增加 `BreadcrumbList` JSON-LD + 可见面包屑 | **采纳** | 完全采纳。映射：`src/shared/seo/json-ld.ts` `buildBreadcrumbList()` + `src/components/breadcrumbs.tsx` + 各详情/列表页。 |
| P2 #10 公共页 `force-dynamic` → ISR / `revalidatePath` | **推迟** | 涉及评论 / 评测 / 文章发布等多模块的 cache invalidation 协议设计，应单独立项做 ADR。本期不动 `dynamic = 'force-dynamic'`。 |
| P2 #11 工具详情 JSON-LD 补 `operatingSystem` / `offers` / `applicationSubCategory` / 代表性 review | **部分采纳** | 本期补 `applicationCategory: 'DeveloperApplication'`（已有）+ 新增 `url`、`sameAs`（如 `target.websiteUrl` 存在）；不补 `offers` 与代表性 review，因为 LogWood 当前不收录定价数据，且把代表性 review 嵌入 SoftwareApplication 容易与 Review 实体语义混淆。 |
| P2 #12 内容增长策略（对比页 / 专题页 / 专栏页 / 标签页） | **推迟** | 全部列入"未来工作"，本期不假设这些路由存在。 |
| 文章模块专项：`seoTitle` / `seoDescription` / `coverImageAlt` / `readingMinutes` / 作者资料页 | **推迟** | 涉及 Prisma schema 改动；本期通过 `excerpt` + `title` + `coverImageUrl` 兜底。 |
| 文章模块专项：编辑器 H2/H3 起步、正文图片 alt 必填 | **部分采纳** | 本期通过渲染时 H1 → H2 兜底；编辑器层校验列入"未来工作"（涉及 `src/components/rich-text-editor.tsx` 改动）。 |
| 抽出 `src/lib/seo.ts` 工具集 | **部分采纳** | 落地路径调整为 `src/shared/seo/*`（与 README 推荐的 `src/shared/` 模块化目录一致）；细分为 `site-config.ts`、`url.ts`、`metadata.ts`、`json-ld.ts`、`index.ts`。 |

### 2.3 决策汇总

- 共 27 条主要建议，**采纳 11 条 / 部分采纳 9 条 / 不采纳 4 条 / 推迟 3 条**。
- 不采纳与推迟的原因主要是：路由不存在（`/search`、`/review/[id]`、对比/专题/标签 landing）、需要 DB 迁移（`Target.updatedAt`、文章 SEO 字段）、需要新依赖（Markdown 解析器）、需要单独 ADR（ISR/cache invalidation、外链 rel 放宽）。

---

## 3. 技术 SEO 实施细则

### 3.1 域名与 `metadataBase`

**问题**：当前 `BASE_URL` 在 `layout.tsx`、`page.tsx`、`articles/[slug]/page.tsx` 等多处独立 `process.env.NEXTAUTH_URL || 'https://logwood.app'`，且没有 `metadataBase`。

**方案**：

- 抽出 `src/shared/seo/site-config.ts`：
  - 导出 `getSiteUrl(): string`，优先读 `process.env.SITE_URL`，回退 `NEXTAUTH_URL`，最终默认 `https://logwood.app`。
  - 返回值保证不带尾斜杠（`rstrip /`）。
- `layout.tsx` 设置 `metadata.metadataBase = new URL(getSiteUrl())`。
- 引入 `SITE_URL` 环境变量（可选）用于"鉴权回调域名 != 公开访问域名"场景，例如鉴权域是 `auth.logwood.app`、公开域是 `logwood.app`。

**`.env.example` 增量**：

```bash
# Optional: public site URL used for metadataBase, canonical, sitemap, og:url. Falls back to NEXTAUTH_URL.
# SITE_URL="https://logwood.app"

# Optional: Google Search Console verification token. Rendered as <meta name="google-site-verification" ...>.
# GOOGLE_SITE_VERIFICATION=""
```

### 3.2 URL 规范化

**问题**：当前 canonical 直接拼字符串模板，例如：

```ts
alternates: { canonical: `${BASE_URL}/articles/${params.slug}` }
```

会有以下风险：
- `NEXTAUTH_URL` 尾斜杠不一致 → 双 `//`。
- `params.slug` 大小写、未 encode 形式 → canonical 与实际 URL 不匹配。
- 中文 slug 在路径中需要 `encodeURI` / `encodeURIComponent` 才能合法。

**方案**（`src/shared/seo/url.ts`）：

```ts
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const base = getSiteUrl()
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${base}${path}`.replace(/([^:])\/{2,}/g, '$1/')
}

export function canonicalFor(path: string): string {
  return toAbsoluteUrl(path)
}

export function joinPath(...segments: string[]): string {
  return '/' + segments.filter(Boolean).map((s) => s.replace(/^\/+|\/+$/g, '')).join('/')
}
```

调用约定：
- 文章详情：`canonicalFor(`/articles/${encodeArticleSlug(article.slug)}`)`，使用数据库原始 `article.slug` 而非请求 `params.slug`。
- 工具详情：`canonicalFor(`/${target.type}/${target.slug}`)`。
- App 详情：`canonicalFor(`/app/${app.slug}`)`。

### 3.3 robots.txt

**当前 `disallow`**：`/api/`、`/app/manage/`、`/articles/manage/`、`/comments/manage/`、`/targets/manage/`、`/auth/`。

**本期新增 disallow**：

| 路径 | 原因 |
| --- | --- |
| `/submit` | 评测发布表单，客户端渲染、无内容价值 |
| `/emojis` | 表情管理工具页 |
| `/tags` | 标签池操作页（client component，登录后增删） |

**双层防御**：robots.txt 的 `Disallow` 不阻止索引（被外链入索引时仍可能展示），所以同步在页面级注入 `noindex`（见 §3.5）。

`sitemap` 字段输出**绝对 URL**：`${getSiteUrl()}/sitemap.xml`。

### 3.4 sitemap.xml

**当前问题**：
1. 含 `/submit`、`/emojis`、`/tags` 三个低价值路由。
2. `target` 路由 `lastModified` 用 `createdAt`（精度差）。

**本期方案**（`src/app/sitemap.ts`）：

- 移除 `/submit`、`/emojis`、`/tags` 三项静态路由。
- 保留 `/`、`/editor`、`/coding`、`/articles`、`/app`。
- `target` 查询改为：

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

- 所有 URL 通过 `canonicalFor()` 生成，避免双斜杠。
- `article` / `app` 已有 `updatedAt`，保持不变。

### 3.5 页面级 noindex

**对象**：`/submit`、`/emojis`、`/tags`、`/auth/*`、`/articles/manage`、`/app/manage`、`/comments/manage`、`/targets/manage`（含子路径）。

**实现**：这些页面大多是 `'use client'`，client component 不能直接 `export const metadata`，所以在每个目录新增 `layout.tsx` 承载 metadata：

```tsx
// src/app/submit/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

需要新增的 layout：
- `src/app/submit/layout.tsx`
- `src/app/emojis/layout.tsx`
- `src/app/tags/layout.tsx`
- `src/app/auth/layout.tsx`（同时覆盖 `/auth/signin` 与 `/auth/error`）
- `src/app/articles/manage/layout.tsx`
- `src/app/app/manage/layout.tsx`
- `src/app/comments/manage/layout.tsx`
- `src/app/targets/manage/layout.tsx`

### 3.6 404 页面

**新增**：`src/app/not-found.tsx`，服务器组件，含 `<main>` 与 `SiteNav` / `SiteFooter`，输出：

```ts
export const metadata: Metadata = {
  title: '页面未找到',
  robots: { index: false, follow: true },
}
```

视觉使用 `STYLE_GUIDE.md` 语义类（`cyber-card`、`gradient-text`、`text-muted`），提供回到首页 / AI Coding / 社区文章三个 CTA。

### 3.7 hreflang（占位）

`layout.tsx` 增加：

```ts
alternates: {
  canonical: getSiteUrl(),
  languages: { 'zh-CN': '/' },
}
```

未来支持英文界面后扩展为 `{ 'zh-CN': '/zh-CN/', 'en': '/en/' }`。本期只是占位，避免未来 schema 大改。

---

## 4. 结构化数据（JSON-LD）

### 4.1 类型分布

| 类型 | 出现位置 | builder |
| --- | --- | --- |
| `Organization` | 全站 layout（覆盖所有页面） | `buildOrganization()` |
| `WebSite` | 首页 | `buildWebSite()` |
| `BlogPosting` | 文章详情 | `buildArticleJsonLd()` |
| `SoftwareApplication` | 工具详情、App 详情 | `buildSoftwareApplicationJsonLd()` |
| `BreadcrumbList` | 所有详情页 + 文章/App/工具列表页 | `buildBreadcrumbList()` |

### 4.2 渲染机制

新增统一组件 `src/components/json-ld.tsx`：

```tsx
type JsonLdValue = Record<string, unknown>

export function JsonLd({ value }: { value: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(value, (_k, v) => (v === undefined ? undefined : v)),
      }}
    />
  )
}
```

调用方式：

```tsx
<JsonLd value={buildBreadcrumbList([...])} />
<JsonLd value={buildArticleJsonLd({...})} />
```

替换现存散落的 `<script type="application/ld+json" dangerouslySetInnerHTML={...}>`，便于审计与未来增强（统一 replacer / nonce / CSP）。

### 4.3 各类型字段约束

#### Organization（站点级，注入 `layout.tsx`）

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LogWood",
  "url": "<absolute site url>",
  "logo": "<absolute /opengraph-image>",
  "description": "AI 编码工具评测社区"
}
```

#### WebSite（首页 `page.tsx`）

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "LogWood",
  "description": "AI 编码工具评测社区",
  "url": "<absolute site url>"
}
```

**不再包含 `potentialAction.SearchAction`**。

#### BlogPosting（文章详情）

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "mainEntityOfPage": "<canonical url>",
  "headline": "<article.title>",
  "description": "<article.excerpt or stripped content, 160 chars>",
  "image": ["<article.coverImageUrl absolute>"],
  "datePublished": "<article.publishedAt or createdAt ISO>",
  "dateModified": "<article.updatedAt ISO>",
  "author": { "@type": "Person|Organization", "name": "..." },
  "publisher": {
    "@type": "Organization",
    "name": "LogWood",
    "url": "<site url>",
    "logo": { "@type": "ImageObject", "url": "<absolute /opengraph-image>" }
  },
  "keywords": ["tag1", "tag2"],
  "articleSection": "<column.name>"
}
```

#### SoftwareApplication（工具/App 详情）

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "<target.name or app.title>",
  "description": "<target.description or app.summary>",
  "url": "<canonical url>",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "sameAs": ["<target.websiteUrl>"],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "<avgRating>",
    "reviewCount": "<reviewCount>",
    "bestRating": 5,
    "worstRating": 1
  }
}
```

`aggregateRating` 仅在 `reviewCount > 0` 时输出（builder 内置该判断），避免空评分污染。

#### BreadcrumbList（所有详情/列表页）

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "首页", "item": "<absolute />" },
    { "@type": "ListItem", "position": 2, "name": "社区文章", "item": "<absolute /articles>" },
    { "@type": "ListItem", "position": 3, "name": "<column.name>", "item": "<absolute /articles>" },
    { "@type": "ListItem", "position": 4, "name": "<article.title>", "item": "<absolute canonical>" }
  ]
}
```

**注意**：当前 `column` 没有专属 landing page，所以 `position 3` 的 `item` 仍指向 `/articles`。等专栏路径化（推迟项）落地后再改为 `/articles/columns/[slug]`。

### 4.4 builder 实现位置

`src/shared/seo/json-ld.ts`：

- `buildOrganization()`
- `buildWebSite()`（不含 SearchAction）
- `buildBreadcrumbList(items: Array<{ name: string; path: string }>)`
- `buildArticleJsonLd(input: {...})`
- `buildSoftwareApplicationJsonLd(input: {...})`

返回类型统一为 `Record<string, unknown>`。所有 url 字段在 builder 内部走 `toAbsoluteUrl()`。

### 4.5 JSON-LD 形状校验（测试）

`src/shared/seo/json-ld.test.ts` 用 `zod`（已在 deps）描述 schema 形状并对 builder 输出 `.parse()`：

```ts
const BlogPostingSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('BlogPosting'),
  mainEntityOfPage: z.string().url(),
  headline: z.string().min(1),
  // ...
})

it('buildArticleJsonLd 返回合法的 BlogPosting', () => {
  const output = buildArticleJsonLd({...})
  expect(() => BlogPostingSchema.parse(output)).not.toThrow()
})
```

---

## 5. 内容 SEO

### 5.1 标题 / 描述模板

**title**：依赖 `layout.tsx` 已配置的 `title.template = '%s | LogWood'`，所以页面级 `metadata.title` 只传**主标题**，避免重复后缀。

**description**：

| 页面 | 来源 |
| --- | --- |
| 首页 | 动态：`已收录 X 款 AI 工具、Y+ 条真实评测，涵盖 AI Editor、AI Coding、AI Model 与 AI Prompt` |
| `/editor`、`/coding`、`/model`、`/prompt` 列表 | 静态（保持现状） |
| `/articles` 列表 | `阅读开发者分享的 AI Coding 实践经验、工具对比与使用技巧` |
| `/app` 列表 | `精选社区开发的 AI Coding 应用实践` |
| `/articles/[slug]` | `article.excerpt || stripHtml(article.content).slice(0, 160)` |
| `/app/[slug]` | `app.summary.slice(0, 160)` |
| `/{type}/[slug]` 工具详情 | `target.description?.slice(0, 160) || `${target.name} 工具评测`` |

`buildMetadata()` 内部对 description 做 160 字符截断（中文按字符计），避免 Google snippet 超长截断。

### 5.2 H1 / H2 / H3 层级

**强制约束**：
- 每个页面**只允许 1 个 H1**，且必须是该页的主标题。
- 文章详情外层标题已经是 H1，正文允许 H2/H3/H4，**禁止正文 H1**。

**当前问题**：富文本编辑器允许插入 `<h1>`，渲染时未做层级矫正。

**本期方案**：抽出 `src/modules/article/sanitize.ts`：

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

注意：`allowedTags` 中**不再包含 `h1`**；同时 `transformTags.h1: 'h2'` 把传入的 `<h1>` 转为 `<h2>` 而不是被剥离，保证内容不丢失。

### 5.3 图片 alt

**约束**：所有 `<Image>` 必须有有意义的 `alt`。

**当前**：
- 文章封面 `<Image alt={article.title}>` ✓
- 工具卡片 logo `<Image alt={target.name}>` ✓
- 文章正文中通过富文本插入的 `<img>` 由 sanitize-html 透传 alt 属性，但默认值是文件名（编辑端问题）。

**本期方案**：保持渲染端透传；编辑端 alt 必填校验列入"未来工作"。

### 5.4 内链

**当前现状**：站点导航 + 页脚已经覆盖核心内链（首页 / AI Coding / 应用工坊 / 社区文章 / 标签）。详情页缺：
- 文章详情 → 同专栏文章
- 文章详情 → 引用工具
- 工具详情 → 该工具相关文章

**本期方案**：仅做面包屑（见 §6.1）。"同专栏文章 / 相关工具"列入"未来工作"，需要新建 service 层方法。

---

## 6. 视觉与组件层 SEO 增强

### 6.1 面包屑

新增 `src/components/breadcrumbs.tsx`（服务端组件）：

```tsx
import Link from 'next/link'

export type BreadcrumbItem = { name: string; href?: string }

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb" className="text-sm text-muted mb-6 flex items-center gap-2 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={`${item.name}-${idx}`} className="flex items-center gap-2">
            {idx > 0 && <span className="text-soft">/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-coding hover-text-coding transition-colors">
                {item.name}
              </Link>
            ) : (
              <span className="text-[var(--color-text-strong)]">{item.name}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
```

**样式约束**：使用 `text-muted`、`text-soft`、`text-coding`、`hover-text-coding` 等语义类，**禁止 `text-gray-*` / `bg-[#xxxxxx]`**。

调用方约定：可见面包屑（`<Breadcrumbs>`）和结构化数据（`<JsonLd value={buildBreadcrumbList(...)} />`）**单独输出**，由调用方组装，保持职责分离。

### 6.2 适用范围

| 页面 | 可见面包屑 | BreadcrumbList JSON-LD |
| --- | --- | --- |
| `/articles` 列表 | 否 | 是（首页 → 社区文章） |
| `/articles/[slug]` 详情 | 是 | 是（首页 → 社区文章 → 专栏 → 文章标题） |
| `/app` 列表 | 否 | 是 |
| `/app/[slug]` 详情 | 是 | 是 |
| `/editor` 列表 | 否 | 是 |
| `/editor/[slug]`、`/coding/[slug]`、`/model/[slug]`、`/prompt/[slug]` 详情 | 是 | 是（首页 → AI Coding → 分类 → 工具名） |
| `/coding` 列表 | 否 | 是 |

`/model` 和 `/prompt` 没有列表页，面包屑中"AI Model / AI Prompt"链接到 `/coding?category=model` / `/coding?category=prompt`（与现有导航一致）。等专栏路径化落地后改为 `/model` / `/prompt`。

---

## 7. 社交分享（OG / Twitter Card）

### 7.1 站点级默认 OG 图

新增 `src/app/opengraph-image.tsx`：

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'LogWood - AI 编码工具评测社区'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          color: '#e5e7eb',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              backgroundImage: 'linear-gradient(90deg, #22d3ee 0%, #a855f7 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            LogWood
          </div>
          <div style={{ fontSize: 48, color: '#cbd5e1', fontWeight: 600 }}>
            AI 编码工具评测社区
          </div>
        </div>
        <div style={{ fontSize: 28, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
          <span>AI Editor / AI Coding / AI Model / AI Prompt</span>
          <span>logwood.app</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
```

**视觉对齐 STYLE_GUIDE.md**：
- 背景：dark gradient（与 `--color-bg` 同源 `#0a0a0f` → `#12121a`）。
- 主标题：cyan → purple 渐变（`#22d3ee` → `#a855f7`，对应 cyber/neon 主色）。
- 副标题与脚注：`#cbd5e1` / `#64748b`（与 `text-muted` / `text-soft` 同源色阶）。

服务端渲染、不依赖客户端主题、不依赖外部字体（用系统 fallback）。

### 7.2 详情页路由级 OG 图

`src/app/articles/[slug]/opengraph-image.tsx`、`src/app/editor/[slug]/opengraph-image.tsx`（可选增强）：

- 不指定 `runtime`（默认 nodejs），允许 `import { prisma }`。
- 读取 `article.title` / `target.name` 渲染到图。
- 失败时不抛错（兜底用 try/catch + fallback ImageResponse）。

如果实施过程中发现 Prisma + Next.js 14 ImageResponse 在边缘构建有兼容问题，可推迟，仅保留站点级 `/opengraph-image`。

### 7.3 metadata.openGraph 与 metadata.twitter

通过 `buildMetadata()` 统一注入：

```ts
openGraph: {
  type: input.type ?? 'website',
  url: canonicalFor(input.path),
  siteName: 'LogWood',
  locale: 'zh_CN',
  images: [{ url: input.image ?? '/opengraph-image', width: 1200, height: 630, alt: ... }],
  ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
  ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
},
twitter: {
  card: 'summary_large_image',
  images: [input.image ?? '/opengraph-image'],
},
```

`/opengraph-image` 是相对路径，Next.js 会基于 `metadataBase` 自动转为绝对 URL。

---

## 8. 性能与 Core Web Vitals

### 8.1 当前状态评估

| 维度 | 现状 | 影响 |
| --- | --- | --- |
| LCP | 详情页 `force-dynamic`，每次请求都查 Prisma + 渲染，TTFB 较高 | 中 |
| CLS | 文章封面用 `<Image width=1400 height=760>` 提供尺寸，无明显跳变 | 低 |
| INP | 首页有交互按钮，但本身无昂贵操作 | 低 |
| 图片优化 | 大量使用 `next/image`，但 `unoptimized` 标记部分关闭了优化（`logoUrl`） | 中 |
| 字体 | Tailwind + `font-['Orbitron']` 引用系统 fallback | 低 |

### 8.2 本期可做

- 不对 `force-dynamic` 做 ISR 改造（涉及 cache invalidation 协议，单独立项）。
- `next/image` 的 `priority` 暂不全局调整（首页 hero 不依赖图片，文章详情封面理论上是 LCP 候选，可以打 `priority`，但这是细节优化，列入"未来工作"）。
- 不做字体迁移到 `next/font`（视觉风险）。

### 8.3 推迟项

- ISR / `revalidatePath`（P2 #10）。
- LCP 图片 `priority` 标记。
- `next/font` 迁移。
- Lighthouse CI 接入。

---

## 9. 可观测与校验

### 9.1 单元测试

新增以下 vitest 文件（include 规则 `src/**/*.test.ts` 已自动收集）：

| 测试文件 | 覆盖目标 |
| --- | --- |
| `src/shared/seo/url.test.ts` | `toAbsoluteUrl` / `canonicalFor` / `joinPath` 边界（已是绝对 URL、尾斜杠、中文 slug） |
| `src/shared/seo/metadata.test.ts` | `buildMetadata` 默认 OG 图、description 截断、noindex 输出、type=article 字段、canonical 绝对 URL |
| `src/shared/seo/json-ld.test.ts` | 所有 builder 输出形状（用 `zod` schema 校验）；BreadcrumbList position 从 1 开始；WebSite 不含 SearchAction |
| `src/app/sitemap.test.ts` | mock prisma 后断言：不含 `/submit`/`/emojis`/`/tags`；含 `/`/`/editor`/`/coding`/`/articles`/`/app`；target lastModified 优先用 review.updatedAt；URL 走 SITE_URL |
| `src/app/robots.test.ts` | disallow 列表、sitemap 字段绝对 URL |
| `src/modules/article/sanitize.test.ts` | `<h1>` → `<h2>`；外链 rel；`<script>` 剥离 |

### 9.2 静态校验（CI 时）

- `npm run lint`
- `npm run test`
- `npm run build`（验证 metadata 类型正确、`opengraph-image.tsx` 不抛错）

### 9.3 运行时校验（手动）

- 浏览器访问：
  - `https://<site>/robots.txt` 应包含 6+ 条 disallow 与 sitemap URL。
  - `https://<site>/sitemap.xml` 不含 `/submit`、`/emojis`、`/tags`。
  - `https://<site>/opengraph-image` 返回 1200x630 PNG。
  - 任意文章详情页 view-source，应能看到 `<script type="application/ld+json">` 至少 3 块（Organization、BlogPosting、BreadcrumbList）。
- 外部工具：
  - Google Rich Results Test（https://search.google.com/test/rich-results）
  - Open Graph 检查（https://www.opengraph.xyz/）
  - PageSpeed Insights（https://pagespeed.web.dev/）

---

## 10. 运维：环境变量、域名、反向代理

### 10.1 关键环境变量

| 变量 | 必填 | 用途 |
| --- | --- | --- |
| `NEXTAUTH_URL` | 生产必填 | 鉴权回调 + SEO 兜底域名（生产必须是公网 HTTPS） |
| `SITE_URL` | 可选 | 优先于 `NEXTAUTH_URL` 用于 metadataBase / canonical / sitemap / og:url |
| `GOOGLE_SITE_VERIFICATION` | 可选 | 配置后 layout 输出 `<meta name="google-site-verification">` |
| `DATABASE_URL` | 必填 | sitemap 动态查询依赖 |

### 10.2 反向代理

当前 `docker-compose.yml`：`web` 直接 `80:3000`，前置由外部代理处理 SSL。`nginx/nginx.conf`（项目内还有一份）做 gzip + 安全头 + 缓存。

**对 SEO 的影响**：
- `metadataBase` / canonical 必须基于 env，不能 hardcode `http://localhost:3000`。
- 反向代理需要透传 `X-Forwarded-Host` / `X-Forwarded-Proto`，否则 NextAuth 与 SEO 域名不一致。
- `/sitemap.xml` 与 `/robots.txt` 必须可被外网抓取（验证：`curl -I https://<site>/sitemap.xml`）。

### 10.3 多环境约定

| 环境 | `NEXTAUTH_URL` | `SITE_URL` | `GOOGLE_SITE_VERIFICATION` |
| --- | --- | --- | --- |
| 本地开发 | `http://localhost:3000` | 不设 | 不设 |
| 预发 | `https://staging.logwood.app` | 不设 | 不设（避免预发被收录） |
| 生产 | `https://logwood.app` | `https://logwood.app` | 实际 token |

**预发避免被收录**：在反向代理或 `next.config.js` 注入 `X-Robots-Tag: noindex` header（推迟项；当前只在内容层面控制）。

---

## 11. 未来工作（推迟项汇总）

| 项 | 触发条件 | 预估成本 |
| --- | --- | --- |
| 实现 `/search?q=...`，补回首页 `WebSite.SearchAction` | 全站搜索能力立项 | 中（需要全文搜索基础设施） |
| `Target` 模型增加 `updatedAt`，sitemap lastmod 用真实字段 | DB 迁移流程完善 | 低（`@updatedAt` 自动维护） |
| 专栏路径化：`/articles/columns/[slug]` | 内容增长后做内容聚合 | 中（路由 + canonical 重建） |
| AI Model / AI Prompt 路径化：`/model`、`/prompt` 列表页 | AI Model/Prompt 工具数量增长 | 中 |
| 工具对比页：`/compare/cursor-vs-windsurf` | 内容沉淀后做长尾 SEO | 高 |
| 标签 landing 页：`/tags/[slug]` | 标签内容富集后 | 中 |
| ISR / `revalidatePath` 替换 `force-dynamic` | 单独 ADR | 中 |
| 文章 SEO 字段：`seoTitle` / `seoDescription` / `coverImageAlt` / `readingMinutes` | 编辑团队需求 | 中（schema + 编辑 UI） |
| 富文本编辑器禁用 H1、图片 alt 必填 | 编辑流程优化 | 中 |
| 文章正文 Markdown 解析（如果保留 Markdown 源） | 决定保留 Markdown 字段 | 中（需新依赖或已有 tiptap markdown 扩展） |
| `next/font` 迁移 | 字体策略调整 | 低 |
| Lighthouse CI 接入 | 性能预算上线 | 中 |
| `X-Robots-Tag: noindex` for 预发 | 多环境部署收口 | 低 |
| 文章详情"同专栏 / 相关工具"内链区块 | 内容增长后 | 中 |

---

## 12. 用户如何快速验证我们的 SEO

> 本期实施完成后（FEAT-002 / FEAT-003 落地），按以下 6 步验证：

1. **`/robots.txt`**
   ```bash
   curl -s https://<your-site>/robots.txt
   ```
   预期：包含 `User-Agent: *`、`Allow: /`、6+ 条 `Disallow:`（含 `/api/`、`/submit`、`/emojis`、`/tags`、`/auth/`、`/*/manage/`），以及一行 `Sitemap: https://<your-site>/sitemap.xml`。

2. **`/sitemap.xml`**
   ```bash
   curl -s https://<your-site>/sitemap.xml | head -40
   ```
   预期：以 `<urlset>` 开头；不含 `/submit`、`/emojis`、`/tags`；包含 `/`、`/editor`、`/coding`、`/articles`、`/app` 与每条 published 文章 / 工具 / App 的详情 URL；`<lastmod>` 字段对工具是最近评测时间或创建时间。

3. **首页 view-source**
   浏览器打开首页，右键查看源代码，搜索 `application/ld+json`：
   - 应能看到 2 块 JSON-LD：`Organization`（来自 layout）+ `WebSite`（来自首页）。
   - `WebSite` 中**不应包含** `potentialAction` 字段。
   - `<head>` 中应能看到 `<meta property="og:image" content="...opengraph-image">`。

4. **文章详情 view-source**
   打开任意已发布文章详情页：
   - JSON-LD 应至少有 3 块：`Organization` + `BlogPosting` + `BreadcrumbList`。
   - `BlogPosting` 应包含 `mainEntityOfPage`、`image`、`datePublished`、`dateModified`、`publisher.logo`、`keywords`（如有 tags）、`articleSection`（如有 column）。
   - 正文 HTML 中**不应出现** `<h1>`（外层标题除外）。
   - `<link rel="canonical" href="...">` 指向规范 slug。

5. **OG 图**
   ```bash
   curl -I https://<your-site>/opengraph-image
   ```
   预期：`Content-Type: image/png`、`Content-Length` 非零。
   或在 https://www.opengraph.xyz/ 输入站点 URL，应能看到完整预览卡。

6. **Rich Results Test**
   在 https://search.google.com/test/rich-results 测试 3 类页面：
   - 首页 → `Organization` 与 `WebSite` 检测通过、无 SearchAction 报错。
   - 文章详情 → `BlogPosting` 与 `BreadcrumbList` 检测通过。
   - 工具/App 详情 → `SoftwareApplication` 与 `BreadcrumbList` 检测通过。

---

## 13. 文档版本与维护

| 版本 | 日期 | 内容 |
| --- | --- | --- |
| v1.0 | 本次 | 综合 `seo-claude.md` 与 `seo-codex.md`，定义本期 SEO 实施范围与未来工作。配套实施清单：`docs/SEO_IMPLEMENTATION_PLAN.md`。 |

**维护节奏**：
- 每次新增可索引页面：在 §6.2 表格补充。
- 每次新增结构化数据类型：在 §4.1 与 §4.3 补充。
- 完成"未来工作"中的项：从 §11 移除并记录到本期对应章节。
- 文档与代码不一致时**先改文档**（与 `docs/STYLE_GUIDE.md` 第 6 节同源）。

> 本文档不出现 em-dash 字符。所有跨语言术语保留英文原文（如 SEO、JSON-LD、canonical、sitemap），中文文案使用全角标点。
