'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RT, subscribeRt, getRt, createRoom, joinRoom, leaveRoom, listRooms, roomAction, sendChat } from '../game/online/rt.js'
import '../game/hunt.js'
import '../game/climb.js'
import '../game/kong.js'
import { hostGame, installGameNet } from '../game/online/gnet.js'
import '../game/duel.js'
const DUEL_IDS = ['slug', 'snake', 'breaker', 'merge', 'rhythm', 'td', 'chomp', 'mines', 'word']
import { hostCardGame, installCardsOnline } from '../game/online/cards-online.js'
import { hostTetris, installTetrisOnline } from '../game/online/tetris-online.js'
import { hostPickle, installPickleOnline } from '../game/online/pickle-online.js'
import { hostBomber, installBomberOnline } from '../game/online/bomber-online.js'
import { hostSpace, installSpaceOnline } from '../game/online/space-online.js'
import { hostFightMatch, installFightOnline } from '../game/online/fight-online.js'
import { hostRaceMatch, installRaceOnline } from '../game/online/race-online.js'
import { hostHockey, installHockeyOnline } from '../game/online/hockey-online.js'
import { hostPool, installPoolOnline } from '../game/online/pool-online.js'
import { hostC4, installC4Online } from '../game/online/connect4-online.js'
import { hostEmpire, installEmpireOnline } from '../game/online/empire-online.js'
import { hostRogue, installRogueOnline } from '../game/online/rogue-online.js'
import { setName, profile as profile0Obj } from '../game/engine.js'
const profile0 = () => profile0Obj

if (typeof window !== 'undefined') { installGameNet(); installCardsOnline(); installTetrisOnline(); installPickleOnline(); installBomberOnline(); installSpaceOnline(); installFightOnline(); installRaceOnline(); installHockeyOnline(); installPoolOnline(); installRogueOnline(); installC4Online(); installEmpireOnline() }

