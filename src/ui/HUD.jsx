'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribe, getSnap, startGame, toShop, launchNext, buy, retryMission, toMenu, togglePause, useSkill, startGameAt, setShip, setName, markSeen } from '../game/engine.js'
import { subscribeSlug, getSlugSnap, slugActions } from '../game/slug.js'
import { subscribePickle, getPickleSnap, pickleActions, MODES } from '../game/pickle.js'
import { subscribeBomber, getBomberSnap, bomberActions, MODES as BMODES } from '../game/bomber.js'
import { subscribeSettings, getSettings, setSetting, resetSettings } from '../game/settings.js'
import { fetchTop } from '../game/online.js'
import { UPGRADES, MISSIONS, BOSSES, BONUS_AFTER } from '../game/levels.js'
import { SP, SHIP_DEFS, PAINTS, TRAILS, BULLET_COLORS, shipSprite } from '../game/sprites.js'
import { isMuted, setMuted, initAudio, unlockAudio, audioState, onAudioState, audioLevel, testSound } from '../game/audio.js'

// ===================== HELPER (how to play) =====================
let help = { open: false, tab: 'start', resume: null }
const helpSubs = new Set()
const helpEmit = () => helpSubs.forEach((f) => f())
const useHelp = () => useSyncExternalStore((f) => { helpSubs.add(f); return () => helpSubs.delete(f) }, () => help)
export function openHelp(tab) {
  const snap = getSnap()
  let resume = null
  if (snap && snap.mode === 'playing') { togglePause(); resume = 'space' }
  else if (snap && snap.mode === 'slug') resume = slugActions.pause() ? 'slug' : null
  else if (snap && snap.mode === 'pickle') resume = pickleActions.pause() ? 'pickle' : null
  else if (snap && snap.mode === 'bomber') resume = bomberActions.pause() ? 'bomber' : null
  help = { open: true, tab: tab || help.tab, resume }
  helpEmit()
}
export function closeHelp() {
  const r = help.resume
  help = { ...help, open: false, resume: null }
  helpEmit()
  if (r === 'space') togglePause(); else if (r === 'slug') slugActions.resume(); else if (r === 'pickle') pickleActions.resume(); else if (r === 'bomber') bomberActions.resume()
}
const K = ({ children }) => <kbd>{children}</kbd>
const HELP = {
  start: {
    name: '👋 START HERE',
    body: () => (
      <>
        <p><b>Welcome to My Space Arcade.</b> Three games, one dashboard. Pick a game, learn it in a minute, beat your score, and climb the <b>TOP PLAYERS</b> board.</p>
        <ol>
          <li>Type your <b>name</b> in the Pilot Profile so your scores show on the leaderboard.</li>
          <li>Press <b>PLAY</b> on a game card. The first time you play a game, this guide opens automatically.</li>
          <li>Press <K>P</K> or <K>Esc</K> any time to pause. Press <K>F1</K> or the <b>?</b> button to reopen this guide.</li>
          <li>Press <K>M</K> to mute / unmute. Use <b>▶ TEST</b> on the dashboard to check your sound.</li>
        </ol>
        <p>Everything you do earns <b>XP</b> (kills, bosses, rescues, wins) and unlocks <b>ranks</b>, <b>awards</b> and new <b>ship hulls</b>.</p>
      </>
    ),
  },
  space: {
    name: '🚀 SPACE IMPACT',
    body: () => (
      <>
        <p><b>Goal:</b> clear 10 levels. Each level has waves, a <b>challenge</b> (bonus rewards) and a <b>boss</b>. Some levels are followed by a coin-rush <b>bonus round</b>.</p>
        <h5>CONTROLS</h5>
        <p><K>WASD</K> / arrows move · <K>SPACE</K> fire (hold) · touch: drag to move</p>
        <p><K>Q</K> LASER · <K>B</K> BOMB · <K>E</K> SHIELD · <K>R</K> OVERDRIVE (ultimate, fills as you kill)</p>
        <h5>HOW IT WORKS</h5>
        <ul>
          <li>Kill enemies fast to build a <b>combo</b> (up to ×8 score). Taking damage resets it.</li>
          <li>Enemies drop <b>coins</b> (credits for the Hangar shop) and <b>power-ups</b>: weapon level, shield, rapid, spread, laser, missiles, repair, overcharge, 1UP, ×2, magnet, <b>drone</b>.</li>
          <li><b>Skills</b> have cooldowns (see the skill bar bottom-right). Upgrade each to LV5 in the Hangar between levels.</li>
          <li>Bosses drop a wingman <b>drone</b> that shoots and blocks bullets.</li>
        </ul>
        <h5>TIPS</h5>
        <p>Keep moving. Save the Laser for a boss's weak moment, the Bomb for emergencies, and Shield when bullets fill the screen. Open <b>CUSTOMIZE SHIP</b> for hulls, paint, trail and bullet colours.</p>
      </>
    ),
  },
  slug: {
    name: '🪖 GROUND ZERO',
    body: () => (
      <>
        <p><b>Goal:</b> fight through 3 stages and defeat each boss. Rescue <b>POWs</b> (tied-up prisoners) for weapons and big points. Grab the <b>battle tank</b> when you see it.</p>
        <h5>CONTROLS</h5>
        <p><K>A</K><K>D</K> move · <K>W</K> aim up · <K>S</K> crouch · <K>K</K> / <K>SPACE</K> jump</p>
        <p><K>J</K> / <K>Z</K> fire · <K>G</K> grenade (or tank cannon) · <K>V</K> leave the tank</p>
        <p><K>Q</K> AIRSTRIKE · <K>E</K> SHIELD · <K>R</K> OVERDRIVE</p>
        <h5>HOW IT WORKS</h5>
        <ul>
          <li>Stand next to an enemy and fire: you use your <b>knife</b> (instant kill, bonus points).</li>
          <li>Crates give <b>Heavy Machine Gun</b>, <b>Shotgun</b>, <b>Rocket</b>, <b>Grenades</b> or a <b>Medkit</b>. Red barrels explode. Shoot them near enemies.</li>
          <li>The <b>tank</b> has armour, a machine gun and a cannon, and crushes foot soldiers. When it is destroyed you pop out unharmed.</li>
          <li>Kill streaks add bonus score. Rescue every POW for a stage bonus.</li>
        </ul>
        <h5>TIPS</h5>
        <p>Jump over runners, crouch under shots, shoot helicopters from below, and use Airstrike when a crowd gathers. Keyboard only.</p>
      </>
    ),
  },
  pickle: {
    name: '🏓 PICKLEBALL',
    body: () => (
      <>
        <p><b>Goal:</b> first to 11 (or the points you pick), <b>win by 2</b>. Choose <b>VS Bot, 1v1 Local, 2v2 + Bot, 2v2 Co-op</b> or watch <b>Bots vs Bots</b> in the lobby.</p>
        <h5>CONTROLS</h5>
        <p><K>WASD</K> move · <K>F</K> DRIVE (becomes a SMASH on high balls) · <K>G</K> DINK (soft shot) · <K>H</K> LOB (high deep shot)</p>
        <p>Hold a direction as you hit to aim. Player 2: <K>↑↓←→</K> + <K>,</K> <K>.</K> <K>/</K></p>
        <p>To <b>serve</b>, press a shot key when the hint appears. Aim with the direction keys.</p>
        <h5>THE RULES (all enforced for you)</h5>
        <ul>
          <li><b>Serve</b> underhand and <b>diagonally</b> into the opposite service box (the green markers show where).</li>
          <li><b>Two-bounce rule:</b> the serve and the return must each bounce before anyone hits it out of the air.</li>
          <li><b>The kitchen</b> (the teal zone by the net): you cannot hit a ball out of the air while standing in it.</li>
          <li>Only the <b>serving side scores</b>. Win a rally on the other side's serve and you get the serve (side-out). In doubles each side has two servers.</li>
          <li>Faults: ball in the net, out of bounds, two-bounce or kitchen violations, bad serves.</li>
        </ul>
        <h5>TIPS</h5>
        <p>Dink short into the kitchen to pull opponents forward, then lob or smash. Stand at the kitchen line (just outside the teal) to attack. Your score call (e.g. 4-2-1) is announced each serve.</p>
      </>
    ),
  },
  bomber: {
    name: '💣 BOMBER BLAST',
    body: () => (
      <>
        <p><b>Goal:</b> be the last fighter (or team) standing. Win <b>best of 1, 3 or 5</b> rounds. Pick a mode in the Bomber lobby: <b>Free for All, 1v1 Duel, 1v1 Local, Party (2 humans + 2 bots), 2v2 + Bot, 2v2 Co-op</b> or <b>Bots Only</b>.</p>
        <h5>CONTROLS</h5>
        <p><K>WASD</K> move · <K>SPACE</K> drop a bomb. Player 2: <K>↑↓←→</K> + <K>ENTER</K> or <K>/</K></p>
        <h5>HOW IT WORKS</h5>
        <ul>
          <li>Bombs explode after about 2 seconds in a <b>cross</b>. Flames stop at the grey steel pillars and break the <b>orange blocks</b>. A flame that touches another bomb sets it off: <b>chain reactions</b>!</li>
          <li>You can walk off a bomb you just dropped, but then it blocks you. <b>Do not trap yourself.</b></li>
          <li>Broken blocks sometimes drop <b>power-ups</b>: <b>💣 more bombs</b>, <b>🔥 longer flames</b>, <b>⚡ speed</b>, <b>🦶 kick</b> (push bombs by walking into them), <b>🛡 shield</b> (survive one blast). Flames destroy power-ups lying around.</li>
          <li>After 90 seconds <b>SUDDEN DEATH</b> starts: steel blocks drop in a spiral from the edge. The red flashing square is the next one.</li>
          <li>In team modes your team's flames do not hurt you, but your <b>own</b> bomb still can.</li>
        </ul>
        <h5>TIPS</h5>
        <p>Always plan your escape route before you bomb. Bots flee from flames, hunt power-ups and trap you in corridors: at HARD they are good at it. Bomb a block, step around the corner, and let the chain do the work.</p>
      </>
    ),
  },
  sound: {
    name: '🔊 SOUND',
    body: () => (
      <>
        <p>All sound is generated live by your browser: effects, music and an announcer voice. There are no audio files.</p>
        <ol>
          <li>Click or press any key once. Browsers block audio until you do.</li>
          <li>Press <b>▶ TEST</b> on the dashboard. You should hear a jingle and a voice. Watch the <b>green meter</b>: if it moves, sound is being produced.</li>
          <li><b>No sound but the meter moves?</b> Check your computer volume, the tab is not muted, and the correct speaker is selected.</li>
          <li><b>Embedded or preview browsers</b> (like the one inside an editor or desktop app) often have <b>no audio output at all</b>. Open the game in <b>Chrome, Edge, Firefox or Safari</b> instead.</li>
          <li>Press <K>M</K> to toggle mute. The button label shows if you are muted.</li>
        </ol>
      </>
    ),
  },
}
function HelpModal() {
  const h = useHelp()
  if (!h.open) return null
  const t = HELP[h.tab] || HELP.start
  return (
    <div className="helpwrap" onClick={closeHelp}>
      <div className="helpbox" onClick={(e) => e.stopPropagation()}>
        <div className="helphead">
          <h2>❓ HOW TO PLAY</h2>
          <button className="mini" onClick={closeHelp}>✕ CLOSE {h.resume ? '& RESUME' : ''}</button>
        </div>
        <div className="tabs">{Object.entries(HELP).map(([k, v]) => <button key={k} className={'tab ' + (h.tab === k ? 'sel' : '')} onClick={() => { help = { ...help, tab: k }; helpEmit() }}>{v.name}</button>)}</div>
        <div className="helpbody">{t.body()}</div>
      </div>
    </div>
  )
}
const FIRST = { playing: 'space', slug: 'slug', pickle: 'pickle', bomber: 'bomber' }
function HelpLayer({ s }) {
  const g = FIRST[s.mode]
  useEffect(() => {
    if (g && !s.seen[g]) { markSeen(g); const t = setTimeout(() => openHelp(g), 600); return () => clearTimeout(t) }
  }, [g, s.seen])
  const inGame = !!g
  return (
    <>
      <button className="helpbtn" onPointerDown={(e) => e.stopPropagation()} onClick={() => openHelp(g || 'start')} title="How to play (F1)">{inGame ? '?' : '❓ HELP'}</button>
      <HelpModal />
    </>
  )
}

