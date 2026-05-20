# LogWood 安全与架构加固执行计划

> 本文档是「FEAT-005 Security & Architecture Hardening」的可执行清单。
> 配套：`docs/SECURITY_REVIEW_2026-04-01.md`（已知风险清单 R-01~R-08）。
> 目标：在不大改业务数据的前提下，把可被利用的高/中危风险一次性收口，并补足代码层的可维护性短板。

## 0. 范围与边界

**会做：**
- 全部 P0 与 P1 风险修复（鉴权、限流、上传、安全头、IP 处理）。
- 一处 Prisma schema 增强：`Target.updatedAt`、新增 `AdminAuditLog` 模型、`RateLimitAction` 增加 `admin_login_attempt`。
- 代码可维护性收口：结构化日志、API 错误包装器、Dockerfile 非 root + multi-stage。

**不会做（推迟到 Phase 3+）：**
- 业务表字段删除/重命名（保护已有数据）。
- 引入 ORM 之外的 raw SQL。
- 引入新 npm 依赖（保持沙箱可静态校验，避免依赖膨胀）。
- CSRF token、ISR 缓存策略、Sentry/APM 接入。
- `next.config.js` `images.remotePatterns` 收紧（需要先盘点已有外链图片域名）。

## 1. Phase 1（无 DB 改动）

### S1. 鉴权与密钥
- `src/lib/auth.ts`：生产启动时若 `NEXTAUTH_SECRET` 缺失或为已知占位字符串则 throw（让 Next.js 启动直接失败）。
- `docker-compose.yml`：把 `${NEXTAUTH_SECRET:-...}` 改成 `${NEXTAUTH_SECRET:?...}`，强制必填。
- `.env.example`：删掉默认占位值，改为生成命令注释。
- 接受 `ADMIN_PASSWORD` 但在生产模式下若 `ADMIN_PASSWORD_HASH` 未设置则 `console.warn`（不阻断）。

### S2. 鉴权权限收口（R-06）
- `/api/tags` POST、`/api/tags/[id]` DELETE：补 `isAdminSession()` 检查。
- `/api/emojis` POST、`/api/emojis/[id]` DELETE：补 `isAdminSession()` 检查。
- `/api/article-columns` POST 已有，复核 OK。

### S3. 匿名身份创建管控（R-02）
- `src/modules/identity/service.ts`：`resolveActorWithFingerprint` 接受可选 `{ createIfMissing }`，**默认 false**。
- 仅在 POST/写操作的 route handler 显式传 `{ createIfMissing: true }`。
- `ensureAnonymous`：fingerprint 校验改为 `length 16-128`、字符集 `[A-Za-z0-9_-]`。
- 未来：把 `displayName` 改成 hash-based 而非全局自增（本期保持兼容，避免数据迁移）。

### S4. IP 处理与限流加固（R-01）
- 新增 `src/lib/ip.ts`：
  - `getClientIp(headers)`：仅当 `LOGWOOD_TRUST_PROXY=true` 时读 `x-forwarded-for` / `x-real-ip`，否则忽略（直连场景以 `unknown` 兜底）。
  - `hashIp(ip)`：HMAC-SHA256，密钥取 `LOGWOOD_IP_HASH_SECRET`，未配置时退化到与现状一致并 `console.warn`。
- `src/modules/identity/service.ts`：调用上述工具替换原始 `hashString`。

