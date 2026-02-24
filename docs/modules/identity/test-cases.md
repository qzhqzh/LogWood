# Test Cases: identity

## Unit Tests
| ID | Case | Input | Expected |
|----|------|-------|----------|
| ID-UT-001 | 登录用户解析 | valid session | 返回 `actorType=user` + `userId` |
| ID-UT-002 | 匿名用户创建 | new fingerprint | 创建 `anonymous_users` 记录 |
| ID-UT-003 | 匿名用户复用 | existing fingerprint | 返回已有 `anonymousUserId` |
| ID-UT-004 | 身份冲突拦截 | userId + anonymousUserId | 抛 `ERR_IDENTITY_CONFLICT` |

## Contract Tests
| ID | Contract | Scenario | Expected |
|----|----------|----------|----------|
| ID-CT-001 | `resolveActor` | 无 session 且无 fingerprint | `ERR_IDENTITY_MISSING` |
| ID-CT-002 | `ensureAnonymous` | 非法 fingerprint | `ERR_DEVICE_FINGERPRINT_INVALID` |

## Integration Tests
| ID | Flow | Expected |
|----|------|----------|
| ID-IT-001 | review 发布调用 identity | actor 上下文完整、身份互斥 |
| ID-IT-002 | comment 发布调用 identity | 可正确写入匿名评论作者 |