const fmt = (n) => String(Math.floor(n)).padStart(7, '0')
const WEAPON = { normal: 'BLASTER', spread: 'SPREAD', laser: 'LASER', missile: 'MISSILE' }

function Pips({ n, max, ch, cls }) {
  return <span className={cls}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'on' : ''}>{ch}</i>)}</span>
}

function Buff({ label, t, max = 12, color }) {
  if (t <= 0) return null
  return (
    <div className="buff" style={{ '--c': color }}>
      <span>{label}</span><b style={{ width: Math.min(100, (t / max) * 100) + '%' }} />
    </div>
  )
}

function TopBar({ s }) {
  const [mute, setMute] = useState(isMuted())
  const ch = s.challenge
  return (
    <>
      <div className="top">
        <div className="col">
          <div className="lbl">SCORE</div><div className="val">{fmt(s.score)}</div>
          <div className="lbl dim">HI {fmt(s.hi)}</div>
        </div>
        <div className="col mid">
          {s.bonus ? <div className="lbl bonuslbl">★ BONUS ROUND ★ {Math.max(0, Math.ceil(s.bonus.len - s.bonus.t))}s · COINS {s.bonus.coins}</div> : <div className="lbl">{s.mission === s.missions - 1 ? 'FINAL ROUND' : `MISSION ${s.mission + 1} · ${s.missionName}`}</div>}
          {ch && (
            <div className={'chal ' + (ch.done ? 'done' : ch.failed ? 'fail' : '')}>
              {ch.done ? '★ ' : ch.failed ? '✖ ' : '◇ '}{ch.desc}
              {ch.type !== 'nodmg' && ch.type !== 'nolife' && ` (${ch.cur.toLocaleString()}/${ch.target.toLocaleString()})`}
            </div>
          )}
        </div>
        <div className="col right">
          <div className="lbl">CREDITS</div><div className="val cred">◆ {s.credits}</div>
          <button className="mini" onClick={() => { initAudio(); setMuted(!mute); setMute(!mute) }}>{mute ? '🔇 MUTED' : '🔊 SOUND'}</button>
        </div>
      </div>
      <div className="left">
        <div className="row"><span className="k">HULL</span><Pips n={s.hp} max={s.maxHp} ch="♥" cls="pips hp" /></div>
        <div className="row"><span className="k">SHIPS</span><Pips n={s.lives} max={Math.max(3, s.lives)} ch="▲" cls="pips life" /></div>
        {s.drones > 0 && <div className="row"><span className="k">DRONES</span><Pips n={s.drones} max={3} ch="✦" cls="pips drn" /></div>}
        <div className="row"><span className="k">WEAPON</span><span className="wp">{WEAPON[s.special]} <em>LV{s.wl}</em></span></div>
        <Buff label="SPECIAL" t={s.specialT} max={15} color="#3dff7a" />
        <Buff label="RAPID" t={s.rapidT} max={11} color="#ff9a2e" />
        <Buff label="SHIELD" t={s.shieldT} max={9} color="#3de8ff" />
        <Buff label="SCORE x2" t={s.multT} max={12} color="#a64dff" />
        <Buff label="MAGNET" t={s.magnetT} max={10} color="#12c9a5" />
      </div>
      {s.comboMult > 1 || s.combo > 2 ? (
        <div className="combo" key={s.comboMult}><b>x{s.comboMult}</b><span>{s.combo} COMBO</span><i style={{ width: Math.max(0, s.comboT / 2.6) * 100 + '%' }} /></div>
      ) : null}
      <div className="toasts">
        {s.toasts.map((t) => <div key={t.id} className="toast" style={{ color: t.color, borderColor: t.color }}>{t.text}</div>)}
      </div>
      {s.boss && (
        <div className={'boss ' + (s.boss.dying ? 'dying' : '')}>
          <span>{s.boss.name}{s.boss.ph > 1 ? ` · PHASE ${s.boss.ph}` : ''}</span>
          <div className="bar"><b style={{ width: (s.boss.hp / s.boss.max) * 100 + '%' }} /></div>
        </div>
      )}
      <div className="skills">
        {s.skills.map((k) => (
          <button key={k.k} className={'sk ' + (k.cd <= 0 ? 'ready ' : '') + (k.active ? 'active' : '')} style={{ '--c': k.color }} onPointerDown={(e) => { e.stopPropagation(); useSkill(k.k) }}>
            <i style={{ height: Math.min(100, (k.cd / k.max) * 100) + '%' }} />
            <b>{k.key}</b><span>{k.name}</span><em>LV{k.lv}{k.cd > 0 ? ` · ${Math.ceil(k.cd)}s` : ' · READY'}</em>
          </button>
        ))}
      </div>
    </>
  )
}