const GAMES = [
  ['climb', '🧗', 'FROST CLIMBERS CO-OP', 'Climb icy mountains together: two climbers, shared mountain, shared lives. The host runs the mountain and picks its width in the 🧗 tab.', 2],
  ['kong', '🦍', 'GIRDER GORILLA CO-OP', 'Climb the girders together and rescue the captive. The host picks the girder width in the 🦍 tab.', 2],
  ['hunt', '🌙', '13 DAYS OF HELL CO-OP', 'Survive the haunted woods together: 1-3 hunters, shared shop at dawn, revive each other. Pick 13 Days or Watch Your Back in the 🌙 tab (host chooses).', 3],
  ['slug', '🪖', 'GROUND ZERO DUEL', 'Both play the first Ground Zero mission at once: highest score wins.', 2],
  ['snake', '🐍', 'SNAKE DUEL', 'Both play Neon Snake at the same time and watch each other\'s score live: the longer snake wins.', 2],
  ['breaker', '🧱', 'BREAKER DUEL', 'Both play Neon Breaker at once. Highest score wins.', 2],
  ['merge', '🔢', '2048 DUEL', 'Both play 2048 at once. Highest score when both are stuck wins.', 2],
  ['rhythm', '🎵', 'BEAT DUEL', 'The same song, two players, live scores: best score wins.', 2],
  ['td', '🛡', 'DEFENSE DUEL', 'Both defend the same map; whoever lasts longest and kills the most wins.', 2],
  ['chomp', '🟡', 'CHOMP DUEL', 'Both play Maze Chomp at once. Highest score wins.', 2],
  ['mines', '💣', 'SWEEP DUEL', 'The same minefield for both: clear it faster than your rival.', 2],
  ['word', '🔤', 'WORD DUEL', 'The same secret word for both: solve it in fewer tries to win.', 2],
  ['ssx', '🏂', 'SNOW RUSH RACE', 'Race 2-4 friends down the mountain (or compare trick scores). Pick your rider, mountain and mode in the 🏂 SNOW RUSH tab first; the host chooses the mountain.', 4],
  ['garden', '🧟', 'GARDEN SIEGE VERSUS', 'One of you defends the garden with sun and plants, the other leads the zombie horde with brains. Sides swap on every rematch.', 2],
  ['orb', '🔮', 'ORB RUSH VERSUS', 'Race a friend through the same chain of orbs. Big combos send extra orbs to your rival; clear the board or make them fall in the hole.', 2],
  ['kart', '🍌', 'KART CLASH', 'Item-packed kart racing with up to 4 friends plus bots: bananas, homing shells, stars, lightning and boosts. Pick your car in the 🏁 RACE tab first.', 4],
  ['race', '🏁', 'TURBO RUSH RACE', 'Race up to 4 friends plus bots. Everyone drives their own car with instant response. Pick your car in the 🏁 RACE tab first.', 4],
  ['fight', '🥊', 'IRON FISTS 1V1', '40 fighters, specials and supers. Pick your fighter in the 🥊 FIGHT tab first.', 2],
  ['space', '🚀', 'SPACE IMPACT CO-OP', 'Fly together: you + up to 2 friends as teammates (3 spacecraft). The host runs the missions.', 3],
  ['pickle', '🏓', 'PICKLEBALL 1V1', 'Real rules, first to 11 win by 2. Host runs the match; WASD/arrows + F G H to hit.', 2],
  ['bomber', '💣', 'BOMBER BLAST', '2-4 friends in the arena, bots fill empty slots. Move with WASD/arrows, Space drops a bomb.', 4],
  ['tetris', '🧱', 'TETRA BLAST 1V1', 'Race a real player. Clear lines to send garbage. Same piece order for both.', 2],
  ['hockey', '🏒', 'AIR HOCKEY 1V1', 'Fast neon air hockey, first to 7. Drag your mallet with the mouse or finger, or use WASD / arrows.', 2],
  ['pool', '🎱', 'BILLIARDS 1V1', '8-ball pool, turn by turn. Drag back and release to shoot; the host runs the table.', 2],
  ['rogue', '🗡', 'NEON DEPTHS CO-OP', 'Fight through the haunted forest together: up to 3 heroes, shared dungeon, your own perks. Pick your hero in the 🗡 DEPTHS tab first.', 3],
  ['c4', '🔴', 'CONNECT FOUR 1V1', 'Drop discs, line up four. The host keeps the board; click a column to play.', 2],
  ['empire', '🏰', 'EMPIRE RISE', 'Build a village into an empire on a huge map against up to 3 other kingdoms (friends or AI) and raiders. Win by conquest or by building the Wonder.', 4],
  ['uno', '🟥', 'UNO', '2-4 humans, bots fill empty seats. Private hands, host runs the table.', 4],
  ['pusoy', '👑', 'PUSOY DOS', '2-4 humans, bots fill empty seats. First to 40 points.', 4],
  ['tongits', '🀄', 'TONG-ITS', '2-3 humans, bots fill the third seat. Everyone starts with 1000 table chips.', 3],
  ['baccarat', '🎴', 'BACCARAT', 'Bet PLAYER, BANKER or TIE together. 1-4 humans, bots fill empty seats. Everyone starts with 1000 table chips.', 4],
  ['poker', '♠️', "TEXAS HOLD'EM", 'Real poker with friends: 2-4 humans, bots fill empty seats. Everyone starts with 1000 table chips.', 4],
  ['lucky9', '🎰', 'LUCKY 9', '1-4 humans against the house. Everyone starts with 1000 table chips.', 4],
]
const useRt = () => useSyncExternalStore(subscribeRt, getRt, getRt)

