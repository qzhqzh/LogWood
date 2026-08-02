# 灵感生命周期重构计划

> 状态：执行中
> 创建日期：2026-08-02
> 上位定义：[`PRODUCT_POSITIONING.md`](./PRODUCT_POSITIONING.md)

## 1. 目标架构

```text
找灵感
  -> 未处理
  -> 观察 / 试用 / 判断
      -> 收藏室（值得继续使用）
      -> 废品站（当前不再继续）

任意阶段
  -> 吐槽室（短、快、主观）
  -> 洞笔记（整理后的长期沉淀）
```

正式 Evaluation 是判断所使用的证据层，不作为一条与业务主线竞争的内容主线。AI 和 MCP 是贯穿各阶段的操作能力，不是独立产品栏目。

## 2. 页面职责

| 入口 | 职责 | 首期数据来源 |
|---|---|---|
| 找灵感 `/candidates` | 快速记录、处理待办、观察和试用 | `Candidate.watching / evaluating` |
| 收藏室 `/skills` | 统一浏览已经决定保留的内容 | `Skill`、`Target`、`App` 聚合适配 |
| 废品站 `/scraps` | 浏览已处理但当前不再继续的内容 | `Candidate.dropped` |
| 吐槽室 `/talk` | 保存即时判断、踩坑、提问和讨论 | `Review` |
| 洞笔记 `/articles` | 保存结构化经验、复盘和方法 | `Article` |

收藏室按内容形态切换：

- 可复用能力：Prompt、Template、Workflow、Skill；
- 工具与资源：模型、软件、服务、仓库；
- 视觉收藏：截图、风格、界面和案例。

`/tools`、`/app` 及所有旧详情 URL 继续可访问。新页面先通过适配层聚合历史数据，不立即复制或删除数据。

## 3. 语义映射

| 当前模型或状态 | 新语义 | 处理方式 |
|---|---|---|
| `Candidate.watching` | 未处理灵感 | 保留原记录和创建入口 |
| `Candidate.evaluating` | 观察中 | 替换“好灵感”文案，避免未验证即下结论 |
| `Candidate.promoted` | 已入藏来源 | 保留原 Candidate，并链接到收藏对象 |
| `Candidate.dropped` | 废品站条目 | 作为独立入口展示，不删除 |
| `Skill` | 可复用能力收藏 | 进入收藏室“能力”视图 |
| `Target` | 历史工具与资源收藏 | 进入收藏室“工具”视图，保留详情路由 |
| `App` | 视觉收藏 | 进入收藏室“视觉”视图，保留详情路由 |
| `Review` | 吐槽 / Quick Take | 继续多态关联现有对象 |
| `Evaluation` | 正式证据 | 继续独立保存，详情页和对象页可访问 |
| `Article` | 洞笔记 | 第二阶段补充与 Subject 的关联 |

## 4. 实施阶段

### Phase 1：统一体验，不迁移物理数据

1. 一级信息架构调整为找灵感、收藏室、废品站、吐槽室、洞笔记。
2. 收藏室新增统一聚合适配器和内容形态筛选。
3. 废品站复用 `Candidate.dropped`，支持搜索和返回观察池。
4. 首页改成生命周期工作台，优先展示待处理、最近入藏、最近淘汰和最近表达。
5. `/tools` 与 `/app` 列表入口收口到收藏室，详情和管理路由保持兼容。
6. sitemap、metadata、README 和产品文档同步更新。

验收：不执行数据库变更即可展示全部公开 Skill、Target、App 和 dropped Candidate；旧详情链接不失效。

### Phase 2：补全生命周期和来源关系

以新增字段或关系表的方式记录：

- 状态变更历史、操作者、时间和理由；
- 废弃原因、替代项、重新考虑条件；
- Candidate 晋升后的统一 Subject 关系；
- Article 与 Candidate、Skill、Target、App、Evaluation、Review 的来源关系；
- 标签统一索引，替代各模型中的 JSON 字符串扫描。

这一阶段只做可回填的增量 schema，先提供 dry-run 统计，再执行写入。任何 Review、Comment、Like、Evaluation、Article ID 都不得改变。

### Phase 3：物理模型收口

当统一页面和关系模型稳定后，再评估建立 `Resource` 主表：

- Target、App、Candidate 迁入 Resource 或成为 Resource 的版本 / 形态；
- Skill 保持独立可复用资产，或通过统一 Subject 接口关联 Resource；
- 旧 slug 建立永久映射，旧路由做 redirect 或兼容查询；
- 双写期完成校验后才停止旧表写入。

不进行一次性合表，不删除旧表，不把历史 Review 自动转换为 Evaluation。

## 5. 历史数据迁移门禁

每批迁移必须输出并核对：

1. 迁移前后各模型总数和按状态计数；
2. Candidate 晋升目标的有效引用率；
3. 每条 Review 和 Evaluation 恰好关联一个可访问 Subject；
4. 旧 slug 和详情 URL 的解析成功率；
5. 迁移前后 Comment、Like、ArticleComment 数量一致；
6. 无目标、重复目标和悬空外键清单；
7. dry-run、事务执行、回滚和备份步骤。

先在目标数据库执行只读审计：

```bash
npm run db:audit-lifecycle
```

命令返回 `readyForPhase2Backfill: true` 才能开始增量关系回填；任何 blocker 都必须先修正或形成明确的人工映射表。该命令固定返回 `readyForPhysicalMigration: false`，物理合表还必须完成迁移前后对账、旧 URL 的 HTTP 实测以及备份和回滚演练。

## 6. 完成标准

- 新用户可以用一句话解释五个入口各自负责什么。
- 任意灵感都能明确处于未处理、观察中、已入藏或已淘汰状态。
- 收藏室能够统一检索 Skill、Target 和 App，不要求用户理解底层模型。
- 废品站不承担删除，失败记录仍能访问原吐槽和正式评测。
- 吐槽和洞笔记能够追溯到产生它们的对象或证据。
- 旧数据数量、互动关系、详情 URL 和 SEO canonical 均有自动化验证。
