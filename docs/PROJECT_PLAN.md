# LogWood 项目计划书

## 1. 文档目的

本文件用于快速理解项目现状、执行计划、架构边界、风险和近期变更。

文档职责：

- 产品定位、用户价值、内容对象和长期信息架构以 [`PRODUCT_POSITIONING.md`](./PRODUCT_POSITIONING.md) 为唯一权威来源。
- 正式评测协议以 [`EVALUATION_PROTOCOL_V2.md`](./EVALUATION_PROTOCOL_V2.md) 为准。
- 本文件只记录当前实现、技术边界、迁移阶段、风险和近期计划。
- `SPEC.md` 是旧评测 MVP 的历史执行规格，不再定义当前产品。

维护规则（强制）：

- 涉及功能、架构、数据库 schema、部署策略或数据迁移时，必须同步更新本文件。
- 代码评审将本文件更新作为必检项。
- 新成员应依次阅读：`PRODUCT_POSITIONING.md` → 本文件 → 专项协议 / 模块文档。

## 2. 项目定位

- 项目名称：**空心树洞**（仓库名保留 `LogWood`）
- 品牌副标题：**大浪淘沙，找寻灵感**
- 功能定位：**AI 灵感炼成与实践沉淀社区**
- 核心目标：将随手灵感和外部资源，经由试用、评测、修订和打包，逐步炼成可复用、可验证、可快速上手的模板、提示词、工作流和技能包；同时保存沿途的吐槽、失败、讨论、技术小结和深度反思。

产品采用“一条生命线、两条轨道”：

1. 资产进化线：灵感 / 资源 → 观察 → 试用 → 正式评测 → 可复用 Skill → 技能包 → 维护或归档。
2. 经验沉淀线：自由记录 / 吐槽 → 讨论 / 求证 → 实验与失败样本 → 正式评测 / 技术小结 → 复盘反思。

整体升级由 GitHub Issue #15 跟踪。

## 3. 当前范围

当前已完成产品定位、运行时 Phase 1 和 Evaluation v2 正式评测层。持久化模型仍处于兼容旧结构、逐步演进的阶段。

### 3.1 公开能力

- 找灵感：`/candidates`
  - 复用现有 Candidate 模型，作为灵感池和待测清单。
- Skill 库：`/skills`
  - 独立 Skill 模型；当前主要为 Prompt × Effect 型资产。
- 正式评测：`/evaluations`
  - Evaluation v2 聚合与协议筛选。
  - 详情 `/evaluations/[id]` 展示对象版本、环境、任务、证据、复现级别、维度评分、限制和结论。
- 吐槽室：`/talk`
  - 聚合历史 Review 自由记录、提问和吐槽。
- 洞笔记：`/articles`
- 资源收藏：`/tools`
  - 保留历史 Target、Editor、Coding、Model、Prompt 数据和详情 URL。
- 案例画廊：`/app`
- AI 炼成助手：`/forge`
  - 确定性本地模板；尚未接入真实模型。

Target、Skill、App、Candidate 详情现在同时展示：

1. Evaluation v2 正式评测；
2. Review 自由记录 / Quick Take 兼容内容。

### 3.2 管理能力

- 灵感管理：`/candidates/manage`
- Skill 管理：`/skills/manage`
- 正式评测工作台：`/evaluations/manage`
  - 管理员创建、编辑、发布和归档 Evaluation。
  - 自动根据对象匹配 Skill / 模型 / 软件 / 普通资源协议。
  - 所有 Evaluation 写操作进入 AdminAuditLog。
- Article、App、Target、评论和标签原管理能力继续保留。

### 3.3 评测语义

- `Review`：自由记录、第一感受、吐槽、提问和阶段性判断；历史数据完全保留。
- `Evaluation`：正式、证据优先、协议版本化的评测。
- 本阶段不将历史 Review 自动迁移为 Evaluation。

## 4. 架构与部署