function Banner({ b }) {
  if (!b) return null
  return (
    <div className={'banner ' + b.kind} key={b.title + b.sub}>
      <h2>{b.title}</h2>
      <h3>{b.sub}</h3>
      {b.sub2 && <p>{b.sub2}</p>}
    </div>
  )
}


const toSrgb = (v) => Math.round(255 * Math.min(1, Math.pow(Math.max(0, v), 1 / 2.2)))
function BossArt({ i }) {
  const ref = useRef()
  useEffect(() => {
    const spr = SP['boss' + i], z = 3, c = ref.current, x = c.getContext('2d')
    c.width = spr.w * z; c.height = spr.h * z
    x.clearRect(0, 0, c.width, c.height)
    for (const p of spr.px) {
      x.fillStyle = `rgb(${toSrgb(p.c[0])},${toSrgb(p.c[1])},${toSrgb(p.c[2])})`
      x.fillRect((p.x + (spr.w - 1) / 2) * z, ((spr.h - 1) / 2 - p.y) * z, z, z)
    }
  }, [i])
  return <canvas ref={ref} className="bossart" />
}

function Codex({ s, onClose, embedded }) {
  return (
    <div className={embedded ? 'codexin' : 'screen codex'}>
      {!embedded && <h1>LEVELS · BOSSES · REWARDS</h1>}
      <div className="rewards">
        <span>◆ COINS = CREDITS</span><span>⚡ COMBO UP TO x8</span><span>★ CHALLENGE: CREDITS + SCORE + DRONE</span>
        <span>✦ BOSS KILL = WINGMAN DRONE</span><span>♥ 1UP EVERY 20,000 PTS</span><span>⛁ BONUS ROUNDS: COIN RUSH</span><span>Q LASER · B BOMB · E SHIELD: 5 LEVELS EACH</span><span>S–C GRADE + FLAWLESS BONUS</span>
      </div>
      <div className="lvgrid">
        {MISSIONS.map((m, i) => {
          const locked = i > s.unlocked
          return (
            <button key={i} className={'lvcard ' + (locked ? 'locked' : '')} onClick={() => !locked && startGameAt(i)} style={{ '--c': m.color }}>
              <em>{locked ? '🔒' : '▶'} LEVEL {i + 1}{i === MISSIONS.length - 1 ? ' · FINAL' : ''}</em>
              <strong>{m.name}</strong>
              <BossArt i={i} />
              <b className="bn">BOSS: {BOSSES[i].name}</b>
              <small>HP {BOSSES[i].hp} · +{BOSSES[i].score.toLocaleString()} PTS · DRONE DROP</small>
              <small className="ch">★ {m.challenge.desc}</small>
              <small className="rw">+{m.challenge.reward.credits} CR · +{m.challenge.reward.score.toLocaleString()} PTS · +DRONE</small>
              {BONUS_AFTER.includes(i) && <small className="bo">⛁ BONUS ROUND FOLLOWS</small>}
            </button>
          )
        })}
      </div>
      {!embedded && <button className="big sec" onClick={onClose}>◀ BACK</button>}
    </div>
  )
}

function Menu({ s, onCodex }) {
  return (
    <div className="screen menu">
      <div className="logo"><span>SPACE</span><span className="b">IMPACT</span></div>
      <div className="tag">10 LEVELS · 10 BOSSES · BONUS ROUNDS · WINGMAN DRONES</div>
      <div className="mlist">
        {MISSIONS.map((m, i) => <span key={i} style={{ color: m.color }}>{i + 1}. {m.name}</span>)}
      </div>
      <button className="big blink" onClick={startGame}>▶ START GAME</button>
      <button className="big sec" onClick={onCodex}>★ LEVELS · BOSSES · REWARDS</button>
      <div className="help">
        <div><kbd>←↑↓→</kbd> / <kbd>WASD</kbd> MOVE</div>
        <div><kbd>SPACE</kbd> FIRE (HOLD)</div>
        <div><kbd>Q</kbd> LASER · <kbd>B</kbd> BOMB · <kbd>E</kbd> SHIELD</div>
        <div><kbd>P</kbd> PAUSE · TOUCH: DRAG TO MOVE</div>
      </div>
      <div className="lbl dim">HI-SCORE {fmt(s.hi)}</div>
    </div>
  )
}

function Clear({ s }) {
  const m = s.summary
  return (
    <div className="screen clear">
      <h1>MISSION {s.mission + 1} COMPLETE</h1>
      <h3 style={{ color: s.color }}>{m.name}</h3>
      <div className="grade">{m.grade}</div>
      <ul>
        {m.lines.map((l, i) => (
          <li key={i} className={l.kind} style={{ animationDelay: 0.25 * i + 's' }}><span>{l.label}</span><b>{l.value}</b></li>
        ))}
      </ul>
      <div className="tot">SCORE {fmt(s.score)}   ·   CREDITS ◆ {s.credits}</div>
      <button className="big" onClick={toShop}>CONTINUE ▶</button>
    </div>
  )
}

function Shop({ s }) {
  const next = MISSIONS[s.mission + 1]
  return (
    <div className="screen shop">
      <h1>HANGAR</h1>
      <div className="tot">CREDITS ◆ {s.credits}</div>
      <div className="cards">
        {UPGRADES.map((u, i) => {
          const lvl = u.key === 'life' ? s.lives : s.up[u.key]
          const maxed = u.key === 'life' ? s.lives >= 6 : lvl >= u.max
          const cost = u.cost(u.key === 'life' ? 0 : lvl)
          const can = !maxed && s.credits >= cost
          return (
            <button key={u.key} className={'card ' + (can ? 'can' : '') + (maxed ? ' max' : '')} onClick={() => buy(u.key)}>
              <em>{i + 1}</em>
              <strong>{u.name}</strong>
              <small>{u.desc}</small>
              <div className="lv">
                {u.key === 'life' ? <span>SHIPS: {s.lives}/6</span> : <>{Array.from({ length: u.max }, (_, j) => <i key={j} className={j < lvl ? 'on' : ''} />)}{u.skill && <span>LV{lvl + 1}</span>}</>}
              </div>
              <b>{maxed ? 'MAX' : '◆ ' + cost}</b>
            </button>
          )
        })}
      </div>
      <button className="big" onClick={launchNext}>{s.bonusNext ? '★ BONUS ROUND, THEN ' : ''}LAUNCH MISSION {s.mission + 2}: {next && next.name} ▶</button>
    </div>
  )
}

function Over({ s }) {
  return (
    <div className="screen over">
      <h1 className="red">GAME OVER</h1>
      <div className="tot">SCORE {fmt(s.score)}</div>
      <div className="lbl dim">HI-SCORE {fmt(s.hi)}</div>
      <button className="big" onClick={retryMission}>↻ RETRY MISSION {s.mission + 1}</button>
      <button className="big sec" onClick={toMenu}>MAIN MENU</button>
    </div>
  )
}

function Victory({ s }) {
  const f = s.final
  return (
    <div className="screen victory">
      <h1 className="gold">EARTH IS SAVED!</h1>
      <h3>OMEGA CORE DESTROYED</h3>
      <div className="grade">{f.rank}</div>
      <ul>
        <li><span>LIVES BONUS</span><b>+{f.lifeB}</b></li>
        <li><span>HULL BONUS</span><b>+{f.hpB}</b></li>
        <li className="bonus"><span>FINAL SCORE</span><b>{fmt(f.score)}</b></li>
      </ul>
      <button className="big" onClick={toMenu}>PLAY AGAIN</button>
    </div>
  )
}


