# Test Cases: rate-limit

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| RL-UT-001 | 匿名发评配额内 | count=4 -> +1 | 成功，剩余额度 0 |
| RL-UT-002 | 匿名发评超额 | count=5 -> +1 | `ERR_RATE_LIMIT_EXCEEDED` |
| RL-UT-003 | 不同 actor 隔离 | user 与 anonymous | 计数互不影响 |
| RL-UT-004 | 时间窗口切换 | 跨 UTC+8 日期 | 配额自动重置 |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| RL-CT-001 | `checkAndConsume` | actor 缺失 | 返回 400 |
| RL-CT-002 | `getRemainingQuota` | 未命中记录 | 返回默认满额 |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| RL-IT-001 | review 发布接入限流 | 超额时不写入 reviews |
| RL-IT-002 | like 接入限流 | 超额时不写入 likes、不增计数 |
| RL-IT-003 | ip 段总限流 | 多 actor 累积触发 429 |

