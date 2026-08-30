# 统一站点迁移与兼容计划

> 唯一目标根：`/home/zhuqin/star/app/LogWood`
> 原则：先吸收有意义内容，再收口产品界面；不删除来源仓库、历史数据、slug 或互动。

## 来源处置

| 来源 | 吸收内容 | 不吸收内容 | 运行关系 |
|---|---|---|---|
| `personal_site` | “秦”“造器，筑界，观心。”、AI/Game/Mind、“信号太多，意义太少。”、Now/Projects/Values/Notes/Links/Contact、Inspector 思想 | Astro、React 19、Three/R3F、Motion、Lenis、独立主题脚本、空页 | 已迁内容；不参与构建或运行 |
| `personal_site_x` | 有意义的作者内容、结构启发和历史设计判断 | 第二套站点 shell、重复组件和独立依赖链 | 已融合；不参与构建或运行 |
| `design-preview` | 14 份非重复病理 AI 概念稿的来源清单、hash、权利审查流程、网格/密度/无障碍灯箱思想 | Nginx/Compose/manifest、本地点赞、未经权利确认的 public 文件 | 私有导入来源；未批准资产不公开 |

来源目录仍可能有历史参考价值。本轮没有删除或搬动它们；是否归档由 owner 后续单独决定。

## 语义迁移

### 公开主模型

`Skill` = Prompt。新首页、提示库、详情和对比只查询 `SkillStatus.published`。

### 历史兼容模型

| 现有模型 | 新语义 | 兼容策略 |
|---|---|---|
| `Target.prompt` | 历史提示资源 | 在 `/skills` 折叠兼容区与 `/prompt/[slug]` 保留；不自动转 Skill |
| `Target.editor/coding/model` | 历史软件/模型资源 | `/tools`、详情和 `/compare` 保留 |
| `App` | 项目/视觉结果 | `/app` 与详情保留，未来通过来源关系连接 Prompt |
| `Candidate` | 收集箱与成熟度状态 | 晋升保留来源；新 Skill 默认 draft |
| `Review` | 自由反馈 | ID、作者、评论和点赞不变 |
| `Evaluation` | 正式验证 | 保持不可由 Subject 级联删除 |
| `Article` | 长期笔记 | 保留 slug；新增版本/来源/贡献只做增量关系 |

## 路由迁移

### 新公开入口

- `/`：Prompt workbench；
- `/skills`：已公开 Prompt；
- `/skills/[slug]`：正文、中央效果、Inspector；
- `/compare/prompts`：2–3 条 Prompt 并排对比；
- `/evaluations`：正式验证；
- `/articles`：笔记；
- `/about`：作者叙事。

### 保留入口

`/tools`、`/app`、`/compare`、`/prompt/[slug]`、`/model/[slug]`、`/editor/[slug]`、`/coding/[slug]`、Candidate、Review、Evaluation、Article 历史详情和管理 URL 均保留。

不设置把旧详情强制跳转到新 Prompt 的批量 redirect，因为目前没有足够证据证明对象等价。

## 数据迁移规则

1. 本轮 UI 发布不执行生产 schema 变更；
2. 不批量把 `Target.prompt` 复制成 Skill，避免重复对象和来源丢失；
3. 不为历史 Article 推断不存在的来源、AI 归属或版本摘要；
4. 视觉稿只能在 manifest/hash/rights 状态齐备后导入 VisualAsset；
5. 所有未来 backfill 必须是幂等事务，先在恢复副本运行并输出逐表对账；
6. 不删除旧字段或表，直到双读统计、兼容周期、回滚方案和 owner 批准同时存在。

## 发布前安全剧本

1. 记录 branch、HEAD、dirty diff 与当前容器状态；
2. 创建 PostgreSQL custom-format dump 并写 SHA256；
3. 归档 `public/uploads`（不删除原目录）并写 SHA256；
4. 把 dump 恢复到独立临时 PostgreSQL，不覆盖生产目录/volume；
5. 对 users/targets/skills/candidates/apps/articles/reviews/comments/evaluations 等表计数；
6. 在恢复副本抽样主外键关系与历史 slug；
7. 本地生产 build；
8. 只重启 `logwood-web`；
9. 检查 health、核心页面、浏览器 console 和网络失败；
10. 再次对核心表只读计数，和发布前对账。

## 回滚

- 代码：恢复发布前工作区快照/镜像并只重启 Web；
- 数据：本轮没有写 schema 或 backfill，正常回滚不应恢复数据库；
- 如果意外数据差异，立即停止写入并使用新 dump 在独立实例核验，未经 owner 确认不覆盖生产；
- 上传：使用发布前归档核对，禁止用空目录覆盖现有上传。

## 完成定义

- 来源项目不再是 runtime dependency；
- 作者内容与视觉资产规则在 LogWood 中有可审计落点；
- Prompt 主库与历史兼容区语义分离；
- 旧 URL 和数据保持；
- 自动化、真实 UI、恢复演练和线上 smoke test 都有证据。
