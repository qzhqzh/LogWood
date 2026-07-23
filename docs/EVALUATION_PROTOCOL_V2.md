# Evaluation v2 正式评测协议

> 状态：Accepted  
> 协议版本：2  
> 生效日期：2026-07-23  
> 对应 Epic：#15

## 1. 目的

Evaluation v2 用于保存可以被引用、比较和复查的正式评测。它与现有 `Review` 的职责不同：

- `Review`：低门槛自由记录，承接吐槽、第一感受、提问、求证和阶段性判断。
- `Evaluation`：正式证据层，必须说明对象版本、测试环境、任务、结果、证据、复现情况、维度评分、限制和结论。

两者并存，不将历史 Review 强制转换为正式评测，也不允许只凭五星和一段主观描述生成 Evaluation。

## 2. 核心原则

1. **对象明确**：每条 Evaluation 只关联一个 Target、Skill、App 或 Candidate。
2. **协议匹配**：Skill、模型、软件/服务和普通资源使用不同评分维度。
3. **版本可见**：尽可能记录被测对象版本、模型版本、软件版本和测试日期。
4. **证据优先**：发布态必须包含可审阅输出或至少一条证据。
5. **失败可保留**：未通过的评测同样可以发布，失败样本是高价值资产。
6. **结论有边界**：必须说明适用场景、限制和复现级别，避免把局部结果扩张为普遍事实。
7. **协议可版本化**：`protocolVersion` 与数据共同保存；未来协议升级不覆盖历史记录。

## 3. 协议类型

### 3.1 Skill 评测

适用于 Prompt、Template、Workflow、Recipe、Agent Skill 和 Skill Pack。

维度：

- 指令遵循 `instruction_following`
- 输出质量 `output_quality`
- 可复现性 `reproducibility`
- 易上手程度 `ease_of_use`
- 兼容性 `compatibility`
- 成本效率 `cost_efficiency`
- 可修改性 `adaptability`
- 失败边界 `failure_boundaries`

### 3.2 模型评测

适用于 `Target.type=model`。

维度：

- 任务完成率 `task_success`
- 推理与生成质量 `reasoning_quality`
- 稳定性 `stability`
- 速度 `speed`
- 成本 `cost`
- 上下文与工具调用 `context_tools`
- 可控性 `controllability`
- 隐私与安全边界 `privacy_safety`

### 3.3 软件 / 服务评测

适用于编辑器、编码助手、插件、API 和在线服务。当前 `Target.type=editor|coding` 自动使用此协议。

维度：

- 核心功能价值 `functional_value`
- 稳定性 `stability`
- 学习成本 `learning_cost`
- 集成能力 `integration`
- 性能 `performance`
- 价格与价值 `price_value`
- 隐私与数据控制 `privacy_control`
- 迁移与替代成本 `migration_cost`

### 3.4 普通资源评测

适用于仓库、网站、项目、案例、论文、课程、数据集、历史 Prompt 资源和灵感条目。

维度：

- 权威性 `authority`
- 时效性 `freshness`
- 深度 `depth`
- 可用性 `usability`
- 可复现性 `reproducibility`
- 时间价值 `time_value`
- 来源透明度 `source_transparency`

## 4. 数据结构

正式评测至少保存：

```text
subjectType / subjectId
protocol / protocolVersion
status
verdict
reproducibility
subjectVersion
testedAt
repeatCount

title
task
environment
input
procedure
output
evidence
scores
strengths
limitations
conclusion
```

### 4.1 环境 `environment`

JSON 结构：

```json
{
  "model": "Claude",
  "modelVersion": "Sonnet 4",
  "software": "Claude Code",
  "softwareVersion": "1.0.60",
  "operatingSystem": "Ubuntu 24.04",
  "hardware": "x86_64 / 32 GB",
  "notes": "网络、权限或其他环境说明"
}
```

### 4.2 证据 `evidence`

JSON 数组：

```json
[
  {
    "type": "url",
    "label": "测试提交",
    "url": "https://github.com/...",
    "note": "对应第二次重复运行"
  }
]
```

证据类型：`url | image | log | code | file | note`。

### 4.3 评分 `scores`

JSON 对象，键必须来自当前协议，分值范围为 `0-10`。草稿允许部分填写，发布态必须填写全部维度。

综合分仅用于摘要展示，按当前协议所有维度等权平均。它不能代替正文结论和失败边界。

## 5. 状态与结论

### 5.1 状态

- `draft`：可不完整，仅管理员可见。
- `published`：通过发布门禁，公开展示并进入 sitemap。
- `archived`：历史评测仍可在管理端访问，不进入公开查询。

### 5.2 结论等级

- `verified`：在声明的场景和版本下验证通过。
- `conditional`：部分通过，需满足明确条件。
- `failed`：在声明的测试范围内未通过。
- `inconclusive`：证据不足，暂不能形成结论。

结论等级不等于内容质量。高质量的失败评测比没有上下文的五星好评更有价值。

### 5.3 复现级别

- `untested`：尚未执行；不能发布。
- `single_run`：完成一次运行。
- `repeated`：同一评测者在同类条件下运行至少两次。
- `reproduced`：由独立环境或独立人员复现，重复次数至少两次。

## 6. 发布门禁

状态切换为 `published` 时必须满足：

- 评测对象存在，且只关联一个对象。
- 对象类型与协议匹配。
- 标题、测试任务和总体结论达到最小完整度。
- 当前协议的所有评分维度已填写，且分值在 `0-10`。
- `reproducibility != untested`。
- `repeated` 或 `reproduced` 时 `repeatCount >= 2`。
- 至少填写一段可审阅输出，或提供一条证据。

草稿不执行完整发布门禁，便于逐步记录实验。

## 7. 权限策略

PR18 首期策略：

- 公开用户可以浏览已发布 Evaluation。
- 正式评测创建、修改、发布和归档仅管理员可用。
- 所有创建和修改写入 `AdminAuditLog`。
- 后续开放普通用户投稿时，应增加审核状态、作者信誉、反刷和证据检查，不直接放开公开发布。

## 8. 与历史数据的关系

- 不迁移或修改历史 Review ID。
- 历史 Review 继续显示为自由记录 / Evaluation v1 兼容内容。
- Evaluation v2 使用独立表和独立 API，不向 Review 表追加大量动态字段。
- 一个对象可以同时拥有多条自由记录和多条正式评测。
- 后续可以从一组 Review、实验日志或 JourneyEntry 生成 Evaluation 草稿，但必须保留来源引用和人工确认。

## 9. API 与页面

公开：

- `GET /api/evaluations`
- `/evaluations`
- `/evaluations/[id]`
- 各 Target / Skill / App / Candidate 详情页的正式评测面板

管理员：

- `GET /api/evaluations?admin=1`
- `POST /api/evaluations`
- `PATCH /api/evaluations`
- `/evaluations/manage`

首期不提供物理删除接口。错误内容通过 `archived` 保留审计和历史。

## 10. 后续协议升级

Evaluation v3 需要优先评估：

- 评测任务集与多个 Test Run 的一对多关系。
- Evidence 独立表和附件签名。
- 维度权重与协议快照，避免常量变化影响历史解释。
- 多评测者复现和共识统计。
- Evaluation 与 SkillVersion / ResourceVersion 的明确关系。
- 从自由记录、日志和文章引用中追溯评测来源。
