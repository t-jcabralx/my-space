'use client'
// MAHJONG (Hong Kong old style): menu, board, tutorial, practice trainer, rules, statistics and settings.
// All rules live in src/game/mahjong (engine, scoring, ai); this file only draws the state and forwards the player's choices.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { fullSet, shuffle, tileFace, tileName, sortTiles, countsOf, KINDS, WINDS, isBonus, HONOR_ZH } from '../game/mahjong/tiles.js'
import { winInfo, waits, chowOptions } from '../game/mahjong/rules.js'
import { pointsForFan } from '../game/mahjong/scoring.js'
import { newMatch, startHand, discardTile, claim, declareKong, declareSelfDrawWin, canSelfDrawWin, selfDrawScore, kongOptions, finishHandInMatch, liveTilesLeft, pendingClaimSeats, viewFor, seatWindOf } from '../game/mahjong/engine.js'
import { advance } from '../game/mahjong/session.js'
import { hint as aiHint } from '../game/mahjong/ai.js'
import { sfx, unlockAudio } from '../game/audio.js'
import { subscribeMj, getMj, mjActions, stopMahjong } from '../game/online/mahjong-online.js'
import { leaveRoom } from '../game/online/rt.js'

const WIND_NAME = ['East', 'South', 'West', 'North']
const SEAT_NAME = ['You', 'Right player', 'Top player', 'Left player']
const SET_KEY = 'si_mj_settings', STAT_KEY = 'si_mj_stats', SAVE_KEY = 'si_mj_save'
const DEFAULTS = { difficulty: 'normal', minFan: 1, dealerDouble: true, windRounds: 1, tile: 'm', dark: false, calm: false, sound: true, hints: true }
const ls = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d } catch { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }, del(k) { try { localStorage.removeItem(k) } catch { /* ignore */ } } }
const EMPTY_STATS = { games: 0, wins: 0, losses: 0, handsWon: 0, selfDraw: 0, discardWins: 0, scoreSum: 0, best: null, patterns: {}, byDiff: { easy: { games: 0, wins: 0 }, normal: { games: 0, wins: 0 }, hard: { games: 0, wins: 0 } }, history: [] }

// ---- a single tile ----------------------------------------------------------------------------------------------------
function Tile({ k, size = 'm', sel, dim, hot, back, onClick, label, small }) {
  if (back) return <span className={'mjt back s-' + size} aria-hidden="true" />
  const f = tileFace(k)
  return (
    <button type="button" className={'mjt s-' + size + ' su-' + f.suit + (sel ? ' sel' : '') + (dim ? ' dim' : '') + (hot ? ' hot' : '') + (small ? ' sm' : '')} onClick={onClick} disabled={!onClick} title={label || tileName(k)} aria-label={label || tileName(k)} aria-pressed={sel ? 'true' : undefined}>
      <span className="mjt-big">{f.big}</span>{f.small && <span className="mjt-small">{f.small}</span>}
    </button>
  )
}
const Row = ({ tiles, size = 's', hot }) => <span className="mj-row">{tiles.map((t) => <Tile key={t.id} k={t.k} size={size} hot={hot && t.id === hot} />)}</span>
const Meld = ({ m, size = 's' }) => <span className={'mj-meld ' + (m.concealed ? 'conc' : '')} title={m.type + (m.concealed ? ' (concealed)' : '')}>{(m.tiles || []).map((t, i) => <Tile key={t.id} k={t.k} size={size} back={m.concealed && (i === 0 || i === 3)} />)}</span>

