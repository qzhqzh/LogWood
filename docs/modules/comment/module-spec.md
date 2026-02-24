# Module Spec: comment

## 1. 目标与边界
### In Scope
- 评论发布与查询
- 状态流转：`published | pending | hidden | deleted`
- 评论计数更新

### Out of Scope
- 评论楼中楼（MVP 仅一级评论）

## 2. 数据归属
- Owned tables: `comments`
- 依赖 contract：
  - `identity.resolveActor`
  - `review.getById`（目标评测存在性与可评论性）
  - `rateLimit.checkAndConsume(comment_create)`
  - `moderation.assessCommentContent`

## 3. 核心规则
- `content length in [10,500]`
- 仅允许对未删除 review 评论
- 公开查询仅返回 `status=published`
- 身份字段互斥约束必须生效

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_COMMENT_VALIDATION` | 400 | 评论内容非法 |
| `ERR_COMMENT_NOT_FOUND` | 404 | 评论不存在 |
| `ERR_REVIEW_NOT_FOUND` | 404 | 评测不存在 |
| `ERR_RATE_LIMIT_EXCEEDED` | 429 | 达到频率上限 |

## 5. 可观测指标
- `comment_create_success_rate`
- `comment_pending_rate`
- `comment_query_latency_ms`

## 6. 兼容性约束
- `POST /api/comments` 出参包含 `id,status,createdAt`
- 评论数据结构扩展必须保持已有字段语义稳定

