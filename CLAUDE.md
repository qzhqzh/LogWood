# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

空心树洞（仓库名 `LogWood`）是 **AI 灵感炼成与实践沉淀社区**，品牌副标题为：**大浪淘沙，找寻灵感**。

产品围绕同一个灵感、资源或 Skill 建立两条可追溯的轨道：

1. **资产进化线**：灵感 / 资源 → 候选 → 试用 → 验证 → 模板 / Prompt / Workflow → 可复用 Skill → Quick Start / 技能包 → 维护或归档。
2. **经验沉淀线**：吐槽 / 快评 → 讨论 / 求证 → 实验与失败样本 → 技术小结 → 正式评测 / 前沿观点 / 复盘反思。

完整产品定义以 `docs/PRODUCT_POSITIONING.md` 为唯一权威来源。整体迁移由 GitHub Issue #15 跟踪。

### Product invariants

- 同一个 Subject 的成熟度变化不得静默复制成互不关联的新对象。
- 历史 Review、Comment、Like、作者、slug 和可访问路径必须保留。
- Candidate 最终应成为 Resource 生命周期状态；Gallery/App 最终映射为 Resource 或 Skill Example。
- Skill 不等于一段 Prompt；目标模型包含版本、依赖、示例、Quick Start、评测和最近验证时间。
- `Review` 与 `Evaluation` 语义不同：Review 是自由记录 / Quick Take；Evaluation v2 是正式、版本化、证据优先的评测层。
- 已发布 Evaluation 必须通过协议门禁：完整维度评分、输出或证据、复现级别、限制和结论。
- Evaluation 协议字段不得随意改名；协议升级必须提升 `protocolVersion` 并保证历史解释不变。
- AI 只负责整理、建议和连接，不得伪造测试或把未验证内容包装成事实。
- 当前 Forge 仍是本地模板生成，不得声称已接入真实模型。

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js Route Handlers + Service Layer
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (GitHub OAuth + Admin Credentials)
- **Deploy**: Docker Compose (Bun + Nginx), Vercel (prod)

## Essential Commands

### Development (Docker Compose)

```bash
# Start everything (web + postgres + nginx) — production build by default
docker compose up --build

# Local dev mode (hot reload)
NODE_ENV=development docker compose up --build

# Access services
docker compose exec web bunx prisma db push       # Sync schema to DB
docker compose exec web bunx prisma generate      # Regenerate Prisma Client
docker compose exec web bun run db:seed           # Seed test data
docker compose exec web bun run test              # Run tests
docker compose exec web bun run lint              # Run ESLint
docker compose down                               # Stop and cleanup
```

### Prisma Commands

```bash
bun run db:generate
bun run db:push
bun run db:migrate
bun run db:studio
bun run db:seed
```

After changing `prisma/schema.prisma`, always regenerate Prisma Client before TypeScript checks. Evaluation v2 is an additive schema change; deployment must run `prisma generate` and `prisma db push` (or a reviewed migration in production).

### Next.js

```bash
bun run dev
bun run build
bun run start
bun run lint
bun run test
bun run test:watch
bunx tsc --noEmit
```

### Force Re-seed Database

Set `FORCE_DB_SEED=1` in `.env` and restart `docker compose up --build`.

### Deployment Architecture

```text
[Client] → [Upstream Nginx (SSL termination)] → [Nginx (:10000, gzip/cache/rate-limit)] → [Next.js (:3000)]
```

- **Production mode**: `NODE_ENV=production` → `bun run build` + `bun run start`
- **Dev mode**: `NODE_ENV=development` → `bun run dev`
- Production `NEXTAUTH_URL` must be a public HTTPS URL.

## Architecture

### Modular Monolith

The codebase uses a modular architecture under `src/modules/`. Each module normally exports its service contract through `index.ts`.

**Modules**: `skill`, `candidate`, `review`, `evaluation`, `like`, `comment`, `moderation`, `rate-limit`, `identity`, `target`, `article`, `article-column`, `app`, `forge`, `audit`, `tag`, `emoji`.

Route Handlers call module services. Do not reach directly into another module's Prisma queries when a service contract exists. During the product migration, prefer compatibility/adaptor layers over an immediate destructive merge of `Target`, `Candidate`, `App`, and `Skill`.

### Evaluation v2 boundary

