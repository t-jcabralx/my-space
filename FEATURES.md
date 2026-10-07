# Feature analysis: what keeps players coming back

Ten games, one dashboard. This is an honest audit of what each game had, what it lacked, and what was added.

## What makes a game exciting (the lens used)
1. **Variety inside a session**: surprises that break the rhythm (events, power-ups, comebacks).
2. **Tension and payoff**: near-death, match point, jackpots, huge combos.
3. **A reason to return tomorrow**: goals, streaks, rewards.
4. **Feedback**: sound, animation and callouts that make every good moment feel big.

## Cross-game systems (affect all 10 games)
| Gap found | Added |
|---|---|
| Nothing to do after finishing a game | **3 daily quests** per day (a mix across all games), chips + XP rewards |
| No reason to come back daily | **Login streak** with a daily bonus that grows for 7 days |
| Awards only visible on a tab | **Award-unlock popups** anywhere, mid-game, with a chip reward |
| Chips only mattered in card games | Quests, awards and the daily bonus all pay **chips** |
| Hard to find a game's rules | **How-to-play helper** (auto-opens first time) |

## Per game
| Game | Already strong | Gap | Added exciting event / feature |
|---|---|---|---|
| **Space Impact** | 10 levels/bosses, skills, drones, ship lab | Waves felt predictable between bosses | **METEOR SHOWER** (8s of coin-rich rocks) and **GOLDEN WAVE** (10s of ×2 score + extra coins + surprise drone swarm) at random moments |
| **Ground Zero** | Tank, knife, POWs, 3 bosses | Stages were steady-paced | **AIR RAID** (telegraphed red bomb markers, dodge-or-die) and **SUPPLY DROP** (parachute crate with a strong weapon) |
| **Pickleball** | Real rules, bot levels, 4 modes | Close games had no drama | **MATCH POINT / DEUCE** callouts with crowd + voice, **rally milestones** (10/15/20/30 shots) with a crowd roar |
| **Bomber Blast** | Chain reactions, smart bots, sudden death | Mid-round lulls once blocks were cleared | **POWER-UP RAIN**: items fall onto the board, everyone races to grab them |
| **Tetra Blast** | SRS, T-spins, garbage battles | Skilled play had little extra reward | **FEVER**: a hot combo or back-to-back hard clear gives 12s of ×2 score with a gold board |
| **Maze Chomp** | Ghost AI, co-op, ghost mode | Fruit was predictable | **GOLDEN FRUIT**: 1 in 5 fruits is gold, worth 5,000 with a jackpot sound |
| **UNO** | Full rules, stacking, catch | Matches could feel samey | **Seven-0 rule**: a 7 swaps hands, a 0 rotates every hand |
| **Pusoy Dos** | Full 5-card ranking, hints | n/a | Banners for monster hands (Four of a Kind, Straight Flush), last-card warning |
| **Lucky 9** | Naturals, suited/trips bonuses | Flat payouts | **DOUBLE DOWN** and a **progressive JACKPOT** (suited natural 9 wins the whole pot) |
| **Tong-its** | Melds, sapaw, Draw challenge, burned | n/a | Opponent hands flip face-up on a challenge showdown |

## Recommended next steps (not built yet)
- **Online extras**: matchmaking/quick-play queue, spectators, rejoin after refresh, online Pickleball/Bomber, ranked Elo.
- **Cosmetics shop**: spend chips on ship skins, card backs, table felts, trail effects.
- **Seasonal events / weekly tournaments** using the existing Redis leaderboard with a week key.
- **Touch controls** for Ground Zero, Bomber and Tetris on phones.
- **Replays / share cards** for big moments (Tetris, jackpot, boss kill).
- **Accessibility**: colour-blind palettes (ghost colours, UNO colours), reduced-motion option (shake is already toggleable).

## Arcade pack 2 and story mode
Seven more games (Air Hockey, Billiards, Neon Defense, Neon Depths, Neon Beat, Word Hunt, 2048 Merge), all with sound, animation, phone support, help pages and leaderboards, plus **Story Mode: The Neon Uprising** (12 chapters across the whole arcade). Air Hockey and Billiards play **online 1v1**. See the README for the full list.

| Area | What was done |
|---|---|
| Dashboard | Category filter chips; per-game tabs hidden from the tab bar (only the game you opened shows) |
| Story | 3 acts, 12 chapters, cut-scenes, objectives, retry, chip rewards, credits |
| Windows parity | Touch pads only on touch-first devices, width-matched font fallback, themed scrollbars, `100dvh`, fullscreen button |

