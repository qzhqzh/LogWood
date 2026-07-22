# LogWood 项目计划书

## 1. 文档目的

本文件用于快速理解项目现状、执行计划、架构边界、风险和近期变更。

文档职责：

- 产品定位、用户价值、内容对象和长期信息架构以 [`PRODUCT_POSITIONING.md`](./PRODUCT_POSITIONING.md) 为唯一权威来源。
- 本文件只记录当前实现、技术边界、迁移阶段、风险和近期计划。
- `SPEC.md` 记录旧评测 MVP 的历史执行规格；新能力必须先在产品定位和迁移方案中明确，再进入执行规格。

维护规则（强制）：

- 涉及功能新增、功能修复、架构调整、部署策略或数据迁移时，必须同步更新本文件。
- 代码评审时将本文件更新作为必检项。
- 新成员应依次阅读：`PRODUCT_POSITIONING.md` → 本文件 → SPEC / 模块文档。

## 2. 项目定位

- 项目名称：**空心树洞**（仓库名保留 `LogWood`）
- 品牌副标题：**大浪淘沙，找寻灵感**
- 功能定位：**AI 灵感炼成与实践沉淀社区**
- 核心目标：把随手灵感和外部资源，经由试用、评测、修订与打包，逐步炼成可复用、可验证、可快速上手的模板、提示词、工作流和技能包；同时保存沿途的吐槽、失败、讨论、技术小结和深度反思。

产品采用“一条生命线、两条并行轨道”：

1. 资产进化线：灵感 / 资源 → 候选 → 试用 → 验证 → 可复用 Skill → 技能包 → 维护或归档。
2. 经验沉淀线：吐槽 / 快评 → 讨论 / 求证 → 实验记录 → 技术小结 → 评测报告 / 前沿观点 / 复盘反思。