- `src/modules/evaluation/constants.ts`: protocol definitions, dimensions, labels and protocol version.
- `src/modules/evaluation/service.ts`: subject resolution, protocol matching, publication gates and persistence.
- `src/modules/evaluation/presentation.ts`: safe decoding of JSON fields and score presentation.
- `docs/EVALUATION_PROTOCOL_V2.md`: normative product and data protocol.
- `Review` remains the interaction layer; do not migrate historical Review rows into Evaluation without a source-preserving migration plan.
- Evaluation create/update is currently admin-only and audited.
- Do not add physical delete for Evaluation by default; use `archived` to preserve evidence and audit history.

### Key Patterns

- **Actor context**: review/comment mutations resolve logged-in or anonymous identity through `identity`.
- **Rate limiting**: public create actions use `checkAndConsume()` plus IP-segment checks.
- **Content moderation**: flagged freeform content becomes `pending`.
- **Report auto-hide**: reported public interaction content can be hidden automatically.
- **Like toggle**: review/comment likes are idempotent.
- **Admin audit**: state-changing Evaluation writes call `recordAdminAction()`.
- **Migration safety**: migrations need dry-run, reconciliation counts, repeatability and rollback. Historical IDs and slugs require an explicit ADR before change.

### API Routes

- `/api/skills` — Skill CRUD
- `/api/candidates` — inspiration/candidate CRUD and promotion
- `/api/reviews` — freeform polymorphic records (Target / Skill / App / Candidate)
- `/api/evaluations` — Evaluation v2 public query; admin create/update
- `/api/comments` — Review comment CRUD
- `/api/reviews/[id]/like`, `/api/comments/[id]/like` — like toggles
- `/api/reports` — reports
- `/api/articles` — Note/Article CRUD
- `/api/articles/[id]/like`, `/api/articles/[id]/comments` — article engagement
- `/api/tags` — tag management
- `/api/targets`, `/api/apps` — historical resource/project management
- `/api/forge/draft` — deterministic local draft generation, not a real LLM call
- `/api/auth/[...nextauth]` — NextAuth
- `/api/uploads/*` — uploads

### Database Models

Key models: `User`, `AnonymousUser`, `Target`, `Skill`, `Candidate`, `App`, `Review`, `Evaluation`, `Comment`, `Article`, `ArticleColumn`, `Tag`, `Emoji`, `Report`, `RateLimit`, `AdminAuditLog`.

Constraints enforced in application services:

- Review actor is exactly one of user/anonymous.
- Review subject is exactly one of Target/Skill/App/Candidate.
- Evaluation subject is exactly one of Target/Skill/App/Candidate.
- Evaluation protocol must match subject type.
- Published Evaluation must satisfy protocol v2 publication gates.

## Theme System

- `src/app/theme.css`: light/dark tokens.
- `src/app/globals.css`: semantic utility classes.
- `src/components/theme-toggle.tsx`: theme switch.
- `docs/STYLE_GUIDE.md`: visual conventions.

Prefer semantic classes over hard-coded colors. Add a token and semantic mapping before introducing a new reusable color role.

## Key Documentation

- `docs/PRODUCT_POSITIONING.md` — product definition SSOT.
- `docs/EVALUATION_PROTOCOL_V2.md` — normative formal evaluation protocol.
- `docs/PROJECT_PLAN.md` — current status, risks and execution plan; update for every feature/schema/migration change.
- `SPEC.md` — Legacy review MVP specification, not current product positioning.
- GitHub Issue #15 — dual-track lifecycle Epic.
- `docs/SEO_STRATEGY.md` and `docs/SEO_CHANGELOG.md` — SEO principles and increments.
- `docs/STYLE_GUIDE.md` — visual system.
- `docs/modules/<module>/` — module contracts and tests.

## Testing

Uses Vitest. Priority:

1. Service rules: validation, authorization, rate limiting, state machines, protocol gates and migration mappings.
2. API integration: request validation, status codes and persistence.
3. Small E2E set for critical lifecycle paths.

Evaluation changes must cover at minimum:

- protocol/subject matching;
- draft partial data;
- published complete scores;
- evidence/output requirement;
- reproducibility and repeat count;
- public filtering of draft/archived rows;
- sitemap exposure of published rows only.

Any Candidate promotion or Subject migration change must prove historical Review, Comment, Like and Evaluation remain reachable.

## Environment Variables

See `.env.example`. Required for production:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Optional: `SITE_URL`, GitHub OAuth variables, admin credentials and Google verification.
