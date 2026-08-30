# Prompt Vault 发布验收矩阵

状态：`通过` 已有可复核证据；`待验证` 尚未完成；`阻塞` 禁止发布。

| 领域 | 验收项 | 证据 | 状态 | 级别 |
|---|---|---|---|---|
| 产品 | 定位为可验证增强提示词仓库，不再是混合收藏首页 | `PRODUCT.md`、产品定位 | 通过 | P0 |
| IA | 一级导航只有 `PROMPT / COMMUNITY / ABOUT` | SiteNav test + 最终桌面/移动截图 | 通过 | P0 |
| 主库 | `/skills` 只显示 published Skill，不混 Target/App/draft | Skill service test + 线上页面（5 条） | 通过 | P0 |
| Home | 完整 `PROMPT / PROMPTS, PROVEN. / ENTER` 首屏近似批准稿 | 批准稿 + 1672/390 线上截图 | 通过 | P0 |
| Workbench | 左 Library、中 Output、右 Recipe 近似批准稿 | 批准稿 + 1672/390 线上截图 | 通过 | P0 |
| 中央效果 | Workbench 有图时居中真实 `effectImageUrl`，不裁切 | component tests + 最终截图 | 通过 | P0 |
| 无图回退 | 不生成伪效果，显示可执行正文与明确说明 | component tests + 对比页无图样本 | 通过 | P0 |
| 对比 | 可选择 2–3 条并在 `/compare/prompts` 并排查看 | 选择器实测 + 可分享 URL | 通过 | P0 |
| 对比真实性 | 只显示实际正文/效果/来源/归属/计数，不造综合分 | 最终对比截图 + 源码 | 通过 | P0 |
| 草稿门禁 | createSkill 与 Candidate 晋升默认 draft | 17 个 targeted tests | 通过 | P0 |
| Article 门禁 | 当前版本未批准不能发布，变更取消批准 | article service tests | 通过 | P0 |
| 安全归档 | DELETE Article 不物理删除来源/版本/贡献/评论 | route test | 通过 | P0 |
| AI 归属 | 完整字段保存；部分字段公开告警 | service/component tests | 通过 | P0 |
| Forge | 默认提示词草稿；幂等调用、恢复性错误、运行时状态可见 | forge/provider/runtime tests + 线上 `/forge` | 通过 | P0 |
| 输出类型 | text/image 可运行；document/video/other 仅管理且没有 runner | constants/workbench/service tests | 通过 | P0 |
| 真实模型 | DeepSeek 文本与 CPA 图片各完成一次不落库 smoke | `ATTRIBUTION_OK`；CPA JPEG 1408×768；`persisted:false` | 通过 | P0 |
| 模型归属 | 空白版本配置回退到实际 model ID | provider regression + 真实 DeepSeek smoke | 通过 | P0 |
| MCP 身份 | token 绑定 owner/agent，Header 不能自报覆盖 | MCP auth/server/route tests | 通过 | P0 |
| 历史兼容 | Target/App/Prompt/Article/Candidate/Review 旧 URL 抽样成功 | 7 条线上兼容路由均为 200 | 通过 | P0 |
| 来源项目 | LogWood 唯一运行根；三个来源不是构建依赖 | migration doc + 独立生产构建 | 通过 | P0 |
| 视觉权利 | 未确认 design-preview 资产不进入 public | 资产清单审计；运行时只用既有 Skill raster | 通过 | P0 |
| Secret | `.env*` 不进入 Docker context；敏感备份权限 0600 | `.dockerignore` + `stat` | 通过 | P0 |
| 依赖 | Docker 使用提交 lockfile 的 `npm ci --include=dev` | Dockerfile + 生产容器构建 | 通过 | P1 |
| 自动化 | 全量 Vitest | 61 files / 314 tests passed | 通过 | P0 |
| 类型 | TypeScript `--noEmit` | 命令输出 | 通过 | P0 |
| Prisma | validate/generate，生产 schema 无差异 | 两条命令通过；生产读取正常 | 通过 | P0 |
| 构建 | Next production build | 隔离 `.next-verify` 构建通过；51 个静态页生成 | 通过 | P0 |
| 桌面 UI | 1672px Home / Workbench 无溢出、遮挡或 console error | 2 张线上截图；`scrollWidth=1672`；0 error | 通过 | P0 |
| 移动 UI | 390px Home / Workbench；Output / Prompts / Edit 均可达 | 4 张线上截图；3 模式实测；0 overflow | 通过 | P0 |
| 可访问性 | 主区域语义、键盘焦点、label、aria-live、减少动态效果 | detector advisory 已审阅；finish PASS；可见控件 ≥40px | 通过 | P0 |
| 备份 | 新 PostgreSQL custom dump + SHA256 | 151022 bytes、0600、SHA256 已记录 | 通过 | P0 |
| 上传 | `public/uploads` 归档 + SHA256 | 3390903 bytes、0600、SHA256 已记录 | 通过 | P0 |
| 恢复 | dump 恢复到独立临时库，核心表计数一致 | 11 个核心表 + 4 个 ID 指纹一致 | 通过 | P0 |
| 发布前后 | 核心表计数/抽样 ID 无意外差异 | 发布后计数和 4 个 ID 指纹均一致 | 通过 | P0 |
| 部署 | 只重启 Web；DB/Nginx 保持运行 | Web `2026-08-26T07:00:46Z`；DB/Nginx 启动时间未变 | 通过 | P0 |
| 线上 | Home 版本 URL、Workbench、Prompt、Community、About、health 成功 | 公网 smoke + Playwright；无 server exception | 通过 | P0 |
| CDN | EdgeOne 裸 `/` 旧的一年 HTML 缓存已清除 | 裸 `/` 返回 `PROMPTS, PROVEN.` 且非 HIT | 待验证 | P0 |
| Finish review | Impeccable detector + finish verdict 无界面阻塞 | `artifacts/ui/phase1-finish-review-20260826.md` | 通过 | P0 |

## 自动化命令

```bash
./node_modules/.bin/prisma validate
./node_modules/.bin/prisma generate
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
NEXT_DIST_DIR=.next-verify ./node_modules/.bin/next build
```

## UI 验收剧本

1. Home 首屏核对 `PROMPT / PROMPTS, PROVEN. / ENTER`，并观察进入和随机 glitch；
2. Workbench 切换 Library 中不同 Prompt，核对中央真实效果与右侧正文；
3. 管理员登录后分别运行 text 与 image，确认中央实时更新且刷新后不留存；
4. 选择 document / video / other，确认可管理但显示 `NO RUNNER`；
5. 选择 2–3 条进入对比，逐行核对效果、正文、来源和 AI 归属；
6. 390px 下切换 Output / Prompts / Edit，确认导航、文本框和锁定态可达；
7. Forge 默认“提示词草稿”，未登录只读，错误与重试说明清楚；
8. 抽样旧 `/prompt`、`/model`、`/editor`、`/coding`、`/app`、Article URL。

## 数据安全剧本

1. 只读记录发布前核心表计数与抽样 ID；
2. 创建 dump、上传归档与 hash；
3. 独立恢复，不覆盖生产 data/volume；
4. 在恢复副本运行只读计数和关系抽样；
5. 部署只替换 Web；
6. 发布后重复计数和 URL smoke；
7. 差异不为零则停止写入并执行代码回滚，禁止直接覆盖生产 DB。