// ===================== DASHBOARD =====================
const ACH = [
  ['FIRST BLOOD', 'Destroy 1 enemy', (p) => p.kills, 1],
  ['EXTERMINATOR', 'Destroy 500 enemies', (p) => p.kills, 500],
  ['BOSS HUNTER', 'Defeat 5 bosses', (p) => p.bosses, 5],
  ['BOSS SLAYER', 'Defeat 15 bosses', (p) => p.bosses, 15],
  ['SKILLED', 'Use skills 50 times', (p) => p.skills, 50],
  ['TREASURE HUNTER', 'Clear 3 bonus rounds', (p) => p.bonus, 3],
  ['HALFWAY THERE', 'Reach Space Impact level 5', (p, u) => u + 1, 5],
  ['EARTH SAVED', 'Beat Space Impact', (p) => p.spaceWins, 1],
  ['LIFE SAVER', 'Rescue 10 POWs', (p) => p.pows, 10],
  ['COMMANDO', 'Beat Operation Ground Zero', (p) => p.slugWins, 1],
  ['HIGH FLYER', 'Score 100,000 in Space Impact', (p) => p.spaceHi, 100000],
  ['FIRST WIN', 'Win a pickleball game', (p) => p.pickleWins || 0, 1],
  ['PICKLE PRO', 'Win 10 pickleball games', (p) => p.pickleWins || 0, 10],
  ['ACE SERVER', 'Serve 5 aces', (p) => p.aces || 0, 5],
  ['BOMBERMAN', 'Win a Bomber Blast match', (p) => p.bomberWins || 0, 1],
  ['DEMOLITION', 'Blow up 100 blocks', (p) => p.bricks || 0, 100],
  ['BOMB SQUAD', 'Knock out 10 opponents', (p) => p.bomberKills || 0, 10],
  ['SOLDIER', 'Score 50,000 in Ground Zero', (p) => p.slugHi, 50000],
]
const RANKS = [[0, 'CADET'], [100, 'PILOT'], [500, 'ACE'], [1500, 'CAPTAIN'], [4000, 'MAJOR'], [9000, 'COLONEL'], [20000, 'LEGEND']]
const xpOf = (p) => p.kills + p.bosses * 50 + p.pows * 20 + (p.spaceWins + p.slugWins) * 500 + (p.pickleWins || 0) * 300 + (p.bomberWins || 0) * 300 + p.played * 5

function SoundBtn() {
  const [, force] = useState(0)
  const [lvl, setLvl] = useState(0)
  useEffect(() => onAudioState(() => force((n) => n + 1)), [])
  useEffect(() => { const id = setInterval(() => setLvl(audioLevel()), 90); return () => clearInterval(id) }, [])
  const st = audioState(), off = isMuted()
  const running = st === 'running'
  const label = off ? '🔇 MUTED (M)' : running ? '🔊 SOUND ON (M)' : '🔈 CLICK TO ENABLE SOUND'
  return (
    <span className="sndwrap">
      <button className={'mini snd ' + (!off && !running ? 'warn' : '')} onClick={() => { if (!running) unlockAudio(); else setMuted(!off) }}>{label}</button>
      <button className="mini snd" onClick={testSound}>▶ TEST</button>
      <i className="meter" title="live audio level"><b style={{ width: lvl * 100 + '%' }} /></i>
    </span>
  )
}

function ShipPreview({ ship }) {
  const ref = useRef()
  useEffect(() => {
    const spr = shipSprite(ship.model, ship.paint), z = 9, c = ref.current, x = c.getContext('2d')
    c.width = 150 * 1.6; c.height = 90 * 1.6
    x.clearRect(0, 0, c.width, c.height)
    const ox = 80, oy = c.height / 2
    const hex = TRAILS[ship.trail][1]
    for (let i = 0; i < 9; i++) {
      x.fillStyle = hex || `hsl(${i * 40}, 90%, 60%)`; x.globalAlpha = 1 - i / 10
      x.fillRect(ox - spr.w * z / 2 - 10 - i * 10, oy - 4 + Math.sin(i) * 3, 9, 8)
    }
    x.globalAlpha = 1
    for (const p of spr.px) {
      x.fillStyle = `rgb(${toSrgb(p.c[0])},${toSrgb(p.c[1])},${toSrgb(p.c[2])})`
      x.fillRect(ox + p.x * z - z / 2, oy - p.y * z - z / 2, z - 1, z - 1)
    }
    x.fillStyle = BULLET_COLORS[ship.bullet][1]
    for (let i = 0; i < 4; i++) x.fillRect(ox + spr.w * z / 2 + 24 + i * 46, oy - 4, 30, 8)
  }, [ship.model, ship.paint, ship.trail, ship.bullet])
  return <canvas ref={ref} className="shipprev" />
}

function ShipLab({ s }) {
  const sh = s.profile.ship, bosses = s.profile.bosses
  const def = SHIP_DEFS[sh.model]
  return (
    <div className="lab">
      <div className="labL">
        <ShipPreview ship={sh} />
        <div className="shipname">{def.name}</div>
        <small>{def.desc}</small>
        <div className="stats">
          <span>SPEED <b>{def.spd}</b></span><span>HULL <b>{3 + def.hp}</b></span><span>FIRE RATE <b>{Math.round(100 / def.rate)}%</b></span>
        </div>
      </div>
      <div className="labR">
        <h4>HULL</h4>
        <div className="chips">
          {SHIP_DEFS.map((d, i) => {
            const locked = bosses < d.unlock
            return <button key={d.id} className={'chip ' + (sh.model === i ? 'sel' : '') + (locked ? ' lock' : '')} onClick={() => !locked && setShip('model', i)}>{locked ? `🔒 ${d.unlock} BOSSES` : d.name}</button>
          })}
        </div>
        <h4>PAINT</h4>
        <div className="chips">
          {PAINTS.map((p, i) => (
            <button key={p[0]} className={'swatch ' + (sh.paint === i ? 'sel' : '')} title={p[0]} onClick={() => setShip('paint', i)} style={{ background: `linear-gradient(135deg, ${p[1]} 50%, ${p[2]} 50%)` }} />
          ))}
        </div>
        <h4>ENGINE TRAIL</h4>
        <div className="chips">
          {TRAILS.map((t, i) => <button key={t[0]} className={'chip ' + (sh.trail === i ? 'sel' : '')} onClick={() => setShip('trail', i)} style={{ borderColor: t[1] || '#fff' }}>{t[0]}</button>)}
        </div>
        <h4>BULLET COLOUR</h4>
        <div className="chips">
          {BULLET_COLORS.map((b, i) => <button key={b[0]} className={'chip ' + (sh.bullet === i ? 'sel' : '')} onClick={() => setShip('bullet', i)} style={{ borderColor: b[1], color: b[1] }}>{b[0]}</button>)}
        </div>
        <small className="hint">Hulls unlock as you defeat bosses (in either game mode). Changes save instantly.</small>
      </div>
    </div>
  )
}

function Awards({ s }) {
  const p = s.profile
  return (
    <div className="awards">
      {ACH.map(([name, desc, get, goal]) => {
        const v = Math.min(goal, get(p, s.unlocked)), done = v >= goal
        return (
          <div key={name} className={'ach ' + (done ? 'done' : '')}>
            <strong>{done ? '★ ' : '☆ '}{name}</strong><small>{desc}</small>
            <div className="bar"><b style={{ width: (v / goal) * 100 + '%' }} /></div><em>{v.toLocaleString()}/{goal.toLocaleString()}</em>
          </div>
        )
      })}
    </div>
  )
}