export default function OnlineLobby({ s, TopPlayers, initGame, lockGame }) {
  const rt = useRt()
  const [game, setGame] = useState(initGame || 'tetris')
  const [showAll, setShowAll] = useState(false)
  const [name, setNm] = useState((s.profile && s.profile.name) || 'PLAYER')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [chat, setChat] = useState('')
  const [target, setTarget] = useState(200)
  const [stack, setStack] = useState(true)
  const [seven, setSeven] = useState(false)
  const [lbots, setLbots] = useState(0)
  const logRef = useRef(null)
  const room = rt.room
  const cleanN = () => (name || 'PLAYER').replace(/[^\w ]/g, '').slice(0, 12).toUpperCase() || 'PLAYER'

  useEffect(() => {
    if (room) return
    listRooms(game)
    const t = setInterval(() => listRooms(game), 4000)
    return () => clearInterval(t)
  }, [game, room])
  const [invite, setInvite] = useState('')
  const autoJoined = useRef(false)
  useEffect(() => {
    if (autoJoined.current || room) return
    let c = ''
    try { c = (new URLSearchParams(location.search).get('join') || '').toUpperCase().slice(0, 5) } catch { /* ignore */ }
    if (c.length >= 4) { autoJoined.current = true; setInvite(c) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [copied, setCopied] = useState(false)
  const [pub, setPub] = useState(() => { try { return localStorage.getItem('si_public_url') || '' } catch { return '' } })
  const baseUrl = () => { const v = (pub || '').trim().replace(/\/+$/, ''); return /^https?:\/\//i.test(v) ? v : location.origin }
  const setPubUrl = (v) => { setPub(v); try { localStorage.setItem('si_public_url', v) } catch { /* ignore */ } }
  const copyLink = () => { try { navigator.clipboard.writeText(`${baseUrl()}/?join=${room.code}`); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { setMsg('Copy failed: share the code instead') } }
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 1e6 }, [rt.chat.length])

  const run = async (fn) => { setMsg(''); try { await fn() } catch (e) { setMsg(e.message || 'Something went wrong') } }
  const create = () => run(async () => { setName && setName(cleanN()); await createRoom(game, cleanN(), game === 'uno' ? { target, stack, sevenZero: seven } : game === 'lucky9' ? { bots: lbots } : {}) })
  const hasName = () => { const n = cleanN(); return !!(name || '').trim() && n !== 'PLAYER' }
  const join = (c) => run(async () => {
    if (!hasName()) throw new Error('Enter your name first')
    setName && setName(cleanN()); setInvite(''); await joinRoom(c, cleanN())
  })
  const isHost = !!room && room.host === rt.cid
  const g = room ? GAMES.find((x) => x[0] === room.game) : null
  const start = () => run(async () => {
    if (room.game === 'race' || room.game === 'kart') await hostRaceMatch({ track: typeof profile0().raceTrack === 'number' ? profile0().raceTrack : 0, laps: 3, diff: 2, ai: 3, kart: room.game === 'kart', size: profile0().raceSize || 1, weather: profile0().raceWeather && profile0().raceWeather !== 'auto' ? profile0().raceWeather : undefined, tod: typeof profile0().raceTod === 'number' && profile0().raceTod >= 0 ? profile0().raceTod : undefined })
    else if (room.game === 'orb') await hostGame('orb', { level: 0 })
    else if (room.game === 'garden') await hostGame('garden', {})
    else if (room.game === 'climb') await hostGame('climb', { size: profile0().climbSize | 0 })
    else if (room.game === 'kong') await hostGame('kong', { size: profile0().kongSize | 0 })
    else if (room.game === 'hunt') await hostGame('hunt', { kind: profile0().huntKind || 'days' })
    else if (DUEL_IDS.includes(room.game)) await hostGame('duel:' + room.game, { song: 1 })
    else if (room.game === 'ssx') await hostGame('ssx', { width: profile0().ssxWidth | 0, course: profile0().ssxCourse | 0, kind: profile0().ssxKind || 'race' })
    else if (room.game === 'fight') await hostFightMatch()
    else if (room.game === 'tetris') await hostTetris()
    else if (room.game === 'space') await hostSpace()
    else if (room.game === 'pickle') await hostPickle()
    else if (room.game === 'bomber') await hostBomber()
    else if (room.game === 'hockey') await hostHockey()
    else if (room.game === 'pool') await hostPool()
    else if (room.game === 'rogue') await hostRogue()
    else if (room.game === 'c4') await hostC4()
    else if (room.game === 'empire') await hostEmpire()
    else await hostCardGame(room.game, { ...room.opts, auto: false, ...(room.game === 'pusoy' ? { target: 40 } : room.game === 'tongits' ? { stake: 50 } : room.game === 'lucky9' ? { bots: room.opts.bots || 0 } : {}) })
  })
  const share = room ? `${room.code}` : ''

  if (!room && invite) {
    return (
      <div className="lobby">
        <div className="lobbyL">
          <h4>ENTER YOUR NAME TO JOIN ROOM {invite}</h4>
          <form className="chips" onSubmit={(e) => { e.preventDefault(); join(invite) }}>
            <input className="nameIn" autoFocus value={name === 'PLAYER' ? '' : name} maxLength={12} onChange={(e) => setNm(e.target.value)} placeholder="NAME" />
            <button className="big" type="submit" disabled={rt.busy}>JOIN</button>
            <button className="big sec" type="button" onClick={() => setInvite('')}>CANCEL</button>
          </form>
          {(msg || rt.error) && <div className="lobbyinfo" style={{ color: '#ff8a96' }}>{msg || rt.error}</div>}
        </div>
      </div>
    )
  }
  if (!room) {
    return (
      <div className="lobby">
        <div className="lobbyL">
          <h4>1 · YOUR NAME</h4>
          <div className="chips"><input className="nameIn" value={name} maxLength={12} onChange={(e) => setNm(e.target.value)} placeholder="NAME" /></div>
          <h4>2 · PICK A GAME</h4>
          <div className="gamepick">{(lockGame && !showAll && GAMES.some((x) => x[0] === game) ? GAMES.filter((x) => x[0] === game) : GAMES).map(([k, ico, n, d]) => <button key={k} className={game === k ? 'sel' : ''} onClick={() => setGame(k)}><span className="ico">{ico}</span><strong>{n}</strong><small>{d}</small></button>)}</div>
          {lockGame && !showAll && GAMES.some((x) => x[0] === game) && <div className="chips"><button className="chip" onClick={() => setShowAll(true)}>↔ CHOOSE A DIFFERENT GAME</button></div>}
          {game === 'uno' && (
            <div className="lobbyopts">
              <div><h4>STACKING +2/+4</h4><div className="chips">{[[true, 'ON'], [false, 'OFF']].map(([v, n]) => <button key={n} className={'chip ' + (stack === v ? 'sel' : '')} onClick={() => setStack(v)}>{n}</button>)}</div></div>
              <div><h4>SEVEN-0 RULE 🔄</h4><div className="chips">{[[true, 'ON'], [false, 'OFF']].map(([v, n]) => <button key={n} className={'chip ' + (seven === v ? 'sel' : '')} onClick={() => setSeven(v)}>{n}</button>)}</div></div>
              <div><h4>PLAY TO</h4><div className="chips">{[100, 200, 500].map((v) => <button key={v} className={'chip ' + (target === v ? 'sel' : '')} onClick={() => setTarget(v)}>{v} PTS</button>)}</div></div>
            </div>
          )}
          {game === 'lucky9' && <div className="lobbyopts"><div><h4>EXTRA BOTS AT THE TABLE</h4><div className="chips">{[0, 1, 2].map((v) => <button key={v} className={'chip ' + (lbots === v ? 'sel' : '')} onClick={() => setLbots(v)}>{v} BOTS</button>)}</div></div></div>}
          <h4>3 · CREATE OR JOIN</h4>
          <div className="chips">
            <button className="big" disabled={rt.busy} onClick={create}>＋ CREATE ROOM</button>
            <input className="nameIn" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" style={{ width: 90, textAlign: 'center' }} />
            <button className="big sec" disabled={rt.busy || code.length < 4} onClick={() => join(code)}>JOIN</button>
          </div>
          {(msg || rt.error) && <div className="lobbyinfo" style={{ color: '#ff8a96' }}>{msg || rt.error}</div>}
          <h4>OPEN ROOMS</h4>
          <div className="rooms">
            {rt.rooms.length === 0 && <div className="lobbyinfo"><small>No open rooms for this game. Create one and share the code with a friend!</small></div>}
            {rt.rooms.map((r) => <button key={r.code} className="chip" onClick={() => join(r.code)}>{r.code} · {(r.players[0] && r.players[0].name) || 'HOST'} · {r.players.length}/{r.max}</button>)}
          </div>
        </div>
        <div className="lobbyR">
          <div className="panel"><h4>ONLINE PLAY</h4><div className="lobbyinfo"><small>Rooms live in Redis and messages travel over Redis pub/sub through this site&apos;s own Next.js API, so there is no extra server. Open this page in two browsers (or send the code to a friend) to play.</small></div></div>
          <TopPlayers s={s} initial={game} compact fixed key={game} />
        </div>
      </div>
    )
  }
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>ROOM <b style={{ letterSpacing: 4, fontSize: 22, color: '#ffe84a' }}>{share}</b> · {g ? g[2] : room.game}</h4>
        {typeof location !== 'undefined' && /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) && <div className="lobbyinfo" style={{ color: '#ffb02e' }}><small>⚠ You are on <b>{location.host}</b>, an address only this computer can open. Friends on other computers need your public address (a deployed site such as Vercel, or a tunnel: <b>npx cloudflared tunnel --url http://localhost:3000</b>). Paste it here and the invite link will use it:</small><br /><input className="nameIn" style={{ width: '100%' }} value={pub} placeholder="https://your-public-address" onChange={(e) => setPubUrl(e.target.value)} /></div>}
        <div className="lobbyinfo"><small>{rt.connected ? '🟢 connected' : '🟠 connecting…'}{Object.keys(rt.p2p || {}).length ? ' · ⚡ direct link' : ' · ☁ relay'} · share the code so friends can join ({room.players.length}/{room.max})</small></div>
        <div className="roomPlayers">
          {room.players.map((p) => <div key={p.id} className="chip sel" style={{ margin: 3 }}>{p.id === room.host ? '👑 ' : '🙂 '}{p.name}{p.id === rt.cid ? ' (you)' : ''}</div>)}
          {(room.game === 'uno' || room.game === 'pusoy' || room.game === 'tongits' || room.game === 'space') && Array.from({ length: Math.max(0, room.max - room.players.length) }).map((_, i) => <div key={i} className="chip" style={{ margin: 3, opacity: 0.6 }}>🤖 BOT</div>)}
          {(room.game === 'tetris' || room.game === 'pickle' || room.game === 'fight' || room.game === 'hockey' || room.game === 'pool' || room.game === 'rogue' || room.game === 'c4' || room.game === 'empire' || room.game === 'orb' || room.game === 'garden' || room.game === 'ssx' || DUEL_IDS.includes(room.game)) && room.players.length < 2 && <div className="chip" style={{ margin: 3, opacity: 0.6 }}>… waiting for opponent</div>}
        </div>
        <div className="chips">
          {isHost
            ? <button className="big" disabled={(room.game === 'tetris' || room.game === 'pickle' || room.game === 'bomber' || room.game === 'fight' || room.game === 'hockey' || room.game === 'pool' || room.game === 'rogue' || room.game === 'c4' || room.game === 'empire' || room.game === 'orb' || room.game === 'garden' || room.game === 'ssx' || DUEL_IDS.includes(room.game)) && room.players.length < 2} onClick={start}>▶ START GAME</button>
            : <div className="lobbyinfo">Waiting for the host to start…</div>}
          <button className="big sec" onClick={copyLink}>{copied ? '✔ LINK COPIED' : '🔗 COPY INVITE LINK'}</button>
          <button className="big sec" onClick={() => leaveRoom()}>LEAVE ROOM</button>
        </div>
        {(msg || rt.error) && <div className="lobbyinfo" style={{ color: '#ff8a96' }}>{msg || rt.error}</div>}
        <h4>CHAT</h4>
        <div className="chatlog" ref={logRef} style={{ maxHeight: 150, overflow: 'auto', background: 'rgba(0,0,0,.35)', padding: 8, borderRadius: 6, fontSize: 13 }}>
          {rt.chat.length === 0 && <small style={{ opacity: 0.6 }}>Say hi 👋</small>}
          {rt.chat.map((c) => <div key={c.id}><b style={{ color: c.from === rt.cid ? '#6cf' : '#ffe84a' }}>{c.name}:</b> {c.text}</div>)}
        </div>
        <form className="chips" onSubmit={(e) => { e.preventDefault(); if (chat.trim()) { sendChat(chat.trim()).catch(() => {}); setChat('') } }}>
          <input className="nameIn" value={chat} maxLength={140} onChange={(e) => setChat(e.target.value)} placeholder="Type a message…" style={{ flex: 1 }} />
          <button className="chip" type="submit">SEND</button>
        </form>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>HOW IT WORKS</h4><div className="lobbyinfo"><small>{room.game === 'race' || room.game === 'kart' ? 'The host picks the track in the 🏁 RACE tab; bots fill the rest of the grid. Your own car reacts instantly; other drivers appear slightly behind real time. 3 laps.' : room.game === 'fight' ? 'Best of 3 rounds. The host runs the fight; your controls and moves are sent instantly over the direct link (⚡). WASD or arrows to move, J K U I to punch and kick, L special, O super. Choose your fighter in the 🥊 FIGHT tab before the host presses START.' : room.game === 'space' ? 'The host flies ship #1 and runs the missions, upgrades and bosses. Friends fly the other ships (WASD/arrows + Space) and share the score and lives. Free ships are flown by AI teammates. Best with the direct link (⚡).' : room.game === 'empire' ? 'Every player runs a kingdom. The host simulates the world; you send build, train and attack orders. AI kingdoms fill empty seats (up to 4 in all). Raiders attack everyone. Last kingdom standing, or the Wonder, wins.' : room.game === 'c4' ? 'Take turns dropping discs. The host holds the board and checks every move. First to four in a row wins.' : room.game === 'rogue' ? 'The host runs the dungeon. Move with WASD / arrows (or the stick on a phone), you attack on your own. SPACE dashes, Q is your special. You pick your own perk after every room, and fallen friends are revived in the next room.' : room.game === 'hockey' ? 'The host runs the puck; you move your own mallet instantly (mouse, finger or WASD). First to 7. A second puck sometimes drops in!' : room.game === 'pool' ? 'Classic 8-ball. Players alternate turns; drag back from anywhere and release to shoot, or aim with the arrow keys and hold Space. The host runs the physics.' : room.game === 'pickle' ? 'The host runs the match and the ball; you move your own player instantly and your hits are checked by the host, so a fast connection helps. First to 11, win by 2.' : room.game === 'bomber' ? 'The host runs the arena. Move and drop bombs; last one standing wins the round, best of 3. Bots fill empty slots; if a friend leaves a bot takes over.' : room.game === 'tetris' ? 'Both of you get the same piece order. Your clears send garbage to the other board. Last one standing wins. Leaving or disconnecting forfeits.' : 'The host runs the table; you only see your own cards (chips are per-table). If someone disconnects a bot takes their seat. If the host leaves the game ends.'}</small></div></div>
        <TopPlayers s={s} initial={room.game} compact fixed key={room.game} />
      </div>
    </div>
  )
}
