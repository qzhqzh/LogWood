# LogWood 历史评测 MVP 规格（Legacy）

> **文档状态：历史执行规格，不再定义当前产品定位。**  
> 当前产品定义以 [`docs/PRODUCT_POSITIONING.md`](./docs/PRODUCT_POSITIONING.md) 为唯一权威来源；当前实现、风险和迁移计划见 [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md)；双线生命线升级由 [Issue #15](../../issues/15) 跟踪。
>
> 本文件仍用于理解最初评测、互动、限流和治理闭环。新增功能不得继续扩大这里“AI 编码工具评测社区”“Target 只有 editor/coding”等历史假设；接口和数据模型应同时核对当前代码与模块文档。

## 1. 文档目的

本规划最初用于指导 LogWood MVP 到 Phase 3 的实现与验收，确保范围、接口、约束、风控、测试和里程碑可直接执行。

当前用途：

- 保存最初评测闭环的设计依据。
- 为历史数据和旧路由兼容提供参考。
- 帮助判断哪些能力可以被 Resource / Skill / Evaluation / Quick Take 新模型继续复用。

## 2. 历史产品定位与目标

- 历史产品名称：LogWood（AI 编码工具评测社区）
- 历史核心价值：沉淀真实评测数据，帮助用户比较 AI Editor / AI Coding 工具在不同能力维度上的表现
- 历史 MVP 核心闭环：工具页 → 发布评测 → 浏览排序 → 点赞评论 → 举报治理

> 现定位为“空心树洞——大浪淘沙，找寻灵感”，围绕资产进化线与经验沉淀线持续演进；参见 `docs/PRODUCT_POSITIONING.md`。

## 3. 已锁定决策（历史 MVP）

- 首发策略：评测闭环优先
- 匿名策略：完全开放（可发评、评论、点赞）+ 基础风控
- 定价信息：MVP 不做自动同步
- 认证策略：邮箱魔法链接 + 可选 GitHub OAuth
- 国际化：界面中文，内容多语言
- 技术架构：Next.js + Prisma + PostgreSQL，不做微服务拆分

## 4. 分期范围

### 4.1 Phase 1（MVP，4-6 周）
- 工具目录：`/editor`、`/coding`
- 工具详情：`/:type/[slug]`
- 评测系统：发布、列表、详情、排序（latest/hot）
- 互动系统：点赞、评论
- 举报系统：review/comment 举报
- 身份体系：匿名 + 登录用户（Email/GitHub）
- 基础风控：限流、敏感词、可疑内容转 pending

### 4.2 Phase 2（治理与运营，2-3 周）
- 审核台：审核、封禁、申诉
- 反刷增强：设备/IP/行为评分
- 排序升级：时间衰减 + 质量分

### 4.3 Phase 3（增长与数据化，2-4 周）
- 榜单 2.0：按分类、时间窗口、工具类型
- 用户中心增强：贡献值、草稿
- 定价模块：先人工维护，后续评估自动同步

## 5. 技术与模块划分

### 5.1 技术栈
- 前端：Next.js 14 App Router + TypeScript + Tailwind CSS
- 后端：Next.js Route Handlers + Service Layer
- 数据库：PostgreSQL + Prisma ORM
- 认证：NextAuth.js
- 部署：Vercel

### 5.2 服务模块
- `reviewService`：评测发布、查询、排序、状态流转
- `likeService`：点赞幂等、计数维护
- `commentService`：评论发布、查询、状态流转
- `moderationService`：敏感词、举报、折叠与审核策略
- `rateLimitService`：匿名/登录/IP 维度限流与审计

## 6. 数据模型（历史执行版）

### 6.1 枚举定义
- `TargetType`: `editor | coding`
- `ReviewStatus`: `published | pending | hidden | deleted`
- `CommentStatus`: `published | pending | hidden | deleted`
- `ReportTargetType`: `review | comment`
- `ReportStatus`: `open | resolved | rejected`

> 当前 Prisma schema 已扩展 Model、Prompt、Skill、Candidate、App、多态 Review 等能力；本节只表示最初设计，不是当前 schema 的准确清单。

### 6.2 表结构与关键约束

#### users
- `id`, `email(unique)`, `name`, `avatarUrl`, `createdAt`, `updatedAt`

#### anonymous_users
- `id`
- `deviceFingerprint(unique)`
- `displayName`
- `sequenceNumber`
- `riskLevel`（默认 0）
- `lastSeenAt`
- `createdAt`

#### targets
- `id`, `name`, `slug(unique)`, `type`, `logoUrl`, `description`, `websiteUrl`, `developer`, `features[]`, `createdAt`

#### reviews
- `id`
- `userId(nullable)`
- `anonymousUserId(nullable)`
- `targetId`
- `category`
- `content`（50-2000）
- `rating`（1-5）
- `language`
- `status`（默认 `published`）
- `qualityScore`（默认 0）
- `likesCount`（默认 0）
- `reportsCount`（默认 0）
- `createdAt`, `updatedAt`
- 约束：`CHECK ((user_id IS NOT NULL) <> (anonymous_user_id IS NOT NULL))`

#### review_likes
- `id`, `reviewId`, `userId(nullable)`, `anonymousUserId(nullable)`, `createdAt`
- 唯一键：`(reviewId, userId)`、`(reviewId, anonymousUserId)`

#### comments
- `id`, `reviewId`, `userId(nullable)`, `anonymousUserId(nullable)`
- `content`（10-500）
- `language`
- `status`（默认 `published`）
- `likesCount`（默认 0）
- `reportsCount`（默认 0）
- `createdAt`
- 约束：`CHECK ((user_id IS NOT NULL) <> (anonymous_user_id IS NOT NULL))`

#### comment_likes
- `id`, `commentId`, `userId(nullable)`, `anonymousUserId(nullable)`, `createdAt`
- 唯一键：`(commentId, userId)`、`(commentId, anonymousUserId)`

#### reports
- `id`
- `targetType`（review/comment）
- `targetId`
- `reason`
- `reporterUserId(nullable)`
- `reporterAnonymousId(nullable)`
- `status`（open/resolved/rejected）
- `createdAt`, `updatedAt`
- 约束：举报人身份二选一

#### rate_limits
- `id`
- `action`（`review_create | comment_create | like_create | report_create`）
- `actorType`（`user | anonymous | ip_segment`）
- `actorKey`
- `windowDate`（UTC+8 自然日）
- `count`
- `updatedAt`
- 唯一键：`(action, actorType, actorKey, windowDate)`

## 7. API 契约（历史 Phase 1）

### 7.1 POST `/api/reviews`
- 入参：`targetId, category, rating, content, language`
- 校验：评分 1-5；内容 50-2000
- 行为：
  - 执行限流
  - 敏感词/风险评分，命中则 `status=pending`
  - 写入 reviews
- 出参：`id, status, createdAt`

### 7.2 GET `/api/reviews`
- 查询参数：`sort=latest|hot`, `category`, `targetId`, `language`, `page`, `pageSize`
- 默认：`sort=latest`, `pageSize=20`
- 行为：只返回 `status=published`

### 7.3 POST `/api/reviews/:id/like`
- 行为：幂等点赞（重复点赞成功返回，不重复计数）
- 限流：按用户/匿名/IP 执行
- 出参：`liked=true`, `likesCount`

### 7.4 POST `/api/comments`
- 入参：`reviewId, content, language`
- 校验：内容 10-500
- 行为：限流 + 风控；命中风险可 `pending`
- 出参：`id, status, createdAt`

### 7.5 POST `/api/reports`
- 入参：`targetType, targetId, reason`
- 行为：创建举报；累计达到阈值触发自动折叠（`hidden`）
- 出参：`id, status=open`

## 8. 限流与风控策略（MVP 默认）
- 时间口径：UTC+8 自然日
- 匿名用户：
  - 发评 `<= 5/日`
  - 评论 `<= 20/日`
  - 点赞 `<= 30/日`
- 登录用户：
  - 发评 `<= 10/日`
  - 点赞 `<= 50/日`
- IP 段总互动：`<= 200/日`
- 风险动作：
  - 命中敏感词或高风险行为 → `pending`
  - 举报累计到阈值 → 自动 `hidden`

## 9. 页面与路由（历史规划）
- `/`：热门评测、最新评测、分类入口
- `/editor`、`/coding`：工具列表（支持筛选）
- `/:type/[slug]`：工具详情 + 该工具评测流
- `/review/[id]`：评测正文、点赞、评论、举报
- `/submit`：提交评测
- `/profile`：我的评测、我的互动、设置（匿名用户展示本机历史）

> 当前路由已包含 `/skills`、`/candidates`、`/tools`、`/app`、`/forge` 和 `/articles`；以代码和 `PROJECT_PLAN.md` 为准。

## 10. 测试与验收

### 10.1 测试用例
- 模型约束：身份互斥、点赞唯一键
- 接口边界：评分/长度限制、限流响应码
- 业务行为：pending 不公开、hot 排序正确、幂等点赞
- E2E：
  - 匿名发布 → 浏览 → 举报 → 折叠
  - 登录发布 → 评论互动 → 个人中心可见
  - 多语言内容发布与检索

### 10.2 Phase 1 DoD
- 核心页面全部可用
- 发布/点赞/评论/举报接口通过集成测试
- 基础风控可配置且生效
- 观测指标可用：DAU、发布量、举报率、折叠率

## 11. 历史里程碑
- Week 1：Prisma Schema + 认证打通
- Week 2：评测 API + 页面（发布/列表/详情）
- Week 3：点赞评论 + 限流 + 举报
- Week 4：排序、最小审核台、监控埋点、联调验收
- Week 5-6：性能优化、灰度修复、文档完善

## 12. 风险与缓解
- 风险：匿名开放导致噪音上升
  - 缓解：pending 审核、举报折叠、限流
- 风险：热门排序被短期刷量影响
  - 缓解：时间衰减 + 质量分（Phase 2）
- 风险：接口与模型不同步
  - 缓解：先 schema 再 API，契约测试强约束

## 13. 非目标（历史 MVP）
- 官方定价自动抓取
- 复杂推荐系统
- 多端原生 App

---

原文最后更新：2026-02-24  
Legacy 标记与产品定位链接更新：2026-07-23
