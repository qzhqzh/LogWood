# Test Cases: comment

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| CM-UT-001 | 最小长度边界 | 9 chars | `ERR_COMMENT_VALIDATION` |
| CM-UT-002 | 最大长度边界 | 501 chars | `ERR_COMMENT_VALIDATION` |
| CM-UT-003 | 有效评论 | 10-500 chars | 成功创建 |
| CM-UT-004 | 身份互斥 | user+anonymous | 写入失败 |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| CM-CT-001 | `POST /api/comments` | valid payload | 返回 `id,status,createdAt` |
| CM-CT-002 | `POST /api/comments` | invalid reviewId | 返回 404 |
| CM-CT-003 | 评论列表查询 | mixed statuses | 仅 published |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| CM-IT-001 | 评论发布 -> 限流命中 | 429 且不写库 |
| CM-IT-002 | 评论发布 -> 风控命中 | `status=pending` |
| CM-IT-003 | 评论发布 -> 举报折叠后查询 | hidden 不公开 |

