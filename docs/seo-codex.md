# LogWood SEO 诊断与优化方案（Codex）

生成日期：2026-05-20  
范围：当前工作区代码，包括已有未提交的 SEO 相关改动。  
项目：LogWood，AI 编码工具评测社区，Next.js 14 App Router + Prisma + PostgreSQL。

> 说明：仓库中已有 `docs/seo-claude.md`。该文档中的一部分结论已经被当前代码实现或不再准确，例如 `robots.ts`、`sitemap.ts`、页面级 metadata、基础 JSON-LD 已经存在。本方案以当前代码为准。

## 结论

LogWood 已经有了 SEO 的骨架：全局 metadata、中文 `lang`、favicon、动态 sitemap、robots、公开页面 canonical、文章和工具详情的 JSON-LD 都已经覆盖到。下一步不应继续堆关键词，而应集中补强三件事：

1. 让可索引页面更准确：修正 SearchAction、低价值页面 noindex、规范 query/filter 页 canonical。
2. 让文章页更像“可理解的内容页”：语义化渲染 Markdown/富文本、补全 Article JSON-LD、改善图片 alt 与 OG 图。
3. 让增长后可维护：统一 URL/metadata 工具函数、完善 sitemap lastModified、拆分可索引栏目/标签页策略。

## 参考依据

- Google SEO Starter Guide：https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google snippets/meta description：https://developers.google.com/search/docs/appearance/snippet
- Google Article structured data：https://developers.google.com/search/docs/appearance/structured-data/article
- Google Image SEO：https://developers.google.com/search/docs/appearance/google-images
- Google robots meta and X-Robots-Tag：https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google robots.txt spec：https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- Next.js Metadata and OG images：https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Next.js sitemap convention：https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap

## 当前已有能力

### 全局层

- `src/app/layout.tsx`
  - 已设置站点级 `title.template`、`description`、`keywords`、`authors`、`creator`、`publisher`。
  - 已设置 `robots` 和 `googleBot` 预览策略。
  - 已设置 `openGraph`、`twitter`、全局 canonical、favicon。
  - `<html lang="zh-CN">` 已存在。

- `src/app/robots.ts`
  - 已允许公开页面抓取。
  - 已屏蔽 `/api/`、管理页和 `/auth/`。
  - 已输出 sitemap 地址。

- `src/app/sitemap.ts`
  - 已包含首页、主要列表页、文章页、工具详情页、App 详情页。
  - 文章和 App 已按 published 状态过滤。

### 页面层

- 首页 `src/app/page.tsx`
  - 已使用 `generateMetadata` 按 review/target 数量生成描述。
  - 已输出 `WebSite` JSON-LD。

- 公开列表页
  - `/editor`、`/coding`、`/app`、`/articles` 已有静态 metadata 与 canonical。

- 详情页
  - `/editor/[slug]`、`/coding/[slug]`、`/model/[slug]`、`/prompt/[slug]` 已有动态 metadata、canonical、`SoftwareApplication` JSON-LD。
  - `/app/[slug]` 已有动态 metadata、OG 图和 `SoftwareApplication` JSON-LD。
  - `/articles/[slug]` 已有动态 metadata、canonical、`Article` JSON-LD。

### 内容层

- 文章模型已有 `title`、`slug`、`excerpt`、`content`、`tags`、`coverImageUrl`、`publishedAt`、`updatedAt`、`viewCount`、`column`。
- 文章管理支持富文本编辑、图片/视频上传、专栏、标签、封面地址。

## 主要问题与机会

### P0：必须优先修

#### 1. `WebSite.SearchAction` 指向不存在的搜索能力

当前首页 JSON-LD 中：

```ts
target: `${BASE_URL}/editor?q={search_term_string}`
```

但 `/editor` 页面没有读取 `q`，也没有实际搜索结果。这会让结构化数据表达和页面能力不一致。

建议二选一：

- 短期：删除 `potentialAction.SearchAction`。
- 中期：实现全站搜索页 `/search?q=`，搜索 target、article、app，再把 SearchAction 指向 `/search?q={search_term_string}`。

