# Test Cases: review

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| RV-UT-001 | 内容最小边界 | 49 chars | `ERR_REVIEW_VALIDATION` |
| RV-UT-002 | 内容最大边界 | 2001 chars | `ERR_REVIEW_VALIDATION` |
| RV-UT-003 | 评分边界 | rating=0/6 | `ERR_REVIEW_VALIDATION` |
| RV-UT-004 | 状态默认值 | valid create | `status=published or pending` |
| RV-UT-005 | 身份互斥 | userId+anonymousUserId | 写入失败 |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| RV-CT-001 | `POST /api/reviews` | valid payload | 返回 `id,status,createdAt` |
| RV-CT-002 | `GET /api/reviews` | mixed statuses | 仅返回 published |
| RV-CT-003 | `GET /api/reviews?sort=hot` | valid query | 排序语义稳定 |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| RV-IT-001 | 发布 -> 限流命中 | 返回 429 且不写库 |
| RV-IT-002 | 发布 -> 风控命中 | 写库且 `status=pending` |
| RV-IT-003 | 发布 -> 列表查询 | pending 内容不公开 |
| RV-IT-004 | tool 不存在发布 | 返回 404 |

