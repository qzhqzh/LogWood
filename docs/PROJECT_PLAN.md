# LogWood 项目计划

> 最近修订：2026-08-26
> 产品定位：[`PRODUCT_POSITIONING.md`](./PRODUCT_POSITIONING.md)
> 发布验收：[`RELEASE_ACCEPTANCE_MATRIX.md`](./RELEASE_ACCEPTANCE_MATRIX.md)

## 目标

把历史上不断叠加功能的个人站收口为一个明确产品：**可验证、可比较、可审计的增强版提示词仓库**。保留作者思想、历史数据和旧 URL，但不再让每个历史功能都占据一级产品位置。

唯一运行根是 `/home/zhuqin/star/app/LogWood`。`personal_site`、`personal_site_x` 和 `design-preview` 都是迁移来源，不是运行依赖。

## 架构边界

- Next.js 14 + TypeScript + Tailwind；
- Prisma + PostgreSQL；
- 保持 `src/modules/*/service.ts` 服务边界；
- `Skill` 是公开 Prompt 主模型；
- Candidate / Article / App / Target / Review / Evaluation 保留现有表与关系；
- 旧路由和 slug 保持向后兼容；
- 本轮不做破坏性 schema 合并，也不删除 migration、volume、上传或来源仓库。

## 本轮交付（Phase 0 收口 + 第一阶段 Home / Prompt Workbench）

### 0.1 产品与信息架构

- 一级导航收口为 `PROMPT / GALLERY / AWESOME / COMMUNITY / ABOUT`；
- 原文章与长期沉淀统一由 Community 承载，验证记录和提示档案保留二级直达路由；
- 收集箱、AI 整理、归档和历史资源降为作者工作台；
- `/skills` 只查询已发布 Skill，不再聚合 Target/App；
- `Target.prompt` 放入明确标记的历史兼容区；
- SEO、副标题、Open Graph 和产品文档改为提示词仓库定位。

### 0.2 新界面与对比

- 首页：近乎复刻已批准的 1672×941 `PROMPT / PROMPTS, PROVEN. / ENTER` 完整首屏；
- Prompt 工作台：左 Library、中 Output、右 Recipe；中央优先真实效果或本次模型结果；
- 提示详情：效果预览在桌面中央、移动端优先；
- 提示库：分类、搜索、真实效果缩略图和 2–3 条选择；
- 新增 `/compare/prompts`，逐行并排效果、正文、证据、来源与 AI 归属；
- 无效果图时显示正文回退，不生产伪效果；
- ASCII character field 设计系统覆盖公共操作 surface。

### 0.3a 第一阶段实时输出契约

- 文本 Prompt 只路由到服务器白名单 DeepSeek 模型；
- 图片 Prompt 只路由到服务器白名单 CPA 生图模型；
- 文档、视频和特殊用途 Prompt 可在管理页正常收录，但显示 `MANAGED ONLY` 且不可运行；
- 输出类型以 `output:*` 保留标签兼容存储，由 service 返回 `outputKind`，不做 schema 迁移或历史回写；
- 所有工作台输出仅存在于当前会话，必须包含 provider、model、非空 modelVersion 与生成时间，不自动保存为证据。

### 0.3 人与 AI 的安全门禁

- `createSkill` 默认 `draft`；
- Candidate 晋升 Skill 默认 `draft`；
- Forge 默认创建提示词草稿，支持 AI/本地模板与幂等重试；
- AI attribution 完整保存，部分字段公开告警；
- Article 内容更新产生新版本、取消旧批准并回到草稿；
- Article 删除改为归档，保留来源、版本、贡献、评论和 URL 语义。

### 0.4 数据与发布安全

- `.env*` 排除 Docker build context；
- 依赖安装使用提交的 `package-lock.json` 与 `npm ci --include=dev`；
- 备份目录 `0700`，备份文件与 `.env.bak` `0600`；
- 发布前创建新 PostgreSQL custom dump、上传归档和代码回滚点；
- 恢复到独立临时 PostgreSQL 实例并做表计数抽样；
- 只重建/重启 `logwood-web`，不运行会触碰 DB 的全量 Compose 生命周期。

### 0.5 Awesome 收录层

- `/awesome` 保留 Project Radar，`/awesome/skills` 新增 Agent Skill Index，`/awesome/feeds` 集中管理发现源；
- Project 与 Skill 均使用 Candidate 和现有兴趣分，不新增 schema；分别以 `catalog:project`、`catalog:skill` 隔离查询；
- Skill 记录 `SKILL.md` 来源、兼容性、权限、许可状态与 `COLLECTED → AUDITED → TRIED → PROVEN` 成熟度；
- Skill Index 只读、收录和评分，不直接运行或安装；只有绑定已发布 Prompt 时才跳转 Workbench；
- 同步脚本只创建缺失条目并回填缺失元数据，保留已有正文、标签、评分和 slug 冲突记录。

## 分期路线