验收：

- Rich Results Test 不再对 SearchAction 产生歧义。
- 搜索 URL 可返回与 query 相关的服务端 HTML 内容。

#### 2. 缺少统一的 `metadataBase` 和默认 OG 图片

当前全局 `openGraph` 没有 `images`，详情页也只有 App 会在有预览图时输出 OG 图。文章详情有封面展示，但 metadata 和 Article JSON-LD 没有把封面作为 `og:image` / `twitter:image` / `image`。

建议：

- 在 `layout.tsx` 增加 `metadataBase: new URL(BASE_URL)`。
- 新增默认图：`src/app/opengraph-image.tsx` 或 `public/og-image.png`，尺寸 1200x630。
- 文章、App、工具详情优先使用实体图片；没有图片时使用默认 OG 图。
- 建立 `toAbsoluteUrl(pathOrUrl)` 工具，避免相对 URL 在 metadata/JSON-LD 中不确定。

文章详情建议：

```ts
openGraph: {
  type: 'article',
  title: `${article.title} | LogWood`,
  description,
  url,
  images: [{ url: imageUrl, width: 1200, height: 630, alt }],
}
twitter: {
  card: 'summary_large_image',
  title: article.title,
  description,
  images: [imageUrl],
}
```

#### 3. 文章正文语义不稳定

当前文章页存在两套渲染路径：

- 如果内容像 HTML：用 `dangerouslySetInnerHTML` 输出净化后的 HTML。
- 如果内容不像 HTML：用 `whitespace-pre-wrap` 输出纯文本。

问题：

- 种子文章内容是 Markdown，例如 `## 为什么你需要...`，但详情页不会把 Markdown 转为 `<h2>`，搜索引擎和读者只能看到普通文本。
- 富文本编辑器允许正文插入 H1，详情页外层已经有文章标题 H1，容易出现多个 H1。
- 图片上传进正文时 alt 默认是文件名，不是描述性文本。
- 文章 body 外链被统一改成 `nofollow`。如果文章是管理员编辑的内容，所有外链都 nofollow 会削弱引用关系表达；评论区和用户生成内容才更适合 `ugc nofollow`。

建议：

- 统一文章存储/渲染协议：要么所有正文保存 HTML，要么 Markdown 正文通过 Markdown 解析器转为语义 HTML。
- 正文编辑器禁用 H1，或保存/渲染时把正文 H1 降级为 H2。
- 图片插入时要求填写 alt，或至少把 `alt` 从文件名改为可编辑字段。
- 文章正文外链默认 `rel="noopener noreferrer"`；只有用户可控链接或低信任链接增加 `nofollow ugc`。

#### 4. sitemap 中混入低价值/管理倾向页面

当前 sitemap 包含：

- `/submit`：发布表单，客户端渲染，搜索价值低。
- `/emojis`：页面标题是“表情包管理”，更像功能页/管理页。
- `/tags`：当前是标签池操作页，不是独立标签落地页。

建议：

- 从 sitemap 移除 `/submit`、`/emojis`。
- 对 `/submit`、`/emojis` 设置页面级 `robots: { index: false, follow: false }`，或把它们归入需要登录/低价值路径。
- `/tags` 如果保留索引，应改造成“AI Coding 标签大全”这类可读落地页；否则也从 sitemap 移除并 noindex。

注意：如果希望搜索引擎遵守页面级 noindex，不要只依赖 robots.txt 的 `Disallow`，因为被 robots.txt 阻止抓取的页面，搜索引擎可能看不到页面里的 noindex。

### P1：应尽快补齐

#### 5. 文章 JSON-LD 需要更完整

当前文章结构化数据已有：

- `headline`
- `description`
- `url`
- `datePublished`
- `dateModified`
- `author`
- `publisher`

建议补充：

- `@type: 'BlogPosting'` 或 `Article`，二者都可；社区实践文章更贴近 `BlogPosting`。
- `mainEntityOfPage`
- `image`
- `author.url`，如果后续有作者页。
- `publisher.logo`
- `keywords: article.tags`
- `articleSection: article.column?.name`

示例形态：

