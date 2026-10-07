import { ImageResponse } from 'next/og'
export const alt = 'My Space Arcade: 30+ free online games to play with friends'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg, #0b1030, #1b0f4a)', color: '#fff' }}>
        <div style={{ fontSize: 30, letterSpacing: 8, color: '#3de8ff', display: 'flex' }}>FREE · NO DOWNLOAD · ONLINE</div>
        <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 1.05, display: 'flex', marginTop: 20 }}>MY SPACE ARCADE</div>
        <div style={{ fontSize: 44, color: '#c9d3f5', marginTop: 24, display: 'flex' }}>30+ games: FLAMES, racing, fighting, snowboarding, cards, strategy</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
          {['#ff4de1', '#3de8ff', '#ffe84a', '#6aff9a'].map((c) => <div key={c} style={{ width: 90, height: 18, background: c, borderRadius: 9, display: 'flex' }} />)}
        </div>
      </div>
    ),
    size,
  )
}
