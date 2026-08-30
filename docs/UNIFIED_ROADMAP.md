# Prompt Vault 路线与排期

> 基线日期：2026-08-26
> 时间窗口是工程排序，不是对外承诺；每一阶段都必须先满足数据门禁。

## Phase 0 — 重新定位与安全发布（当前）

目标：把公开网站从混合入口收口为增强提示词仓库，并在不写生产 schema 的前提下发布。

- [x] `Skill` 作为 Prompt 主模型；
- [x] 公共 IA：`PROMPT / COMMUNITY / ABOUT`；
- [x] 完整 Home 入口首屏与三栏 Prompt Workbench；
- [x] Prompt 搜索、分类与 2–3 条选择；
- [x] `/compare/prompts` 独立对比页；
- [x] Candidate → Skill 与 createSkill 默认 draft；
- [x] Article 删除改可恢复归档；
- [x] `.env*` build 隔离与备份权限收紧；
- [ ] 全量测试、构建、Impeccable finish review；
- [ ] 新 dump、上传归档、恢复演练、发布前后对账；
- [ ] 线上 UI 与 URL 验收。

退出条件：验收矩阵 P0 全部通过。

## Phase 1A — Home + Prompt Workbench（当前增量）

目标：先把最重要的提示词入口与可运行工作台做成可验收产品，同时保持零 schema 迁移。

- [x] 1672×941 Home 与 Workbench 批准稿；
- [x] Home 完整首屏、随机低频故障标题与单一 Enter；
- [x] Workbench 左 Library / 中 Output / 右 Recipe；
- [x] DeepSeek 文本实时运行与 CPA 图片实时运行；
- [x] 文档、视频、特殊用途仅管理且不暴露 runner；
- [x] 空白 modelVersion 回退到实际模型 ID；
- [ ] 全量测试、隔离生产构建、桌面/移动 finish review；
- [ ] 数据备份、发布前后只读对账与线上验收。

数据门禁：输出类型使用 `output:*` 兼容标签；测试结果不落库；不执行 migration 或历史数据回写。

## Phase 1B — Prompt Version + Effect Samples（1–2 周）

目标：从“一条 Prompt 一张图”升级到可冻结版本和多样本验证。

- `PromptVersion` 不可变快照；
- 当前编辑版 / 已批准公开版分离；
- 输入契约、输出格式、依赖与失败边界；
- 多个 EffectSample，记录环境、模型、时间、来源和权利；
- 对比 URL 可固定具体版本；
- 现有 `effectImageUrl/effectNote` 幂等迁入首样本。

数据门禁：additive migration；恢复副本先跑；旧字段至少保留一个兼容周期。

## Phase 2 — 可复现对比（2–4 周）

目标：让同类 Prompt 比较从静态阅读扩展到可复现实验。

- Evaluation Prompt 专用模板；
- 同输入跨模型/版本对照；
- 对比快照保存选择、版本与环境；
- 失败样本和边界作为一等结果；
- 输出证据引用不可级联删除。

验收：固定版本同输入、两种环境、证据可下载、限制可见。

## Phase 3 — 作者审核队列（4–6 周）

目标：扩大整理吞吐量但不放松人工门禁。

- Candidate 批量去重与来源检查；
- AI 草稿 Inbox；
- 缺失 attribution、来源、效果、验证的清晰状态；
- 发布/驳回/归档 audit trail；
- Forge 与 Agent reply 失败池重试和可观测性。

数据门禁：批处理幂等、可暂停、逐批输出 before/after ID 清单。

## Phase 4 — 视觉资产合法发布（6–10 周）

目标：让 design-preview 的有价值概念稿在权利可确认时进入公开系统。

- VisualAsset rights review UI；
- manifest/hash 漂移检查；
- `owned` / `licensed` 才能公开；
- Candidate、App、Prompt、Article 的来源图谱；
- 无障碍网格、密度切换和灯箱。

未确认权利的 14 份资产继续留在私有导入区；不得为了填充页面直接公开。

## Phase 5 — 证据驱动简化（10 周后评估）

只有访问统计、兼容测试和回滚方案足够时才执行：

- 抽取五个重复上传 API handler；
- 合并 coding/editor 与 model/prompt renderer，保留各自路由；
- 统一安全 JSON parser；
- 共享 noindex layout；
- 删除确认无引用的旧 cyber CSS 和单个死组件；
- 评估 Target.prompt 的只读归档或映射，而不是直接删除。

任何物理模型合并都需要独立 RFC、双读期和 owner 明确批准。

## 永不自动化的动作

- AI 批准或公开内容；
- 根据相似度自动合并历史 Prompt；
- 自动声明视觉资产权利；
- 自动删除历史数据、来源仓库、migration 或 volume；
- 自动根据单一综合分数宣布“最佳提示词”。