```ts
const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  mainEntityOfPage: url,
  headline: article.title,
  description,
  image: imageUrl ? [imageUrl] : undefined,
  datePublished: publishedAt,
  dateModified: updatedAt,
  author: {
    '@type': article.author ? 'Person' : 'Organization',
    name: article.author?.name || 'LogWood Team',
    url: authorUrl,
  },
  publisher: {
    '@type': 'Organization',
    name: 'LogWood',
    url: BASE_URL,
    logo: `${BASE_URL}/favicon.svg`,
  },
  keywords: article.tags,
  articleSection: article.column?.name,
}
```

#### 6. canonical 应使用规范 slug，而不是请求参数原样

文章详情当前 canonical 使用：

```ts
`${BASE_URL}/articles/${params.slug}`
```

建议改为使用数据库中的 `article.slug`，再统一 encode：

```ts
const canonical = `${BASE_URL}/articles/${encodeArticleSlug(article.slug)}`
```

原因：

- 中文 slug、大小写、编码形式可能造成多个可访问 URL。
- canonical 应指向系统认可的规范 URL。

同理，target/app 详情也建议统一走 `canonicalFor(path)` 工具函数，避免 `NEXTAUTH_URL` 尾部斜杠造成双斜杠。

#### 7. query/filter 页需要明确策略

当前有两类 query 页面：

- `/coding?category=editor|coding|model|prompt`
- `/articles?column=<id>`

目前它们都继承列表页 canonical，例如 `/articles?column=xxx` canonical 到 `/articles`。

建议按业务价值决定：

- 如果分类/专栏要承接搜索流量，改成路径型页面：
  - `/coding/editor`
  - `/coding/model`
  - `/articles/columns/vibe-coding`
- 如果只是 UI 筛选，保留 canonical 到列表页，并对 query 页 noindex。

文章专栏更建议做成可索引页面，因为 `ArticleColumn` 已有 `slug`，天然适合作为内容聚合页。

#### 8. sitemap 的 `lastModified` 精度不足

当前 `Target` 模型没有 `updatedAt`，sitemap 对 target 使用 `createdAt`。工具详情、评分和评论变化后，sitemap 无法表达页面更新。

建议：

- 给 `Target` 增加 `updatedAt DateTime @updatedAt`。
- target sitemap 使用 target `updatedAt`，或使用最新 published review/comment 的时间作为 `lastModified`。
- App/Article 已有 `updatedAt`，保持使用。

#### 9. 增加 BreadcrumbList

文章、工具、App 详情页都有清晰路径，但没有面包屑结构化数据。

建议：

- 页面上展示面包屑：`首页 / 社区文章 / 专栏 / 文章标题`。
- 同步输出 `BreadcrumbList` JSON-LD。

这对搜索结果理解站点层级有帮助，也能改善用户从详情页回到列表/专栏的路径。

### P2：中期优化

#### 10. 公共页全部 `force-dynamic`，性能和缓存空间较大

多个公开页面设置了：

```ts
export const dynamic = 'force-dynamic'
```

这保证数据实时，但会牺牲 TTFB 和缓存能力。SEO 上，性能不是唯一因素，但慢页面会影响抓取效率和用户体验。

建议：

- 首页、列表页、详情页按内容时效改为 `revalidate = 60`、`revalidate = 300` 或按发布/评论动作触发 `revalidatePath`。
- 浏览量递增不要阻塞文章首屏渲染；可改为异步 route handler、server action 或边缘日志。
- 对首屏图片使用合理尺寸、`priority` 仅给真正首屏图。

#### 11. 工具详情结构化数据可更丰富

当前工具页输出 `SoftwareApplication` 与 `aggregateRating`。可继续补充：

- `operatingSystem`
- `offers`，如果有价格/免费信息
- `applicationSubCategory`
- 代表性 `review`，但必须确保内容真实、可见、且与页面展示一致。

#### 12. 内容增长策略

LogWood 的主题适合做长尾 SEO，不建议只依赖首页和工具卡片。

建议建设：

