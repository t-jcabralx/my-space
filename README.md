# My Space Arcade

Three games in one Next.js app (React Three Fiber, WebAudio, no asset files):

- **Space Impact: Neon** - 10 levels, 10 bosses, bonus rounds, Laser/Bomb/Shield/Overdrive skills, wingman drones, ship customization
- **Operation Ground Zero** - Metal Slug-style run & gun: 3 stages, POWs, weapon crates, 3 bosses
- **Bomber Blast** - classic bomb-and-block battle arena: chain reactions, power-ups (bombs, flames, speed, kick, shield), smart bots, sudden death, best-of-1/3/5; modes: free-for-all, 1v1 duel, 1v1 local, party (2P + bots), 2v2, 2v2 co-op, bots only
- **Tetra Blast** - full Tetris: SRS rotation + wall kicks, hold, ghost, T-spins, combos, back-to-back, perfect clears; Marathon, Sprint 40, Ultra, Zen, **1v1 vs bot**, **2P local versus** (garbage battles)
- **Maze Chomp** - a Pac-Man-style maze chase: procedural mazes, 4 ghosts with classic personalities, power pellets, fruit, tunnel; classic, 2P co-op, play-as-a-ghost
- **Card Room** - **UNO** (2-4 players, stacking, call-UNO/catch), **Pusoy Dos** (Filipino Big Two with all 5-card hands), **Lucky 9** (betting, naturals, suited/trips bonuses) and **Tong-its** (melds, sapaw, Draw challenge, burned players). Fully animated table: dealing, 3D flips, fanned hands, confetti. Chips persist between sessions
- **Pickleball** - real rules (diagonal serve, two-bounce, kitchen, rally scoring by default or classic side-out scoring, win by 2); modes: vs Bot, 1v1 local, 2v2 + bot partner, 2v2 co-op, bots vs bots

Built-in **How to play** helper (opens automatically the first time you play each game), **Settings** (volume sliders, voice, screen shake, graphics) and **gamepad** support.

**Daily quests, login streak and award popups** run across all games, and each game has a signature random event (meteor showers, air raids, power-up rain, Tetris fever, golden fruit, UNO Seven-0, Lucky 9 jackpot...). See `FEATURES.md` for the full analysis.

Dashboard with pilot profile, ranks, achievements, ship lab, and a **global Top Players** leaderboard.

## Run

```bash
npm install
cp .env.example .env.local   # fill in your own values
npm run dev                  # http://localhost:3000
npm run build && npm start
npm run test:sim             # headless bot playthroughs of all three games
```

## Environment (`.env.local`, never committed)

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | permanent score history (`scores` collection) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | fast leaderboard (sorted sets `lb:<game>`), rate limiting, **online rooms + pub/sub** |
| `RT_SECRET` (optional) | signs room membership tokens; defaults to the Upstash token |

Without these the games still work; the global leaderboard just shows empty.

## API

- `POST /api/score` `{ game: "space"|"slug"|"pickle"|"bomber"|"tetris"|"chomp"|"uno"|"pusoy"|"lucky9"|"tongits", name, score }`
- `GET /api/leaderboard?game=space&limit=10`

## Also in the box

