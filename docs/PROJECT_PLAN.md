# LogWood 项目计划书

## 1. 文档目的
本文件用于快速理解项目现状、里程碑、架构边界和近期变更。

维护规则（强制）：
- 涉及功能新增、功能修复、架构调整、部署策略变更时，必须同步更新本文件。
- 代码评审时将本文件更新作为必检项。
- 新成员应先阅读本文件，再阅读 SPEC 与模块文档。

## 2. 项目定位
- 项目名称：空心树洞（仓库名仍可为 LogWood）
- 副标题：放下执念，重新生长
- 定位：个人策展的 Skill 库 + 画廊 + AI 造物台
- 核心价值：收藏可对比的 Skill / 美图与示例站，并用 AI 帮内容重新生长

## 3. 当前范围（Core Scope）
- Skill 室：`/skills`（独立 `Skill` 模型：提示词 × 效果标本，按分类层架；管理 `/skills/manage`）
- 候选评测：`/candidates`（短名单观察/评测；可晋升到工具收藏或画廊；管理 `/candidates/manage`）
- 工具收藏：`/tools`（历史 Target/评测；`/coding`、`/editor` 列表重定向至此）
- 画廊：`/app`（原应用工坊作品继续作为展陈）
- 造物台：`/forge`（AI 创作占位）
- 洞笔记：`/articles`
- 评测闭环：多态 Review，可挂 Target / Skill / App / Candidate
- 互动能力：点赞、评论、举报
- 身份能力：登录用户 + 匿名用户
- 治理能力：限流、内容风险判定、自动隐藏与审核流

## 4. 架构与部署概览
- 技术栈：Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL + NextAuth
- 架构风格：模块化单体（modules）
- 部署形态（当前仓库）：Docker Compose
  - postgres：数据存储
  - web：Next.js 应用
  - web 直接对外：80 -> 3000

## 5. 模块边界（高层）
- identity：登录身份、匿名身份解析
- skill：Skill 标本 CRUD、分类层架、效果图
- candidate：候选短名单、晋升到工具/画廊
- target：历史工具目录与工具统计
- review：多态评测发布与查询（target/skill/app/candidate）
- comment：评论发布与查询
- like：点赞及基础内容风险判定函数
- moderation：举报、自动折叠、处理状态流转
- rate-limit：行为限流（用户/匿名/IP 段）
- article：文章发布、管理、slug 编码

## 6. 质量策略（核心）
- 单元测试优先覆盖核心业务：发布、鉴权、限流、状态机、风险判定
- 边界/缺陷修复必须补测试
- 目标：守住高风险回归，不追求所有展示层细节测试

## 7. 近期关键风险与约束
- NextAuth 生产环境必须配置正确的 NEXTAUTH_URL（公网域名），不能指向 localhost。
- 代理链路场景下，登录回调 URL 必须做安全归一化，避免错误跳转。
- 当前 web 容器默认启动开发模式，正式生产建议使用 build + start。

## 8. 变更记录

### 2026-07-23 (候选评测 + 多态 Review + 热更新)
- 新增 `Candidate` 模型与 `/candidates` 展览/详情/管理；支持晋升到工具收藏或画廊。
- `Review` 多态挂载：`targetId`（历史保留）+ `skillId` / `appId` / `candidateId`；共用 `ReviewPanel`。
- Skill / 画廊 / 工具详情均可写评测。
- 本地开发切 `NODE_ENV=development` 热更新，避免反复 production build。

### 2026-07-23 (Skill 独立板块)
- 新增独立 Prisma 模型 `Skill`（与 Target 解耦）：提示词、效果图、分类、标签、状态。
- 新模块 `src/modules/skill` + API `/api/skills` + 效果图上传 `/api/uploads/skill-effect`。
- Skill 室全新 UI：分类层架 + 提示词/效果双栏标本；详情可复制；管理页 `/skills/manage`。
- 历史工具目录迁至 `/tools`；主导航 Skill 室只展示新标本。
- 首页精选改用真实 Skill；种子含 5 份示例标本。

### 2026-07-23
- 产品重包装为「空心树洞」，副标题「放下执念，重新生长」。
- 信息架构改为三室：Skill 室 `/skills`、画廊 `/app`（`/gallery` 重定向）、造物台 `/forge`；文章改称洞笔记。
- 历史 `Target`（editor/coding/model/prompt）以 Skill 分类自然陈列，DB 枚举与详情 URL 不变；`/coding`、`/editor` 列表重定向到 Skill 室。
- Target 增量字段：`previewImageUrl` / `sourceUrl` / `compareGroup`；Skill 效果图上传 `/api/uploads/skill-preview`。
- 新增同洞对比页 `/compare?ids=` / `?group=`；造物台草稿接口 `/api/forge/draft`（本地模板，预留模型接入）。
- 更新站点 SEO、导航、页脚、OG 图与 sitemap 静态路由。

