# SEO 变更记录

> 本文件作为 [`SEO_STRATEGY.md`](./SEO_STRATEGY.md) 的增量变更记录。SEO 的长期原则、builder 约束、JSON-LD 和 canonical 规则仍以主策略文档为准。

## 2026-07-23：双线生命线运行时 Phase 1

### 背景

产品定位从“Skill 室 + 画廊 + 造物台”的并列栏目，收口为“找灵感 / Skill 库 / 吐槽室 / 洞笔记”的双线生命线。此次变更只调整公开信息架构、metadata、站点地图和默认 OG 图，不修改 canonical 工具、JSON-LD builder 或 Prisma schema。

### Metadata 与关键词

- `SITE_TAGLINE` 更新为“**大浪淘沙，找寻灵感**”。
- `SITE_DESCRIPTION` 更新为 AI 灵感炼成与实践沉淀定位。
- 关键词覆盖 AI Skill、Prompt、工作流、模型评测、软件评测、资源评测、灵感池、吐槽室和技术小结。
- 模型、编辑器、编码工具和历史 Prompt 详情页不再错误称为 Skill，分别使用模型资源、软件资源、编码工具资源和提示资源语义。
- `/forge` 明确标记为确定性本地模板 Beta，避免对真实 AI 能力作不准确承诺。

### Sitemap

新增或提升：

- `/candidates`：公开“找灵感”入口，daily，priority 0.9。
- `/skills`：Skill 库，daily，priority 0.9。
- `/talk`：公开真实记录聚合页，daily，priority 0.85。
- `/articles`：经验沉淀入口，daily，priority 0.8。
- `/skills/[slug]`：所有 `published` Skill 详情，weekly，priority 0.85。

继续保留：

- 历史 Target、Article、App、Candidate 详情 URL。
- `/tools`、`/app`、`/compare` 和 `/forge` 等兼容入口。

继续排除：

- `/submit`
- `/emojis`
- `/tags`
- 管理、认证和 API 路由

### OG 图

默认 OG 图底部入口文案更新为：

```text
找灵感 · Skill 库 · 吐槽室 · 洞笔记
```

图片尺寸、edge runtime、站点名称和 builder 使用方式不变。

### Canonical 与历史兼容

- `/candidates` 继续作为当前灵感池 canonical，避免在没有数据迁移前制造新 URL。
- `/editor/[slug]`、`/coding/[slug]`、`/model/[slug]`、`/prompt/[slug]` 继续保留原 canonical 与历史索引资产。
- 本阶段不增加 redirect，不修改历史 slug。
- Resource 统一路由稳定后，再通过 ADR 决定 canonical 和 redirect 收口策略。

### 验证清单

- `sitemap.test.ts` 覆盖 `/talk` 与 published Skill 详情。
- 检查 sitemap 不出现 `/submit`、`/emojis`、`/tags`、`/editor` 和 `/coding` 列表页。
- 检查 Target 详情仍使用原 URL，且 metadata 不再把资源称为 Skill。
- 检查 `/talk`、`/skills/[slug]` 和 `/candidates/[slug]` 输出统一 metadata 与 BreadcrumbList。
- 后续 CI 应增加 `next build` 后的 robots、sitemap 和 JSON-LD 抓取契约测试。
