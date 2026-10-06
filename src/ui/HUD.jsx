'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribe, getSnap, startGame, toShop, launchNext, buy, retryMission, toMenu, togglePause, useSkill, startGameAt, setShip, setName } from '../game/engine.js'
import { subscribeSlug, getSlugSnap, slugActions } from '../game/slug.js'
import { subscribePickle, getPickleSnap, pickleActions, MODES } from '../game/pickle.js'
import { fetchTop } from '../game/online.js'
import { UPGRADES, MISSIONS, BOSSES, BONUS_AFTER } from '../game/levels.js'
import { SP, SHIP_DEFS, PAINTS, TRAILS, BULLET_COLORS, shipSprite } from '../game/sprites.js'
import { isMuted, setMuted, initAudio, unlockAudio, audioState, onAudioState, audioLevel, testSound } from '../game/audio.js'

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
  ['SOLDIER', 'Score 50,000 in Ground Zero', (p) => p.slugHi, 50000],
]
const RANKS = [[0, 'CADET'], [100, 'PILOT'], [500, 'ACE'], [1500, 'CAPTAIN'], [4000, 'MAJOR'], [9000, 'COLONEL'], [20000, 'LEGEND']]
const xpOf = (p) => p.kills + p.bosses * 50 + p.pows * 20 + (p.spaceWins + p.slugWins) * 500 + (p.pickleWins || 0) * 300 + p.played * 5

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

