'use client'
// Overlay for score duels (a solo game played head-to-head online): live rival score and the final verdict.
import { useSyncExternalStore } from 'react'
import { subscribeDuel, getDuelSnap, duelActions } from '../game/duel.js'

const fmt = (n) => Math.floor(n || 0).toLocaleString()
export function DuelOverlay() {
  const d = useSyncExternalStore(subscribeDuel, getDuelSnap)
  if (!d || !d.on) return null
  return (
    <>
      <div className="duelbar" onPointerDown={(e) => e.stopPropagation()}>
        <span>⚔ {d.game}</span>
        <span className="you">YOU <b>{fmt(d.mine)}</b>{d.mineDone ? ' ✔' : ''}</span>
        <span className="foe">{d.foeName} <b>{d.foeScore < 0 ? 'LEFT' : fmt(d.foeScore)}</b>{d.foeDone ? ' ✔' : ''}</span>
        {d.mineDone && !d.foeDone && <em>WAITING FOR {d.foeName}…</em>}
      </div>
      {d.result && (
        <div className="duelres" onPointerDown={(e) => e.stopPropagation()}>
          <h2 className={d.result.win ? 'gold' : d.result.tie ? '' : 'red'}>{d.result.forfeit ? 'YOU WIN! (rival left)' : d.result.win ? 'YOU WIN THE DUEL!' : d.result.tie ? 'IT IS A TIE' : 'YOU LOST THE DUEL'}</h2>
          <p>{fmt(d.result.mine)} vs {fmt(d.result.theirs)}</p>
          <div className="chips"><button className="big" onClick={duelActions.rematch}>↻ REMATCH</button><button className="big sec" onClick={duelActions.close}>DASHBOARD</button></div>
        </div>
      )}
    </>
  )
}
