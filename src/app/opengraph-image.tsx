import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'LogWood - AI 编码工具评测社区'
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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0e18',
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(0, 255, 255, 0.18) 0%, transparent 55%), radial-gradient(circle at 80% 85%, rgba(191, 0, 255, 0.18) 0%, transparent 55%)',
          padding: 80,
          fontFamily: 'system-ui, sans-serif',
          color: '#e6f6ff',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '8px 22px',
            border: '1px solid rgba(0, 255, 255, 0.4)',
            borderRadius: 999,
            background: 'rgba(0, 255, 255, 0.06)',
            color: '#7ee9ff',
            fontSize: 22,
            letterSpacing: 8,
            textTransform: 'uppercase',
            marginBottom: 48,
          }}
        >
          AI Coding Review Platform
        </div>

        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -2,
            textAlign: 'center',
            backgroundImage:
              'linear-gradient(135deg, #00ffff 0%, #bf00ff 50%, #ff58e5 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'flex',
          }}
        >
          LogWood
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 38,
            fontWeight: 600,
            color: '#cfe7ff',
            textAlign: 'center',
            display: 'flex',
          }}
        >
          AI 编码工具评测社区
        </div>

        <div
          style={{
            marginTop: 16,
            fontSize: 24,
            color: '#7c93b3',
            textAlign: 'center',
            display: 'flex',
          }}
        >
          AI Editor · AI Coding · AI Model · AI Prompt
        </div>
      </div>
    ),
    { ...size },
  )
}