整体升级由 [Issue #15](../../issues/15) 跟踪。

## 3. 当前范围（Core Scope）

当前代码已经完成双线定位的第一阶段运行时收口，但持久化模型仍处于旧结构和目标模型之间的过渡期。

- 找灵感：`/candidates`（复用现有 Candidate 模型，公共页面已改为灵感池 / 待测清单语义；管理 `/candidates/manage`）
- Skill 库：`/skills`（独立 `Skill` 模型，当前以 Prompt × Effect 为主；管理 `/skills/manage`）
- 吐槽室：`/talk`（聚合 Target / Skill / App / Candidate 上的公开自由评测和回复数量）
- 洞笔记：`/articles`（文章、专栏、评论和点赞）
- 资源收藏：`/tools`（历史 Target / 评测；`/coding`、`/editor` 列表重定向至此）
- 案例画廊：`/app`（当前 App / 项目 / 示例站；未来映射为 Resource 或 Skill Example）
- AI 炼成助手：`/forge`（确定性本地模板；洞笔记草稿写 Article，Skill 草稿写独立 Skill；尚未接入真实模型）
- 评测闭环：多态 Review，可挂 Target / Skill / App / Candidate
- 互动能力：点赞、评论、举报
- 身份能力：登录用户 + 匿名用户
- 治理能力：限流、内容风险判定、自动隐藏与审核流

一级导航已收口为：找灵感 / Skill 库 / 吐槽室 / 洞笔记。资源收藏、案例画廊和 AI 炼成助手保留为辅助入口，旧路由均继续可访问。

## 4. 架构与部署概览

- 技术栈：Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL + NextAuth
- 架构风格：模块化单体（`src/modules`）
- 部署形态（当前仓库）：Docker Compose
  - `postgres`：数据存储
  - `web`：Next.js 应用
  - `web` 直接对外：80 → 3000，或由外部代理接管

## 5. 模块边界（高层）

- `identity`：登录身份、匿名身份解析
- `skill`：Skill CRUD、分类、效果图和草稿状态
- `candidate`：当前灵感 / 候选短名单、晋升到工具 / 画廊
- `target`：历史模型、软件、工具和 Prompt 目录
- `app`：当前画廊、应用和项目内容
- `review`：多态评测发布与查询（target / skill / app / candidate）
- `comment`：评论发布与查询
- `like`：点赞及基础内容风险判定函数
- `moderation`：举报、自动折叠、处理状态流转
- `rate-limit`：行为限流（用户 / 匿名 / IP 段）
- `article` / `article-column`：洞笔记、专栏、发布与管理
- `forge`：确定性本地草稿整理；不代表真实模型能力
- `src/shared/reviews/subject.ts`：把当前四种多态 Review Subject 适配为统一展示形状

迁移方向：先通过展示适配层统一 Subject / Resource 语义，再设计成熟度状态和数据迁移；不得为模型整洁牺牲历史内容和 URL。

## 6. 质量策略（核心）

- 单元测试优先覆盖核心业务：发布、鉴权、限流、状态机、风险判定和迁移映射。
- 边界或缺陷修复必须补测试。
- 数据迁移必须支持 dry-run、统计核对、可重复执行和回滚。
- 核心生命线需要 API 集成测试和少量端到端测试。
- Forge 必须测试 Article / Skill 写入目标、Legacy 输入兼容和短输入校验。
- Sitemap 必须测试公开 Skill 详情和 `/talk`。
- 目标是守住高风险回归，不追求所有展示层细节测试。

## 7. 近期关键风险与约束

### 产品与数据风险

- Candidate 晋升仍会创建新的 Target 或 App，候选阶段 Review 仍挂在旧 Candidate 上，历史连续性问题尚未解决。
- Review 仍只有五星和自由文本；`/talk` 当前是兼容聚合视图，还没有 `Evaluation` / `Quick Take` 的持久化分型。
- Target、Skill、App、Candidate 仍是四种持久化对象；统一展示适配层已经建立，但统一详情页和 Resource 模型尚未完成。
- Skill 当前仍以 Prompt、效果图和标签为主，尚未持久化版本、输入契约、依赖、Quick Start、失败边界和验证时间。
- AI 炼成助手仍只做本地模板整理，公开文案与代码不得暗示已经接入真实模型、自动验证或生成证据。
- 旧 README、SPEC 和近期包装曾出现不同产品定位；后续以 `PRODUCT_POSITIONING.md` 为唯一准绳。

### 运行与安全风险

- NextAuth 生产环境必须配置正确的 `NEXTAUTH_URL`（公网域名），不能指向 localhost。
- 代理链路场景下，登录回调 URL 必须做安全归一化，避免错误跳转。
- 当前 web 容器可运行开发模式，正式生产应使用 build + start。
- 上传文件仍需继续推进对象存储、病毒扫描和域名白名单收紧。

## 8. 变更记录

### 2026-07-23（双线生命线运行时 Phase 1）

- 站点副标题、默认 metadata、关键词和 OG 图更新为“**大浪淘沙，找寻灵感**”。
- 一级导航从 Skill 室 / 候选评测 / 画廊 / 造物台，收口为找灵感 / Skill 库 / 吐槽室 / 洞笔记；旧入口保留在页脚。
- 首页按双线生命线重构：最近炼成的 Skill、正在淘洗的灵感、真实记录、洞笔记和透明的 AI Beta 入口。
- `/candidates` 在不改表和路由的前提下重述为灵感池；详情页强调真实试用、验证或淘汰。
- `/skills` 重述为可复用资产库，并明确当前为 Prompt 型 Skill 的过渡版本。
- 新增 `/talk`，聚合四种 Review Subject 的公开真实记录；新增统一 Subject 展示适配器与测试。
- Forge 的 Skill 草稿从错误的 `createTarget()` 改为 `createSkill()`，保留旧 `TargetType` 客户端兼容；增加分类选择和单元测试。
- Sitemap 新增 `/talk` 和全部 published Skill 详情 URL，并更新测试。
- 本阶段不修改 Prisma schema、不迁移历史数据、不删除旧路由。

### 2026-07-23（双线生命线产品定位）

- 品牌副标题确定为“**大浪淘沙，找寻灵感**”。
- 产品从“Skill 库 + 画廊 + 造物台”的并列栏目叙事，收口为“一条生命线、两条轨道”：资产进化线与经验沉淀线。
- 新增 `docs/PRODUCT_POSITIONING.md`，作为产品定义 SSOT。
- README 改为从灵感 / 资源到可复用 Skill、以及吐槽 / 文章沉淀的双线叙事。
- 明确目标信息架构：找灵感 / Skill 库 / 吐槽室 / 洞笔记；Candidate、Gallery、Forge 分别转为生命周期状态、案例 / 资源和 AI 辅助能力。
- 本次只调整产品规范与文档，不修改数据库、路由和运行时行为；后续实施由 Issue #15 分阶段推进。

### 2026-07-23（候选评测 + 多态 Review + 热更新）

- 新增 `Candidate` 模型与 `/candidates` 展览 / 详情 / 管理；支持晋升到工具收藏或画廊。
- `Review` 多态挂载：`targetId`（历史保留）+ `skillId` / `appId` / `candidateId`；共用 `ReviewPanel`。
- Skill / 画廊 / 工具详情均可写评测。
- 本地开发切 `NODE_ENV=development` 热更新，避免反复 production build。

### 2026-07-23（Skill 独立板块）

- 新增独立 Prisma 模型 `Skill`（与 Target 解耦）：提示词、效果图、分类、标签、状态。
- 新模块 `src/modules/skill` + API `/api/skills` + 效果图上传 `/api/uploads/skill-effect`。
- Skill 室全新 UI：分类层架 + 提示词 / 效果双栏标本；详情可复制；管理页 `/skills/manage`。
- 历史工具目录迁至 `/tools`；主导航 Skill 室只展示新标本。
- 首页精选改用真实 Skill；种子含 5 份示例标本。

### 2026-07-23（个人策展包装，已被新定位继承并收口）

- 产品重包装为“空心树洞”，当时副标题为“放下执念，重新生长”。
- 信息架构改为 Skill 室 `/skills`、画廊 `/app`、造物台 `/forge`；文章改称洞笔记。
- 历史 `Target`（editor / coding / model / prompt）以 Skill 分类陈列，DB 枚举与详情 URL 不变；`/coding`、`/editor` 列表重定向。
- Target 增量字段：`previewImageUrl` / `sourceUrl` / `compareGroup`；Skill 效果图上传 `/api/uploads/skill-preview`。
- 新增同洞对比页 `/compare?ids=` / `?group=`；造物台草稿接口 `/api/forge/draft`（本地模板，预留模型接入）。
- 更新站点 SEO、导航、页脚、OG 图与 sitemap 静态路由。

### 2026-07-22

- 应用工坊管理页：详细表述改为富文本编辑器；详情页按 HTML 渲染。
- 新增 `/api/uploads/app-preview`，支持预览图本地上传与剪贴板粘贴；`previewImageUrl` 允许 `/` 相对路径。
- docker-compose：补充 `SITE_URL` / `ADMIN_GITHUB_EMAILS`；postgres 改本地 bind mount；nginx 只读挂载 `public/uploads`；默认国内 npm 源调整为华为云。
- `.gitignore` 补充 `*.bak`、`/data/`、`public/uploads/apps/*`。

### 2026-05-20（安全与架构加固落地，FEAT-005）

实施 `docs/SECURITY_HARDENING_PLAN.md` Phase 1 + Phase 2，把 `docs/SECURITY_REVIEW_2026-04-01.md` 列出的 R-01 ~ R-08 中的 7 项关闭、1 项部分关闭，并补足配套的可观测 / 可维护性短板。

Phase 1（无 DB 改动）：

- 鉴权密钥：生产模式下对 `NEXTAUTH_SECRET` 做强校验；Compose 使用必填语法；示例环境移除弱占位值。
- 鉴权权限：标签、Emoji 等写接口补管理员校验。
- 匿名身份：GET 路径不再批量创建匿名用户；写入端点显式 opt-in；fingerprint 使用格式白名单。
- IP 处理：HMAC-SHA-256 哈希；仅在显式信任代理时读取转发头。
- 安全响应头：HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、CSP report-only。
- 文件上传：magic-byte 校验与图片扩展名白名单。
- 输入校验：统一页码、页大小和搜索词安全解析；目标统计改为 Prisma 聚合。
- 可观测：结构化日志、统一 API 错误包装和 `/api/health`。
- 容器：健康检查与非 root 运行。

Phase 2（DB 增量）：

- `Target` 增加 `updatedAt`。
- 新增 `AdminAuditLog` 和管理员破坏性操作审计。
- 管理员登录和文章上传纳入 RateLimitAction。
- 新增单元测试并更新 target / sitemap 测试。

仍待推进：

- CSRF token 替代仅依赖 `sameSite=lax`。
- Sentry / APM。
- ClamAV 和对象存储。
- `Article.tags` / `App.tags` / `Target.features` 从 JSON 字符串迁移为关联表。
- CSP 从 report-only 切换为 enforce。

### 2026-05-20（全站 SEO 基础设施）

- 新增 `src/shared/seo/` 工具，统一 metadata、canonical、OG、Twitter 和 JSON-LD。
- 修复无效 SearchAction；站内搜索完成后再补回。
- 增加 sitemap、robots、站点级和详情页结构化数据。
- 文章正文 sanitize 抽取并强化外链安全。
- 低价值、管理和认证页增加 noindex / nofollow。
- 新增站点级 not-found、可选 SITE_URL 和 Google verification。
- 新增 SEO 单元测试。
- 详细决策与维护约束见 `docs/SEO_STRATEGY.md`。

### 2026-04-02

- Docker 构建链路切换为可配置国内源。
- Debian apt 默认使用清华 HTTP 镜像，npm 和 Prisma 使用可配置镜像。
- docker-compose 补充 build args / runtime env。

### 2026-03-13

- 修复登录可能跳转 localhost 的问题，并增加生产环境 NEXTAUTH_URL 启动校验。
- 增补 comment、target、rate-limit、identity callback URL 单元测试。
- 部署入口调整为 web 直接暴露端口，由外部代理接管。
- 首页调整为 AI Coding、应用工坊、社区文章三个入口。
- AI Coding 聚合 Editor、Coding、Model、Prompt。
- 新增应用工坊、标签池、专栏和统一导航 / 页脚。

## 9. 下阶段计划

### 9.1 产品与数据（Issue #15）

1. 设计 Resource / Skill 成熟度状态 ADR 与统一详情页数据契约。
2. 修复 Candidate 晋升导致的历史 Review 割裂。
3. 区分 Evaluation 与 Quick Take，设计并迁移版本化评测 schema。
4. 为吐槽室增加内容类型、关联版本、证据和发布入口。
5. 扩展 Skill 的版本、依赖、输入输出契约、Quick Start、验证记录和技能包关系。
6. 编写 Target / Candidate / App / Skill 历史映射、dry-run、核对和回滚方案。
7. 在上述模型稳定后，接入真实 AI 炼成能力并保留来源、模型、时间和人工确认。

### 9.2 工程与部署

1. 部署模式切换为稳定的 production build + start，并拆分 dev / prod Compose。
2. 增补核心 API 集成测试：articles / reviews / comments / skills / candidates / forge。
3. 为审核、限流和迁移补充可观测指标。
4. 增加发布前检查：校验 PROJECT_PLAN 与相关产品文档是否同步更新。
5. 为首页、灵感池、吐槽室和 Skill 生命周期补少量 E2E。

### 9.3 SEO 后续项

1. 实现站内搜索后补回 `WebSite.SearchAction`。
2. 将专栏 / 标签筛选升级为可索引 landing 路径。
3. 为文章、Resource 和 Skill 详情生成动态 OG 图。
4. 在 CI 的 `next build` 后增加 robots、sitemap 和 JSON-LD 抓取契约测试。
