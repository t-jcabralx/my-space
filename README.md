# My Space Arcade

Three games in one Next.js app (React Three Fiber, WebAudio, no asset files):

- **Space Impact: Neon** - 10 levels, 10 bosses, bonus rounds, Laser/Bomb/Shield/Overdrive skills, wingman drones, ship customization
- **Operation Ground Zero** - Metal Slug-style run & gun: 3 stages, POWs, weapon crates, 3 bosses
- **Bomber Blast** - classic bomb-and-block battle arena: chain reactions, power-ups (bombs, flames, speed, kick, shield), smart bots, sudden death, best-of-1/3/5; modes: free-for-all, 1v1 duel, 1v1 local, party (2P + bots), 2v2, 2v2 co-op, bots only
- **Tetra Blast** - full Tetris: SRS rotation + wall kicks, hold, ghost, T-spins, combos, back-to-back, perfect clears; Marathon, Sprint 40, Ultra, Zen, **1v1 vs bot**, **2P local versus** (garbage battles)
- **Maze Chomp** - a Pac-Man-style maze chase: procedural mazes, 4 ghosts with classic personalities, power pellets, fruit, tunnel; classic, 2P co-op, play-as-a-ghost
- **Card Room** - **UNO** (2-4 players, stacking, call-UNO/catch), **Pusoy Dos** (Filipino Big Two with all 5-card hands), **Lucky 9** (betting, naturals, suited/trips bonuses) and **Tong-its** (melds, sapaw, Draw challenge, burned players). Fully animated table: dealing, 3D flips, fanned hands, confetti. Chips persist between sessions
- **Pickleball** - real rules (diagonal serve, two-bounce, kitchen, side-out scoring, win by 2); modes: vs Bot, 1v1 local, 2v2 + bot partner, 2v2 co-op, bots vs bots

Built-in **How to play** helper (opens automatically the first time you play each game), **Settings** (volume sliders, voice, screen shake, graphics) and **gamepad** support.

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
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | fast leaderboard (sorted sets `lb:<game>`) + rate limiting |

Without these the games still work; the global leaderboard just shows empty.

## API

- `POST /api/score` `{ game: "space"|"slug"|"pickle"|"bomber"|"tetris"|"chomp"|"uno"|"pusoy"|"lucky9"|"tongits", name, score }`
- `GET /api/leaderboard?game=space&limit=10`

## Controls

See the **Skills & Controls** tab in the dashboard. Press **M** to mute, **P/Esc** to pause.
