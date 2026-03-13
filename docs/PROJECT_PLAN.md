# LogWood 项目计划书

## 1. 文档目的
本文件用于快速理解项目现状、里程碑、架构边界和近期变更。

维护规则（强制）：
- 涉及功能新增、功能修复、架构调整、部署策略变更时，必须同步更新本文件。
- 代码评审时将本文件更新作为必检项。
- 新成员应先阅读本文件，再阅读 SPEC 与模块文档。

## 2. 项目定位
- 项目名称：LogWood
- 定位：AI 编码工具评测社区（AI Editor / AI Coding）
- 核心价值：沉淀真实使用反馈，支持工具横向比较和社区内容沉淀。

## 3. 当前范围（Core Scope）
- 工具目录与详情：/editor、/coding、/:type/[slug]
- 评测闭环：发布、列表、详情、排序（latest/hot）
- 互动能力：点赞、评论、举报
- 内容能力：文章发布、文章管理、文章列表与详情
- 身份能力：登录用户 + 匿名用户
- 治理能力：限流、内容风险判定、自动隐藏与审核流

## 4. 架构与部署概览
- 技术栈：Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL + NextAuth
- 架构风格：模块化单体（modules）
- 部署形态（当前仓库）：Docker Compose
  - postgres：数据存储
  - web：Next.js 应用
  - web 直接对外：80 -> 3000

## 5. 模块边界（高层）
- identity：登录身份、匿名身份解析
- target：工具目录与工具统计
- review：评测发布与查询
- comment：评论发布与查询
- like：点赞及基础内容风险判定函数
- moderation：举报、自动折叠、处理状态流转
- rate-limit：行为限流（用户/匿名/IP 段）
- article：文章发布、管理、slug 编码

## 6. 质量策略（核心）
- 单元测试优先覆盖核心业务：发布、鉴权、限流、状态机、风险判定
- 边界/缺陷修复必须补测试
- 目标：守住高风险回归，不追求所有展示层细节测试

## 7. 近期关键风险与约束
- NextAuth 生产环境必须配置正确的 NEXTAUTH_URL（公网域名），不能指向 localhost。
- 代理链路场景下，登录回调 URL 必须做安全归一化，避免错误跳转。
- 当前 web 容器默认启动开发模式，正式生产建议使用 build + start。

## 8. 变更记录

### 2026-03-13
- 修复登录可能跳转 localhost 的问题：
  - 增加回调地址清洗逻辑，阻断 localhost 绝对地址。
  - 增加生产环境 NEXTAUTH_URL 启动校验。
- 增补核心模块单元测试：comment、target、rate-limit、identity callback URL。
- 部署入口策略调整为 web 直接暴露 80:3000，由外部代理层接管后续转发策略。

## 9. 下阶段计划（简版）
1. 部署模式切换为生产运行（Next.js build + start），拆分 dev/prod compose。
2. 增补核心 API 集成测试（articles/reviews/comments）。
3. 为审核与限流补充可观测指标（命中率、拦截率、误判率）。
4. 增加发布前检查流程：强制校验 PROJECT_PLAN 变更记录更新。