### 2026-07-22
- 应用工坊管理页：详细表述改为富文本编辑器；详情页按 HTML 渲染。
- 新增 `/api/uploads/app-preview`，支持预览图本地上传与剪贴板粘贴；`previewImageUrl` 允许 `/` 相对路径。
- docker-compose：补充 `SITE_URL` / `ADMIN_GITHUB_EMAILS`；postgres 改本地 bind mount；nginx 只读挂载 `public/uploads`；默认国内 npm 源调整为华为云。
- `.gitignore` 补充 `*.bak`、`/data/`、`public/uploads/apps/*`。

### 2026-05-20 (evening) 安全与架构加固落地（FEAT-005）

实施 `docs/SECURITY_HARDENING_PLAN.md` Phase 1 + Phase 2，把 `docs/SECURITY_REVIEW_2026-04-01.md` 列出的 R-01 ~ R-08 中的 7 项关闭、1 项部分关闭，并补足配套的可观测/可维护性短板。

Phase 1（无 DB 改动）：

- 鉴权密钥：`src/lib/auth.ts` 在生产模式下对 `NEXTAUTH_SECRET` 做强校验（缺失 / 命中已知弱值 / 长度 < 32 直接 throw）；`docker-compose.yml` 用 `:?` 必填语法；`.env.example` 移除占位字符串。
- 鉴权权限：`/api/tags`、`/api/emojis` 的 POST/DELETE 补 `isAdminSession`，前端 `/tags` 和 `/emojis` 页面把"已登录"语义改为"管理员"。
- 匿名身份：`resolveActorWithFingerprint` 默认 `createIfMissing=false`，GET 路径不再批量制造 `anonymous_users` 行；7 个写入端点显式 opt-in；fingerprint 必须匹配 `[A-Za-z0-9_-]{16,128}`。
- IP 处理：新增 `src/lib/ip.ts`，HMAC-SHA-256 + `LOGWOOD_IP_HASH_SECRET`，`x-forwarded-for` / `x-real-ip` 仅在 `LOGWOOD_TRUST_PROXY=true` 时被信任。
- 安全响应头：`next.config.js` `headers()` 全站下发 HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、CSP（report-only）；nginx 移除已弃用的 X-XSS-Protection。
- 文件上传：`src/lib/file-signature.ts` 实现 magic-byte 校验，两个上传路由读首 32 字节比对，HTML 伪装为 PNG 之类的请求被 400 拒绝；图片扩展名走白名单。
- 输入校验：`src/lib/safe-parse.ts` 提供 `parsePage` / `parsePageSize` / `parseSearchKeyword`；`/api/articles`、`/api/comments/manage` 等 6 处迁移到安全解析；`listTargets` / `getTargetBySlug` 改用 Prisma `_avg` 聚合，避免单 target 上万条评测时全量加载。
- 可观测：新增 `src/lib/logger.ts`（JSON-line 结构化日志 + child binding）与 `src/lib/api-handlers.ts`（`withApiError(tag, handler)` 装饰器，统一 ZodError → 400、ERR_* → 状态码推断、未知错误 → 500 不泄露）。新增 `/api/health` liveness 探针。
- 容器：Dockerfile 装 wget 并加 `HEALTHCHECK` 探活 `/api/health`，`USER bun` 非 root 运行。

Phase 2（DB migration，已使用 `prisma db push` 兼容现有数据）：

- `Target` 增加 `updatedAt @default(now()) @updatedAt`；`sitemap.ts` 简化为直接读取该字段，去掉之前用 review 兜底的逻辑。
- 新增 `AdminAuditLog` 模型与 `User.adminAuditLogs` 反向关系；新增 `src/modules/audit` 模块，写日志失败不抛错、不影响主流程。
- 8 处管理员破坏性接口接入审计：`articles/[id]` PATCH（仅状态变化）+ DELETE、`comments/manage/[id]` PATCH + DELETE、`/api/targets` PATCH + DELETE、`/api/tags/[id]` DELETE、`/api/emojis/[id]` DELETE。
- `RateLimitAction` 增加 `admin_login_attempt` 与 `article_upload`；admin 登录在 `authorize()` 之前先消耗 `admin_login_attempt:ip_segment` 配额（10/IP/UTC+8 day），失败 / 限流均通过 `logger` 记录。

测试：