## Update: more games, 3D and online (latest)
- **🏰 EMPIRE RISE** (new): grow a village into a city and an empire on a 96x96 map. 9 building types, 4 hall ranks (Village, Town, City, Empire), soldiers, knights and catapults, walls and towers, raiders from the map edges, AI kingdoms, a Wonder victory, minimap. Up to 4 kingdoms online (friends + AI).
- **🔴 CONNECT FOUR** (online 1v1), **🐍 NEON SNAKE**, **🧱 NEON BREAKER**, **💣 MINE SWEEP**.
- **🗡 NEON DEPTHS** is now a 3D haunted forest with a story, 5 races (Half-blood, Elf, Dwarf, Undead, Fairy), 4 companions (Wolf, Owl, Fairy sprite, Dragon whelp), XP levels up to 10 with new skills at levels 3 and 6, and online co-op for up to 3 heroes.
- **3D look** for Neon Defense, Air Hockey, Billiards, Neon Snake, Neon Breaker and Neon Beat (lit voxel pass plus real spheres, shadows, animated parts).

## Update: stories, chapters and scenarios
- **Neon Depths** is now a 5-chapter campaign (Woods, Marsh, Crystal Caverns, Ember Ruins, Void Grove): bigger rooms, a story with cut-scenes and guardian dialogue, rune trials (puzzles), treasure rooms, elite guards, a hidden vault behind a cracked wall in every chapter, 10 lore tablets (codex), weapons (3 unlockable per class) and 6 passive powers to unlock, plus new bosses (Crystal Warden, Cinder Drake). Monsters are 20% slower.
- **Neon Defense** has a 5-map campaign "The Wardens of the Valley" with story scenes, much bigger maps (up to 30x16) and slower monsters.
- **Empire Rise** has a 5-scenario campaign "From Ember to Empire" with objectives, guided hints, story scenes and its own raid pacing; free skirmish and online remain.
- **Story mode** now includes the Village of Embers and the new Depths and Defense chapters.
- **Phones:** the layout follows rotation, asks for fullscreen + landscape on the first game, and shows a hint in portrait.

## Update: companions, click-to-attack, the Abyss and hidden agendas
- **Neon Depths** no longer attacks for you: click (or hold) to attack toward the mouse, press J, or use the on-screen button on phones.
- **Rooms are about 60% wider.**
- **9 companions** (wolf, eagle, owl, lion, tiger, bear, fairy, dragon, phoenix), all unlocked by playing. They gain XP, level up to 9 and evolve at levels 4 and 7 with new effects; their progress is saved.
- **Your hero ascends** at levels 3, 6 and 9: a rune ring, a flowing river of light, then a halo.
- **The Abyss**: 50 different room scenarios (ambushes, gauntlets, survival, trap floors, shrines, merchants, rune trials, elites, a guardian every 10 rooms).
- **6 hidden agendas** (pots, untouched rooms, speed, shrines, depth, collecting) that reward an **orb** (floating effect) and a **relic skill** (key F).
- **Empire Rise**: idle soldiers auto-defend when an enemy gets near any of your buildings; new sounds for fighting, building, training, alarms and raid horns.

## Update: Snow Rush, Kart items, Orb Rush, Garden Siege, finishers, story season 2, online everywhere
- **🏂 SNOW RUSH** (SSX-style 3D snowboarding): 3 mountains (alpine, ice half-pipe, night), race 5 AI riders or Trick Attack, kickers, rails, boost, tricky/uber tricks, 6 riders. **Online race** for 2-4 friends (each rides on their own device, others are live ghosts).
- **🍌 KART MODE** in Turbo Rush: item boxes, bananas, homing shells, blue shell, stars, lightning, boosts; rubber-band item luck. **Kart Clash** online room (up to 4 + bots, hits are relayed through the host).
- **🔮 ORB RUSH** (marble shooter): 10 spiral levels, power orbs (slow / freeze / reverse / bomb), chain reactions; **online versus** (same orbs, combos send extra orbs to your rival).
- **🧟 GARDEN SIEGE** (lane defence): 8 plants, 5 zombies, 10 levels with a wave director; **Horde mode** (you lead zombies against an AI gardener); **online versus** (one friend plants, the other leads the horde; sides swap each rematch).
- **🥊 FINISH HIM** in Iron Fists: win the deciding round by K.O. and press special/super for an element finisher (Inferno, Absolute Zero, Thunder God, Soul Eater). Bots finish you too. Works online and in 2P.
- **📖 STORY season 2: THE LAST CABINET**: acts IV and V (8 more chapters, 5 new characters), dialogue **choices** that set flags (co-pilot, spare or delete ARCHON), two endings, a 3-round **gauntlet** finale, and **👥 play any chapter with a friend** online (the objective counts for both players).
- **⚔ SCORE DUELS**: Snake, Neon Breaker, 2048, Neon Beat, Neon Defense, Maze Chomp, Mine Sweep (same minefield) and Word Hunt (same word) can be played head-to-head online with live rival scores.
- Tests: `scripts/sim-ssx.mjs`, `sim-kart.mjs`, `sim-orb.mjs`, `sim-garden.mjs`, `sim-story2.mjs` (in `npm run test:sim`) and the two-process `scripts/sim-online2.mjs` (`npm run test:online2`, needs the dev server).