- 技术栈：Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL + NextAuth
- 架构风格：模块化单体（`src/modules`）
- 部署：Docker Compose；生产建议 build + start
- 数据库更新：当前仓库启动链路使用 `prisma db push`；正式环境应在执行前审阅 schema diff 和备份策略。

Evaluation v2 上线要求：

```bash
bun run db:generate
bun run db:push
bun run test
bunx tsc --noEmit
bun run build
```

## 5. 模块边界

- `identity`：登录和匿名身份
- `skill`：Skill CRUD、分类、效果图和草稿
- `candidate`：灵感 / 候选及现有晋升流程
- `target`：历史模型、软件、工具和 Prompt 资源
- `app`：案例、应用和项目
- `review`：自由记录，多态关联 Target / Skill / App / Candidate
- `evaluation`：Evaluation v2 协议、发布门禁、查询和持久化
- `comment` / `like`：Review 互动
- `moderation` / `rate-limit`：治理和行为限流
- `article` / `article-column`：洞笔记
- `forge`：本地草稿整理
- `audit`：管理员状态变更审计
- `src/shared/reviews/subject.ts`：当前多态对象统一展示适配

迁移策略：先用适配层统一公开语义，再设计 Resource、版本和成熟度状态；不得为模型整洁牺牲历史内容、互动或 URL。

## 6. Evaluation v2 实现约束

### 6.1 协议

支持四类协议：

- Skill
- 模型
- 软件 / 服务
- 普通资源

协议维度和发布规则集中在 `src/modules/evaluation/constants.ts` 与 `docs/EVALUATION_PROTOCOL_V2.md`。修改维度键属于协议变更，必须提升 `protocolVersion` 或提供兼容解释。

### 6.2 发布门禁

Evaluation 只有满足以下条件才能发布：

- 对象存在且协议匹配；
- 全部协议维度评分已填写，范围 `0-10`；
- 有可审阅输出或至少一条证据；
- 复现级别不是 `untested`；
- 重复 / 独立复现时运行次数至少两次；
- 标题、任务和结论达到最低完整度。

草稿允许逐步补齐。首期只允许管理员写入，不提供物理删除，使用 `archived` 保留审计历史。

### 6.3 SEO

- `/evaluations` 和已发布详情进入 sitemap。
- 草稿、归档和管理页面不公开索引。
- 管理页有 noindex，并在 robots 中 disallow。
- 暂不输出 ClaimReview / Review JSON-LD，避免在协议和版本关系尚未稳定时作错误结构化声明。

## 7. 质量策略

- 单元测试优先覆盖协议匹配、发布门禁、状态机和数据兼容。
- API 集成测试应覆盖鉴权、Zod 校验、错误码和数据库写入。
- 核心 E2E 应覆盖：草稿 → 补证据 → 发布 → 对象详情可见 → sitemap 可见。
- 数据迁移必须支持 dry-run、数量核对、可重复执行和回滚。
- Candidate 晋升或 Subject 迁移必须证明 Review、Comment、Like 和 Evaluation 仍可访问。

本阶段新增测试：

- `src/modules/evaluation/service.test.ts`
- `src/app/sitemap.test.ts` 的 Evaluation 覆盖

仍需补充：

- `/api/evaluations` 集成测试；
- 管理工作台 E2E；
- 真实数据库下的 Prisma schema 更新验证。

## 8. 关键风险

### 产品与数据

- Candidate 晋升仍会创建新的 Target / App；Review 与 Evaluation 的历史连续性尚未解决。
- Target、Skill、App、Candidate 仍是四种持久化对象；统一 Resource 模型尚未落地。
- Evaluation 当前直接关联对象，不关联明确的 ResourceVersion / SkillVersion；`subjectVersion` 仍是文本。
- 协议维度由代码常量定义，没有在每条 Evaluation 中保存完整协议快照；未来修改必须严格版本化。
- Evidence 当前是 JSON 引用，尚无独立附件表、文件完整性、签名和失效检查。
- 维度综合分暂时等权平均，只用于摘要，不应被解释为官方排名。
- 正式评测仅管理员可写；开放社区投稿前需要审核、信誉、限流和证据治理。