- **🏁 TURBO RUSH**: a 3D arcade racer with a chase camera. 5 tracks (Sunset Circuit, Neon City, Green Valley, Ice Peak, Desert Run), 6 cars with different strengths, drifting with mini-turbos, nitro, boost pads, AI rivals (3 levels) and lap records. Play it on a keyboard or with the on-screen touch buttons, and race up to 4 friends online (everyone drives their own car with instant response).
- **🥊 IRON FISTS**: a fighting game with **40 fighters** (10 styles x 4 elements, each with their own look, 8 command moves, 3 strings, a special and a cinematic super; elements burn, freeze, shock or drain). Light/heavy punches and kicks, crouch and jump moves, blocking, combos, a signature **special** and a cinematic **super** for every fighter (uppercuts, fireballs, teleports, grabs, beams, tornados, earthquakes...). Modes: vs CPU (3 levels), 2 players on one keyboard, CPU vs CPU, and **online 1v1** with INVITE FRIEND. Controls: WASD + J K punch, U I kick, L special, O super (P2: arrows + N M , . / and Right Shift).
- **🏒 AIR HOCKEY**: neon table, mouse/finger/keyboard mallet, 3 bot levels, 2 players on one screen or **online 1v1**; a CHAOS puck sometimes drops in a second puck.
- **🎱 BILLIARDS**: 8-ball with real fouls and ball-in-hand, slingshot aiming (drag back and release, or arrows + Space), 3 bot levels, 2 players or **online 1v1**.
- **🛡 NEON DEFENSE**: tower defense with 3 maps, 6 towers (Pulse, Cannon, Frost, Sniper, Tesla, Bank) with 3 upgrades each, flyers, bosses, 25 waves and an airstrike.
- **🗡 NEON DEPTHS**: roguelike dungeon crawler. Knight, Ranger or Mage, 3 floors of 4 rooms with a boss each floor, 12 perks, dash and class specials, touch stick.
- **🎵 NEON BEAT**: 4-lane rhythm game, 5 generated songs with a synthesized backing track, hold notes, combos, grades, touch lanes.
- **🔤 WORD HUNT**: 5-letter guessing game (daily word, practice, hard mode) with English and **Filipino** word lists, streaks and a shareable result.
- **🔢 2048 MERGE**: swipe puzzle on 3x3, 4x4 or 5x5 with undo, hammer and shuffle.
- **📖 STORY MODE: THE NEON UPRISING**: a 12-chapter campaign in 3 acts that threads through the whole arcade (Space Impact, racing, hockey, pool, tower defense, rhythm, word, roguelike, fighting, merge, pickleball and a final boss). Cut-scenes, objectives, retry, chips as rewards and credits. Progress is saved.
- **Dashboard**: games are filtered by category (Action, Sports, Strategy, Puzzle, Cards, Music) and the tab bar stays short.
- **Same experience on Windows, macOS, Linux and phones**: touch controls only appear on devices whose main input is touch (a Windows touch-screen laptop keeps keyboard + mouse), the pixel font has a width-matched fallback, scrollbars look the same, and there is a fullscreen button.
- **🔥 FLAMES**: type two names, watch the shared letters get crossed out, count the rest and eliminate F-L-A-M-E-S letters until one remains: Friends, Lovers, Affection, Marriage, Enemies, Siblings. Every result has its own animated voxel scene (high-five and rainbow, kiss and hearts, bouquet, wedding bells and rings, a proper punch-up, piggyback and noogie).
- **Space Impact squad**: fly with up to **2 teammates (3 spacecraft)**. Teammates are **people first**: friends who join online, or a second player on the same keyboard (**P2**: WASD + Space for P1, arrows + Enter for P2). Optionally turn on **AI fills empty slots** for wingmen that follow, dodge, shoot and respawn. Choose SOLO / DUO / TRIO on the Space Impact card; by default you fly alone until friends join. **Invite friends** to fly the teammate ships from another computer (🌐 Online tab or the INVITE FRIEND button on the Space Impact card): the host runs the missions, bosses and shop, friends see the same world and share the score and lives. It works best over the direct WebRTC link (⚡).

## Online multiplayer (no extra server)

The **🌐 ONLINE** tab lets friends play together: **Tetra Blast 1v1, UNO, Pusoy Dos, Tong-its, Lucky 9**. Create a room, share the 5-letter code, the host presses START (bots fill empty seats).
Everything runs inside this Next.js app: rooms are stored in Redis, and messages travel over **Redis pub/sub** through route handlers.

- `POST /api/rt/room` list / create / join / leave / start / finish (rooms live in Redis, 2h TTL)
- `POST /api/rt/send` publish a message to the room, or privately to one player (`PUBLISH rt:<code>[:<cid>]`)
- `GET /api/rt/stream` Server-Sent Events bridge: subscribes to Upstash (`/subscribe/...`) and relays frames to the browser

Real-time games (Pickleball, Bomber, Tetra Blast) upgrade to a **direct WebRTC data channel** between browsers once it connects (signalled through the same Redis channel, so no extra server); if the direct link cannot be made, everything keeps working through Redis. The lobby shows ⚡ direct link or ☁ relay.

The host simulates card games and sends each player a private snapshot (other hands are masked); Tetra Blast runs on both clients with the same seeded piece bag and exchanges attacks and board snapshots.
Disconnected players are replaced by a bot. On serverless hosts a long-lived SSE response is capped by `maxDuration` (300s); the client reconnects automatically. `npm run dev` + `node scripts/sim-online.mjs` runs a two-process end-to-end test against real Redis.

## Playing with friends on other computers

`localhost:3000` only exists on your own machine, so a friend who opens it (or a link that starts with `localhost`) gets their own empty copy of the game and a "room not found" error. Everyone must open the **same public address**:

1. **Deploy** the project (for example on Vercel) with the same environment variables as `.env.local`, or
2. **Tunnel** your local game: run `npm run build && npm start`, then `npx cloudflared tunnel --url http://localhost:3000` (or ngrok / localtunnel) and share the `https://...` address it prints.
3. In the 🌐 Online tab paste that address into the box shown on the room screen. **🔗 COPY INVITE LINK** then builds `https://your-address/?join=CODE`, and your friend lands directly in your room. Friends can also type the code into the **JOIN** bar at the top of the dashboard.

## Controls

See the **Skills & Controls** tab in the dashboard. Press **M** to mute, **P/Esc** to pause.