// ---- tutorial content ---------------------------------------------------------------------------------------------------
const mkT = (s) => s.split(' ').map((k, i) => ({ id: i, k }))
const TUTORIAL = [
  { t: 'Welcome to Mahjong', body: 'Mahjong is played with 144 tiles. You hold 13 tiles and try to build a complete hand of four sets and one pair by drawing and discarding. This game uses Hong Kong old style rules.', tiles: 'm1 p5 s9 we dr', note: 'Tiles are shown with a big symbol and a small label so you can tell suits apart without colour.' },
  { t: '1. The tile categories', body: 'Three suits with tiles 1 to 9 (four copies each): Characters 萬, Circles 筒 and Bamboo 索. Honour tiles: four winds (東 南 西 北) and three dragons (中 發 白). Bonus tiles: four flowers and four seasons.', tiles: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 we ws ww wn dr dg dw f1 q1', note: 'Honours and bonus tiles have no numbers. Bonus tiles are never part of a set.' },
  { t: '2. Draw and discard', body: 'On your turn you draw one tile (you then hold 14), look at your hand and discard one tile (back to 13). Keep tiles that connect and throw away tiles that do not fit your plan.', tiles: 'm2 m3 p4 p5 p6 s1 s9 dw' },
  { t: '3. Sets, pairs and kongs', body: 'A sequence (chow) is three consecutive tiles of one suit. A triplet (pung) is three identical tiles. A kong is four identical tiles. A pair is two identical tiles. Honours can form pungs but never chows.', tiles: 'm4 m5 m6 | p7 p7 p7 | s2 s2 s2 s2 | we we', note: 'Chow, pung, kong, pair.' },
  { t: '4. Calling a discard: chow, pung, kong', body: 'You may claim another player\'s discard to finish a set. Pung and kong can be claimed from anyone. Chow can only be claimed from the player before you (on your left). A claimed set is shown face up, and then you must discard.', quiz: 'chow' },
  { t: 'Pung or not?', body: 'A pung needs two identical tiles in your hand plus the discard.', quiz: 'pung' },
  { t: '5. Recognising a winning hand', body: 'A winning hand is exactly four sets and one pair (kong counts as one set). Counting 14 tiles is not enough: the tiles must form the right shapes.', quiz: 'win' },
  { t: '6. Self-draw and winning on a discard', body: 'If the tile that completes your hand comes from your own draw, you win by self-draw and the other three players each pay you. If you win on someone else\'s discard, the player who discarded it pays. A winning call beats pung/kong and chow.', tiles: 'm1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr dr' },
  { t: '7. Basic scoring', body: 'Hands score fan. Examples: common hand (all chows) 1, dragon pung 1, seat/prevailing wind pung 1, all pungs 3, one suit plus honours 3, one suit only 6. Self-draw adds 1. Fan are turned into points: 3 fan = 8 points, 4 = 16, 5 = 24, 6 = 32 and so on. A limit hand is capped at 13 fan.', tiles: 'dr dr dr m1 m2 m3 p5 p5' },
  { t: '8. Exposed melds and concealed hands', body: 'Sets you claim from discards are exposed (face up). A hand with no exposed melds is concealed and scores extra: 1 fan if you win on a discard, 3 fan for a fully concealed self-draw win. A concealed kong is shown with its outer tiles face down.', tiles: 'p3 p3 p3 p3' },
  { t: '9. Bonus tiles and replacement draws', body: 'If you receive a flower or season, show it at once and draw a replacement tile from the end of the wall. Your own flower or season (the one that matches your seat wind number) is worth 1 fan.', tiles: 'f1 q2' },
  { t: '10. Turn order and end of the hand', body: 'Play passes counter-clockwise: you, the player on your right, across, then left. The hand ends when somebody wins, or when the live wall runs out and the hand is a draw (the last 14 tiles stay unplayed). The dealer keeps the seat after winning or after a draw; otherwise the deal moves on.', tiles: 'we ws ww wn' },
  { t: 'You are ready', body: 'Try the Win Trainer in Practice mode, then start a Classic game. The Hint button explains good discards and calls.', tiles: 'dr dg dw' },
]

// ---- practice: a ready hand where the player must name the winning tiles -------------------------------------------------
function readyHand() {
  for (let n = 0; n < 200; n++) {
    const pool = shuffle(fullSet()), take = (k) => pool.splice(pool.findIndex((t) => t.k === k), 1)[0]
    const out = []
    const suits = ['m', 'p', 's']
    try {
      for (let i = 0; i < 4; i++) {
        const s = suits[Math.floor(Math.random() * 3)]
        if (Math.random() < 0.55) { const a = 1 + Math.floor(Math.random() * 7); for (let d = 0; d < 3; d++) out.push(take(s + (a + d))) } else { const k = Math.random() < 0.7 ? s + (1 + Math.floor(Math.random() * 9)) : ['we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw'][Math.floor(Math.random() * 7)]; for (let d = 0; d < 3; d++) out.push(take(k)) }
      }
      const pk = KINDS[Math.floor(Math.random() * 34)]; out.push(take(pk), take(pk))
    } catch { continue }
    const drop = out.splice(Math.floor(Math.random() * out.length), 1)[0]; void drop
    const hand = sortTiles(out), w = waits(hand)
    if (w.length >= 1) return { hand, waits: w }
  }
  return null
}

function PracticePanel({ onBack }) {
  const [q, setQ] = useState(() => readyHand())
  const [picked, setPicked] = useState([])
  const [done, setDone] = useState(null)
  const [score, setScore] = useState({ ok: 0, n: 0 })
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  const check = () => { const right = picked.length === q.waits.length && q.waits.every((k) => picked.includes(k)); setDone({ right }); setScore((s) => ({ ok: s.ok + (right ? 1 : 0), n: s.n + 1 })); sfx(right ? 'cWin' : 'cBad') }
  const nextQ = () => { setQ(readyHand()); setPicked([]); setDone(null) }
  if (!q) return <div className="mj-panel"><p>Could not build a puzzle. Try again.</p><button onClick={nextQ}>Retry</button></div>
  return (
    <div className="mj-panel">
      <h2>Win Trainer</h2>
      <p>This hand is one tile away from winning (it is "ready"). Tap <b>every</b> tile kind that would complete it, then press Check. Score: {score.ok}/{score.n}</p>
      <div className="mj-hand-demo">{q.hand.map((t) => <Tile key={t.id} k={t.k} size="m" />)}</div>
      <div className="mj-palette">{KINDS.map((k) => <Tile key={k} k={k} size="s" sel={picked.includes(k)} onClick={() => !done && toggle(k)} />)}</div>
      {!done ? <button className="mj-btn go" onClick={check} disabled={!picked.length}>Check</button> : (
        <div className={'mj-feedback ' + (done.right ? 'good' : 'bad')}>
          <b>{done.right ? 'Correct!' : 'Not quite.'}</b> The winning tiles are: {q.waits.map((k) => <Tile key={k} k={k} size="s" />)}
          <p>Each of these makes four sets and a pair. {q.waits.length > 1 ? 'Having several waiting tiles makes the hand easier to finish.' : 'Only this tile finishes the hand.'}</p>
          <button className="mj-btn go" onClick={nextQ}>Next puzzle</button>
        </div>
      )}
      <button className="mj-btn" onClick={onBack}>Back to menu</button>
    </div>
  )
}

function Tutorial({ onBack }) {
  const [i, setI] = useState(0), [ans, setAns] = useState(null)
  const step = TUTORIAL[i]
  useEffect(() => { setAns(null) }, [i])
  const quiz = useMemo(() => {
    if (step.quiz === 'chow') return { hand: mkT('m2 m3 m5 p1 p9 s4'), tile: 'm4', opts: chowOptions(mkT('m2 m3 m5 p1 p9 s4'), 'm4') }
    if (step.quiz === 'pung') return { hand: mkT('p7 p7 m1 m5 s2 s8'), tile: 'p7' }
    if (step.quiz === 'win') return { a: mkT('m1 m2 m3 p4 p5 p6 s7 s8 s9 we we we dr dr'), b: mkT('m1 m2 m4 p4 p5 p6 s7 s8 s9 we we we dr dr') }
    return null
  }, [step])
  const parts = (step.tiles || '').split('|').map((s) => s.trim()).filter(Boolean)
  return (
    <div className="mj-panel">
      <div className="mj-prog">{TUTORIAL.map((_, n) => <i key={n} className={n === i ? 'on' : n < i ? 'past' : ''} />)}</div>
      <h2>{step.t}</h2><p>{step.body}</p>
      {parts.length > 0 && <div className="mj-hand-demo">{parts.map((p, n) => <span key={n} className="mj-grp">{mkT(p).map((t) => <Tile key={t.id} k={t.k} size="m" />)}</span>)}</div>}
      {step.note && <p className="mj-note">{step.note}</p>}
      {quiz && step.quiz === 'chow' && (
        <div className="mj-quiz"><p>You hold these tiles. Player on your left discards <Tile k={quiz.tile} size="s" />. Which two tiles from your hand make a chow with it?</p>
          <div className="mj-hand-demo">{quiz.hand.map((t) => <Tile key={t.id} k={t.k} size="m" />)}</div>
          <div className="mj-choices">{[['m2', 'm3'], ['m3', 'm5'], ['m2', 'm5'], ['p1', 'p9']].map((o) => <button key={o.join()} className="mj-btn" onClick={() => setAns({ ok: quiz.opts.some((p) => p[0] === o[0] && p[1] === o[1]), why: o.join(' + ') })}>{o.map((k) => tileName(k)).join(' + ')}</button>)}</div>
          {ans && <p className={'mj-feedback ' + (ans.ok ? 'good' : 'bad')}>{ans.ok ? 'Yes! 3 + 4 + 5 of Characters is a sequence.' : 'No. A chow needs three consecutive numbers of the same suit. Here the legal choices are 2+3 (making 2-3-4), 3+5 (3-4-5) and 5+6 only if you had a 6.'}</p>}
        </div>
      )}
      {quiz && step.quiz === 'pung' && (
        <div className="mj-quiz"><p>Someone discards <Tile k={quiz.tile} size="s" />. Can you pung it?</p>
          <div className="mj-hand-demo">{quiz.hand.map((t) => <Tile key={t.id} k={t.k} size="m" />)}</div>
          <div className="mj-choices"><button className="mj-btn" onClick={() => setAns({ ok: true })}>Yes</button><button className="mj-btn" onClick={() => setAns({ ok: false })}>No</button></div>
          {ans && <p className={'mj-feedback ' + (ans.ok ? 'good' : 'bad')}>{ans.ok ? 'Correct: you hold two 7 Circles, so three together make a pung.' : 'You hold two matching tiles, which is exactly what a pung needs.'}</p>}
        </div>
      )}
      {quiz && step.quiz === 'win' && (
        <div className="mj-quiz"><p>Which of these 14-tile hands is a winning hand?</p>
          {[['A', quiz.a], ['B', quiz.b]].map(([n, h]) => <div key={n} className="mj-hand-demo"><b>{n}</b>{h.map((t) => <Tile key={t.id} k={t.k} size="s" />)}<button className="mj-btn" onClick={() => { const win = winInfo(h).win; setAns({ ok: win, n }) }}>Choose {n}</button></div>)}
          {ans && <p className={'mj-feedback ' + (ans.ok ? 'good' : 'bad')}>{ans.ok ? 'Correct. Hand A is 123 Characters, 456 Circles, 789 Bamboo, three East winds and a pair of Red dragons.' : 'Hand B is not complete: 1-2-4 Characters is not a sequence. Both hands have 14 tiles, so the shape decides, not the count.'}</p>}
        </div>
      )}
      <div className="mj-nav"><button className="mj-btn" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>Back</button>{i < TUTORIAL.length - 1 ? <button className="mj-btn go" onClick={() => setI((n) => n + 1)}>Next</button> : <button className="mj-btn go" onClick={onBack}>Finish</button>}<button className="mj-btn" onClick={onBack}>Menu</button></div>
    </div>
  )
}

const RULES = [
  ['Ruleset', 'Hong Kong Old Style, 144 tiles (including 4 flowers and 4 seasons), 4 players. Chow can only be claimed from the player on your left. Seven pairs is not a winning hand in this ruleset. Thirteen orphans is.'],
  ['Winning', 'Four sets (chow, pung or kong) and one pair, or thirteen orphans. You need at least the minimum fan (default 1; the traditional table minimum is 3 and can be selected in Custom game).'],
  ['Bonus tiles', 'Flowers and seasons are shown at once and replaced from the end of the wall. Your own flower and season (numbers matching your seat wind: East 1, South 2, West 3, North 4) are worth 1 fan each. All four flowers or all four seasons: 2 fan.'],
  ['Calls priority', 'Mahjong beats everything. If two players can win on the same discard, the one closest after the discarder (counter-clockwise) wins ("head bump"). Pung and kong beat chow. A pung can be added to become a kong, and an added kong can be robbed by a player who can win on that tile.'],
  ['Scoring', 'Common hand 1, All pungs 3, Mixed one suit 3, Pure one suit 6, Dragon pung 1 each, seat wind pung 1, prevailing wind pung 1, Small three dragons 5, Big three dragons 8, Small four winds 6. Self-draw 1, concealed 1, fully concealed self-draw 3. Last tile 1, kong replacement win 1, robbing a kong 1. Limit hands (Big four winds, All honours, All terminals, Thirteen orphans) are 13 fan. Fan are capped at the limit.'],
  ['Payments', 'Fan 1=2 points, 2=4, 3=8, 4=16, 5=24, 6=32, 7=48, 8=64, 9=96, 10=128, 11=192, 12=256, 13=384. The player who discards the winning tile pays the full amount. On a self-draw each of the other three pays it. Payments involving the dealer are doubled (a house rule you can switch off).'],
  ['Dealer and rounds', 'The dealer is East. The dealer keeps the seat after winning or a draw and the deal passes counter-clockwise otherwise. After each player has dealt, the prevailing wind moves on. A match is one wind round by default.'],
  ['End of a hand', 'The hand ends when somebody wins, or when the live wall is used up (the 14-tile dead wall is not drawn): then nobody wins and nobody pays.'],
  ['Playing with friends', 'Online tables for 2 to 4 people are available through Invite friends: the host runs the table, empty seats are played by the computer, and nobody can see another player\'s tiles. Local hot-seat play on one device is not included.'],
]

// ---- the main component -------------------------------------------------------------------------------------------------
export default function MahjongUI() {
  const [screen, setScreen] = useState('menu')
  const [cfg, setCfg] = useState(() => ({ ...DEFAULTS, ...ls.get(SET_KEY, {}) }))
  const [stats, setStats] = useState(() => ({ ...EMPTY_STATS, ...ls.get(STAT_KEY, {}) }))
  const [, bump] = useReducer((x) => x + 1, 0)
  const net = useSyncExternalStore(subscribeMj, getMj, getMj)
  const online = !!(net.active && net.st)
  const [saved, setSaved] = useState(false)
  const [sel, setSel] = useState(null)
  const [hintBox, setHintBox] = useState(null)
  const [msg, setMsg] = useState('')
  const [pairPick, setPairPick] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [custom, setCustom] = useState(false)
  const R = useRef({ match: null, st: null, cfg: null, timer: 0, log: [], last: null, mounted: true, counted: false })
  useEffect(() => { setSaved(!!ls.get(SAVE_KEY, null)); R.current.mounted = true; return () => { R.current.mounted = false; clearTimeout(R.current.timer) } }, [])
  useEffect(() => { ls.set(SET_KEY, cfg) }, [cfg])
  const snd = useCallback((n) => { if (cfg.sound) sfx(n) }, [cfg.sound])
  const calm = cfg.calm

  const save = () => { const r = R.current; if (r.match && r.st) ls.set(SAVE_KEY, { match: r.match, st: r.st, levels: r.cfg.levels, v: 1 }) }

  function recordHandStats(st, match) {
    setStats((old) => {
      const s = JSON.parse(JSON.stringify(old)); const r = st.result
      if (r.type === 'win' && r.winner === 0) {
        s.handsWon++; if (r.selfDraw) s.selfDraw++; else s.discardWins++
        for (const it of r.items) s.patterns[it.name.replace(/\(.*\)/, '').trim()] = (s.patterns[it.name.replace(/\(.*\)/, '').trim()] || 0) + 1
        if (!s.best || r.points > s.best.points) s.best = { points: r.points, fan: r.fan, items: r.items.map((i) => i.name) }
      }
      s.history = [{ at: Date.now(), type: r.type, winner: r.winner ?? null, fan: r.fan || 0, points: r.points || 0, items: (r.items || []).map((i) => i.name), payments: r.payments, difficulty: match.opts.difficulty }, ...s.history].slice(0, 40)
      ls.set(STAT_KEY, s); return s
    })
  }
  function recordMatchStats(match) {
    setStats((old) => {
      const s = JSON.parse(JSON.stringify(old)); const top = Math.max(...match.scores), won = match.scores[0] === top && match.scores.filter((x) => x === top).length === 1
      s.games++; if (won) s.wins++; else s.losses++; s.scoreSum += match.scores[0]
      const d = s.byDiff[match.opts.difficulty] || (s.byDiff[match.opts.difficulty] = { games: 0, wins: 0 }); d.games++; if (won) d.wins++
      ls.set(STAT_KEY, s); return s
    })
  }

  const finishIfOver = () => {
    const r = R.current, st = r.st
    if (st && st.phase === 'over' && !r.counted) {
      r.counted = true
      finishHandInMatch(r.match, st); recordHandStats(st, r.match)
      if (r.match.finished) { recordMatchStats(r.match); ls.del(SAVE_KEY); setSaved(false) } else save()
      snd(st.result.type === 'win' ? (st.result.winner === 0 ? 'cWin' : 'cLose') : 'cShuffle')
      setShowResult(true); bump()
      return true
    }
    return false
  }

  const pump = () => {
    const r = R.current; if (!r.mounted || !r.st) return
    if (finishIfOver()) return
    const out = advance(r.st, r.cfg, 1)
    for (const e of out.events) {
      if (e.ev === 'discard') { r.last = { seat: e.seat, id: e.tile.id }; snd('cPlay'); r.log.unshift(`${SEAT_NAME[e.seat]} discarded ${tileName(e.tile.k)}`) }
      else if (e.ev === 'draw') snd('cDraw')
      else if (e.ev === 'call') { snd('cSkip'); r.log.unshift(`${SEAT_NAME[e.seat]} called ${e.action}`) }
      else if (e.ev === 'kong') { snd('cSkip'); r.log.unshift(`${SEAT_NAME[e.seat]} made a kong`) }
    }
    r.log = r.log.slice(0, 8)
    bump()
    if (r.st.phase === 'over') { finishIfOver(); return }
    if (out.need) { save(); return }
    r.timer = setTimeout(pump, calm ? 40 : 520)
  }
  const kick = (delay = 350) => { clearTimeout(R.current.timer); R.current.timer = setTimeout(pump, calm ? 30 : delay) }

  function beginHand() {
    const r = R.current
    r.st = startHand(r.match); r.counted = false; r.log = []; r.last = null
    setSel(null); setHintBox(null); setMsg(''); setPairPick(null); setShowResult(false); setScreen('play'); bump(); save(); kick(500)
  }
  function startMatch(over = {}) {
    unlockAudio(); const o = { ...cfg, ...over }
    const match = newMatch({ minFan: o.minFan, dealerDouble: o.dealerDouble, windRounds: o.windRounds, difficulty: o.difficulty })
    R.current.match = match; R.current.cfg = { human: 0, levels: ['normal', o.difficulty, o.difficulty, o.difficulty] }
    beginHand()
  }
  function resume() {
    const d = ls.get(SAVE_KEY, null); if (!d) return
    unlockAudio(); const r = R.current
    r.match = d.match; r.st = d.st; r.cfg = { human: 0, levels: d.levels }; r.counted = false; r.log = ['Game restored']; r.last = null
    setSel(null); setShowResult(false); setScreen('play'); bump(); kick(300)
  }
  function nextHand() {
    const r = R.current
    if (r.match.finished) { setShowResult(false); setScreen('final'); return }
    beginHand()
  }

  // ---- human actions ----
  const st = online ? net.st : R.current.st, human = online ? net.seat : 0
  const nameOf = (s2) => (online ? net.names[s2] || SEAT_NAME[s2] : SEAT_NAME[s2])
  const rel = (k) => (human + k) % 4
  const myTurn = st && st.phase === 'discard' && st.turn === human
  const myClaim = st && st.phase === 'claim' && pendingClaimSeats(st).includes(human)
  const sdScore = myTurn ? selfDrawScore(st, human) : null
  const kongs = myTurn ? kongOptions(st, human) : []
  const doDiscard = (id) => { const r = R.current; if (!myTurn) return; if (online) { mjActions.discard(id); setSel(null); setHintBox(null); setMsg(''); snd('cPlay'); return } const res = discardTile(r.st, human, id); if (!res.ok) { setMsg(res.reason); return } r.last = { seat: 0, id }; snd('cPlay'); setSel(null); setHintBox(null); setMsg(''); bump(); save(); kick(400) }
  const doClaim = (action, pair) => { const r = R.current; if (online) { mjActions.claim(action, pair); if (action !== 'pass') snd('cSkip'); setPairPick(null); setMsg(''); return } const res = claim(r.st, human, action, pair); if (!res.ok) { setMsg(res.reason); return } if (action !== 'pass') snd('cSkip'); setPairPick(null); setMsg(''); bump(); save(); finishIfOver() || kick(300) }
  const doWin = () => { const r = R.current; if (online) { mjActions.win(); return } const res = declareSelfDrawWin(r.st, human); if (!res.ok) { setMsg(res.reason); return } bump(); finishIfOver() }
  const doKong = (k) => { const r = R.current; if (online) { mjActions.kong(k); setSel(null); return } const res = declareKong(r.st, human, k); if (!res.ok) { setMsg(res.reason); return } snd('cSkip'); setSel(null); bump(); save(); finishIfOver() || kick(300) }
  const sortHand = () => { const sst = online ? net.st : R.current.st; if (!sst) return; sst.players[human].hand = sortTiles(sst.players[human].hand); bump() }
  const moveSel = (d) => { const sst = online ? net.st : R.current.st; if (!sst || sel === null) return; const h = sst.players[human].hand, i = h.findIndex((t) => t.id === sel), j = i + d; if (i < 0 || j < 0 || j >= h.length) return;[h[i], h[j]] = [h[j], h[i]]; bump() }
  const tapTile = (t) => { if (!myTurn) { setSel(t.id === sel ? null : t.id); return } if (sel === t.id) doDiscard(t.id); else { setSel(t.id); snd('ui') } }
  const askHint = () => {
    const r = { st }; if (!r.st) return
    if (myClaim) { const o = r.st.claims.options[human]; setHintBox(o.hu ? 'You can declare Mahjong now: press Mahjong!' : o.kong ? 'A kong is possible. It gives a replacement draw but exposes the set.' : o.pung ? 'A pung is possible. Claim it if it brings you closer to a winning hand or it is a dragon / wind of value.' : 'You can chow this tile. Compare how many sets you would have afterwards.'); return }
    if (!myTurn) { setHintBox('Wait for your turn.'); return }
    if (sdScore && sdScore.valid) { setHintBox('You already have a winning hand: press Mahjong!'); return }
    const h = aiHint(viewFor(r.st, human)); setSel(h.tile.id); setHintBox(`Suggested discard: ${tileName(h.tile.k)}: ${h.reason}.${h.shanten <= 0 ? ' You would be ready to win.' : ''}`)
  }

  // keyboard
  useEffect(() => {
    if (screen !== 'play') return undefined
    const fn = (e) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      const r = { st }; if (!r.st) return
      const h = r.st.players[human].hand
      const key = e.key.toLowerCase()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const i = h.findIndex((t) => t.id === sel); const j = i < 0 ? 0 : Math.min(h.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1))); setSel(h[j].id) }
      else if ((e.key === 'Enter' || e.key === ' ') && sel !== null) { e.preventDefault(); if (myTurn) doDiscard(sel) }
      else if (key === 's') sortHand()
      else if (key === 'h') askHint()
      else if (key === 'm' && (myClaim ? r.st.claims.options[human].hu : sdScore && sdScore.valid)) { myClaim ? doClaim('hu') : doWin() }
      else if (key === 'p' && myClaim && r.st.claims.options[human].pung) doClaim('pung')
      else if (key === 'k' && myClaim && r.st.claims.options[human].kong) doClaim('kong')
      else if (key === 'x' && myClaim) doClaim('pass')
    }
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn)
  })

  const full = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 759px)').matches
  const sizeClass = cfg.tile === 'l' ? 'big' : cfg.tile === 's' ? 'tiny' : 'mid'
  const root = 'mj ' + (cfg.dark ? 'dark ' : '') + sizeClass + ((screen === 'play' || online) ? ' playing' : '')

  // ---------------- screens ----------------
  if (online && net.finished) {
    const m = net.match, order = [0, 1, 2, 3].sort((a, b) => m.scores[b] - m.scores[a])
    return <div className={root}><div className="mj-panel"><h2>Match finished</h2><p>{order[0] === human ? 'You won the match!' : nameOf(order[0]) + ' won the match.'}</p>{order.map((s2, n) => <div key={s2} className="mj-score"><b>{n + 1}. {nameOf(s2)}</b><span>{m.scores[s2] > 0 ? '+' : ''}{m.scores[s2]}</span></div>)}<button className="mj-btn go" onClick={() => { if (net.host) stopMahjong(true); else leaveRoom() }}>Leave table</button></div></div>
  }
  if (!online && screen === 'rules') return <div className={root}><div className="mj-panel"><h2>Rules of this game</h2>{RULES.map(([h, b]) => <div key={h}><h3>{h}</h3><p>{b}</p></div>)}<button className="mj-btn go" onClick={() => setScreen('menu')}>Back</button></div></div>
  if (!online && screen === 'tutorial') return <div className={root}><Tutorial onBack={() => setScreen('menu')} /></div>
  if (!online && screen === 'practice') return <div className={root}><PracticePanel onBack={() => setScreen('menu')} /></div>
  if (!online && screen === 'stats') {
    const pct = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0
    const pats = Object.entries(stats.patterns).sort((a, b) => b[1] - a[1]).slice(0, 6)
    return (
      <div className={root}><div className="mj-panel"><h2>Statistics</h2>
        <div className="mj-statgrid">
          {[['Games played', stats.games], ['Won / lost', stats.wins + ' / ' + stats.losses], ['Win rate', pct + '%'], ['Hands won', stats.handsWon], ['Self-draw wins', stats.selfDraw], ['Wins on a discard', stats.discardWins], ['Average score per game', stats.games ? Math.round(stats.scoreSum / stats.games) : 0], ['Best hand', stats.best ? stats.best.fan + ' fan / ' + stats.best.points + ' pts' : '—']].map(([a, b]) => <div key={a}><small>{a}</small><b>{b}</b></div>)}
        </div>
        <h3>By difficulty</h3><div className="mj-statgrid">{['easy', 'normal', 'hard'].map((d) => <div key={d}><small>{d}</small><b>{stats.byDiff[d].wins}/{stats.byDiff[d].games}</b></div>)}</div>
        <h3>Most common winning patterns</h3><p>{pats.length ? pats.map(([n, c]) => n + ' x' + c).join(' · ') : 'Win a hand to see your patterns.'}</p>
        <h3>Recent hands</h3>
        <div className="mj-hist">{stats.history.length ? stats.history.slice(0, 12).map((h, i) => <div key={i}><b>{h.type === 'win' ? (h.winner === 0 ? 'You won' : WIND_NAME[h.winner] + ' seat won') : 'Draw'}</b> {h.fan ? `${h.fan} fan, ${h.points} pts` : ''} <small>{h.items.join(', ')} · {h.difficulty}</small></div>) : <p>No hands played yet.</p>}</div>
        <button className="mj-btn" onClick={() => { ls.set(STAT_KEY, EMPTY_STATS); setStats(EMPTY_STATS) }}>Reset statistics</button> <button className="mj-btn go" onClick={() => setScreen('menu')}>Back</button>
      </div></div>
    )
  }
  if (!online && screen === 'final') {
    const m = R.current.match, order = [0, 1, 2, 3].sort((a, b) => m.scores[b] - m.scores[a])
    return <div className={root}><div className="mj-panel"><h2>Match finished</h2><p>{order[0] === 0 ? 'You won the match!' : SEAT_NAME[order[0]] + ' won the match.'}</p>{order.map((s, n) => <div key={s} className="mj-score"><b>{n + 1}. {SEAT_NAME[s]}</b><span>{m.scores[s] > 0 ? '+' : ''}{m.scores[s]}</span></div>)}<button className="mj-btn go" onClick={() => startMatch()}>Play again</button> <button className="mj-btn" onClick={() => setScreen('menu')}>Menu</button></div></div>
  }
  if (!online && screen === 'menu') {
    return (
      <div className={root}>
        <div className="mj-menu">
          <div className="mj-logo"><span>🀄</span><h1>MAHJONG</h1><small>Hong Kong style · 144 tiles · 3 computer opponents</small></div>
          <div className="mj-tiles-deco">{['dr', 'm8', 'p5', 'we', 's3', 'dg'].map((k) => <Tile key={k} k={k} size="m" />)}</div>
          <div className="mj-menubtns">
            <button className="mj-btn go" onClick={() => startMatch()}>▶ Play · Classic ({cfg.difficulty})</button>
            <button className="mj-btn go" onClick={() => { try { window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'online:mahjong' })) } catch { /* ignore */ } }}>🌐 Invite friends (online, 2-4 players)</button>
            {net.error && <div className="mj-msg">{net.error}</div>}
            {saved && <button className="mj-btn" onClick={resume}>⏵ Continue saved game</button>}
            <div className="mj-diff">{['easy', 'normal', 'hard'].map((d) => <button key={d} className={'mj-btn' + (cfg.difficulty === d ? ' on' : '')} onClick={() => setCfg((c) => ({ ...c, difficulty: d }))}>{d}</button>)}</div>
            <button className="mj-btn" onClick={() => setCustom((v) => !v)}>⚙ Custom game & settings</button>
            {custom && (
              <div className="mj-custom">
                <label>Minimum fan to win <select value={cfg.minFan} onChange={(e) => setCfg((c) => ({ ...c, minFan: +e.target.value }))}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}{n === 3 ? ' (traditional)' : ''}</option>)}</select></label>
                <label>Dealer pays double <input type="checkbox" checked={cfg.dealerDouble} onChange={(e) => setCfg((c) => ({ ...c, dealerDouble: e.target.checked }))} /></label>
                <label>Wind rounds <select value={cfg.windRounds} onChange={(e) => setCfg((c) => ({ ...c, windRounds: +e.target.value }))}>{[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label>Tile size <select value={cfg.tile} onChange={(e) => setCfg((c) => ({ ...c, tile: e.target.value }))}><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label>
                <label>Dark mode <input type="checkbox" checked={cfg.dark} onChange={(e) => setCfg((c) => ({ ...c, dark: e.target.checked }))} /></label>
                <label>Reduced motion / fast bots <input type="checkbox" checked={cfg.calm} onChange={(e) => setCfg((c) => ({ ...c, calm: e.target.checked }))} /></label>
                <label>Sound effects <input type="checkbox" checked={cfg.sound} onChange={(e) => setCfg((c) => ({ ...c, sound: e.target.checked }))} /></label>
                <small>Settings are saved on this device. Music is not part of this game; sound effects follow the arcade sound button.</small>
              </div>
            )}
            <button className="mj-btn" onClick={() => setScreen('practice')}>🎯 Practice: Win Trainer</button>
            <button className="mj-btn" onClick={() => setScreen('tutorial')}>📘 Tutorial</button>
            <button className="mj-btn" onClick={() => setScreen('rules')}>📜 Rules</button>
            <button className="mj-btn" onClick={() => setScreen('stats')}>📊 Statistics & history</button>
            <small className="mj-limit">Play with friends online: press Invite friends, share the room code or link, then the host starts the table (bots fill empty seats). Hot-seat play on one device is not available.</small>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- the board ----------------
  if (!st) return <div className={root}><div className="mj-panel"><p>Loading…</p></div></div>
  const me = st.players[human], match = online ? net.match : R.current.match
  const wind = WIND_NAME[st.prevailing] || 'East'
  const seatsAt = { bottom: 0, right: 1, top: 2, left: 3 }
  const lastId = R.current.last && R.current.last.id
  const claimOpts = myClaim ? st.claims.options[human] : null
  const OppSeat = ({ s, cls }) => {
    const p = st.players[s], turn = st.turn === s && st.phase !== 'over' && st.phase !== 'claim', w = seatWindOf(st, s)
    return (
      <div className={'mj-opp ' + cls + (turn ? ' turn' : '')}>
        <div className="mj-plate"><b>{nameOf(s)}</b><span className="mj-wind" title={WIND_NAME[w] + ' wind'}>{HONOR_ZH[WINDS[w]]}{st.dealer === s ? <i title="Dealer">庄</i> : null}</span><span className="mj-sc">{match.scores[s] > 0 ? '+' : ''}{match.scores[s]}</span>{p.flowers.length > 0 && <small title="Bonus tiles">🌸{p.flowers.length}</small>}</div>
        <div className="mj-backs">{Array.from({ length: p.hand.length }).map((_, i) => <Tile key={i} back size="xs" />)}</div>
        <div className="mj-melds">{p.melds.map((m, i) => <Meld key={i} m={m} size="xs" />)}</div>
      </div>
    )
  }
  const Discards = ({ s, cls }) => <div className={'mj-disc ' + cls}>{st.players[s].discards.map((t) => <Tile key={t.id} k={t.k} size="xs" hot={t.id === lastId} />)}</div>
  const res = st.result
  return (
    <div className={root + (full ? ' full' : '')}>
      <div className="mj-top">
        <button className="mj-btn" onClick={() => { if (online) { if (net.host) stopMahjong(true); else leaveRoom(); return } clearTimeout(R.current.timer); save(); setSaved(true); setScreen('menu') }}>{online ? 'Leave table' : '← Menu'}</button>
        <div className="mj-info">{online ? <b>🌐 ONLINE · </b> : null}<b>{wind} round</b> · hand {match.handNo}{match.dealerStreak ? ` (dealer x${match.dealerStreak + 1})` : ''} · wall <b>{liveTilesLeft(st)}</b> · you are <b>{WIND_NAME[seatWindOf(st, human)]}</b>{st.dealer === human ? ' (dealer 庄)' : ''}</div>
        <div className="mj-toolbar"><button className="mj-btn" onClick={sortHand} title="Sort your hand by suit and number (S)">Sort</button>{cfg.hints && <button className="mj-btn" onClick={askHint} title="Get a hint (H)">Hint</button>}</div>
      </div>
      <div className="mj-board">
        <OppSeat s={rel(2)} cls="mjs-top" /><OppSeat s={rel(3)} cls="mjs-left" /><OppSeat s={rel(1)} cls="mjs-right" />
        <div className="mj-center">
          <div className="mj-center-info"><span className="mj-bigwind">{HONOR_ZH[WINDS[st.prevailing]]}</span><small>{st.phase === 'over' ? 'Hand over' : st.phase === 'claim' ? 'Waiting for calls…' : st.turn === human ? 'Your turn' : nameOf(st.turn) + ' is playing'}</small></div>
          <div className="mj-discards"><Discards s={rel(2)} cls="d-top" /><Discards s={rel(3)} cls="d-left" /><Discards s={rel(1)} cls="d-right" /><Discards s={human} cls="d-bottom" /></div>
        </div>
        <div className={'mj-me' + (myTurn ? ' turn' : '')}>
          <div className="mj-plate"><b>You</b><span className="mj-wind">{HONOR_ZH[WINDS[seatWindOf(st, human)]]}{st.dealer === human ? <i>庄</i> : null}</span><span className="mj-sc">{match.scores[human] > 0 ? '+' : ''}{match.scores[human]}</span>{me.flowers.length > 0 && <span className="mj-flowers" title="Your bonus tiles">{me.flowers.map((t) => <Tile key={t.id} k={t.k} size="xs" />)}</span>}</div>
          <div className="mj-melds">{me.melds.map((m, i) => <Meld key={i} m={m} size="s" />)}</div>
          <div className="mj-hand" role="group" aria-label="Your hand">{me.hand.map((t, i) => <Tile key={t.id} k={t.k} size="m" sel={sel === t.id} hot={hintBox && sel === t.id} onClick={() => tapTile(t)} small={false} label={tileName(t.k) + (sel === t.id && myTurn ? ' (selected, tap again to discard)' : '')} />)}</div>
        </div>
      </div>
      <div className="mj-actions">
        {msg && <div className="mj-msg">{msg}</div>}
        {hintBox && <div className="mj-hint">💡 {hintBox}</div>}
        {myTurn && (
          <div className="mj-btnrow">
            {sdScore && sdScore.valid && <button className="mj-btn win" onClick={doWin} title="Declare Mahjong (M)">Mahjong! ({sdScore.fan} fan)</button>}
            {sdScore && !sdScore.valid && <span className="mj-note">This hand is complete but only {sdScore.fan} fan (needs {match.opts.minFan}).</span>}
            {kongs.map((o) => <button key={o.k + o.type} className="mj-btn" onClick={() => doKong(o.k)} title="Four of a kind, then draw a replacement tile">Kong {tileName(o.k)}</button>)}
            {sel !== null && <><button className="mj-btn go" onClick={() => doDiscard(sel)}>Discard</button><button className="mj-btn" onClick={() => moveSel(-1)} title="Move tile left">◀</button><button className="mj-btn" onClick={() => moveSel(1)} title="Move tile right">▶</button></>}
            {sel === null && <span className="mj-note">Tap a tile to select it, tap it again (or press Discard) to throw it.</span>}
          </div>
        )}
        {myClaim && (
          <div className="mj-btnrow claim">
            <span className="mj-note">{SEAT_NAME[st.claims.from]} {st.claims.kind === 'robkong' ? 'is making a kong with' : 'discarded'} <Tile k={st.claims.tile.k} size="s" /></span>
            {claimOpts.hu && <button className="mj-btn win" onClick={() => doClaim('hu')}>Mahjong! ({claimOpts.hu.fan} fan)</button>}
            {claimOpts.kong && <button className="mj-btn" onClick={() => doClaim('kong')}>Kong</button>}
            {claimOpts.pung && <button className="mj-btn" onClick={() => doClaim('pung')}>Pung</button>}
            {claimOpts.chow && (pairPick ? <>{claimOpts.chow.map((p) => <button key={p.join()} className="mj-btn" onClick={() => doClaim('chow', p)}>{[p[0], st.claims.tile.k, p[1]].sort().map((k) => tileFace(k).big).join(' ')}</button>)}<button className="mj-btn" onClick={() => setPairPick(false)}>cancel</button></> : <button className="mj-btn" onClick={() => (claimOpts.chow.length === 1 ? doClaim('chow', claimOpts.chow[0]) : setPairPick(true))}>Chow</button>)}
            <button className="mj-btn" onClick={() => doClaim('pass')} title="Decline (X)">Pass</button>
          </div>
        )}
        {!myTurn && !myClaim && st.phase !== 'over' && <div className="mj-note">{R.current.log[0] || 'Waiting…'}</div>}
      </div>
      {(online ? st.phase === 'over' : showResult) && res && !(online && net.finished) && (
        <div className="mj-result"><div className="mj-resultbox">
          <h2>{res.type === 'draw' ? 'Draw: the wall is exhausted' : res.winner === human ? (res.selfDraw ? 'You win by self-draw! 自摸' : 'You win! 糊') : `${nameOf(res.winner)} wins${res.selfDraw ? ' by self-draw' : ' from ' + nameOf(res.discarder)}`}</h2>
          {res.type === 'win' && <>
            <div className="mj-hand-demo">{[...res.melds.map((m, i) => <Meld key={'m' + i} m={{ ...m, concealed: false }} size="s" />), <span key="h" className="mj-grp">{res.hand.map((k, i) => <Tile key={i} k={k} size="s" />)}</span>]}</div>
            <div className="mj-breakdown">{res.items.map((it, i) => <div key={i}><span>{it.name}</span><b>{it.fan ? it.fan + ' fan' : '—'}</b></div>)}<div className="tot"><span>Total {res.fan >= match.opts.limit ? '(limit)' : ''}</span><b>{res.fan} fan = {res.points} points</b></div></div>
            <p className="mj-note">{res.structure && res.structure.kind === 'orphans' ? 'Thirteen orphans: one of each terminal and honour plus a pair.' : 'Structure: ' + (res.structure ? res.structure.sets.map((s) => s.t + ' ' + tileName(s.k)).join(', ') + ' and a pair of ' + tileName(res.structure.pair) : '')}</p>
          </>}
          {res.type === 'draw' && <p>{res.reason}</p>}
          <div className="mj-pay">{[0, 1, 2, 3].map((s) => <div key={s}><span>{nameOf(s)}</span><b className={res.payments[s] > 0 ? 'up' : res.payments[s] < 0 ? 'down' : ''}>{res.payments[s] > 0 ? '+' : ''}{res.payments[s]}</b><small>total {match.scores[s]}</small></div>)}</div>
          {online && !net.host ? <p className="mj-note">Waiting for the host to continue…</p> : <button className="mj-btn go" onClick={online ? () => mjActions.next() : nextHand}>{match.finished ? 'Final results' : 'Next hand'}</button>}
        </div></div>
      )}
    </div>
  )
}
