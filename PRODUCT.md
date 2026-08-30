# Product

## Platform

Web

## Product Definition

**空心树洞是一个可验证、可比较、可审计的增强版提示词仓库。**

一条公开提示词不只有正文，还可以同时保存真实效果、适用说明、来源、AI 归属、验证记录、使用反馈和后续笔记。首页与 `/skills` 以 `Skill` 为唯一提示词主模型；历史 `Target.prompt` 只在兼容区继续访问，不再和工具、App 混入主库。

核心价值不是“提示词越多越好”，而是让人快速回答：

- 这条指令能直接复制执行吗？
- 实际效果是什么，而不是宣传图是什么？
- 与同类提示词相比，正文、效果和证据有什么不同？
- 内容从哪里来，AI 和人分别做了什么？
- 哪些结论经过验证，哪些仍是待验证判断？

## Users

主要用户是长期整理 AI 提示词、工作流、实验和实践经验的个人创作者与开发者。访客可以查找、复制、比较和阅读公开记录；作者通过收集箱、AI 整理台和管理页维护草稿、来源、归属与发布状态。

## Core Flow

```text
Candidate（收集箱）
  → 人 / AI 协作整理
  → Skill draft（提示词草稿）
  → 来源 + AI 归属 + 真实效果
  → 人工发布门禁
  → Prompt Library
  → Evaluation / Review / Article
```

Article 与 App 仍是有效产物，但不再和提示词争夺首页主叙事：

- `Article` 解释实验、比较与长期判断；
- `App` 保存项目或视觉结果；
- `Evaluation` 保存正式验证；
- `Review` 保存低门槛使用反馈；
- `Candidate` 保存尚未成熟的输入与放弃理由。

## Information Architecture

公开一级入口固定为五个英文入口：

| 入口 | 路由 | 职责 |
|---|---|---|
| Prompt | `/workbench` | 按输出类型筛选公开 Prompt，在中央查看真实效果或本次模型输出；管理员可显式保存截图草稿与效果更新 |
| Gallery | `/gallery` | 以同一题材横向研究绘画、版画、插画、数字媒介与摄影视觉语言，并把可追溯风格配方带回 Prompt 工作台 |
| Awesome | `/awesome`、`/awesome/skills`、`/awesome/feeds` | 分别收录值得投入的开源项目、可审计 Agent Skill 与发现源；共享兴趣排序，但不把“想尝试”冒充质量证明 |
| Community | `/articles` | 统一承载文章、实验、比较、复盘与长期判断 |
| About | `/about` | 连接“秦”“造器，筑界，观心。”与系统的创作伦理 |

作者工作台属于二级入口：

| 工作台 | 路由 | 职责 |
|---|---|---|
| Prompt 工作台 | `/workbench` | 以紧凑三栏选择/筛选 Prompt；管理员可先贴截图建立私有 Candidate，再补正文，或按文本/图像能力调用 DeepSeek / CPA |
| Prompt 档案 | `/skills` | 浏览、筛选、打开公开记录并选择 2–3 条提示词对比 |
| 验证记录 | `/evaluations` | 查看带协议、环境、证据和限制的正式验证 |
| 收集箱 | `/candidates` | 低摩擦保存原始信号与来源 |
| AI 整理 | `/forge` | 幂等地生成提示词或笔记草稿 |
| 归档 | `/scraps` | 保留当前放弃的内容和理由 |
| 历史资源 | `/tools`、`/app`、`/compare` | 保持旧数据与 URL 可访问 |

提示词对比使用 `/compare/prompts?ids=slug-a,slug-b[,slug-c]`。页面按同一行并排展示真实效果、完整正文、验证/反馈、来源、更新时间和 AI 归属，不生成虚构综合评分。Awesome 的 1–5 兴趣分只代表“愿意投入的程度”，独立于 Review 与 Evaluation，不冒充质量或验证结论；同一登录或匿名身份对同一候选只有一份可修改评分。Awesome Skill 只提供来源、`SKILL.md`、兼容性、权限、成熟度与试用入口；目录本身不安装、不调用。只有显式绑定已发布 Prompt 的条目才跳转 Workbench。

## Human + AI Contract

1. AI 默认只生成草稿，没有发布权限。
2. Candidate 晋升为 Skill 时默认 `draft`。
3. 新 Skill 未显式指定状态时默认 `draft`。
4. AI 归属需要完整记录 `provider`、`model`、`modelVersion`、`generatedAt`；部分字段会公开告警。
5. Forge 请求带幂等键；可恢复失败不会重复创建内容。
6. Article 审核只批准当前版本；正文变更会生成新版本、使旧批准失效并回到草稿。
7. “删除文章”执行可恢复归档，不物理级联删除来源、版本、贡献与评论。
8. Prompt 工作台只允许管理员调用服务器白名单模型；模型测试输出只存在当前会话，不会自动写入 Skill、Candidate、Article 或发布状态。
9. 图像类 Prompt 默认路由到 CPA 生图模型；CPA 客户端凭据只由服务端只读配置获取，图像结果经过 MIME、文件签名、体积和尺寸校验后才返回当前会话。
10. 第一阶段只有 `text` 和 `image` 可执行；`document`、`video` 与 `other` 是可检索、可编辑、可发布的管理类型，但工作台不会为它们显示可运行模型。
11. 输出类型暂存为 Skill 的保留兼容标签 `output:*`；服务层会剥离该内部标签并返回 `outputKind`，因此无需生产 schema 迁移或历史数据回写。
12. 管理员可以从剪贴板或文件选择图片，但图片只先进入本地未保存预览；只有显式保存才会更新当前 Skill/Candidate 的效果字段，或创建带 `visibility:private` 保留标签的私有 Candidate。
13. 截图优先的 Candidate 允许正文为空，且不能直接晋升；补齐内容并完成明确的人工作业后，才可移除私有状态并进入原有发布链。

