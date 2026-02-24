# Module Spec: review

## 1. 目标与边界
### In Scope
- 评测发布、编辑（后续）、查询、排序
- 状态流转：`published | pending | hidden | deleted`
- 质量分字段维护（MVP 先默认值）

### Out of Scope
- 富文本编辑器能力
- 推荐系统与个性化排序

## 2. 数据归属
- Owned tables: `reviews`
- 依赖 contract：
  - `identity.resolveActor`
  - `target.getTargetById`
  - `rateLimit.checkAndConsume(review_create)`
  - `moderation.assessReviewContent`

## 3. 核心规则
- 发布前校验：
  - `rating in [1,5]`
  - `content length in [50,2000]`
  - `targetId` 必须存在
- 公开查询仅返回 `status=published`
- 排序：
  - `latest` 按 `createdAt desc`
  - `hot` 按 `likesCount` + 时间衰减（MVP 可先 likesCount desc）
- 身份字段互斥约束必须生效

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_REVIEW_VALIDATION` | 400 | 字段校验失败 |
| `ERR_REVIEW_NOT_FOUND` | 404 | 评测不存在 |
| `ERR_REVIEW_FORBIDDEN` | 403 | 无权限操作 |
| `ERR_RATE_LIMIT_EXCEEDED` | 429 | 达到频率上限 |

## 5. 可观测指标
- `review_create_success_rate`
- `review_status_pending_rate`
- `review_list_latency_ms`

## 6. 兼容性约束
- `POST /api/reviews` 出参必须含 `id,status,createdAt`
- `GET /api/reviews` 默认分页参数稳定：`page=1,pageSize=20`

