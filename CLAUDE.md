# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

空心树洞（仓库名 `LogWood`）是 **AI 灵感炼成与实践沉淀社区**，品牌副标题为：**大浪淘沙，找寻灵感**。

产品围绕同一个灵感、资源或 Skill 建立两条可追溯的轨道：

1. **资产进化线**：灵感 / 资源 → 候选 → 试用 → 验证 → 模板 / Prompt / Workflow → 可复用 Skill → Quick Start / 技能包 → 维护或归档。
2. **经验沉淀线**：吐槽 / 快评 → 讨论 / 求证 → 实验与失败样本 → 技术小结 → 评测报告 / 前沿观点 / 复盘反思。

完整产品定义以 `docs/PRODUCT_POSITIONING.md` 为唯一权威来源。整体迁移由 GitHub Issue #15 跟踪。

### Product invariants

- 同一个 Subject 的成熟度变化不得静默复制成互不关联的新对象。
- 历史 Review、Comment、Like、作者、slug 和可访问路径必须保留。
- Candidate 最终应成为 Resource 生命周期状态；Gallery/App 最终映射为 Resource 或 Skill Example。
- Skill 不等于一段 Prompt；目标模型包含版本、依赖、示例、Quick Start、评测和最近验证时间。
- Evaluation 与 Quick Take 语义不同：正式评测需要上下文和证据，吐槽 / 快评可以低门槛但应关联 Subject。
- AI 只负责整理、建议和连接，不得伪造测试或把未验证内容包装成事实。
- 当前 Forge 仍是本地模板生成，不得在公开文案或代码注释中声称已接入真实模型。

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
bun run db:generate   # prisma generate
bun run db:push       # prisma db push (dev iteration)
bun run db:migrate    # prisma migrate dev (versioned migrations)
bun run db:studio     # prisma studio (visual DB browser)
bun run db:seed       # Seed test data
```

### Next.js
```bash
bun run dev           # Next.js dev (0.0.0.0:3000)
bun run build         # Next.js build
bun run start         # Next.js start (0.0.0.0:3000)
bun run lint          # ESLint
bun run test          # Vitest run
bun run test:watch    # Vitest watch mode
```

### Force Re-seed Database
Set `FORCE_DB_SEED=1` in `.env` and restart `docker compose up --build`.

### Deployment Architecture

```text
[Client] → [Upstream Nginx (SSL termination)] → [Nginx (:10000, gzip/cache/rate-limit)] → [Next.js (:3000)]
```

- **Production mode** (default): `NODE_ENV=production` → `bun run build` + `bun run start`
- **Dev mode**: `NODE_ENV=development` → `bun run dev` (hot reload)
- Switch via `.env.local`: `NODE_ENV=development`

### Nginx Config

`nginx/nginx.conf` handles: reverse proxy to web:3000, gzip compression, `/_next/static` long cache, API rate limiting, security headers. No SSL — handled by upstream Nginx.

## Architecture

### Modular Monolith

The codebase uses a modular architecture under `src/modules/`. Each module has:
- `service.ts` — core business logic
- `index.ts` — re-exports from service.ts

**Modules**: `skill`, `candidate`, `review`, `like`, `comment`, `moderation`, `rate-limit`, `identity`, `target`, `article`, `article-column`, `app`, `forge`, `tag`, `emoji`

**Service layer pattern**: Route handlers call service functions, which use Prisma directly. Modules interact through exported functions, not by calling Prisma across module boundaries.

During the product migration, prefer a compatibility / adapter layer over an immediate destructive merge of `Target`, `Candidate`, `App`, and `Skill`.

### Key Patterns

- **Actor context** (`src/modules/identity/service.ts`): All mutating actions receive an `ActorContext` that resolves to either a logged-in user or an anonymous user (via device fingerprint). Use `resolveActor()` for session-based resolution or `resolveActorWithFingerprint()` for anonymous flows.
- **Rate limiting**: Every create action goes through `checkAndConsume()` from `rate-limit` module. IP segment limits are checked separately via `checkIpSegmentLimit()`.
- **Content moderation**: `assessContent()` in `like/service.ts` checks against sensitive words. Flagged content gets `status=pending`.
- **Report auto-hide**: When a target accumulates 5+ open reports, `applyAutoHideIfThresholdReached()` automatically hides/archives it.
- **Like toggle**: `toggleReviewLike` / `toggleCommentLike` in `like/service.ts` are idempotent — existing likes are removed (not double-counted).
- **Migration safety**: Data migrations must support dry-run, counts / reconciliation, repeatability, and rollback. Do not change historical IDs or slugs without an explicit ADR and redirect plan.

### API Routes

All API routes live under `src/app/api/`:
- `/api/skills` — Skill 标本 CRUD（展览页公开读，写入需管理员）
- `/api/candidates` — 候选短名单 CRUD；`/api/candidates/[id]/promote` 晋升
- `/api/reviews` — 多态评测（targetId / skillId / appId / candidateId）
- `/api/comments` — comment CRUD
- `/api/reviews/[id]/like`, `/api/comments/[id]/like` — like toggles
- `/api/reports` — report creation
- `/api/articles` — article CRUD
- `/api/articles/[id]/like`, `/api/articles/[id]/comments` — article engagement
- `/api/tags` — tag management
- `/api/targets`, `/api/apps` — target/app management
- `/api/forge/draft` — local template draft generation; not a real LLM call
- `/api/auth/[...nextauth]` — NextAuth handler
- `/api/uploads/*` — file uploads (article images/videos, skill effects)

### Database Models (from `prisma/schema.prisma`)

Key models: `User`, `AnonymousUser`, `Skill`, `Candidate`, `Target`, `Review`, `Comment`, `Article`, `ArticleColumn`, `App`, `Tag`, `Emoji`, `Report`, `RateLimit`

Identity constraint: Every review/comment has EITHER `userId` OR `anonymousUserId`, never both (enforced at application level).

Review subject constraint: Every review has exactly one of `targetId` / `skillId` / `appId` / `candidateId` (enforced in service layer).

This polymorphic Review implementation is a compatibility foundation, not the final domain model. New evaluation fields should be additive and schema-versioned so historical records remain readable.

### Local development (hot reload)

Set `NODE_ENV=development` in `.env`, then `docker compose up -d web`. Entrypoint runs `bun run dev` with source bind-mount — no production rebuild on each edit. Only rebuild the image when Dockerfile / dependencies change.

### Auth

- **GitHub OAuth**: Configured via `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- **Admin credentials**: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH` for bcrypt)
- **Session**: JWT-based, includes `role` field (`admin` | `user`)
- **Production requirement**: `NEXTAUTH_URL` must be a public HTTPS domain, NOT localhost

## Theme System

The project supports light/dark theme with a token + semantic class system:
- **`src/app/theme.css`**: CSS custom properties for `html[data-theme='dark']` and `html[data-theme='light']`
- **`src/app/globals.css`**: Semantic utility classes (e.g., `text-muted`, `border-divider`, `surface-panel`). Use these instead of hardcoded colors.
- **`src/components/theme-toggle.tsx`**: Theme switch button, state persisted to `localStorage` key `logwood-theme`
- **Style guide**: See `docs/STYLE_GUIDE.md` for the dark neon / cyberpunk palette and reusable classes (`.cyber-card`, `.cyber-input`, `.cyber-button`, etc.)

**Rule**: Prefer semantic classes over hardcoded `text-gray-*` / `bg-[#xxxxxx]`. For new colors, add tokens in `theme.css` first, then map in `globals.css`.

## Key Documentation

- **Product positioning**: `docs/PRODUCT_POSITIONING.md` — product definition SSOT; read before proposing navigation, content models, migration, AI behavior, or public copy.
- **Project plan**: `docs/PROJECT_PLAN.md` — current status, execution stages, risks and recent changes. MUST be updated for feature / architecture / deployment / migration changes.
- **Legacy spec**: `SPEC.md` — historical AI coding review MVP contracts; do not treat its old product positioning as current.
- **Epic**: GitHub Issue #15 — dual-track lifecycle implementation plan.
- **SEO strategy**: `docs/SEO_STRATEGY.md` — metadata, JSON-LD, sitemap and SEO change constraints.
- **Style guide**: `docs/STYLE_GUIDE.md` — visual design system and component patterns.
- **Module specs**: `docs/modules/<module>/module-spec.md` and `docs/modules/<module>/test-cases.md`.

## Testing

Uses Vitest. Test files co-locate with source or live alongside modules.

```bash
bun run test          # Run all tests
bun run test:watch    # Watch mode
```

Priority: service layer business rules (validation, rate limiting, state machines, moderation, subject continuity and migration mappings) > API integration > E2E.

Any Candidate promotion or Subject migration change must include tests proving that historical Review / Comment / Like data remains reachable.

## Environment Variables

See `.env.example`. Required for production:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — public HTTPS domain
- `NEXTAUTH_SECRET` — session secret

Optional: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`
