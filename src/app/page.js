'use client'
import dynamic from 'next/dynamic'

// The whole game is client-only (WebGL + WebAudio + localStorage), so skip server rendering.
const GameApp = dynamic(() => import('../GameApp'), { ssr: false })

export default function Page() {
  return <GameApp />
}
