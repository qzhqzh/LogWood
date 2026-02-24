# Test Cases: target

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| TG-UT-001 | 按类型筛选 | `type=editor` | 仅返回 editor 工具 |
| TG-UT-002 | slug 查询成功 | `type+slug` valid | 返回单条 target |
| TG-UT-003 | slug 查询失败 | missing slug | `ERR_TARGET_NOT_FOUND` |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| TG-CT-001 | `getTargetById` | 无效 id | 404 错误语义稳定 |
| TG-CT-002 | `listTargets` | 空过滤参数 | 返回分页默认值 |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| TG-IT-001 | review 发布前校验 target | target 不存在时阻断写入 |
| TG-IT-002 | 工具详情页加载 + review 列表 | 组合查询成功 |