function Skills() {
  return (
    <div className="skillsdoc">
      <div>
        <h4>SPACE IMPACT</h4>
        <p><kbd>SPACE</kbd> FIRE · <kbd>WASD</kbd> MOVE</p>
        <p><kbd>Q</kbd> <b style={{ color: '#3de8ff' }}>LASER</b> piercing beam, slows you while firing</p>
        <p><kbd>B</kbd> <b style={{ color: '#ffe84a' }}>BOMB</b> screen blast, bullets turn into gems</p>
        <p><kbd>E</kbd> <b style={{ color: '#3dff7a' }}>SHIELD</b> bubble: destroys bullets, rams enemies, reflects (LV4+)</p>
        <p><kbd>R</kbd> <b style={{ color: '#ff4de1' }}>OVERDRIVE</b> ultimate. Fills as you kill: max weapons, rapid fire, 3 drones, invulnerable</p>
        <p>Upgrade each skill to LV5 in the Hangar shop. Pickups: weapon level, shield, rapid, spread, laser, missiles, repair, overcharge, 1UP, x2, magnet, DRONE.</p>
      </div>
      <div>
        <h4>BOMBER BLAST</h4>
        <p><K>WASD</K> MOVE · <K>SPACE</K> BOMB · P2: <K>ARROWS</K> + <K>ENTER</K></p>
        <p>Power-ups: 💣 bombs · 🔥 range · ⚡ speed · 🦶 kick · 🛡 shield. Sudden death after 90s.</p>
      </div>
      <div>
        <h4>GAMEPAD</h4>
        <p>Plug in a controller: stick / d-pad moves, <K>A</K> main action, <K>X</K> fire / drive, <K>Y</K> grenade / dink, <K>B</K> bomb / lob, <K>LB</K> shield, <K>RB</K> overdrive, <K>LT</K> laser / airstrike, <K>Start</K> pause. A second pad controls Player 2.</p>
      </div>
      <div>
        <h4>PICKLEBALL</h4>
        <p><kbd>WASD</kbd> MOVE · <kbd>F</kbd> DRIVE (smash when high) · <kbd>G</kbd> DINK · <kbd>H</kbd> LOB</p>
        <p>Hold a direction while hitting to aim. Player 2: <kbd>ARROWS</kbd> + <kbd>,</kbd> <kbd>.</kbd> <kbd>/</kbd></p>
        <p>Rules: serve diagonally underhand · two-bounce rule · no volleys in the kitchen · only the server scores · first to 11, win by 2.</p>
      </div>
      <div>
        <h4>OPERATION GROUND ZERO</h4>
        <p><kbd>A/D</kbd> MOVE · <kbd>W</kbd> AIM UP · <kbd>S</kbd> CROUCH · <kbd>K</kbd>/<kbd>SPACE</kbd> JUMP</p>
        <p><kbd>J</kbd>/<kbd>Z</kbd> FIRE · <kbd>G</kbd> GRENADE</p>
        <p><kbd>Q</kbd> <b style={{ color: '#ffe84a' }}>AIRSTRIKE</b> bomb run across the screen</p>
        <p><kbd>E</kbd> <b style={{ color: '#3dff7a' }}>SHIELD</b> 4s invulnerable bubble</p>
        <p><kbd>R</kbd> <b style={{ color: '#ff4de1' }}>OVERDRIVE</b> 7s heavy machine gun + invulnerable</p>
        <p>Rescue POWs for weapons and points. Crates: Heavy Machine Gun, Shotgun, Rocket, Grenades, Medkit.</p>
      </div>
    </div>
  )
}