- 新增 6 个单元测试文件覆盖 ip / file-signature / safe-parse / api-handlers / logger / identity service 中的 createIfMissing 行为。
- 更新 `target/service.test.ts` 与 `sitemap.test.ts` 适配新的 Prisma 调用形状（`_avg` 聚合 / `Target.updatedAt`）。

被推迟的工作（详见 `docs/SECURITY_HARDENING_PLAN.md` §4）：

- CSRF token 替代 `sameSite=lax`。
- `force-dynamic` → ISR / `revalidatePath`。
- Sentry / APM。
- `images.remotePatterns` 从 `**` 收紧到具体域名 allowlist。
- ClamAV 病毒扫描 + 上传迁移到对象存储。
- `Article.tags` / `App.tags` / `Target.features` 从 JSON 字符串迁移为 join 表。
- CSP 从 report-only 切到 enforce（待生产观察 1-2 周）。
### 2026-05-20 (afternoon) 全站 SEO 基础设施落地

实施 `docs/SEO_IMPLEMENTATION_PLAN.md` FEAT-002 与 FEAT-003，所有改动严格遵守"不引入新依赖、不改 Prisma schema、不假设不存在的路由"三条硬性约束：

- 新增 `src/shared/seo/{site-config,url,metadata,json-ld,index}.ts` 工具与 `<JsonLd>` 服务端组件，统一全站 metadata / JSON-LD 输出口径。
- 修复首页 `WebSite` JSON-LD 中失效的 `SearchAction`（站点未实现 `/search`），避免破坏 sitelinks SearchBox 资格。
- `sitemap.ts` 移除 `/submit` `/emojis` `/tags` 三条静态路由；target 行的 `lastModified` 改为「最近一条 published review.updatedAt 兜底 createdAt」（Target 没有 `updatedAt` 字段且本期不改 schema）。
- `robots.ts` 同步将上述三条路径加入 disallow，sitemap 字段输出 absolute URL。
- 站点级 `layout.tsx` 引入 `metadataBase`、Twitter Card、Organization JSON-LD 与默认动态 OG 图 (`/opengraph-image`)；新增 env 驱动的 Google 验证字段。
- 文章详情升级为完整 `BlogPosting` JSON-LD（含 author / publisher / datePublished / dateModified / keywords / articleSection），canonical 用持久化 slug 而不是请求 param。
- 所有详情/列表页（articles/app/editor/coding/model/prompt 共 6 个详情 + 4 个列表）注入 `BreadcrumbList` JSON-LD；详情页加可见 `<Breadcrumbs>` 组件。
- 文章正文 sanitize 抽出到 `src/modules/article/sanitize.ts`，`<h1>` 渲染时降级为 `<h2>` 并强制外链 `rel="noopener noreferrer nofollow"`。
- `getArticleBySlug` 扩展 include `column`，使面包屑能输出真实专栏名（之前 `article.column` 始终为 undefined）。
- 低价值 / 管理 / 认证页通过 8 个路由级 `layout.tsx` 注入 `noindex, nofollow`：`/submit`、`/emojis`、`/tags`、`/auth`、`/articles/manage`、`/app/manage`、`/comments/manage`、`/targets/manage`。
- 新增站点级 `not-found.tsx`，使用语义类（`cyber-card`、`gradient-text`、`text-muted` 等），robots 设为 `index: false, follow: true`。
- 新增可选环境变量 `SITE_URL`（推荐生产显式设置）与 `GOOGLE_SITE_VERIFICATION`，统一 fallback 链 `SITE_URL → NEXTAUTH_URL → 'https://logwood.app'`。
- 新增 6 份 SEO 单元测试：`src/shared/seo/{url,metadata,json-ld}.test.ts`、`src/app/{robots,sitemap}.test.ts`、`src/modules/article/sanitize.test.ts`，使用 zod schema 校验 builder 输出形状（BlogPosting / BreadcrumbList / SoftwareApplication）。

被推迟的工作（不阻塞本期合入）：

- 文章详情与工具详情的动态 OG 图（FEAT-003 S9）：保留站点级 `/opengraph-image` 即可；待评估 Prisma + ImageResponse 在 nodejs runtime 下的稳定性后再补。
- `WebSite.SearchAction`：等 `/search` 路由实现后补回。
- `Target.updatedAt` 字段：现以最近 published review 的 updatedAt 兜底。

