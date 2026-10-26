// MAHJONG session driver: lets the AI seats play until a human decision is needed (or the hand ends).
// The human seat is optional, so a whole game can also be played by four AIs (that is how the tests exercise the rules).
import { drawTile, discardTile, claim, declareSelfDrawWin, canSelfDrawWin, declareKong, kongOptions, pendingClaimSeats, viewFor } from './engine.js'
import { chooseDiscard, decideClaim, wantsKong } from './ai.js'

// cfg: { human: seat | null, humans: [seats] (online: several people), levels: ['easy'|'normal'|'hard' x4], rand }
// returns { need: null | 'discard' | 'claim', events: [...] }; `events` describes what the bots did (the UI plays animations from it)
export function advance(st, cfg, maxSteps = 4000) {
  const events = []
  const level = (s) => cfg.levels[s] || 'normal'
  const isHuman = (s) => s === cfg.human || (cfg.humans ? cfg.humans.includes(s) : false)
  for (let i = 0; i < maxSteps; i++) {
    if (st.phase === 'over') return { need: null, events, over: true }
    if (st.phase === 'draw') {
      const seat = st.turn
      const r = drawTile(st, seat)
      events.push({ ev: 'draw', seat, tile: r.tile })
      continue
    }
    if (st.phase === 'discard') {
      const seat = st.turn
      if (isHuman(seat)) return { need: 'discard', seat, events }
      if (canSelfDrawWin(st, seat)) { declareSelfDrawWin(st, seat); events.push({ ev: 'win', seat, selfDraw: true }); continue }
      const view = viewFor(st, seat)
      const kopt = kongOptions(st, seat).find((o) => wantsKong(view, o, level(seat)))
      if (kopt) { const r = declareKong(st, seat, kopt.k); events.push({ ev: 'kong', seat, k: kopt.k, concealed: kopt.type === 'concealed' }); if (r.ok) continue }
      const t = chooseDiscard(view, level(seat), cfg.rand)
      const r = discardTile(st, seat, t.id)
      events.push({ ev: 'discard', seat, tile: t })
      if (!r.ok) throw new Error('AI made an illegal discard: ' + r.reason)
      continue
    }
    if (st.phase === 'claim') {
      for (const seat of pendingClaimSeats(st)) {
        if (isHuman(seat)) continue
        if (st.phase !== 'claim') break
        const opts = st.claims.options[seat]
        const view = viewFor(st, seat)
        const d = st.claims.kind === 'robkong' ? (opts.hu ? { action: 'hu' } : { action: 'pass' }) : decideClaim(view, opts, st.claims.tile, level(seat), cfg.rand)
        const r = claim(st, seat, d.action, d.pair)
        if (!r.ok) throw new Error('AI made an illegal claim: ' + r.reason)
        if (d.action !== 'pass') events.push({ ev: 'call', seat, action: d.action })
      }
      if (st.phase === 'claim') { const waiting = pendingClaimSeats(st).filter(isHuman); if (waiting.length) return { need: 'claim', seats: waiting, events }; continue }
      continue
    }
    throw new Error('unknown phase ' + st.phase)
  }
  if (maxSteps >= 4000) throw new Error('session did not settle')
  return { need: null, events, partial: true } // a bounded call stops after maxSteps and can be called again
}
