# Test Cases: moderation

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| MD-UT-001 | 敏感词命中评测 | risky content | 返回 `pending` |
| MD-UT-002 | 正常内容评论 | normal content | 返回 `published` |
| MD-UT-003 | 举报人身份冲突 | user+anonymous | 校验失败 |
| MD-UT-004 | 举报目标非法 | targetType=post | `ERR_REPORT_TARGET_INVALID` |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| MD-CT-001 | `POST /api/reports` | valid payload | 返回 `id,status=open` |
| MD-CT-002 | `POST /api/reports` | missing reason | 返回 400 |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| MD-IT-001 | review 发布 -> 风控评估 | 可转 `pending` |
| MD-IT-002 | comment 发布 -> 风控评估 | 可转 `pending` |
| MD-IT-003 | 连续举报达阈值 | 目标自动 `hidden` |
| MD-IT-004 | hidden 内容公开流查询 | 不可见 |

