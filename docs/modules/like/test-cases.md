# Test Cases: like

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| LK-UT-001 | 首次点赞评测 | valid actor + reviewId | 创建 like，计数 +1 |
| LK-UT-002 | 重复点赞评测 | same actor + reviewId | 成功返回，计数不变 |
| LK-UT-003 | 首次点赞评论 | valid actor + commentId | 创建 like，计数 +1 |
| LK-UT-004 | 点赞已删除对象 | deleted target | 返回目标不可用错误 |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| LK-CT-001 | `POST /api/reviews/:id/like` | repeated requests | 幂等响应稳定 |
| LK-CT-002 | 点赞错误码语义 | invalid target | 返回 404/400 与约定一致 |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| LK-IT-001 | 点赞 -> 限流命中 | 429 且不写 like |
| LK-IT-002 | 高并发重复点赞 | 最终仅 1 条 like 记录 |
| LK-IT-003 | 点赞后 review 热度排序 | likesCount 参与排序 |