### 2026-05-20
- 新增 `docs/SEO_STRATEGY.md`：综合 `docs/seo-claude.md` 与 `docs/seo-codex.md` 的 SEO 建议，结合本仓库实际代码（layout/sitemap/robots/各业务页 generateMetadata/JSON-LD、Prisma schema、反向代理与网络约束），输出 866 行的本期 SEO 单一权威指导文档。所有未来 SEO 改动以此为准。
- 新增 `docs/SEO_IMPLEMENTATION_PLAN.md`：FEAT-002（基础设施）/ FEAT-003（详情页升级）/ FEAT-004（文档同步）的可执行任务清单，包含 steps、acceptance criteria、verification 命令。
- 本期 SEO 实施约束：严格不引入新 npm 依赖（仅使用 Next.js 14 内置 + 已有依赖）；不修改 Prisma schema（`Target.updatedAt` 通过最近 published review.updatedAt 兜底）；不假设不存在的路由（`/search`、`/compare`、专栏/标签 landing 等列入未来工作）。
- 实施时机：本次 commit 仅包含策略与计划文档，代码改动（FEAT-002/003）由后续会话按 `docs/SEO_IMPLEMENTATION_PLAN.md` 执行。

### 2026-04-02
- Docker 构建链路切换为可配置国内源：
  - Debian apt 默认使用清华 HTTP 镜像，避免基础镜像首次构建时因缺少 CA 证书导致握手失败。
  - npm 默认使用 npmmirror。
  - Prisma engines 默认使用 npmmirror 二进制镜像。
- docker-compose 为 web 服务补充镜像源相关 build args / runtime env，确保镜像构建和容器内 `npm ci` 均走国内源。

### 2026-03-13
- 修复登录可能跳转 localhost 的问题：
  - 增加回调地址清洗逻辑，阻断 localhost 绝对地址。
  - 增加生产环境 NEXTAUTH_URL 启动校验。
- 增补核心模块单元测试：comment、target、rate-limit、identity callback URL。
- 部署入口策略调整为 web 直接暴露 80:3000，由外部代理层接管后续转发策略。
- 首页信息架构调整为 3 个主入口：AI Coding、应用工坊、阅读社区文章。
- 首页统计口径同步调整：展示 AI Coding 4 个分区、收录工具总数、内容沉淀总量（评测 + 文章）。
- AI Coding 页面改造为四分类聚合入口：AI Editor、AI Coding、AI Model、AI Prompt。
- 新增评测目标管理入口与应用工坊 `/app`、`/app/manage` 页面及基础数据结构。
- 应用工坊管理页新增历史应用编辑能力：支持回填已创建应用并更新内容，保留原有 slug 稳定性。
- 新增统一标签池能力：标签全站通用（不再按板块区分），支持“好/不好”两类，并在目标管理、应用管理、文章管理中支持多标签选择与快速创建。
- 新增标签展示页 `/tags`，支持通过 `+` 新增标签，并在标签右上角 `x` 删除标签。
- 抽取统一站点页脚组件并接入首页、AI Coding、应用工坊、社区文章；页脚在三大板块下新增“标签”入口。
- 应用工坊管理策略调整：编辑 App 时若名称变更，将同步重算并更新 slug（URL 会随名称变化）。
- 社区文章新增“专栏”维度：创建文章可选择所属专栏，并可在创建时新增专栏；内置基础专栏 `vibe coding`、`Vision`、`Robot`。
- 社区文章导航调整为与首页一致，并额外保留“文章管理”入口。
- 抽取统一站点导航组件，复用于 AI Coding / 应用工坊 / 社区文章，统一间距、字体权重与按钮宽度，降低页面切换时的视觉晃动。

## 9. 下阶段计划（简版）
1. 部署模式切换为生产运行（Next.js build + start），拆分 dev/prod compose。
2. 增补核心 API 集成测试（articles/reviews/comments）。
3. 为审核与限流补充可观测指标（命中率、拦截率、误判率）。
4. 增加发布前检查流程：强制校验 PROJECT_PLAN 变更记录更新。

### 9.1 SEO 后续项

5. 实现站内搜索 `/search` 后，补回 `WebSite.SearchAction` JSON-LD（移动端 sitelinks SearchBox 资格）。
6. 为 `Target` 模型补 `updatedAt` 字段；现阶段 sitemap lastmod 用最近 published review.updatedAt 兜底，受评测节奏影响精度有限。
7. 专栏 / 标签 landing 页路径化：`/articles/columns/[slug]`、`/topics/[slug]`，让现在依靠 query string 的筛选页拥有可索引的 canonical URL。
8. 公开页从 `force-dynamic` 迁移到 ISR / `revalidatePath`，提升爬虫体验与首屏指标。
9. 详情页动态 OG 图（文章详情 + 工具详情），与本期推迟项配套实现。
10. SEO 集成验证：在 CI 跑通 `next build` 后增加站点抓取契约测试（robots.txt / sitemap.xml / 单页 JSON-LD 形状）。