function AudioNotice() {
  const [emb, setEmb] = useState(false)
  useEffect(() => { setEmb(/Electron|Claude\//.test(navigator.userAgent)) }, [])
  if (!emb) return null
  return <div className="audionote">🔇 This looks like an embedded preview browser, which usually has NO audio output. For sound, open <b>{typeof location !== 'undefined' ? location.origin : 'this page'}</b> in Chrome or Safari.</div>
}

const MODE_ICON = { bot: ['🧍', '🤖'], local: ['🧍', '🧍'], duo: ['🧍🤖', '🤖🤖'], coop: ['🧍🧍', '🤖🤖'], demo: ['🤖🤖', '🤖🤖'] }
function PickleLobby({ s, mode, setMode, diff, setDiff, target, setTarget }) {
  const p = s.profile
  const m = MODES[mode]
  const CTRL = {
    bot: 'WASD / arrows move · F drive · G dink · H lob',
    local: 'P1: WASD + F G H   ·   P2: arrows + , . /',
    duo: 'WASD / arrows move · F G H · your bot partner covers the other side',
    coop: 'P1: WASD + F G H   ·   P2: arrows + , . /   ·   bots on the other team',
    demo: 'Just watch! Press Esc to leave.',
  }
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A MODE</h4>
        <div className="modegrid">
          {Object.entries(MODES).map(([k, md]) => (
            <button key={k} className={'modecard ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>
              <div className="vs"><span>{MODE_ICON[k][0]}</span><i>VS</i><span>{MODE_ICON[k][1]}</span></div>
              <strong>{md.name}</strong><small>{md.desc}</small>
            </button>
          ))}
        </div>
        <div className="lobbyopts">
          <div><h4>2 · BOT LEVEL</h4><div className="chips">{['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (diff === i + 1 ? 'sel' : '')} onClick={() => setDiff(i + 1)}>{d}</button>)}</div></div>
          <div><h4>3 · PLAY TO</h4><div className="chips">{[7, 11, 15].map((t) => <button key={t} className={'chip ' + (target === t ? 'sel' : '')} onClick={() => setTarget(t)}>{t} POINTS</button>)}</div></div>
        </div>
        <div className="lobbyinfo"><b>{m.name}</b> · {m.desc}<br /><small>{CTRL[mode]}</small></div>
        <button className="big" onClick={() => pickleActions.start(mode, diff, target)}>▶ START MATCH</button>
        <small className="hint">Rules: serve diagonally underhand · ball must bounce once on each side before volleys · no volleys in the kitchen (teal zone) · only the server scores · win by 2.</small>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY PICKLEBALL</h4><div className="kv"><span>WINS</span><b>{p.pickleWins || 0}</b><span>GAMES</span><b>{p.pickleGames || 0}</b><span>ACES</span><b>{p.aces || 0}</b></div></div>
        <TopPlayers s={s} initial="pickle" compact fixed />
      </div>
    </div>
  )
}

const BMODE_ICON = { ffa: ['🧍', '🤖🤖🤖'], duel: ['🧍', '🤖'], local: ['🧍', '🧍'], party: ['🧍🧍', '🤖🤖'], team: ['🧍🤖', '🤖🤖'], coop: ['🧍🧍', '🤖🤖'], demo: ['🤖🤖', '🤖🤖'] }
function BomberLobby({ s, mode, setMode, diff, setDiff, rounds, setRounds }) {
  const p = s.profile
  const m = BMODES[mode]
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A MODE</h4>
        <div className="modegrid">
          {Object.entries(BMODES).map(([k, md]) => (
            <button key={k} className={'modecard ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>
              <div className="vs"><span>{BMODE_ICON[k][0]}</span><i>VS</i><span>{BMODE_ICON[k][1]}</span></div>
              <strong>{md.name}</strong><small>{md.desc}</small>
            </button>
          ))}
        </div>
        <div className="lobbyopts">
          <div><h4>2 · BOT LEVEL</h4><div className="chips">{['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (diff === i + 1 ? 'sel' : '')} onClick={() => setDiff(i + 1)}>{d}</button>)}</div></div>
          <div><h4>3 · ROUNDS</h4><div className="chips">{[1, 3, 5].map((t) => <button key={t} className={'chip ' + (rounds === t ? 'sel' : '')} onClick={() => setRounds(t)}>BEST OF {t}</button>)}</div></div>
        </div>
        <div className="lobbyinfo"><b>{m.name}</b> · {m.desc}<br /><small>{m.humans.length === 0 ? 'Just watch. Press Esc to leave.' : m.humans.length === 1 ? 'WASD move · SPACE bomb' : 'P1: WASD + SPACE   ·   P2: arrows + ENTER'}</small></div>
        <button className="big" onClick={() => bomberActions.start(mode, diff, rounds)}>▶ START BATTLE</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY BOMBER STATS</h4><div className="kv"><span>MATCH WINS</span><b>{p.bomberWins || 0}</b><span>MATCHES</span><b>{p.bomberGames || 0}</b><span>KNOCKOUTS</span><b>{p.bomberKills || 0}</b><span>BLOCKS BLOWN UP</span><b>{p.bricks || 0}</b></div></div>
        <TopPlayers s={s} initial="bomber" compact fixed />
      </div>
    </div>
  )
}

function Settings() {
  const st = useSyncExternalStore(subscribeSettings, getSettings)
  const Slider = ({ k, label }) => (
    <label className="setrow"><span>{label}</span><input type="range" min="0" max="1" step="0.05" value={st[k]} onChange={(e) => setSetting(k, +e.target.value)} /><b>{Math.round(st[k] * 100)}%</b></label>
  )
  return (
    <div className="settings">
      <h4>🔊 AUDIO</h4>
      <Slider k="master" label="MASTER VOLUME" /><Slider k="music" label="MUSIC" /><Slider k="sfx" label="SOUND EFFECTS" />
      <label className="setrow"><span>ANNOUNCER VOICE</span><button className={'chip ' + (st.voice ? 'sel' : '')} onClick={() => setSetting('voice', !st.voice)}>{st.voice ? 'ON' : 'OFF'}</button></label>
      <h4>🎮 GAMEPLAY</h4>
      <label className="setrow"><span>SCREEN SHAKE</span><button className={'chip ' + (st.shake ? 'sel' : '')} onClick={() => setSetting('shake', !st.shake)}>{st.shake ? 'ON' : 'OFF'}</button></label>
      <label className="setrow"><span>GRAPHICS</span><span className="chips">{[['auto', 'AUTO'], ['high', 'HIGH (GLOW)'], ['low', 'LOW (FAST)']].map(([k, n]) => <button key={k} className={'chip ' + (st.quality === k ? 'sel' : '')} onClick={() => setSetting('quality', k)}>{n}</button>)}</span></label>
      <h4>🧹 DATA</h4>
      <div className="chips">
        <button className="chip" onClick={resetSettings}>RESET SETTINGS</button>
        <button className="chip lock" onClick={() => { if (window.confirm('Erase ALL progress (scores, unlocks, name)? This cannot be undone.')) { ['si_profile', 'si_hi', 'si_unlock', 'si_settings'].forEach((k) => localStorage.removeItem(k)); location.reload() } }}>ERASE ALL PROGRESS</button>
      </div>
      <small className="hint">Settings are saved in this browser. Gamepads are detected automatically when you press a button.</small>
    </div>
  )
}

// ---- card art: real game sprites drawn on a canvas, plus a mini bomber board ----
function SpriteArt({ scene, sky = ['#0b2a22', '#2f7a5a'], ground = '#3f9a3f' }) {
  const ref = useRef()
  useEffect(() => {
    const c = ref.current, W = 220, H = 100, x = c.getContext('2d')
    c.width = W; c.height = H
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, H)
    x.fillStyle = '#ffffffcc'; x.beginPath(); x.arc(185, 22, 10, 0, 7); x.fill()
    x.fillStyle = '#ffffff22'; x.fillRect(20, 20, 40, 6); x.fillRect(120, 30, 30, 5)
    x.fillStyle = ground; x.fillRect(0, H - 14, W, 14); x.fillStyle = '#00000044'; x.fillRect(0, H - 8, W, 8)
    for (const [spr, ox, flip, z] of scene) {
      for (const p of spr.px) { x.fillStyle = `rgb(${toSrgb(p.c[0])},${toSrgb(p.c[1])},${toSrgb(p.c[2])})`; x.fillRect(Math.round(ox + (flip ? -p.x : p.x) * z), Math.round(H - 14 - (p.y + spr.h / 2) * z), z, z) }
    }
  }, [])
  return <canvas ref={ref} className="artcv" />
}
function MiniBomber() {
  const cells = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) {
    let t = 'floor'
    if (r % 2 === 1 && c % 2 === 1) t = 'pillar'
    else if (((r * 11 + c) * 37) % 10 < 5 && !((r === 0 || r === 4) && (c < 2 || c > 8))) t = 'brick'
    const flame = (r === 2 && c >= 3 && c <= 7 && t !== 'pillar') || (c === 5 && t !== 'pillar')
    cells.push({ t: flame ? 'flame' : t, r, c })
  }
  return (
    <div className="miniBomb">
      {cells.map((x) => (
        <div key={x.r + '-' + x.c} className={'c ' + x.t + ((x.r + x.c) % 2 ? ' alt' : '')}>
          {x.r === 2 && x.c === 5 && <span className="em">💣</span>}
          {x.r === 0 && x.c === 0 && <i className="dot" style={{ color: '#3de8ff' }} />}
          {x.r === 0 && x.c === 10 && <i className="dot" style={{ color: '#ff4de1' }} />}
          {x.r === 4 && x.c === 0 && <i className="dot" style={{ color: '#ffe84a' }} />}
          {x.r === 4 && x.c === 10 && <i className="dot" style={{ color: '#3dff7a' }} />}
        </div>
      ))}
    </div>
  )
}

function GameCard({ cls, title, tag, hi, hiLabel, art, onPlay, label, sub }) {
  return (
    <div className={'gcard ' + cls}>
      <h4>{title}</h4>
      <small>{tag}</small>
      <div className="gart">{art}</div>
      <div className="kv"><span>{hiLabel}</span><b>{hi}</b>{sub}</div>
      <button className="big" onClick={onPlay}>{label}</button>
    </div>
  )
}

function Hub({ s }) {
  const [tab, setTab] = useState('home')
  const [pmode, setPmode] = useState('bot')
  const [pdiff, setPdiff] = useState(2)
  const [ptarget, setPtarget] = useState(11)
  const [bmode, setBmode] = useState('ffa')
  const [bdiff, setBdiff] = useState(2)
  const [brounds, setBrounds] = useState(3)
  const p = s.profile
  const xp = xpOf(p)
  let ri = 0
  RANKS.forEach(([x], i) => { if (xp >= x) ri = i })
  const next = RANKS[ri + 1]
  const pct = next ? ((xp - RANKS[ri][0]) / (next[0] - RANKS[ri][0])) * 100 : 100
  const doneAch = ACH.filter(([, , g, goal]) => g(p, s.unlocked) >= goal).length
  const TABS = [['home', 'DASHBOARD'], ['pickle', '🏓 PICKLEBALL'], ['bomber', '💣 BOMBER'], ['top', '🏆 TOP PLAYERS'], ['ship', 'CUSTOMIZE SHIP'], ['levels', 'SPACE LEVELS'], ['skills', 'CONTROLS'], ['settings', '⚙ SETTINGS'], ['awards', `AWARDS ${doneAch}/${ACH.length}`]]
  return (
    <div className="screen hub">
      <div className="hubtop">
        <div className="logo2"><span>MY</span><span className="b"> SPACE</span><small> ARCADE</small></div>
        <div className="tabs">{TABS.map(([k, n]) => <button key={k} className={'tab ' + (tab === k ? 'sel' : '')} onClick={() => setTab(k)}>{n}</button>)}</div>
        <SoundBtn />
      </div>
      <AudioNotice />
      {tab === 'home' && (
        <>
          <div className="cards4">
            <GameCard cls="space" title="🚀 SPACE IMPACT: NEON" tag="10 levels · 10 bosses · skills · drones" hiLabel="HI-SCORE" hi={p.spaceHi.toLocaleString()}
              art={<ShipPreview ship={p.ship} />} label="▶ PLAY" onPlay={startGame}
              sub={<><span>LEVELS</span><b>{s.unlocked + 1}/10</b></>} />
            <GameCard cls="slug" title="🪖 OPERATION GROUND ZERO" tag="Run & gun · POWs · tank · 3 bosses" hiLabel="HI-SCORE" hi={p.slugHi.toLocaleString()}
              art={<SpriteArt scene={[[SP.palm, 22, false, 3], [SP.vsv, 110, false, 3], [SP.heroS, 66, false, 4], [SP.solS, 178, true, 4], [SP.runS, 206, true, 4]]} />} label="▶ PLAY" onPlay={() => slugActions.start(0)}
              sub={<><span>WINS</span><b>{p.slugWins}</b></>} />
            <GameCard cls="pickle" title="🏓 PICKLEBALL" tag="Bots · 1v1 · 2v2 · real rules" hiLabel="WINS" hi={p.pickleWins || 0}
              art={<div className="miniCourt"><i className="net" /><i className="ball" /><b className="pa">🧍</b><b className="pb">🤖</b></div>} label="SELECT MODE ▶" onPlay={() => setTab('pickle')}
              sub={<><span>ACES</span><b>{p.aces || 0}</b></>} />
            <GameCard cls="bomber" title="💣 BOMBER BLAST" tag="Battle arena · bots · 1v1 · 2v2" hiLabel="WINS" hi={p.bomberWins || 0}
              art={<MiniBomber />} label="SELECT MODE ▶" onPlay={() => setTab('bomber')}
              sub={<><span>BLOCKS</span><b>{p.bricks || 0}</b></>} />
          </div>
          <div className="hubrow">
            <div className="panel prof">
              <h4>PILOT PROFILE</h4>
              <input className="nameinp" value={p.name || ''} placeholder="ENTER YOUR NAME (for the leaderboard)" maxLength={14} onChange={(e) => setName(e.target.value)} />
              <div className="rank">{RANKS[ri][1]}</div>
              <div className="bar"><b style={{ width: pct + '%' }} /></div>
              <small>{xp.toLocaleString()} XP{next ? ` · NEXT: ${next[1]} @ ${next[0].toLocaleString()}` : ' · MAX RANK'}</small>
              <div className="kv">
                <span>ENEMIES DESTROYED</span><b>{p.kills.toLocaleString()}</b>
                <span>BOSSES DEFEATED</span><b>{p.bosses}</b>
                <span>POWs RESCUED</span><b>{p.pows}</b>
                <span>GAMES PLAYED</span><b>{p.played + (p.pickleGames || 0)}</b>
              </div>
            </div>
            <div className="panel wide"><TopPlayers s={s} compact /></div>
          </div>
        </>
      )}
      {tab === 'pickle' && <PickleLobby s={s} mode={pmode} setMode={setPmode} diff={pdiff} setDiff={setPdiff} target={ptarget} setTarget={setPtarget} />}
      {tab === 'bomber' && <BomberLobby s={s} mode={bmode} setMode={setBmode} diff={bdiff} setDiff={setBdiff} rounds={brounds} setRounds={setBrounds} />}
      {tab === 'settings' && <Settings />}
      {tab === 'ship' && <ShipLab s={s} />}
      {tab === 'levels' && <Codex s={s} embedded />}
      {tab === 'top' && <TopPlayers s={s} />}
      {tab === 'skills' && <Skills />}
      {tab === 'awards' && <Awards s={s} />}
    </div>
  )
}

function TopPlayers({ s, initial = 'space', compact = false, fixed = false }) {
  const [game, setGame] = useState(initial)
  const [rows, setRows] = useState(null)
  const lim = compact ? 5 : 10
  useEffect(() => { let on = true; setRows(null); fetchTop(game, lim).then((r) => on && setRows(r)); return () => { on = false } }, [game, lim])
  const me = (s.profile.name || '').toUpperCase()
  const GAMES = [['space', 'SPACE IMPACT'], ['slug', 'GROUND ZERO'], ['pickle', 'PICKLEBALL'], ['bomber', 'BOMBER BLAST']]
  return (
    <div className="topboard">
      <h4>🏆 TOP PLAYERS{fixed ? ' · ' + (GAMES.find(([k]) => k === game) || [0, game])[1] : ''}</h4>
      {!fixed && <div className="chips">{GAMES.map(([k, n]) => <button key={k} className={'chip ' + (game === k ? 'sel' : '')} onClick={() => setGame(k)}>{n}</button>)}</div>}
      <div className="lbtable">
        <div className="lbh"><span>#</span><span>PLAYER</span><span>SCORE</span></div>
        {rows === null && <div className="lbrow dim"><span /><span>LOADING…</span><span /></div>}
        {rows && rows.length === 0 && <div className="lbrow dim"><span /><span>NO GLOBAL SCORES YET (OR API OFFLINE)</span><span /></div>}
        {rows && rows.map((r, i) => (
          <div key={i} className={'lbrow ' + (i < 3 ? 'top' + (i + 1) : '') + (me && r.name.toUpperCase() === me ? ' me' : '')}>
            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span><span>{r.name}</span><b>{r.score.toLocaleString()}</b>
          </div>
        ))}
      </div>
      {!compact && <small className="hint">Set your name on the dashboard. Scores are submitted automatically at the end of every game.</small>}
    </div>
  )
}

function TopPlayersMini({ game = 'pickle' }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { let on = true; const t = setTimeout(() => fetchTop(game, 5).then((r) => on && setRows(r)), 1200); return () => { on = false; clearTimeout(t) } }, [])
  return (
    <div className="lbtable mini">
      <div className="lbh"><span /><span>🏆 TOP {game.toUpperCase()} PLAYERS</span><span /></div>
      {(rows || []).map((r, i) => <div className="lbrow" key={i}><span>{i + 1}</span><span>{r.name}</span><b>{r.score.toLocaleString()}</b></div>)}
      {rows && !rows.length && <div className="lbrow dim"><span /><span>NO GLOBAL SCORES YET</span><span /></div>}
    </div>
  )
}

function BomberHUD() {
  const g = useSyncExternalStore(subscribeBomber, getBomberSnap)
  if (!g) return null
  const mm = Math.floor(g.time / 60), ss = String(g.time % 60).padStart(2, '0')
  return (
    <div className="hud">
      {g.mode !== 'over' && (
        <>
          <div className="bbar">
            {g.players.map((p) => (
              <div key={p.id} className={'bcard ' + (p.alive ? '' : 'dead')} style={{ '--c': p.color }}>
                <div className="bn"><i /> {p.name}{g.teams ? ` · T${p.team + 1}` : ''}</div>
                <div className="bw">{'★'.repeat(p.wins)}{'☆'.repeat(Math.max(0, g.need - p.wins))}</div>
                <div className="bs">💣{p.bombs} 🔥{p.range} ⚡{p.speed}{p.kick ? ' 🦶' : ''}{p.shield ? ' 🛡' : ''}</div>
              </div>
            ))}
            <div className="bmid"><span>ROUND {g.round}/{g.rounds}</span><strong className={g.sudden ? 'sd' : ''}>{g.sudden ? 'SUDDEN DEATH' : `${mm}:${ss}`}</strong><small>{g.modeName} · {g.diff}</small></div>
          </div>
          {g.phase === 'ready' && g.countdown > 0 && <div className={'bcount ' + (g.countdown > 3 ? 'small' : '')} key={g.countdown}>{g.countdown > 3 ? 'GET READY' : g.countdown}</div>}
          {g.msg && <div className="pmsg" key={g.msg.text} style={{ borderColor: g.msg.color }}><h2 style={{ color: g.msg.color }}>{g.msg.text}</h2><p>{g.msg.sub}</p></div>}
          <div className="pctl">WASD MOVE · SPACE BOMB · P2: ARROWS + ENTER · P PAUSE</div>
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={bomberActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('bomber')}>❓ HOW TO PLAY</button><button className="big sec" onClick={bomberActions.quit}>QUIT TO DASHBOARD</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className="gold">{g.over.winName} WINS THE MATCH!</h1>
          <ul>
            {g.players.map((p) => <li key={p.id} style={{ borderColor: p.color }}><span>{p.name}</span><b>★ {g.over.wins[p.id]} · KO {g.over.kills[p.id]}</b></li>)}
            <li><span>BLOCKS DESTROYED</span><b>{g.over.bricks}</b></li>
            {g.over.score !== undefined && <li className="bonus"><span>YOUR SCORE</span><b>{g.over.score.toLocaleString()}</b></li>}
          </ul>
          <div className="overboard"><TopPlayersMini game="bomber" /></div>
          <button className="big" onClick={bomberActions.rematch}>↻ REMATCH</button>
          <button className="big sec" onClick={bomberActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

function PickleHUD() {
  const g = useSyncExternalStore(subscribePickle, getPickleSnap)
  if (!g) return null
  const two = g.type === 'local'
  const hint = g.phase === 'serve'
    ? (g.serverHuman ? `PLAYER ${g.serverHuman}: PRESS ${g.serverHuman === 2 || (!two && g.serverHuman === 1 && false) ? ', . /' : 'F / G / H'} TO SERVE (hold a direction to aim)` : 'BOT IS SERVING…')
    : ''
  return (
    <div className="hud">
      {g.mode !== 'over' && (
        <>
          <div className="scoreboard">
            {[0, 1].map((t) => (
              <div key={t} className={'sbteam ' + (t ? 'b' : 'a') + (g.serveTeam === t ? ' srv' : '')}>
                <span className="nm">{g.serveTeam === t ? '● ' : ''}{g.names[t]}</span>
                <b>{g.score[t]}</b>
              </div>
            ))}
            <div className="sbmid">
              <span>{g.modeName} · {g.diff}</span>
              <strong>{g.call}</strong>
              <small>{g.doubles ? 'SERVER ' + g.serverNum : 'SINGLES'} · TO {g.target} · RALLY {g.rally}</small>
            </div>
          </div>
          {g.msg && <div className={'pmsg ' + (g.msg.team ? 'b' : 'a')} key={g.msg.text + g.score.join()}><h2>{g.msg.text}</h2><p>{g.msg.sub} · {g.names[g.msg.team]}</p></div>}
          {hint && <div className="phint">{hint}</div>}
          <div className="pctl">F/J DRIVE · G/K DINK · H/L LOB · NO VOLLEYS IN THE KITCHEN · P PAUSE</div>
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={pickleActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('pickle')}>❓ HOW TO PLAY</button><button className="big sec" onClick={pickleActions.quit}>QUIT TO DASHBOARD</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className="gold">{g.names[g.over.winner]} WIN{g.over.winner === 0 && g.names[0] === 'YOU' ? '' : 'S'}!</h1>
          <div className="bigscore"><span className="a">{g.over.a}</span> : <span className="b">{g.over.b}</span></div>
          <ul><li><span>LONGEST RALLY</span><b>{g.bestRally}</b></li><li><span>MODE</span><b>{g.modeName} · {g.diff}</b></li></ul>
          <div className="overboard"><TopPlayersMini /></div>
          <button className="big" onClick={pickleActions.rematch}>↻ REMATCH</button>
          <button className="big sec" onClick={pickleActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ===================== GROUND ZERO HUD =====================
function SlugHUD() {
  const g = useSyncExternalStore(subscribeSlug, getSlugSnap)
  if (!g) return null
  const play = g.mode === 'play'
  return (
    <div className="hud">
      {(play || g.paused) && (
        <>
          <div className="top">
            <div className="col"><div className="lbl">SCORE</div><div className="val">{fmt(g.score)}</div><div className="lbl dim">HI {fmt(g.hi)}</div></div>
            <div className="col mid">
              <div className="lbl">STAGE {g.stage + 1} · {g.name}</div>
              <div className="prog"><b style={{ width: g.progress * 100 + '%' }} /></div>
            </div>
            <div className="col right"><div className="lbl">POWs</div><div className="val cred">☺ {g.pows}/{g.powTotal}</div><SoundBtn /></div>
          </div>
          <div className="left">
            <div className="row"><span className="k">HP</span><Pips n={g.hp} max={3} ch="♥" cls="pips hp" /></div>
            <div className="row"><span className="k">LIVES</span><Pips n={g.lives} max={Math.max(3, g.lives)} ch="▲" cls="pips life" /></div>
            <div className="row"><span className="k">GRENADE</span><Pips n={Math.min(g.gren, 10)} max={10} ch="●" cls="pips bomb" /></div>
            <div className="row"><span className="k">WEAPON</span><span className="wp">{g.weapon}{g.ammo >= 0 ? <em> ×{g.ammo}</em> : <em> ∞</em>}</span></div>
            {g.veh && <div className="row"><span className="k">TANK</span><span className="vbar"><b style={{ width: (g.veh.hp / g.veh.max) * 100 + '%' }} /></span></div>}
          </div>
          {g.streak >= 3 && <div className="streak" key={g.streak}><b>{g.streak}</b><span>KILL STREAK</span></div>}
          <div className="toasts">{g.toasts.map((t) => <div key={t.id} className="toast" style={{ color: t.color, borderColor: t.color }}>{t.text}</div>)}</div>
          {g.boss && <div className="boss"><span>{g.boss.name}</span><div className="bar"><b style={{ width: (g.boss.hp / g.boss.max) * 100 + '%' }} /></div></div>}
          <div className="skills">
            {g.skills.map((k) => (
              <button key={k.k} className={'sk ' + (k.cd <= 0 ? 'ready ' : '') + (k.active ? 'active' : '')} style={{ '--c': k.color }} onPointerDown={(e) => { e.stopPropagation(); slugActions.skill(k.k) }}>
                <i style={{ height: Math.min(100, (k.cd / k.max) * 100) + '%' }} />
                <b>{k.key}</b><span>{k.name}</span><em>{k.label ?? (k.cd > 0 ? Math.ceil(k.cd) + 's' : 'READY')}</em>
              </button>
            ))}
          </div>
          {g.banner && <div className={'banner ' + g.banner.kind} key={g.banner.title + g.banner.sub}><h2>{g.banner.title}</h2><h3>{g.banner.sub}</h3>{g.banner.sub2 && <p>{g.banner.sub2}</p>}</div>}
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={slugActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('slug')}>❓ HOW TO PLAY</button><button className="big sec" onClick={slugActions.quit}>QUIT TO DASHBOARD</button></div>}
      {g.mode === 'clear' && g.summary && (
        <div className="screen clear"><h1>STAGE {g.stage + 1} CLEAR</h1><h3 style={{ color: g.color }}>{g.summary.name}</h3><div className="grade">{g.summary.grade}</div>
          <ul>{g.summary.lines.map((l, i) => <li key={i} className={l.kind} style={{ animationDelay: 0.25 * i + 's' }}><span>{l.label}</span><b>{l.value}</b></li>)}</ul>
          <div className="tot">SCORE {fmt(g.score)}</div><button className="big" onClick={slugActions.next}>NEXT STAGE ▶</button></div>
      )}
      {g.mode === 'over' && <div className="screen over"><h1 className="red">MISSION FAILED</h1><div className="tot">SCORE {fmt(g.score)}</div><button className="big" onClick={slugActions.retry}>↻ RETRY STAGE {g.stage + 1}</button><button className="big sec" onClick={slugActions.quit}>DASHBOARD</button></div>}
      {g.mode === 'victory' && g.final && (
        <div className="screen victory"><h1 className="gold">GROUND ZERO SECURED!</h1><div className="grade">{g.final.rank}</div>
          <ul><li><span>LIVES BONUS</span><b>+{g.final.lifeB}</b></li><li className="bonus"><span>FINAL SCORE</span><b>{fmt(g.final.score)}</b></li></ul>
          <button className="big" onClick={slugActions.quit}>DASHBOARD</button></div>
      )}
    </div>
  )
}

export default function HUD() {
  const s = useSyncExternalStore(subscribe, getSnap)
  return (
    <>
      <HUDInner s={s} />
      <div className="hud helplayer"><HelpLayer s={s} /></div>
    </>
  )
}
function HUDInner({ s }) {
  if (s.mode === 'slug') return <SlugHUD />
  if (s.mode === 'pickle') return <PickleHUD />
  if (s.mode === 'bomber') return <BomberHUD />
  const playing = s.mode === 'playing' || s.mode === 'paused'
  return (
    <div className="hud">
      {playing && <TopBar s={s} />}
      {playing && <Banner b={s.banner} />}
      {s.mode === 'paused' && (
        <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={togglePause}>RESUME</button><button className="big sec" onClick={toMenu}>QUIT TO MENU</button></div>
      )}
      {s.mode === 'menu' && <Hub s={s} />}
      {s.mode === 'clear' && s.summary && <Clear s={s} />}
      {s.mode === 'shop' && <Shop s={s} />}
      {s.mode === 'over' && <Over s={s} />}
      {s.mode === 'victory' && s.final && <Victory s={s} />}
      {playing && <div className="scan" />}
    </div>
  )
}