- 工具对比页：`/compare/cursor-vs-windsurf`
- 专题页：`/topics/ai-editor`、`/topics/claude-code`
- 专栏页：`/articles/columns/vibe-coding`
- 标签页：`/tags/efficient`，前提是每个标签页有足够内容，不只是标签列表。
- 年份型内容慎用，避免过期后成为低质量页面；如果使用，建立更新机制。

## 文章模块专项方案

### 数据模型建议

短期不一定需要迁移，但如果要长期做文章 SEO，建议逐步增加：

- `seoTitle String?`：允许标题和搜索标题分离，长度控制在约 30-60 个中文字符内。
- `seoDescription String?`：允许独立 meta description；没有时回退 `excerpt`。
- `coverImageAlt String?`：封面图 alt/OG alt。
- `canonicalSlug String?` 或只保留 `slug`，但要有不可频繁变更的规范。
- `readingMinutes Int?`：可用于页面展示和结构化描述。
- 作者资料页字段：作者简介、头像、个人页 URL。

### 编辑器与内容规范

建议把文章编辑规范固化到 UI 和校验：

- 标题：1 个 H1，只来自文章标题。
- 正文：从 H2 开始，允许 H2/H3/H4，不允许正文 H1。
- 摘要：建议 60-160 字，必须能独立说明文章收益。
- 图片：正文图片必须有 alt；封面图必须有 alt。
- 外链：编辑文章中的可信引用链接可以 follow；用户评论链接使用 `ugc nofollow`。
- 内链：文章编辑时建议补充 2-5 个站内链接，例如工具详情、相关专栏、相关文章。

### 文章详情页实现建议

优先改动文件：

- `src/app/articles/[slug]/page.tsx`
- `src/modules/article/service.ts`
- `src/components/rich-text-editor.tsx`
- `src/app/articles/manage/page.tsx`

建议实现：

1. 抽出通用 SEO 工具：
   - `src/lib/seo.ts`
   - `getBaseUrl()`
   - `toAbsoluteUrl()`
   - `canonicalUrl()`
   - `truncateDescription()`
   - `stripHtmlToText()`

2. 文章 metadata 使用规范字段：
   - `title: article.seoTitle || article.title`
   - `description: seoDescription || excerpt || stripped content`
   - `canonical` 从 `article.slug` 生成
   - `openGraph.images` 和 `twitter.images` 使用封面或默认图

3. 文章 JSON-LD 补齐：
   - `BlogPosting`
   - `mainEntityOfPage`
   - `image`
   - `keywords`
   - `articleSection`
   - `publisher.logo`

4. 文章正文渲染统一：
   - 如果继续支持 Markdown，引入解析器并输出语义 HTML。
   - 如果只支持富文本 HTML，管理端保存时就不要生成 Markdown。
   - 渲染前做 heading 规范化，把正文 H1 降级。

5. 文章页增加可读内链：
   - 同专栏文章
   - 同标签文章
   - 相关工具卡片

## 路由级建议

### 首页 `/`

- 保留动态统计描述。
- 修复或删除 `SearchAction`。
- 增加 Organization JSON-LD，可与 WebSite JSON-LD 并存。
- 默认 OG 图应覆盖首页分享。

### `/editor`、`/coding`

- `/coding?category=` 当前适合产品内筛选，不适合直接作为可索引 URL。
- 如果 AI Model / AI Prompt 是重要入口，建议创建独立列表页 `/model`、`/prompt`，而不是只放在 `/coding?category=model`。
- 列表页 metadata 可包含目标数量和代表性工具，但避免堆关键词。

### 工具详情 `/:type/[slug]`

- 继续使用 `SoftwareApplication`。
- OG 图优先用 logo 生成动态 1200x630 卡片，而不是直接用 favicon。
- 如果评论质量高，可考虑展示并标记代表性 review。
- target 没有 `updatedAt`，需要补数据字段或用最新互动时间。

### `/app` 与 `/app/[slug]`

- 当前 App 详情 SEO 基础较好。
- `previewImageUrl` 应同时进入 `twitter.images`。
- App 外链可保留 follow，但建议对不可控提交来源设审核。

### `/articles`

