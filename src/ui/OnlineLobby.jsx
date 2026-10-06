'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RT, subscribeRt, getRt, createRoom, joinRoom, leaveRoom, listRooms, roomAction, sendChat } from '../game/online/rt.js'
import { hostCardGame, installCardsOnline } from '../game/online/cards-online.js'
import { hostTetris, installTetrisOnline } from '../game/online/tetris-online.js'
import { hostPickle, installPickleOnline } from '../game/online/pickle-online.js'
import { hostBomber, installBomberOnline } from '../game/online/bomber-online.js'
import { hostSpace, installSpaceOnline } from '../game/online/space-online.js'
import { hostFightMatch, installFightOnline } from '../game/online/fight-online.js'
import { setName } from '../game/engine.js'

if (typeof window !== 'undefined') { installCardsOnline(); installTetrisOnline(); installPickleOnline(); installBomberOnline(); installSpaceOnline(); installFightOnline() }

const GAMES = [
  ['fight', '🥊', 'IRON FISTS 1V1', '40 fighters, specials and supers. Pick your fighter in the 🥊 FIGHT tab first.', 2],
  ['space', '🚀', 'SPACE IMPACT CO-OP', 'Fly together: you + up to 2 friends as teammates (3 spacecraft). The host runs the missions.', 3],
  ['pickle', '🏓', 'PICKLEBALL 1V1', 'Real rules, first to 11 win by 2. Host runs the match; WASD/arrows + F G H to hit.', 2],
  ['bomber', '💣', 'BOMBER BLAST', '2-4 friends in the arena, bots fill empty slots. Move with WASD/arrows, Space drops a bomb.', 4],
  ['tetris', '🧱', 'TETRA BLAST 1V1', 'Race a real player. Clear lines to send garbage. Same piece order for both.', 2],
  ['uno', '🟥', 'UNO', '2-4 humans, bots fill empty seats. Private hands, host runs the table.', 4],
  ['pusoy', '👑', 'PUSOY DOS', '2-4 humans, bots fill empty seats. First to 40 points.', 4],
  ['tongits', '🀄', 'TONG-ITS', '2-3 humans, bots fill the third seat. Everyone starts with 1000 table chips.', 3],
  ['lucky9', '🎰', 'LUCKY 9', '1-4 humans against the house. Everyone starts with 1000 table chips.', 4],
]
const useRt = () => useSyncExternalStore(subscribeRt, getRt, getRt)

export default function OnlineLobby({ s, TopPlayers, initGame }) {
  const rt = useRt()
  const [game, setGame] = useState(initGame || 'tetris')
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
  const autoJoined = useRef(false)
  useEffect(() => {
    if (autoJoined.current || room) return
    let c = ''
    try { c = (new URLSearchParams(location.search).get('join') || '').toUpperCase().slice(0, 5) } catch { /* ignore */ }
    if (c.length >= 4) { autoJoined.current = true; join(c) }
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
  const join = (c) => run(async () => { setName && setName(cleanN()); await joinRoom(c, cleanN()) })
  const isHost = !!room && room.host === rt.cid
  const g = room ? GAMES.find((x) => x[0] === room.game) : null
  const start = () => run(async () => {
    if (room.game === 'fight') await hostFightMatch()
    else if (room.game === 'tetris') await hostTetris()
    else if (room.game === 'space') await hostSpace()
    else if (room.game === 'pickle') await hostPickle()
    else if (room.game === 'bomber') await hostBomber()
    else await hostCardGame(room.game, { ...room.opts, auto: false, ...(room.game === 'pusoy' ? { target: 40 } : room.game === 'tongits' ? { stake: 50 } : room.game === 'lucky9' ? { bots: room.opts.bots || 0 } : {}) })
  })
  const share = room ? `${room.code}` : ''

  if (!room) {
    return (
      <div className="lobby">
        <div className="lobbyL">
          <h4>1 · YOUR NAME</h4>
          <div className="chips"><input className="nameIn" value={name} maxLength={12} onChange={(e) => setNm(e.target.value)} placeholder="NAME" /></div>
          <h4>2 · PICK A GAME</h4>
          <div className="gamepick">{GAMES.map(([k, ico, n, d]) => <button key={k} className={game === k ? 'sel' : ''} onClick={() => setGame(k)}><span className="ico">{ico}</span><strong>{n}</strong><small>{d}</small></button>)}</div>
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
          {(room.game === 'tetris' || room.game === 'pickle' || room.game === 'fight') && room.players.length < 2 && <div className="chip" style={{ margin: 3, opacity: 0.6 }}>… waiting for opponent</div>}
        </div>
        <div className="chips">
          {isHost
            ? <button className="big" disabled={(room.game === 'tetris' || room.game === 'pickle' || room.game === 'bomber' || room.game === 'fight') && room.players.length < 2} onClick={start}>▶ START GAME</button>
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
        <div className="panel"><h4>HOW IT WORKS</h4><div className="lobbyinfo"><small>{room.game === 'fight' ? 'Best of 3 rounds. The host runs the fight; your controls and moves are sent instantly over the direct link (⚡). WASD or arrows to move, J K U I to punch and kick, L special, O super. Choose your fighter in the 🥊 FIGHT tab before the host presses START.' : room.game === 'space' ? 'The host flies ship #1 and runs the missions, upgrades and bosses. Friends fly the other ships (WASD/arrows + Space) and share the score and lives. Free ships are flown by AI teammates. Best with the direct link (⚡).' : room.game === 'pickle' ? 'The host runs the match and the ball; you move your own player instantly and your hits are checked by the host, so a fast connection helps. First to 11, win by 2.' : room.game === 'bomber' ? 'The host runs the arena. Move and drop bombs; last one standing wins the round, best of 3. Bots fill empty slots; if a friend leaves a bot takes over.' : room.game === 'tetris' ? 'Both of you get the same piece order. Your clears send garbage to the other board. Last one standing wins. Leaving or disconnecting forfeits.' : 'The host runs the table; you only see your own cards (chips are per-table). If someone disconnects a bot takes their seat. If the host leaves the game ends.'}</small></div></div>
        <TopPlayers s={s} initial={room.game} compact fixed key={room.game} />
      </div>
    </div>
  )
}