## Visual Direction

提示词工作面采用 **ASCII character field**：Dark Terminal 默认使用近黑背景与磷光绿文字，Paper Terminal 使用米白纸面与深墨绿文字；两者共享硬边框、紧凑索引和无阴影层级，切换结果由 `logwood-theme` 在浏览器本地记忆。首页第一屏是完整的 `PROMPT / PROMPTS, PROVEN. / ENTER` 入口字符场，不在视口底部切入下一段内容。进入 `/workbench` 后，桌面约为 `15% / 64% / 21%`：左侧是真实 Prompt 菜单与 `ALL / IMAGE / TEXT / MANAGED` 筛选，中央承载效果/模型输出，右侧是可编辑正文与模型控制；移动端以 `OUTPUT / PROMPTS / EDIT` 模式切换，默认效果优先。

Gallery 延续当前所选的 Dark/Paper 字符框架，但让作品保持全彩且不叠加染色。首屏采用“风格家族索引 / 主作品 / 配方与来源 Inspector / 同题材接触印样”结构；风格图谱支持按媒介筛选、全屏检查和 2–4 项并排比较。预填充图片必须标记为 synthetic seed，记录生成来源、日期、权利状态与验证状态；它们是研究起点，不冒充已稳定复现的客户案例。

约束：

- 有 `effectImageUrl` 时使用真实图片居中 `object-contain`，不裁切、不生成替代图；
- 无效果图时，文本 Prompt 展示可执行正文，图像 Prompt 展示等待运行的空舞台，不用虚构占位成果；
- 不使用假指标、假模型、假版本、假日期或来源；
- 状态同时用文字、结构和 ARIA 表达，不只依赖颜色；
- 支持键盘焦点、减少动态效果与 390px 移动宽度。
- `PROMPT` 故障在进入时触发一次，随后每次独立抽样低频触发；页面失焦暂停，减少动态效果时完全关闭。

作者页可保留暖纸叙事 surface，但共享同一导航、字体纪律、来源 Inspector 和发布伦理。

## Compatibility and Source Projects

`/home/zhuqin/star/app/LogWood` 是唯一运行根。

- `personal_site`：只迁移作者内容与独特叙事，不迁 Astro、Three/R3F、Motion、Lenis 或独立主题脚本；
- `personal_site_x`：有价值的结构与内容已吸收后，不再作为构建或运行依赖；
- `design-preview`：概念图通过来源、hash 和权利状态进入 Candidate/VisualAsset 流程，未确认权利的资产不能公开发布；
- 旧 Target、App、Review、slug 和路由全部保留兼容，不做一次性破坏性合表。

来源项目在融合完成后可作为只读历史参考或另行归档；删除它们不是本次发布动作。

## Data Safety

- 不删除 migration、数据库 volume、上传目录或历史记录；
- 发布前创建 PostgreSQL custom dump、上传文件归档和代码回滚点，并做独立数据库恢复演练；
- `.env*` 不进入 Docker build context，备份目录权限为 `0700`，备份文件为 `0600`；
- Schema 变更只能先在恢复副本验证；Awesome 只新增 `candidate_interests` 表与索引，不改写现有表行，发布前仍必须完成 dump、恢复副本 `db push` 和表计数对照；
- 部署只重建/重启 Web，数据库与 Nginx 不随应用重启；
- 发布前后对核心表做计数与只读抽样，任何意外差异立即回滚。

## Anti-references

- 不做按热度堆内容的 AI 导航站；
- 不做只收藏正文、没有效果和来源的 Prompt 搬运站；
- 不把 Prompt、工具、App 和视觉稿混成同一种卡片；
- 不把 AI 草稿伪装成人工结论；
- 不把来源或权利未确认的图片直接放进公开目录；
- 不用堆叠解释与假指标的营销式 Hero、玻璃拟态、渐变发光或圆角卡片墙遮挡真实内容；
- 不把“归档”实现成不可恢复的物理删除。

## Success Criteria

- 访客进入工作台后看到真实提示词菜单和居中的真实效果；
- 首页首屏保持完整并提供唯一 `ENTER`，工作台内才能编辑和测试 Prompt；
- 工作台测试输出带真实模型归属、不会写库，也不会越过人工发布门禁；
- 2–3 条同类提示词可在独立 URL 并排比较；
- Gallery 可用同一场景比较至少 30 种视觉语言，复制每种风格配方，并明确区分合成种子与人工验证案例；
- 主库只显示已公开 Skill，草稿与历史 Target.prompt 不混入；
- 新内容默认草稿，AI 归属和人工门禁可审计；
- 历史 URL、数据、评论和上传文件保持可访问；
- 单测、TypeScript、生产构建、桌面/移动真实渲染和发布前后数据对账全部通过。