### S5. 安全响应头（R-07）
- `next.config.js`：新增 `headers()`，对所有路由下发：
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy-Report-Only: ...`（先 report-only，待生产验证后再切到 enforce）
- `nginx/nginx.conf`：保留现有头不冲突，移除已弃用的 `X-XSS-Protection`。
- 上线前若有 staging 环境，加 `X-Robots-Tag: noindex` via `STAGING=1` 环境变量（可选）。

### S6. 文件上传加固（R-03）
- 新增 `src/lib/file-signature.ts`：常见图片/视频的 magic byte 校验（不引依赖，纯字节比对）。
- `src/app/api/uploads/article-image/route.ts` 与 `article-video/route.ts`：
  - 读取首 16 字节做 magic-byte 验证，拒绝 MIME 与文件签名不一致的请求。
  - 走 `checkAndConsume('article_upload', actor)` 限流（admin 也受限，避免误操作刷写）。
  - 文件名 ext 加白名单兜底，避免 `image/svg+xml` 之类被拼接。

### S7. 输入校验与 DoS 缓解
- 新增 `src/lib/safe-parse.ts`：
  - `parsePositiveInt(value, { default, max })`、`parsePageSize(value, { default, max })`。
  - 用于 `articles/route.ts`、`reviews/route.ts`、`comments/route.ts`、`comments/manage/route.ts` 等所有 query 解析。
- `src/modules/target/service.ts` `listTargets`：把 `reviews: { select: { rating: true } }` 替换为 `_avg` 聚合，避免 10000 条评测全量加载。
- `src/app/api/comments/manage/route.ts`：`keyword` 长度限制 ≤ 80 字符。

### S8. 结构化日志与 API wrapper
- 新增 `src/lib/logger.ts`：基于 `console` 的轻量结构化 logger，输出 JSON 行（level/timestamp/msg/context）。
- 新增 `src/lib/api-handlers.ts`：`withApiError(handler)` 装饰器，统一捕获 ZodError、`ERR_*` 业务错误、未知异常，并加 requestId。
- 渐进迁移：本期只在新写代码用，存量 route 不强制改。

### S9. Dockerfile 加固
- `Dockerfile`：
  - 拆 multi-stage：`deps` -> `builder` -> `runner`。
  - 新增 `nextjs:nodejs` 用户，`USER nextjs`。
  - 加 `HEALTHCHECK` 调用 `/health`（nginx 已暴露 `/health`，应用层加一个 `/api/health` route）。
- 新增 `src/app/api/health/route.ts`：返回 `{ status: 'ok', uptime, version }`，不查 DB。

## 2. Phase 2（DB Migration）

### S10. Schema 改动（`prisma/schema.prisma`）
- `Target` 增加 `updatedAt DateTime @updatedAt`。
- 新增 `AdminAuditLog`：
  ```prisma
  model AdminAuditLog {
    id          String   @id @default(cuid())
    actorUserId String
    action      String   // e.g. 'article.delete', 'comment.hide'
    targetType  String   // 'article' | 'comment' | 'review' | 'target' | 'app'
    targetId    String
    metadata    String?  // JSON string for extra context
    createdAt   DateTime @default(now())
    actor       User     @relation(fields: [actorUserId], references: [id], onDelete: Cascade)
    @@index([targetType, targetId])
    @@index([actorUserId, createdAt])
    @@map("admin_audit_logs")
  }
  ```
- `User` 增加反向关系 `adminAuditLogs AdminAuditLog[]`。
- `RateLimitAction` enum 增加 `admin_login_attempt`。

### S11. 审计日志接入
- 新增 `src/modules/audit/service.ts`：`recordAdminAction(actorUserId, action, targetType, targetId, metadata?)`。
- 接入点（destructive admin endpoints）：
  - `DELETE /api/articles/[id]`、`PATCH /api/articles/[id]`（status 变化）、`DELETE /api/comments/manage/[id]`、`PATCH /api/comments/manage/[id]`、`DELETE /api/targets`、`PATCH /api/targets`、`DELETE /api/tags/[id]`、`DELETE /api/emojis/[id]`。

### S12. Admin 登录限流
- `src/lib/auth.ts` `CredentialsProvider.authorize`：
  - 在密码校验前后都 `checkAndConsume('admin_login_attempt', { actorType: 'ip_segment', actorKey: ip })`。
  - 失败 5 次/24h 后返回 null（NextAuth 会显示通用错误）。
  - 成功后清空当日计数（可选；本期保留即可）。

### S13. sitemap 利用真实 updatedAt
- `src/app/sitemap.ts`：去掉 review.updatedAt 兜底分支，直接用 `target.updatedAt`。
- 更新 `docs/SEO_STRATEGY.md` §13.9，把"Target.updatedAt 推迟"标记为已落地。

## 3. 验收清单

| 项 | 验证方式 |
|---|---|
| `NEXTAUTH_SECRET` 默认值不再可启动 | 启动时 throw；CI 跑一次构建确认 |
| Tags/Emojis 写接口需 admin | `curl` 用普通用户 token 测 POST 应得 403 |
| GET 带 fingerprint 不再创建 anonymous_user | 测试用例 `identity/service.test.ts` 验证 |
| HMAC IP 哈希 | 单元测试比对相同 IP 不同 secret 输出不同 |
| 安全头 | 浏览器 view DevTools Network 头确认 6 项 |
| Magic-byte | 测试用例：把 `<script>` 内容改名 .png 上传应被拒 |
| Dockerfile 非 root | `docker run logwood id` 应非 0 |
| 审计日志 | 删一篇文章后 `prisma.adminAuditLog.findMany()` 有一条 |
| Admin 登录限流 | 错误密码连试 6 次第 6 次返回 null（无论密码对错） |

## 4. 推迟到 Phase 3 的项

- CSRF token（暂时依赖 `sameSite=lax`，admin endpoints 已 server-session 校验）。
- ISR / `revalidatePath` 替换 `force-dynamic`。
- Sentry / APM。
- `images.remotePatterns` 从 `**` 收紧到具体域名 allowlist（需要先盘点）。
- 文章 viewCount 写改为 fire-and-forget + 抽样 + 去重（防 bot 刷量）。
- 把 `Article.tags` / `App.tags` / `Target.features` 从 JSON 字符串列改为 join 表。
