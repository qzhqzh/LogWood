import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE } from '@/shared/seo/site-config'

export const runtime = 'edge'
export const alt = `${SITE_NAME} - ${SITE_TAGLINE}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#020603',
          padding: 80,
          fontFamily: 'monospace',
          color: '#dcffdc',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 18px',
            border: '1px solid rgba(151, 246, 151, 0.7)',
            background: '#baffb7',
            color: '#020603',
            fontSize: 22,
            letterSpacing: 8,
            textTransform: 'uppercase',
            marginBottom: 48,
          }}
        >
          [:: PROMPT VAULT ::]
        </div>

        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -5,
            color: '#dcffdc',
            display: 'flex',
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 36,
            fontWeight: 600,
            color: '#a9dbaa',
            display: 'flex',
          }}
        >
          {SITE_TAGLINE}
        </div>

        <div
          style={{
            marginTop: 16,
            fontSize: 22,
            color: '#6f9673',
            display: 'flex',
          }}
        >
          提示词 · 效果预览 · 同类对比 · 验证记录
        </div>
      </div>
    ),
    { ...size },
  )
}
