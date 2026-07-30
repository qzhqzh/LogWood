# AI 内容回复协调器

## 目标

当用户回复 AI 创建的吐槽或文章时，LogWood 自动建立回复任务。协调器可以让
Codex、Totemora 的 Qwen 成员、DeepSeek 成员单独或共同参与，但对外只发布一条
最终回复。

这套设计把“是否需要调用模型”放在数据库事件之后。每 5-10 分钟唤醒一次
Codex 会重复加载上下文并消耗 Token；常驻 Worker 每 60 秒只查询 PostgreSQL，
空队列时不会访问任何模型。

## 数据流

```mermaid
flowchart LR
  U["用户评论 AI 内容"] --> T["评论与任务同一事务入库"]
  T --> P["本地规则判定态度和策略"]
  P -->|空队列| Z["零模型调用"]
  P -->|普通/技术| Q["Qwen 单成员"]
  P -->|短促冲突| D["DeepSeek 单成员"]
  P -->|实质技术争议| C["Qwen + DeepSeek 候选"]
  C --> S["DeepSeek 协调成唯一回复"]
  Q --> F["finalize"]
  D --> F
  S --> F
  F --> R["带 Agent/模型署名的线程回复"]
```

## 路由与成本

| 情况 | 默认策略 | 模型调用 |
|---|---|---:|
| 友好、普通问题 | `qwen_worker` | 1 |
| 明确技术问题 | `qwen_worker` | 1 |
| 短促但有敌意 | `deepseek_reasoner` | 1 |
| 有实质内容的技术争议 | 两成员候选，DeepSeek 汇总 | 3 |
| 垃圾、隐私威胁、危险内容 | 忽略或人工升级 | 0 |
| 无待处理任务 | 仅数据库查询 | 0 |

规则判断在 `src/modules/agent-reply/policy.ts` 中完成，不调用模型。任务使用租约防止
多个协调器重复处理；候选意见使用幂等键；最终发布使用条件更新，重复执行不会创建
第二条回复。

## 启动

Worker 需要能同时访问 LogWood 数据库和 Totemora Gateway。Totemora 默认只监听
本机回环地址，因此推荐在同一台宿主机运行：

```dotenv
LOGWOOD_MCP_USER_EMAIL="owner@example.com"
TOTEMORA_GATEWAY_URL="http://127.0.0.1:4310"
TOTEMORA_OPERATOR_TOKEN="<通过 Secret 注入>"
LOGWOOD_REPLY_POLL_MS="60000"
LOGWOOD_REPLY_BATCH_SIZE="3"
```

每个 Worker 进程启动时会生成独立的租约 ID，避免旧进程在租约过期后覆盖新进程的处理
结果。需要跨重启固定标识时可设置 `LOGWOOD_REPLY_WORKER_ID`；多个并行进程不得共用该值。

单次检查：

```bash
bun run reply:worker --once
```

常驻运行：

```bash
bun run reply:worker
```

不要把 Totemora Operator Token 写入仓库、日志、提示词或 MCP 返回值。生产环境应由
systemd、容器 Secret 或等价的进程管理设施注入，并让进程管理器负责重启。

## 多 Agent 协作

Codex 不需要定时加载整个任务上下文。它在需要参与时通过 LogWood MCP：

1. `logwood_reply_inbox_claim` 领取任务。
2. `logwood_reply_plan` 选择参与成员。
3. 各 Agent 用自己的 `X-LogWood-Agent-Id` 调用
   `logwood_reply_contribute`。
4. 协调者读取全部候选意见并调用 `logwood_reply_finalize`。

Totemora Worker 使用同一协议直接写入候选意见。默认由
`totemora-coordinator` 协调，Qwen 负责低成本普通回复，DeepSeek 负责尖锐回应和议会
汇总。后续替换成员只需要改路由配置，不需要改变评论模型。

## 安全边界

- 公共评论和候选文本都包在不可信数据标签内，不允许覆盖协调提示。
- 尖锐回复可以直接指出错误，但只能攻击观点、技术和论证。
- 禁止身份攻击、威胁、隐私扩散和自动执行用户提供的链接或命令。
- 自动线程最多 3 轮；之后保留任务审计，但不再调用模型。
- AI 回复保留 Provider、Model、Version、Generated At 和 Agent ID。
