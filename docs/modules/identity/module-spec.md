# Module Spec: identity

## 1. 目标与边界
### In Scope
- 登录用户身份解析（NextAuth session -> `userId`）
- 匿名身份创建与复用（`deviceFingerprint` -> `anonymousUserId`）
- 统一身份上下文输出（供 review/comment/like/report 使用）

### Out of Scope
- OAuth 提供方业务逻辑细节
- 用户画像与成长体系

## 2. 数据归属
- Owned tables: `users`, `anonymous_users`
- 对外只暴露：
  - `resolveActor(ctx) -> { actorType, userId?, anonymousUserId?, actorKey }`
  - `ensureAnonymous(deviceFingerprint) -> anonymousUser`

## 3. 核心规则
- 所有写操作必须携带 actor 上下文
- `userId` 与 `anonymousUserId` 必须互斥
- `deviceFingerprint` 全局唯一
- 匿名名称采用 `匿名#<sequenceNumber>`

## 4. 错误码
| Code | HTTP | Meaning |
|------|------|---------|
| `ERR_IDENTITY_MISSING` | 401 | 无法识别身份 |
| `ERR_DEVICE_FINGERPRINT_INVALID` | 400 | 设备指纹无效 |
| `ERR_IDENTITY_CONFLICT` | 400 | user/anonymous 身份冲突 |

## 5. 可观测指标
- `identity_resolve_success_rate`
- `anonymous_user_create_count`
- `identity_conflict_count`

## 6. 兼容性约束
- 任何模块不得直接查询 `anonymous_users`，必须经 identity contract
- 匿名标识生成规则变更需 ADR

