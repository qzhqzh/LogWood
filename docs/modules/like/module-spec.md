# Module Spec: like

## 1. 目标与边界
### In Scope
- 评测点赞（`review_likes`）
- 评论点赞（`comment_likes`）
- 点赞幂等与计数更新

### Out of Scope
- 点踩、反应表情等扩展互动

## 2. 数据归属
- Owned tables: `review_likes`, `comment_likes`
- 依赖 contract：
  - `identity.resolveActor`
  - `rateLimit.checkAndConsume(like_create)`
  - `review/comment` 存在性查询

## 3. 核心规则
- 幂等：重复点赞返回成功且不重复计数
- 唯一键：
  - `review_likes(reviewId,userId)` / `(reviewId,anonymousUserId)`
  - `comment_likes(commentId,userId)` / `(commentId,anonymousUserId)`
- 不允许对 `deleted` 对象点赞

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_LIKE_TARGET_NOT_FOUND` | 404 | 点赞目标不存在 |
| `ERR_LIKE_TARGET_INVALID` | 400 | 点赞目标类型非法 |
| `ERR_RATE_LIMIT_EXCEEDED` | 429 | 达到频率上限 |

## 5. 可观测指标
- `like_request_total`
- `like_idempotent_hit_count`
- `like_create_latency_ms`

## 6. 兼容性约束
- `POST /api/reviews/:id/like` 返回 `liked,likesCount` 必须稳定
- 幂等语义不得在版本间改变

