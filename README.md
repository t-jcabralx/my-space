# My Space Arcade

Three games in one Next.js app (React Three Fiber, WebAudio, no asset files):

- **Space Impact: Neon** - 10 levels, 10 bosses, bonus rounds, Laser/Bomb/Shield/Overdrive skills, wingman drones, ship customization
- **Operation Ground Zero** - Metal Slug-style run & gun: 3 stages, POWs, weapon crates, 3 bosses
- **Pickleball** - real rules (diagonal serve, two-bounce, kitchen, side-out scoring, win by 2); modes: vs Bot, 1v1 local, 2v2 + bot partner, 2v2 co-op, bots vs bots

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

- `POST /api/score` `{ game: "space"|"slug"|"pickle", name, score }`
- `GET /api/leaderboard?game=space&limit=10`

## Controls

See the **Skills & Controls** tab in the dashboard. Press **M** to mute, **P/Esc** to pause.