- 文章列表页可以继续索引。
- 现有专栏筛选建议升级为路径型专栏页。
- 列表页可增加最新更新时间、专栏介绍、热门文章模块。

### `/articles/[slug]`

- 这是最值得投入的 SEO 页面。
- 优先补：semantic HTML、Article JSON-LD image、OG image、规范 canonical、正文 H1 降级、图片 alt。

### `/submit`、`/tags`、`/emojis`

- `/submit`：建议 noindex 且移出 sitemap。
- `/emojis`：建议 noindex 且移出 sitemap。
- `/tags`：如果只是标签管理/标签池，建议 noindex；如果改造成标签内容索引页，再保留。

## 实施路线

### 第 1 阶段：快速修正，1 天

- 删除或实现首页 SearchAction。
- 增加 `metadataBase`、默认 OG 图。
- 文章详情 metadata 增加 `openGraph.images`、`twitter.images`。
- 从 sitemap 移除 `/submit`、`/emojis`；必要时 `/tags` 也移除。
- 给低价值页面加 noindex metadata。
- 抽 `src/lib/seo.ts`，统一 canonical 和 absolute URL。

### 第 2 阶段：文章 SEO，2-4 天

- Markdown/HTML 渲染协议统一。
- 正文 H1 降级或编辑器禁用 H1。
- 文章 JSON-LD 升级为完整 BlogPosting。
- 管理端增加 `coverImageAlt`、`seoDescription`。
- 文章页增加相关内容内链。
- 专栏筛选改为 `/articles/columns/[slug]`。

### 第 3 阶段：信息架构和性能，1-2 周

- 新增 `/model`、`/prompt` 列表页。
- 给 `Target` 增加 `updatedAt`，优化 sitemap lastModified。
- 公共页从 `force-dynamic` 迁移到 ISR 或按动作 revalidate。
- 做工具对比页、专题页、标签落地页。
- 接入 Search Console，提交 sitemap 并监控覆盖率、重复 canonical、结构化数据问题。

## 验收清单

技术验收：

- `npm run build` 通过。
- `/robots.txt` 返回预期规则。
- `/sitemap.xml` 不包含低价值页面，只包含可索引 canonical URL。
- 文章页 HTML 源码中有唯一主 H1，正文标题为 H2/H3。
- 文章页 HTML 源码中包含 canonical、description、og:image、twitter:image。
- Article JSON-LD 通过 Rich Results Test。
- 首页 WebSite JSON-LD 不包含不存在的 SearchAction。

内容验收：

- 每篇文章有唯一标题和摘要。
- 每篇文章正文至少有清晰 H2 结构。
- 封面图和正文关键图片有描述性 alt。
- 每篇重点文章包含合理站内链接。
- 低价值页面不会进入 sitemap。

监控验收：

- Search Console 提交 sitemap。
- 观察“已发现，尚未编入索引”“重复网页，Google 选择的规范网页不同于用户指定的网页”。
- 用 PageSpeed Insights 抽查首页、文章详情页、工具详情页。
- 结构化数据错误为 0，警告可接受但需记录。

## 建议优先级汇总

| 优先级 | 项目 | 影响 | 改动成本 |
| --- | --- | --- | --- |
| P0 | 修复/删除 SearchAction | 避免错误结构化数据 | 低 |
| P0 | 默认 OG 图 + 文章封面进 metadata | 提升分享和图片理解 | 中 |
| P0 | 文章 Markdown/HTML 语义化 | 直接影响文章内容理解 | 中 |
| P0 | 移除低价值 sitemap URL | 减少低质量索引风险 | 低 |
| P1 | 文章 BlogPosting JSON-LD | 提升文章页可理解性 | 中 |
| P1 | 规范 canonical/absolute URL | 降低重复 URL 风险 | 低 |
| P1 | 专栏页路径化 | 建立内容聚合入口 | 中 |
| P1 | Target updatedAt | 提升 sitemap 准确度 | 中 |
| P2 | ISR/revalidate | 改善性能和抓取效率 | 中 |
| P2 | 对比页/专题页/标签页 | 增加长尾入口 | 高 |