### 运行与安全

- 生产环境必须正确配置 `NEXTAUTH_URL`、`NEXTAUTH_SECRET` 和 `DATABASE_URL`。
- Schema 更新前必须备份数据库并审阅新增表、枚举和索引。
- 上传仍需对象存储、病毒扫描和更严格域名白名单。
- 当前缺少可执行的 GitHub Actions 门禁；合并前依赖人工静态审查，部署环境必须补跑测试和构建。

## 9. 变更记录

### 2026-07-23：Evaluation v2 + 评测协议

- 新增独立 `Evaluation` 模型，不修改历史 Review。
- 新增 Skill、模型、软件/服务、普通资源四套协议和维度。
- 新增草稿、发布、归档状态；结论等级与复现级别。
- 新增协议匹配、完整评分、证据、复现和重复次数发布门禁。
- 新增 `/api/evaluations` 公共查询和管理员创建 / 更新。
- 新增 `/evaluations`、`/evaluations/[id]` 和 `/evaluations/manage`。
- Target、Skill、App、Candidate 详情接入正式评测面板，并将历史 Review 明确为自由记录。
- 新增管理员审计、footer 入口、sitemap 和 robots 规则。
- 新增 `docs/EVALUATION_PROTOCOL_V2.md` 和 SEO 增量记录。
- 新增 Evaluation 服务测试与 sitemap 测试。

### 2026-07-23：双线生命线运行时 Phase 1

- 副标题、SEO 和首页更新为“**大浪淘沙，找寻灵感**”。
- 一级导航收口为找灵感 / Skill 库 / 吐槽室 / 洞笔记。
- Candidate 公共页面改为灵感池语义。
- 新增 `/talk` 和多态 Subject 展示适配器。
- Forge Skill 草稿从 `createTarget()` 修复为 `createSkill()`。
- Published Skill 详情进入 sitemap。

### 2026-07-23：产品定位与 Skill/Candidate 基础

- 新增 `docs/PRODUCT_POSITIONING.md`，确立双线生命线。
- 新增独立 Skill、Candidate 和多态 Review。
- 历史 Target 迁至 `/tools`；新增 App 画廊和 Forge 本地模板。
- 旧 SPEC 标记为 Legacy。

### 2026-05-20：安全、审计与 SEO 基础设施

- 强化鉴权、匿名身份、IP 哈希、响应头、上传签名、输入解析和健康检查。
- 新增 AdminAuditLog。
- 建立 metadata、canonical、JSON-LD、sitemap、robots 和 SEO 测试基础。

## 10. 下一阶段

### 10.1 产品与数据

1. 修复 Candidate 晋升导致的 Review / Evaluation 历史割裂。
2. 设计 Resource / Skill 成熟度状态和状态历史 ADR。
3. 建立 ResourceVersion / SkillVersion，使 Evaluation 关联明确版本而非文本。
4. 为自由记录增加持久化 `QuickTake` 类型、关联版本和证据入口。
5. 扩展 Skill 的输入输出契约、依赖、Quick Start、失败边界和技能包关系。
6. 编写 Target / Candidate / App / Skill 历史映射与 dry-run 迁移工具。
7. 在数据模型稳定后接入真实 AI 辅助评测计划、证据整理和总结，并保留来源与人工确认。

### 10.2 工程

1. 在可访问依赖的环境运行 Prisma generate、测试、type-check 和 production build。
2. 增补 Evaluation API 集成测试与 E2E。
3. 将 schema 变更切换为可审阅、可回滚的正式 migration。
4. 增加 CI 门禁和数据库迁移 smoke test。
5. 为证据链接失效、协议覆盖率和评测发布失败增加可观测指标。

### 10.3 SEO

1. 为正式 Evaluation 评估适当的结构化数据类型。
2. 为 Resource、Skill 和 Evaluation 详情生成动态 OG 图。
3. 在 CI 中抓取验证 robots、sitemap、canonical 和 JSON-LD。
4. 站内搜索完成后补回 `WebSite.SearchAction`。
