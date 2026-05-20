import { NextResponse } from 'next/server'

/**
 * Liveness probe used by container/load-balancer healthchecks.
 *
 * Intentionally does NOT touch the database or any external service: a
 * healthcheck should answer "is this process alive?", not "is every
 * dependency reachable?". A separate `/api/ready` (future) would do the deep
 * readiness checks.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STARTED_AT = Date.now()

export function GET() {
  return NextResponse.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    nodeEnv: process.env.NODE_ENV || 'unknown',
  })
}
