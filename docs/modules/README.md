# LogWood 模块划分与治理总览

本文档将 `SPEC.md` 的规划转为模块化执行规范，目标是支持“小模块独立重构”，同时保持整体一致性与可演进性。

## 1. 模块清单

- `identity`: 登录身份与匿名身份识别
- `target`: AI 工具目录、详情与标签
- `review`: 评测发布、查询、排序、状态
- `comment`: 评论发布、查询、状态
- `like`: 点赞幂等与计数
- `moderation`: 敏感词、举报、折叠、审核流
- `rate-limit`: 用户/设备/IP 的限流与审计

## 2. 依赖规则（强约束）

### 2.1 分层依赖
- 仅允许：`api -> application -> domain -> infra`
- 禁止：跨模块直接访问对方 `infra` 与数据库表

### 2.2 模块依赖矩阵
- `identity`: 不依赖业务模块
- `target`: 仅依赖 shared
- `review`: 依赖 `identity`、`target`、`moderation`、`rate-limit`
- `comment`: 依赖 `identity`、`review`、`moderation`、`rate-limit`
- `like`: 依赖 `identity`、`review/comment`、`rate-limit`
- `moderation`: 依赖 `identity`（举报人）、读 `review/comment` 的公开契约
- `rate-limit`: 不依赖其他业务模块（由其他模块调用）

## 3. 统一业务约束

- 身份互斥：`userId` 与 `anonymousUserId` 二选一
- 点赞幂等：重复点赞返回成功但不重复计数
- 公开查询只返回 `status=published`
- 风控可将内容置为 `pending`
- 举报达到阈值可自动 `hidden`
- 限流窗口统一为 `UTC+8` 自然日

## 4. 统一测试门槛

- 每个模块必须有：
  - `module-spec.md`
  - `test-cases.md`
- 每个模块至少覆盖：
  - 输入校验边界
  - 状态流转
  - 错误码语义
  - 并发/幂等关键路径
- 跨模块必须补集成场景：
  - 发布 -> 风控 -> 展示
  - 点赞/评论 -> 限流
  - 举报 -> 折叠

## 5. 文档落地路径

- `docs/modules/<module>/module-spec.md`
- `docs/modules/<module>/test-cases.md`

