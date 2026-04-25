# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogWood is an AI coding tools review community (AI Editor / AI Coding). Users can browse tools, publish reviews, comment, like, and report content. The platform supports both anonymous and authenticated participation with rate limiting and content moderation.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js Route Handlers + Service Layer
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (GitHub OAuth + Admin Credentials)
- **Deploy**: Docker Compose (dev), Vercel (prod)

## Essential Commands

### Development (Docker Compose)
```bash
# Start everything (web + postgres)
docker compose up --build

# Access services
docker compose exec web npx prisma db push       # Sync schema to DB
docker compose exec web npx prisma generate       # Regenerate Prisma Client
docker compose exec web npm run db:seed           # Seed test data
docker compose exec web npm run test              # Run tests
docker compose exec web npm run lint              # Run ESLint
docker compose down                               # Stop and cleanup
```

### Prisma Commands
```bash
npm run db:generate   # prisma generate
npm run db:push       # prisma db push (dev iteration)
npm run db:migrate    # prisma migrate dev (versioned migrations)
npm run db:studio     # prisma studio (visual DB browser)
npm run db:seed       # Seed test data
```

### Next.js
```bash
npm run dev           # Next.js dev (0.0.0.0:3000)
npm run build         # Next.js build
npm run start         # Next.js start (0.0.0.0:3000)
npm run lint          # ESLint
npm run test          # Vitest run
npm run test:watch    # Vitest watch mode
```

### Force Re-seed Database
Set `FORCE_DB_SEED=1` in `.env` and restart `docker compose up --build`.

## Architecture

### Modular Monolith

The codebase uses a modular architecture under `src/modules/`. Each module has:
- `service.ts` — core business logic
- `index.ts` — re-exports from service.ts

**Modules**: `review`, `like`, `comment`, `moderation`, `rate-limit`, `identity`, `target`, `article`, `article-column`, `app`, `tag`, `emoji`

**Service layer pattern**: Route handlers call service functions, which use Prisma directly. Modules interact through exported functions, not by calling Prisma across module boundaries.

### Key Patterns

- **Actor context** (`src/modules/identity/service.ts`): All mutating actions receive an `ActorContext` that resolves to either a logged-in user or an anonymous user (via device fingerprint). Use `resolveActor()` for session-based resolution or `resolveActorWithFingerprint()` for anonymous flows.
- **Rate limiting**: Every create action goes through `checkAndConsume()` from `rate-limit` module. IP segment limits are checked separately via `checkIpSegmentLimit()`.
- **Content moderation**: `assessContent()` in `like/service.ts` checks against sensitive words. Flagged content gets `status=pending`.
- **Report auto-hide**: When a target accumulates 5+ open reports, `applyAutoHideIfThresholdReached()` automatically hides/archives it.
- **Like toggle**: `toggleReviewLike` / `toggleCommentLike` in `like/service.ts` are idempotent — existing likes are removed (not double-counted).

### API Routes

All API routes live under `src/app/api/`:
- `/api/reviews` — review CRUD
- `/api/comments` — comment CRUD
- `/api/reviews/[id]/like`, `/api/comments/[id]/like` — like toggles
- `/api/reports` — report creation
- `/api/articles` — article CRUD
- `/api/articles/[id]/like`, `/api/articles/[id]/comments` — article engagement
- `/api/tags` — tag management
- `/api/targets`, `/api/apps` — target/app management
- `/api/auth/[...nextauth]` — NextAuth handler
- `/api/uploads/*` — file uploads (article images/videos)

### Database Models (from `prisma/schema.prisma`)

Key models: `User`, `AnonymousUser`, `Target`, `Review`, `Comment`, `Article`, `ArticleColumn`, `App`, `Tag`, `Emoji`, `Report`, `RateLimit`

Identity constraint: Every review/comment has EITHER `userId` OR `anonymousUserId`, never both (enforced at application level).

### Auth

- **GitHub OAuth**: Configured via `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (optional, supports proxy via `GITHUB_OAUTH_PROXY`)
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

- **Project plan**: `docs/PROJECT_PLAN.md` — current status, milestones, recent changes. MUST be updated for any feature/architecture/deployment changes.
- **Spec**: `SPEC.md` — API contracts, data models, rate limits, moderation rules
- **Style guide**: `docs/STYLE_GUIDE.md` — visual design system and component patterns
- **Module specs**: `docs/modules/<module>/module-spec.md` and `docs/modules/<module>/test-cases.md`

## Testing

Uses Vitest. Test files co-locate with source or live alongside modules.

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
```

Priority: service layer business rules (validation, rate limiting, state machines, moderation) > API integration > E2E.

## Environment Variables

See `.env.example`. Required for production:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — public HTTPS domain
- `NEXTAUTH_SECRET` — session secret

Optional: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`