function Hub({ s }) {
  const [tab, setTab] = useState('home')
  const [pmode, setPmode] = useState('bot')
  const [pdiff, setPdiff] = useState(2)
  const p = s.profile
  const xp = xpOf(p)
  let ri = 0
  RANKS.forEach(([x], i) => { if (xp >= x) ri = i })
  const next = RANKS[ri + 1]
  const pct = next ? ((xp - RANKS[ri][0]) / (next[0] - RANKS[ri][0])) * 100 : 100
  const doneAch = ACH.filter(([, , g, goal]) => g(p, s.unlocked) >= goal).length
  const TABS = [['home', 'DASHBOARD'], ['ship', 'CUSTOMIZE SHIP'], ['levels', 'SPACE LEVELS'], ['top', 'TOP PLAYERS'], ['skills', 'SKILLS & CONTROLS'], ['awards', `AWARDS ${doneAch}/${ACH.length}`]]
  return (
    <div className="screen hub">
      <div className="hubtop">
        <div className="logo2"><span>SPACE</span><span className="b"> IMPACT</span><small> ARCADE COMMAND</small></div>
        <div className="tabs">{TABS.map(([k, n]) => <button key={k} className={'tab ' + (tab === k ? 'sel' : '')} onClick={() => setTab(k)}>{n}</button>)}</div>
        <SoundBtn />
      </div>
      {tab === 'home' && (
        <div className="hubgrid">
          <div className="panel prof">
            <h4>PILOT PROFILE</h4>
            <input className="nameinp" value={p.name || ''} placeholder="ENTER YOUR NAME" maxLength={14} onChange={(e) => setName(e.target.value)} />
            <div className="rank">{RANKS[ri][1]}</div>
            <div className="bar"><b style={{ width: pct + '%' }} /></div>
            <small>{xp.toLocaleString()} XP{next ? ` · NEXT: ${next[1]} @ ${next[0].toLocaleString()}` : ' · MAX RANK'}</small>
            <div className="kv">
              <span>ENEMIES DESTROYED</span><b>{p.kills.toLocaleString()}</b>
              <span>BOSSES DEFEATED</span><b>{p.bosses}</b>
              <span>POWs RESCUED</span><b>{p.pows}</b>
              <span>SKILLS USED</span><b>{p.skills}</b>
              <span>BONUS ROUNDS</span><b>{p.bonus}</b>
              <span>GAMES PLAYED</span><b>{p.played}</b>
            </div>
          </div>
          <div className="panel mode space">
            <h4>🚀 SPACE IMPACT: NEON</h4>
            <small>10 levels · 10 bosses · bonus rounds · skills · drones</small>
            <ShipPreview ship={p.ship} />
            <div className="kv"><span>LEVELS UNLOCKED</span><b>{s.unlocked + 1}/10</b><span>HI-SCORE</span><b>{p.spaceHi.toLocaleString()}</b></div>
            <button className="big" onClick={startGame}>▶ PLAY</button>
            <button className="mini" onClick={() => setTab('ship')}>✎ CUSTOMIZE SHIP</button>
          </div>
          <div className="panel mode slug">
            <h4>🪖 OPERATION GROUND ZERO</h4>
            <small>Run &amp; gun · 3 stages · POWs · weapon crates · 3 bosses</small>
            <div className="slugart"><span>▙▄▟</span><b>RUN · GUN · RESCUE</b></div>
            <div className="kv"><span>HI-SCORE</span><b>{p.slugHi.toLocaleString()}</b><span>WINS</span><b>{p.slugWins}</b></div>
            <button className="big" onClick={() => slugActions.start(0)}>▶ PLAY</button>
            <small>Keyboard only · see SKILLS &amp; CONTROLS</small>
          </div>
          <div className="panel mode pickle">
            <h4>🏓 PICKLEBALL</h4>
            <small>Real rules: diagonal serve · two-bounce · kitchen · win by 2</small>
            <div className="chips">
              {Object.entries(MODES).map(([k, m]) => <button key={k} className={'chip ' + (pmode === k ? 'sel' : '')} onClick={() => setPmode(k)}>{m.name}</button>)}
            </div>
            <small>{MODES[pmode].desc}</small>
            <div className="chips">
              {['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (pdiff === i + 1 ? 'sel' : '')} onClick={() => setPdiff(i + 1)}>{d}</button>)}
              <span className="kv inl"><span>WINS</span><b>{p.pickleWins || 0}</b><span>ACES</span><b>{p.aces || 0}</b></span>
            </div>
            <button className="big" onClick={() => pickleActions.start(pmode, pdiff, 11)}>▶ PLAY PICKLEBALL</button>
          </div>
          <div className="panel boards">
            <h4>🏆 MY BEST SCORES</h4>
            <div className="two">
              {['space', 'slug', 'pickle'].map((g) => (
                <div key={g}>
                  <small>{g === 'space' ? 'SPACE IMPACT' : g === 'slug' ? 'GROUND ZERO' : 'PICKLEBALL'}</small>
                  {(p.tops[g] || []).length ? p.tops[g].map((r, i) => <div className="lb" key={i}><span>{i + 1}.</span><b>{r.score.toLocaleString()}</b></div>) : <div className="lb dim">NO SCORES YET</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === 'ship' && <ShipLab s={s} />}
      {tab === 'levels' && <Codex s={s} embedded />}
      {tab === 'top' && <TopPlayers s={s} />}
      {tab === 'skills' && <Skills />}
      {tab === 'awards' && <Awards s={s} />}
    </div>
  )
}


function TopPlayers({ s }) {
  const [game, setGame] = useState('space')
  const [rows, setRows] = useState(null)
  useEffect(() => { let on = true; setRows(null); fetchTop(game, 10).then((r) => on && setRows(r)); return () => { on = false } }, [game])
  const me = (s.profile.name || '').toUpperCase()
  const GAMES = [['space', 'SPACE IMPACT'], ['slug', 'GROUND ZERO'], ['pickle', 'PICKLEBALL']]
  return (
    <div className="topboard">
      <div className="chips">{GAMES.map(([k, n]) => <button key={k} className={'chip ' + (game === k ? 'sel' : '')} onClick={() => setGame(k)}>{n}</button>)}</div>
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
      <small className="hint">Set your name on the dashboard. Scores are submitted automatically at the end of every game.</small>
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
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={pickleActions.resume}>RESUME</button><button className="big sec" onClick={pickleActions.quit}>QUIT TO DASHBOARD</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className="gold">{g.names[g.over.winner]} WIN{g.over.winner === 0 && g.names[0] === 'YOU' ? '' : 'S'}!</h1>
          <div className="bigscore"><span className="a">{g.over.a}</span> : <span className="b">{g.over.b}</span></div>
          <ul><li><span>LONGEST RALLY</span><b>{g.bestRally}</b></li><li><span>MODE</span><b>{g.modeName} · {g.diff}</b></li></ul>
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
          </div>
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
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={slugActions.resume}>RESUME</button><button className="big sec" onClick={slugActions.quit}>QUIT TO DASHBOARD</button></div>}
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
  if (s.mode === 'slug') return <SlugHUD />
  if (s.mode === 'pickle') return <PickleHUD />
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
