# Module Spec: rate-limit

## 1. 目标与边界
### In Scope
- 统一限流检查与计数（user/anonymous/ip_segment）
- 限流结果审计落库（`rate_limits`）
- 统一窗口口径（UTC+8 自然日）

### Out of Scope
- 复杂行为风控评分模型（归 moderation）

## 2. 数据归属
- Owned tables: `rate_limits`
- 对外 contract：
  - `checkAndConsume(action, actorContext, amount=1)`
  - `getRemainingQuota(action, actorContext)`

## 3. 核心规则
- 唯一键：`(action, actorType, actorKey, windowDate)`
- 限额（MVP）：
  - 匿名：`review_create<=5`、`comment_create<=20`、`like_create<=30`
  - 登录：`review_create<=10`、`like_create<=50`
  - IP 段总互动：`<=200`
- 超额返回 429，不执行下游写操作

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_RATE_LIMIT_EXCEEDED` | 429 | 超出配额 |
| `ERR_RATE_LIMIT_ACTOR_INVALID` | 400 | actor 信息不完整 |

## 5. 可观测指标
- `rate_limit_hit_count{action,actorType}`
- `rate_limit_check_latency_ms`
- `rate_limit_bypass_count`（应为 0）

## 6. 兼容性约束
- 限额调整仅改配置，不改 contract
- 时间口径变更必须 ADR（涉及统计与业务可解释性）

