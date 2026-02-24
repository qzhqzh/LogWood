# Module Spec: moderation

## 1. 目标与边界
### In Scope
- 内容风险评估（评测/评论）
- 举报受理与状态流转（`reports`）
- 达阈值自动折叠（`hidden`）

### Out of Scope
- 复杂机器学习审核模型
- 人工审核后台完整功能（Phase 2 扩展）

## 2. 数据归属
- Owned tables: `reports`
- 协作更新：`reviews.status`、`comments.status`
- 对外 contract：
  - `assessReviewContent(content) -> published|pending`
  - `assessCommentContent(content) -> published|pending`
  - `createReport(targetType,targetId,reason,actor)`
  - `applyAutoHideIfThresholdReached(target)`

## 3. 核心规则
- 举报人身份二选一（user/anonymous）
- 举报目标仅支持 `review | comment`
- 自动折叠阈值（MVP 默认）：
  - 同一内容 `open reports >= 5` -> `hidden`
- 审核状态：`open | resolved | rejected`

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_REPORT_TARGET_INVALID` | 400 | 举报目标类型非法 |
| `ERR_REPORT_TARGET_NOT_FOUND` | 404 | 举报目标不存在 |
| `ERR_REPORT_VALIDATION` | 400 | 举报原因无效 |

## 5. 可观测指标
- `moderation_pending_rate`
- `report_create_rate`
- `auto_hidden_count`

## 6. 兼容性约束
- 举报 API 的 `targetType` 枚举不可隐式扩展
- 自动折叠阈值应配置化，不写死在控制器层