| 阶段 | 时间窗口 | 交付 | 数据门禁 | 验收 |
|---|---|---|---|---|
| Phase 0 | 当前发布 | 定位、ASCII 首页/提示库/详情、2–3 条对比、草稿门禁、安全归档 | 无生产 schema 变更；备份+恢复演练 | P0 矩阵全绿 |
| Phase 1A | 当前增量 | 批准稿 Home / Workbench、文本与图片实时测试、其他输出类型安全管理 | 兼容标签；零 schema 变更；模型结果不落库 | 桌面/移动视觉、真实双模型 smoke、归属完整 |
| Phase 1C | 当前增量 | Awesome Project / Skill / Feed 三分区、Skill 权限与成熟度审计 | Candidate 标签兼容；幂等同步；不自动安装或执行 | 查询隔离、评分、筛选、来源链接与响应式 UI |
| Phase 1B | 发布后 1–2 周 | Prompt 版本、结构化输入/输出契约、效果样本集、失败边界 | 只新增表/列；迁移先跑恢复副本 | 版本切换、旧链接、回归样本 |
| Phase 2 | 2–4 周 | 对比快照、跨模型/跨版本 Evaluation 模板、可复现运行记录 | 证据引用不可级联删除 | 同输入多环境对照 |
| Phase 3 | 4–6 周 | Candidate → Prompt 更完整的人工整理队列、发布审核 Inbox、批量但可回滚的元数据补齐 | 每批幂等、可重跑、逐批对账 | 失败池与恢复剧本 |
| Phase 4 | 6–10 周 | VisualAsset 权利审核 UI、合法资产发布、Prompt/App/Article 来源图谱 | `owned/licensed` 才可公开 | hash、权利和来源审计 |
| Phase 5 | 有数据后评估 | 物理模型简化或历史模型归档 | 只有使用统计、双写和完整回滚后才决定 | RFC + owner approval |

## Phase 1B 详细任务

### PromptVersion

- 建立不可变版本快照；
- 记录正文、分类、效果引用、来源、AI 归属和 changeSummary；
- 公开页指向批准版本，不把当前编辑态误当公开版本；
- 比较页允许固定到具体版本。

### Prompt Contract

- 可选字段：目标、输入要求、输出格式、依赖模型/工具、已知限制；
- 不强迫历史提示词立即补齐；
- 管理页提供完成度，而不是在公共页虚构信息。

### Effect Sample

- 一个 Prompt 可保存多条真实结果；
- 每条结果记录输入变量、环境、模型版本、时间、来源与权利状态；
- 当前 `effectImageUrl/effectNote` 作为兼容首样本，迁移必须幂等。

## DSH 简化审计结论

本轮已显式调用 `dsh-find-simplifications` 做证据式审计。为降低发布风险，只记录可独立验证的后续候选，不在 UI 重做时顺手大删：

1. 五个上传 API 有约 378 行重复，可抽成共享、带权限测试的上传 handler；
2. coding/editor、model/prompt 详情存在成对重复，可保留 URL 后共享 renderer；
3. 多处 JSON 字符串解析应统一为安全 helper；
4. noindex layout 可共享；
5. 旧 cyber CSS 在新 surface 稳定后可按真实引用删除；
6. `emoji-picker.tsx` 目前无生产消费者，但 Emoji 路由/API/数据仍有使用，不能连带删除；
7. `@tiptap/pm`、历史路由、导入资产和证据链不能按“看起来未用”删除。

每项简化必须单独提交、单独测量行为等价，不和 schema 或发布变更混在一起。

## 验证策略

### 自动化

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
./node_modules/.bin/prisma validate
```

覆盖重点：

- service：Prompt 公开查询、默认 draft、Candidate 晋升、Article 归档与版本门禁；
- API：鉴权、幂等、恢复性错误、发布冲突、归档；
- component：真实效果图与无图正文回退；
- integration：Candidate → Forge → draft、审核/发布、sitemap；
- UI：桌面 1440px、移动 390px，首页、提示库、详情、对比、Forge。

### 数据验收

- 备份 SHA256；
- 独立恢复实例可连接；
- 核心表计数与抽样 ID 一致；
- 上传归档可列出并校验；
- 发布前后只读计数无意外差异；
- 旧 Target/App/Article/Candidate/Review URL 抽样返回 200。

## 已知限制

- 生产历史 Article 尚未批量回填版本/来源/贡献；不在本轮无依据推断；
- Evaluation 记录数量可能为零，公共页必须如实显示空态；
- 现有 Skill 只有单一效果图字段，效果样本集排入 Phase 1；
- 完整 PromptVersion 尚未实现，公共页不显示虚构 V1；
- Docker 仍是单阶段镜像，后续可在稳定后拆为构建/运行阶段；
- 数据库 app role 权限仍需单独最小权限审计。

## 发布判定

只有下列条件同时满足才能对用户宣告完成：

1. 全量 Vitest、TypeScript、Prisma validate、production build 通过；
2. Impeccable 检测与 finish review 无 P0/P1 阻塞；
3. 桌面/移动真实截图与关键交互通过；
4. 新数据库备份、上传归档和恢复演练成功；
5. 发布前后核心数据对账一致；
6. 线上 `/`、`/skills`、一个提示详情、`/compare/prompts`、`/api/health` 返回成功且无浏览器错误。
