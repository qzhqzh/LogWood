# LogWood 安全性审查报告

- 审查日期：2026-04-01
- 审查方式：代码静态审查（应用层、鉴权层、上传链路、容器配置）
- 审查范围：src、next.config.js、docker-compose.yml、.env.example
- 结论摘要：发现 8 项风险（高危 3，中危 5）

## 使用说明

- 每一项都包含：风险描述、影响、建议修复。
- 你可以在“处理决策”中填：
  - `接受处理`：需要修复
  - `暂缓`：排期处理
  - `豁免`：评估后不处理（需写理由）

## 风险清单

### R-01 高危：IP 来源可伪造，限流与行为归因可被绕过

- 位置：src/modules/identity/service.ts
- 现象：直接信任 `x-forwarded-for` / `x-real-ip`。
- 影响：攻击者可伪造 IP，绕过按 IP 的限流与风控分群。
- 建议修复：
  1. 仅在可信反向代理场景读取转发头。
  2. 其他场景回退真实连接地址。
  3. 将 IP 哈希改为带服务端密钥的 HMAC-SHA256。
- 处理决策：待定
- 豁免理由（如有）：

### R-02 高危：匿名身份可被批量制造，存在数据库放大风险

- 位置：src/modules/identity/service.ts、src/app/api/reviews/route.ts、src/app/api/comments/route.ts
- 现象：GET 侧通过 fingerprint 也可能触发匿名用户创建。
- 影响：可被脚本批量构造 fingerprint 造成 anonymousUser 表膨胀，拖慢查询。
- 建议修复：
  1. GET 只解析身份，不创建匿名用户。
  2. 仅 POST 等写操作允许创建匿名用户。
  3. 对 fingerprint 增加长度、格式、字符集限制。
  4. 对匿名创建单独限流。
- 处理决策：待定
- 豁免理由（如有）：

### R-03 高危：上传仅校验 MIME/大小，缺少文件签名校验

- 位置：src/app/api/uploads/article-image/route.ts、src/app/api/uploads/article-video/route.ts
- 现象：依赖 `file.type` 与扩展名映射，未做 magic number 检测。
- 影响：可上传伪装文件到公开目录，增加恶意内容分发风险。
- 建议修复：
  1. 增加文件头签名校验（magic number）。
  2. 落盘前可接入恶意样本扫描（如 ClamAV）。
  3. 上传资源迁移到对象存储并使用受控访问策略。
- 处理决策：待定
- 豁免理由（如有）：

### R-04 中危：远程图片域名白名单过宽

- 位置：next.config.js
- 现象：`images.remotePatterns.hostname = "**"`。
- 影响：任意 HTTPS 域名可进入图片优化链路，带宽和拉取面过大。
- 建议修复：
  1. 改为明确 allowlist 域名。
  2. 如需广泛外链，增加代理层审核与缓存策略。
- 处理决策：待定
- 豁免理由（如有）：

### R-05 中危：管理员登录缺少登录防爆破措施

- 位置：src/lib/auth.ts
- 现象：管理员凭据登录路径未见失败次数和时间窗口限制。
- 影响：存在在线暴力尝试风险。
- 建议修复：
  1. 为管理员登录增加账号+IP 维度限流。
  2. 连续失败触发冷却时间或临时锁定。
  3. 增加登录失败审计日志。
- 处理决策：待定
- 豁免理由（如有）：

### R-06 中危：标签/表情管理仅校验“登录”，缺少管理员权限限制

- 位置：src/app/api/tags/route.ts、src/app/api/tags/[id]/route.ts、src/app/api/emojis/route.ts、src/app/api/emojis/[id]/route.ts
- 现象：写操作校验 `session.user.id`，未统一校验 admin 角色。
- 影响：任意登录用户可修改站点基础数据，造成污染或破坏。
- 建议修复：
  1. 写接口统一改为管理员权限校验。
  2. 或引入细粒度 RBAC（editor/moderator/admin）。
- 处理决策：待定
- 豁免理由（如有）：

### R-07 中危：缺少统一安全响应头基线

- 位置：next.config.js、src/app/layout.tsx
- 现象：未看到统一下发 CSP、X-Frame-Options、X-Content-Type-Options 等。
- 影响：浏览器侧防护基线不足。
- 建议修复：
  1. 在 Next headers 中配置安全头。
  2. 对内联脚本使用 nonce/hash，逐步收紧 CSP。
- 处理决策：待定
- 豁免理由（如有）：

### R-08 中危：生产密钥存在默认回退值风险

- 位置：docker-compose.yml、.env.example
- 现象：`NEXTAUTH_SECRET` 存在默认占位值回退。
- 影响：若生产误用默认值，会导致会话安全性降低。
- 建议修复：
  1. 启动时强校验关键密钥不可为默认值。
  2. CI 增加配置检查，阻断弱密钥发布。
- 处理决策：待定
- 豁免理由（如有）：

## 建议执行顺序

1. R-01、R-02、R-03（直接影响风控与上传面）
2. R-05、R-06（认证与授权面）
3. R-04、R-07、R-08（平台基线与发布安全）

## 复核建议

- 每修复一项，补一条对应测试（单测或集成测试）。
- 修复完成后做一次二次审查并更新本报告状态。
