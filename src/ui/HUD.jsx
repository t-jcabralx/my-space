'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import OnlineLobby from './OnlineLobby.jsx'
import { joinRoom, subscribeRt, getRt } from '../game/online/rt.js'
import { onKey as engineKey, setSquad, subscribe, getSnap, startGame, toShop, launchNext, buy, retryMission, toMenu, togglePause, useSkill, startGameAt, setShip, setName, markSeen, claimDaily } from '../game/engine.js'
import { subscribeSlug, getSlugSnap, slugActions } from '../game/slug.js'
import { subscribePickle, getPickleSnap, pickleActions, MODES } from '../game/pickle.js'
import { subscribeBomber, getBomberSnap, bomberActions, MODES as BMODES } from '../game/bomber.js'
import { subscribeTetris, getTetrisSnap, tetrisActions, MODES as TMODES, COLORS as TCOL, SHAPES as TSH } from '../game/tetris.js'
import { pickleScoring } from '../game/pickle.js'
import { subscribeFight, getFightSnap, fightActions, setFightPick } from '../game/fight.js'
import { subscribeRace, getRaceSnap, raceActions, setRacePick, TRACKS, CARS, buildTrack } from '../game/race.js'
import { ROSTER, ELEMENTS as ELS } from '../game/roster.js'
import { subscribeChomp, getChompSnap, chompActions, MODES as CMODES } from '../game/chomp.js'
import { subscribeFlames, getFlamesSnap, flamesActions, OUTCOMES as FOUT } from '../game/flames.js'
import CardsHUD from './CardsUI.jsx'
import { EmpireLobby, EmpireHUD } from './EmpireUI.jsx'
import { SsxLobby, SsxHUD } from './Ssx.jsx'
import { OrbLobby, OrbHUD } from './Orb.jsx'
import { orbActions } from '../game/orb.js'
import { ssxActions } from '../game/ssx.js'
import { More2HUD, MORE2_MODES, C4Lobby, SnakeLobby, BreakerLobby, MinesLobby } from './MoreGames2.jsx'
import { MoreHUD, MORE_MODES, HockeyLobby, PoolLobby, TdLobby, RogueLobby, RhythmLobby, WordLobby, MergeLobby } from './MoreGames.jsx'
import { StoryTab, StoryOverlay } from './StoryUI.jsx'
import { isTouchPrimary } from './platform.js'
import { hockeyActions } from '../game/hockey.js'
import { poolActions } from '../game/pool.js'
import { tdActions } from '../game/td.js'
import { rogueActions } from '../game/rogue.js'
import { rhythmActions } from '../game/rhythm.js'
import { snakeActions } from '../game/snake.js'
import { breakerActions } from '../game/breaker.js'
import { cardsActions } from '../game/cards/core.js'
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
  else if (snap && snap.mode === 'tetris') resume = tetrisActions.pause() ? 'tetris' : null
  else if (snap && snap.mode === 'chomp') resume = chompActions.pause() ? 'chomp' : null
  else if (snap && snap.mode === 'cards') resume = cardsActions.pause() ? 'cards' : null
  else if (snap && snap.mode === 'hockey') resume = hockeyActions.pause() ? 'hockey' : null
  else if (snap && snap.mode === 'pool') resume = poolActions.pause() ? 'pool' : null
  else if (snap && snap.mode === 'td') resume = tdActions.pause() ? 'td' : null
  else if (snap && snap.mode === 'rogue') resume = rogueActions.pause() ? 'rogue' : null
  else if (snap && snap.mode === 'snake') resume = snakeActions.pause() ? 'snake' : null
  else if (snap && snap.mode === 'breaker') resume = breakerActions.pause() ? 'breaker' : null
  else if (snap && snap.mode === 'ssx') resume = ssxActions.pause() ? 'ssx' : null
  else if (snap && snap.mode === 'orb') resume = orbActions.pause() ? 'orb' : null
  else if (snap && snap.mode === 'rhythm') resume = rhythmActions.pause() ? 'rhythm' : null
  help = { open: true, tab: tab || help.tab, resume }
  helpEmit()
}
export function closeHelp() {
  const r = help.resume
  help = { ...help, open: false, resume: null }
  helpEmit()
  if (r === 'space') togglePause(); else if (r === 'slug') slugActions.resume(); else if (r === 'pickle') pickleActions.resume(); else if (r === 'bomber') bomberActions.resume(); else if (r === 'tetris') tetrisActions.resume(); else if (r === 'chomp') chompActions.resume(); else if (r === 'cards') cardsActions.resume(); else if (r === 'hockey') hockeyActions.resume(); else if (r === 'pool') poolActions.resume(); else if (r === 'td') tdActions.resume(); else if (r === 'rogue') rogueActions.resume(); else if (r === 'rhythm') rhythmActions.resume(); else if (r === 'snake') snakeActions.resume(); else if (r === 'breaker') breakerActions.resume(); else if (r === 'ssx') ssxActions.resume(); else if (r === 'orb') orbActions.resume()
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
          <li><b>Rally scoring (default):</b> whoever wins the rally gets the point, and the winners take the serve. <b>Classic:</b> only the <b>serving side scores</b>; win a rally on the other side's serve and you only get the serve (side-out). Pick it in the lobby under SCORING.</li>
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
  cards: {
    name: '🃏 CARD ROOM',
    body: () => (
      <>
        <p>Click a game in the <b>CARD ROOM</b> tab. Click your cards to play or select them. Glowing cards are playable. The table animates every deal, flip and play. Lucky 9 and Tong-its use your <b>chip bank</b> (🪙, saved between sessions).</p>
        <h5>UNO (2-4 players)</h5>
        <ul>
          <li>Match the top card by <b>colour</b> or <b>number/symbol</b>. No match? Click the <b>deck</b> to draw (play it if it fits, or pass).</li>
          <li><b>Skip</b> ⊘ skips the next player. <b>Reverse</b> ⇄ flips direction. <b>+2</b> and <b>Wild +4</b> make the next player draw (with <b>stacking</b> on, they can answer with another +2 / +4). <b>Wild</b> lets you pick the colour.</li>
          <li>Down to <b>one card</b>? Press <b>UNO!</b> fast, or you draw 2 when caught. If a bot forgets, press <b>CATCH!</b> to make them draw 2.</li>
          <li><b>Seven-0 rule</b> (optional): playing a <b>7</b> lets you <b>swap hands</b> with anyone; playing a <b>0</b> makes <b>everyone pass their hand</b> in the play direction. Chaos!</li>
          <li>Win a round to score the points left in the others' hands. First to the target wins the match.</li>
        </ul>
        <h5>PUSOY DOS (4 players)</h5>
        <ul>
          <li>Get rid of all 13 cards first. Order low to high: <b>3 4 5 … K A 2</b>. Suits low to high: <b>♣ ♠ ♥ ♦</b>.</li>
          <li>Whoever holds the <b>3♣</b> leads and must play it. Play a <b>single, pair, triple</b>, or a <b>5-card hand</b>: Straight &lt; Flush &lt; Full House &lt; Four of a Kind &lt; Straight Flush. Later players must play the <b>same kind and beat it</b>, or pass.</li>
          <li>Click cards to select them (the table shows what you have selected), then <b>PLAY</b>. <b>HINT</b> suggests a play. If everyone passes, the last player leads anything.</li>
          <li>Losers pay points for cards left (the more left, the worse: 8+ cards double, 10+ triple, 13 quadruple).</li>
        </ul>
        <h5>LUCKY 9 (vs the house)</h5>
        <ul>
          <li>Pick a bet, press <b>DEAL</b>. You get 2 cards; <b>A=1, 2-9 face value, 10/J/Q/K=0</b>. Hand value = <b>total mod 10</b>. Closest to 9 wins. <b>HIT</b> for a 3rd card or <b>STAND</b>.</li>
          <li><b>DOUBLE DOWN</b>: after your first two cards, double your bet and take exactly one more card. <b>JACKPOT</b>: a small slice of every bet builds the pot; a <b>suited natural 9</b> wins all of it!</li>
          <li>A 2-card <b>8 or 9</b> is a <b>natural</b>. Bonuses: all <b>same suit</b> pays ×2 (2 cards) or ×3 (3 cards); <b>three of a kind</b> pays ×5. Ties push (bet returned).</li>
          <li>Out of chips? Take the free <b>loan</b>. <b>CASH OUT</b> to bank your score on the leaderboard.</li>
        </ul>
        <h5>BACCARAT</h5>
        <ul>
          <li>Pick <b>PLAYER</b>, <b>BANKER</b> or <b>TIE</b>, choose a bet and press <b>DEAL</b>. Two cards each; <b>A=1, 2-9 face value, 10/J/Q/K=0</b>; a hand is its <b>total mod 10</b>. Closest to 9 wins.</li>
          <li>You never draw yourself: the table follows the fixed third-card rules. PLAYER pays 1:1, BANKER pays 0.95:1, TIE pays 8:1 (a tie returns PLAYER/BANKER bets). The coloured dots in the header are the last results (🔵 player, 🔴 banker, 🟢 tie).</li>
        </ul>
        <h5>TEXAS HOLD'EM POKER</h5>
        <ul>
          <li>You get 2 private cards; five shared cards come out in three steps (<b>flop</b> 3, <b>turn</b> 1, <b>river</b> 1). Make the best 5-card hand from your 2 + the 5. Blinds are 10/20.</li>
          <li>On your turn: <b>CHECK</b> (free), <b>CALL</b> (match the bet), <b>RAISE</b> (+20/+50/+100), <b>ALL IN</b> or <b>FOLD</b> (give up the hand). Best hand at the showdown wins the pot. Order, best to worst: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.</li>
        </ul>
        <h5>TONG-ITS (3 players)</h5>
        <ul>
          <li>Form <b>melds</b>: a <b>set</b> (3-4 of a rank) or a <b>run</b> (3+ of one suit in order, Ace is low). Each turn: <b>draw</b> from the stock, or <b>take the top discard</b> if it makes a meld with cards in your hand (select them, then click the discard pile). Then <b>MELD</b>, <b>sapaw</b> (select card(s), click any meld on the table to add to it), and finally <b>DISCARD</b> one card.</li>
          <li><b>TONG-ITS!</b> Empty your hand to win big (opponents pay double). Face cards are 10 points, Ace 1.</li>
          <li><b>CALL DRAW</b> (needs an exposed meld, before drawing): the other players must answer <b>FIGHT</b> or <b>FOLD</b>.</li>
          <li><b>How to answer:</b> the game shows your points next to the caller's. <b>Lower points wins.</b> If yours are lower, press <b>FIGHT</b> and you win the pot. If yours are higher (or equal), press <b>FOLD</b>: it only costs a small stake, while losing a fight costs more. The caller wins ties.</li>
          <li>Anyone with <b>no melds</b> at the end is <b>burned</b> and pays extra. If the stock runs out, the lowest hand wins.</li>
        </ul>
      </>
    ),
  },
  race: {
    name: '🏁 TURBO RUSH',
    body: () => (
      <>
        <p><b>Finish first!</b> Race through 3D tracks against bots (or friends online).</p>
        <ul>
          <li><b>🍌 KART ITEMS mode:</b> drive through the rainbow boxes for an item and press <b>F</b> / <b>Q</b> / <b>SHIFT</b> (ITEM button on a phone). 🚀 boost, 🍌 banana (drops behind you), 🔴 homing shell (hits the car ahead), 🔵 blue shell (hunts the leader), ⭐ star (unstoppable), ⚡ lightning (slows everyone else). Players further back get better items.</li>
          <li><b>Drive:</b> ↑/W gas · ↓/S brake · ←/→ or A/D steer. On a phone use the on-screen buttons.</li>
          <li><b>Drift:</b> hold <b>SPACE</b> while steering to slide. Keep it going until the bar is full, then release for a <b>mini-turbo</b>.</li>
          <li><b>Nitro:</b> hold <b>SHIFT/E</b>. Green canisters on the road refill the tank, blue pads give a free boost.</li>
          <li>Stay on the asphalt: grass and walls slow you down. Press <b>R</b> to put the car back on the road.</li>
          <li>Each car has its own strengths (speed, grip, drift power, nitro, weight). Beat the lap record on each track.</li>
        </ul>
      </>
    ),
  },
  fight: {
    name: '🥊 IRON FISTS',
    body: () => (
      <>
        <p><b>Beat your opponent in a best-of-three.</b> Pick one of 40 fighters (10 styles x 4 elements). Every fighter has their own <b>special</b> and a cinematic <b>super</b>.</p>
        <ul>
          <li><b>Move:</b> A/D walk · W jump · S crouch · <b>hold back to block</b> (stand blocks high/mid, crouch blocks low/mid).</li>
          <li><b>Attacks:</b> J light punch · K heavy punch · U light kick · I heavy kick. Crouch (S) for low kicks and uppercuts, jump for air attacks.</li>
          <li><b>L = special</b> (cooldown). <b>O = super</b>: the meter fills when you hit or get hit.</li>
          <li><b>P2 (same keyboard):</b> arrows · N M punch · , . kick · / special · Right Shift super.</li>
          <li>Chain light attacks into combos, but damage shrinks with long combos. Grabs (wrestlers) cannot be blocked.</li>
          <li><b>Online:</b> use the INVITE FRIEND button; both players use WASD or the arrows.</li>
        </ul>
      </>
    ),
  },
  flames: {
    name: '🔥 FLAMES',
    body: () => (
      <>
        <p><b>The classic name game.</b> Type two names and press <b>REVEAL</b>.</p>
        <ul>
          <li><b>1.</b> Letters that appear in both names are <b>crossed out</b> (one match per letter).</li>
          <li><b>2.</b> Count the letters that are left.</li>
          <li><b>3.</b> Go around <b>F-L-A-M-E-S</b> using that count and cross out the letter you land on. Repeat until one letter remains.</li>
          <li><b>F</b> Friends · <b>L</b> Lovers · <b>A</b> Affection · <b>M</b> Marriage · <b>E</b> Enemies (fist fight!) · <b>S</b> Siblings. Identical names are Soulmates (S).</li>
        </ul>
      </>
    ),
  },
  chomp: {
    name: '🟡 MAZE CHOMP',
    body: () => (
      <>
        <p><b>Goal:</b> eat every dot in the maze without being caught by the four ghosts. Clear the maze to reach the next level: each level has a <b>brand-new maze</b> and faster ghosts.</p>
        <h5>CONTROLS</h5>
        <p><K>WASD</K> / <K>ARROWS</K> steer. Press a direction early: the chomper turns at the next corner. Player 2 (co-op or ghost): <K>ARROWS</K> (Player 1 uses <K>WASD</K>).</p>
        <h5>HOW IT WORKS</h5>
        <ul>
          <li><b>Big flashing pellets</b> in the corners make the ghosts <b>scared and blue</b> for a few seconds. Eat them for 200, 400, 800, 1600 points in a row. Eaten ghosts turn into eyes and race home.</li>
          <li>Each ghost hunts differently: <b>Blinky</b> (red) chases you, <b>Pinky</b> (pink) aims ahead of you, <b>Inky</b> (cyan) ambushes using Blinky's position, <b>Clyde</b> (orange) chases until close and then runs away. They also take turns <b>scattering</b> to their corners.</li>
          <li>The <b>tunnel</b> on the side edge wraps you to the other side, and ghosts slow down inside it.</li>
          <li><b>Fruit</b> appears below the ghost house twice per maze for bonus points. Every 10,000 points is an <b>extra life</b>.</li>
          <li><b>2P Co-op:</b> two chompers share 3 lives. <b>Pac vs Ghost:</b> P1 chomps, P2 drives the red ghost and scores 1000 per catch.</li>
        </ul>
        <h5>TIPS</h5>
        <p>Do not clear the corners' pellets too early: keep them as an escape button. Look at where the ghosts are heading, not where they are.</p>
      </>
    ),
  },
  tetris: {
    name: '🧱 TETRA BLAST',
    body: () => (
      <>
        <p><b>Goal:</b> stack falling blocks into full rows to clear them. Pick <b>SOLO</b> (Marathon, Sprint 40, Ultra 2:00, Zen) or battle in <b>1v1</b>: <b>VS BOT</b> or <b>2P VERSUS</b> on one keyboard.</p>
        <h5>CONTROLS</h5>
        <p><K>←</K><K>→</K> / <K>A</K><K>D</K> move (hold to slide fast) · <K>↓</K> / <K>S</K> soft drop · <K>SPACE</K> hard drop</p>
        <p><K>↑</K> / <K>W</K> / <K>X</K> rotate right · <K>Z</K> / <K>Q</K> rotate left · <K>C</K> / <K>E</K> / <K>SHIFT</K> hold</p>
        <p>2P Versus, Player 1: <K>A</K><K>D</K><K>S</K> · <K>W</K> rotate · <K>Q</K> rotate left · <K>SPACE</K> drop · <K>E</K> hold. Player 2: <K>←→↓</K> · <K>↑</K> rotate · <K>,</K> rotate left · <K>ENTER</K> drop · <K>.</K> hold</p>
        <h5>HOW IT WORKS</h5>
        <ul>
          <li>The faint <b>ghost</b> shows where the piece will land. <b>Hold</b> swaps the current piece (once per piece). The next 5 pieces are shown on the side.</li>
          <li>A piece locks half a second after it touches down. Sliding or rotating restarts that timer, up to 15 times.</li>
          <li><b>Scoring:</b> more lines at once is worth far more. A <b>TETRIS</b> (4 lines) is the best normal clear. <b>T-spins</b>, <b>combos</b> and <b>back-to-back</b> hard clears add big bonuses. A <b>perfect clear</b> (empty board) is a huge bonus.</li>
          <li><b>T-spin:</b> rotate a T piece into a tight slot so that at least 3 corners around it are blocked, then clear lines.</li>
          <li><b>Battle:</b> your clears send <b>garbage rows</b> to your opponent (Tetris = 4, T-spin double = 4, +1 back-to-back, plus combo bonus). The red bar beside your board shows garbage coming at you. <b>Clearing lines cancels it.</b> Top out and you lose.</li>
        </ul>
        <h5>TIPS</h5>
        <p>Keep the board flat, leave one column open for I pieces, and build combos. In battle, big clears beat many small ones.</p>
      </>
    ),
  },
  hockey: {
    name: '🏒 AIR HOCKEY',
    body: () => (
      <>
        <p><b>Goal:</b> slam the puck into the other goal. First to the target score wins.</p>
        <h5>CONTROLS</h5>
        <p><b>Mouse or finger:</b> your mallet follows the pointer (it stays on your half). <b>Keyboard:</b> <K>WASD</K> or <K>ARROWS</K>. In 2-player mode P1 uses the mouse / <K>WASD</K> and P2 uses the <K>ARROWS</K>.</p>
        <ul><li>A hard hit makes the puck faster. Walls bounce it, so bank shots work.</li><li><b>CHAOS PUCK:</b> now and then a second puck drops in. Both count.</li><li>Online: invite a friend from the dashboard. The host runs the puck.</li></ul>
      </>
    ),
  },
  pool: {
    name: '🎱 BILLIARDS',
    body: () => (
      <>
        <p><b>8-ball rules.</b> The first ball you pot after the break decides if you are <b>solids (1-7)</b> or <b>stripes (9-15)</b>. Pot all yours, then the black <b>8</b> to win.</p>
        <h5>SHOOTING</h5>
        <p><b>Mouse / finger:</b> press anywhere and drag <b>away</b> from where you want to shoot (like a slingshot): the longer the drag, the harder the shot. Release to fire. <b>Keyboard:</b> <K>←</K> <K>→</K> aim, <K>↑</K> <K>↓</K> power, hold <K>SPACE</K> to charge and release.</p>
        <ul><li><b>Fouls:</b> scratching, hitting the wrong group first, missing every ball, or no ball reaching a rail. Your opponent then gets the cue ball <b>anywhere</b>.</li><li>Potting the 8 early, or while fouling, loses the game.</li></ul>
      </>
    ),
  },
  td: {
    name: '🛡 NEON DEFENSE',
    body: () => (
      <>
        <p><b>Goal:</b> survive 25 waves. Enemies follow the glowing road to your base. Every one that gets through costs a life (bosses cost 5).</p>
        <ul>
          <li>Pick a tower (<K>1</K>-<K>6</K> or the bar at the bottom) then click / tap a free cell to build it. Click a tower to <b>upgrade</b> (<K>U</K>) or <b>sell</b> (<K>S</K>).</li>
          <li><b>PULSE</b> fast, <b>CANNON</b> splash (ground only), <b>FROST</b> slows, <b>SNIPER</b> long range, <b>TESLA</b> chain lightning, <b>BANK</b> earns gold each wave.</li>
          <li>Flyers ignore the road. Cannons cannot hit them.</li>
          <li><K>SPACE</K> calls the next wave (calling early gives a bonus). <K>F</K> speeds things up. <K>Q</K> then click = <b>airstrike</b>.</li>
        </ul>
      </>
    ),
  },
  rogue: {
    name: '🗡 NEON DEPTHS',
    body: () => (
      <>
        <p><b>The tale:</b> beneath the Grid a haunted forest grew from deleted games. The Last Lantern shattered into five Shards, each held by a guardian. Clear the 5 <b>chapters</b> (Woods, Marsh, Caverns, Ember Ruins, Void Grove), or dive into <b>The Abyss</b>: 50 different rooms.</p>
        <h5>CONTROLS</h5>
        <p><K>WASD</K> / <K>ARROWS</K> move. <b>Nothing attacks by itself:</b> <b>click</b> (or hold) to attack toward the mouse, or press <K>J</K>. On a phone use the left stick and tap anywhere or the ⚔ button. <K>SPACE</K> dashes, <K>Q</K> <K>E</K> <K>R</K> are your class skills (levels 1, 3, 6), <K>F</K> is your <b>relic skill</b>, <K>1</K> <K>2</K> <K>3</K> pick a perk.</p>
        <h5>GROWING STRONGER</h5>
        <ul>
          <li><b>Levels</b> up to 10. At levels 3, 6 and 9 your hero <b>ascends</b>: a rune ring, then a river of light that flows behind you, then a halo.</li>
          <li><b>Companions</b> (wolf, eagle, owl, lion, tiger, bear, fairy, dragon, phoenix) are unlocked by playing. They gain XP with you, <b>evolve</b> at levels 4 and 7, and keep their levels forever.</li>
          <li><b>Weapons</b> and <b>powers</b> unlock by clearing chapters, finding secrets and collecting lore.</li>
        </ul>
        <h5>SECRETS</h5>
        <ul>
          <li><b>Rune trials:</b> watch the runes light up, then step on them in the same order.</li>
          <li><b>Cracked walls</b> hide vaults. <b>Clay pots</b> hide something too.</li>
          <li><b>Hidden agendas</b> reward an <b>orb</b> that floats beside you and a <b>relic skill</b>. The codex in the lobby has a riddle for each one.</li>
        </ul>
        <p><b>Co-op:</b> press INVITE FRIENDS to bring up to 2 friends. Everyone picks their own perks; fallen friends revive in the next room.</p>
      </>
    ),
  },
  rhythm: {
    name: '🎵 NEON BEAT',
    body: () => (
      <>
        <p><b>Goal:</b> hit each note as it reaches the line at the bottom.</p>
        <p>Keys <K>D</K> <K>F</K> <K>J</K> <K>K</K> (or the arrow keys). On a phone, tap the four lanes. <b>Long notes:</b> press and keep holding until the tail ends.</p>
        <ul><li><b>PERFECT</b> / <b>GREAT</b> / <b>GOOD</b> depend on timing. Combos multiply your score.</li><li>The life bar drops when you miss. If it empties, the song fails.</li><li>Grades: S 95%+, A 88%+, B 75%+, C 60%+.</li></ul>
      </>
    ),
  },
  word: {
    name: '🔤 WORD HUNT',
    body: () => (
      <>
        <p>Guess the secret 5-letter word in 6 tries. Type with your keyboard or tap the on-screen keys, then <K>ENTER</K>.</p>
        <ul><li><b>Green:</b> right letter, right place. <b>Yellow:</b> right letter, wrong place. <b>Grey:</b> not in the word.</li><li><b>Daily</b> gives everyone the same word each day. <b>Filipino</b> uses Tagalog words.</li><li><b>Hard mode:</b> green letters must stay in place.</li></ul>
      </>
    ),
  },
  merge: {
    name: '🔢 2048 MERGE',
    body: () => (
      <>
        <p>Slide all tiles with the arrow keys, <K>WASD</K> or by swiping. Two equal tiles that touch merge into one with double the number. Make <b>2048</b>.</p>
        <ul><li><b>UNDO</b> (<K>Z</K>) takes back your last move. <b>HAMMER</b> deletes one tile. <b>SHUFFLE</b> rearranges the board.</li><li>3x3 is harder and scores x3; 5x5 is roomier.</li></ul>
      </>
    ),
  },
  c4: { name: '🔴 CONNECT FOUR', body: () => (<><p>Drop discs into the 7x6 grid; the first to line up <b>four</b> (across, up or diagonal) wins. Click a column or press <K>1</K>-<K>7</K>. Online: invite a friend; the host keeps the board.</p></>) },
  snake: { name: '🐍 NEON SNAKE', body: () => (<><p>Steer with <K>WASD</K> / <K>ARROWS</K> (swipe on a phone). Eat red apples to grow (+10) and golden apples (+50). Walls, rocks and snakes are deadly. Solo mode speeds up and adds rocks; 2P: P1 <K>WASD</K>, P2 <K>ARROWS</K>.</p></>) },
  breaker: { name: '🧱 NEON BREAKER', body: () => (<><p>Move the paddle with the mouse, finger or <K>←</K> <K>→</K>; <K>SPACE</K> / click launches. Break all bricks in 5 levels. Capsules: wide paddle, multi-ball, slow, extra life. Where the ball hits the paddle sets its angle.</p></>) },
  orb: { name: '🔮 ORB RUSH', body: () => (<><p>A chain of coloured orbs rolls along the track toward the skull hole. Aim with the <b>mouse</b> (or <K>←</K> <K>→</K>) and click / <K>SPACE</K> to shoot the frog's orb. <K>Q</K> swaps your two orbs.</p><p>Make a group of <b>3 or more</b> of the same colour to pop them. When a gap closes and the colours meet, you get a <b>chain reaction</b> with a combo multiplier. Glowing orbs hide power-ups: <b>SLOW</b>, <b>FREEZE</b>, <b>REVERSE</b> and <b>BOMB</b>.</p><p><b>Versus (online):</b> you both face the same orbs. Pops of 4+ orbs and combos send extra orbs to your rival. Clear your board first, or watch your rival fall into the hole!</p></>) },
  ssx: { name: '🏂 SNOW RUSH', body: () => (<><p>Race five riders down the mountain or chase the biggest trick score in <b>Trick Attack</b>. <K>←</K> <K>→</K> / <K>A</K> <K>D</K> steer. Hold <K>SPACE</K> to crouch and release it to jump (longer hold = higher). Hit a <b>kicker</b> (glowing chevron ramp) for big air.</p><p><b>In the air:</b> <K>←</K> <K>→</K> spin, <K>↑</K> <K>↓</K> flip, hold <K>J</K> or <K>K</K> to grab (add a direction for a different grab). Land when the board is pointing downhill: any half-turn counts, a bad angle is a <b>wipeout</b>. Longer tricks and mixing spin + flip + grab multiply the points.</p><p><b>Rails:</b> jump onto a rail to grind it for points. <b>Boost:</b> hold <K>SHIFT</K> / <K>B</K>; tricks and coins fill the meter. When it is full you are <b>TRICKY</b>: unlimited boost, double points, and in the air tapping boost performs an <b>UBER TRICK</b>. Avoid rocks, grab the gold coins and use blue boost pads. On a phone use the on-screen pad and buttons.</p></>) },
  mines: { name: '💣 MINE SWEEP', body: () => (<><p>Open every safe square. A number shows how many mines touch it. <b>Right-click</b> or <b>long-press</b> flags a mine (or use FLAG MODE, <K>F</K>). Click a number with enough flags around it to open its neighbours. The first click is always safe.</p></>) },
  empire: { name: '🏰 EMPIRE RISE', body: () => (<><p><b>Goal:</b> grow your village into a <b>city and an empire</b> and defeat the rival kingdoms (AI or friends). Raiders from the map edges attack everyone, so build towers and an army.</p><h5>BUILD</h5><ul><li>Pick a building (<K>1</K>-<K>9</K> or the bar) and click free grass near your town. Lumber camps, quarries and mines produce more when built <b>next to forest, rock and gold</b>.</li><li>Houses raise your population cap. Barracks train soldiers (<K>T</K> sword, <K>Y</K> archer). Click the Town Hall (or press <K>U</K>) to upgrade it: <b>Village → Town → City → Empire</b>, unlocking mines, knights, catapults and the Wonder.</li></ul><h5>FIGHT</h5><ul><li><b>Right-click</b> (or <K>G</K>, then click) sends your whole army to a point or target. <K>H</K> recalls it to defend. Idle soldiers guard your hall.</li><li>Walls block enemies until they break through. Towers shoot anything in range.</li></ul><h5>WIN</h5><ul><li>Destroy every rival Town Hall, <b>or</b> build the Wonder (Empire level) and keep it alive for 2.5 minutes. If your hall falls, you are out.</li></ul><p><K>WASD</K> / drag scroll · wheel zoom · <K>SPACE</K> jump home · <K>F</K> speed (solo).</p></>) },
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
const FIRST = { race: 'race', fight: 'fight', flames: 'flames', playing: 'space', slug: 'slug', pickle: 'pickle', bomber: 'bomber', tetris: 'tetris', chomp: 'chomp', cards: 'cards', hockey: 'hockey', pool: 'pool', td: 'td', rogue: 'rogue', rhythm: 'rhythm', word: 'word', merge: 'merge', c4: 'c4', empire: 'empire', snake: 'snake', breaker: 'breaker', mines: 'mines', ssx: 'ssx', orb: 'orb' }
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
const fmtN = (n) => Math.floor(n).toLocaleString()
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
        <Buff label="GOLDEN WAVE x2" t={s.golden} max={10} color="#ffd84a" />
        <Buff label="METEORS!" t={s.meteor} max={8} color="#ff6a3a" />
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
import { ACH } from '../game/awards.js'
const RANKS = [[0, 'CADET'], [100, 'PILOT'], [500, 'ACE'], [1500, 'CAPTAIN'], [4000, 'MAJOR'], [9000, 'COLONEL'], [20000, 'LEGEND']]
const xpOf = (p) => p.kills + p.bosses * 50 + p.pows * 20 + (p.spaceWins + p.slugWins) * 500 + (p.pickleWins || 0) * 300 + (p.bomberWins || 0) * 300 + (p.tetrisWins || 0) * 300 + (p.tetrisLines || 0) + (p.cardWins || 0) * 200 + Math.floor((p.chompDots || 0) / 10) + p.played * 5

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
        <h4>MAZE CHOMP</h4>
        <p><K>WASD</K> / <K>ARROWS</K> STEER · P2 / GHOST: <K>ARROWS</K></p>
        <p>Pellets scare ghosts · eat them in a chain · fruit twice per maze · tunnel on the sides.</p>
      </div>
      <div>
        <h4>TETRA BLAST</h4>
        <p><K>←→</K> MOVE · <K>↓</K> SOFT DROP · <K>SPACE</K> HARD DROP · <K>↑</K>/<K>X</K> ROTATE · <K>Z</K> ROTATE LEFT · <K>C</K> HOLD</p>
        <p>2P: P1 <K>WASD</K> + <K>Q</K> <K>E</K> <K>SPACE</K> · P2 <K>ARROWS</K> + <K>,</K> <K>.</K> <K>ENTER</K></p>
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
        <p>Rules: serve diagonally underhand · two-bounce rule · no volleys in the kitchen · every rally scores (or classic: only the server) · first to 11, win by 2.</p>
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
  const [scoring, setScoring] = useState(pickleScoring.get())
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
          {Object.entries(MODES).filter(([, md]) => !md.online).map(([k, md]) => (
            <button key={k} className={'modecard ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>
              <div className="vs"><span>{MODE_ICON[k][0]}</span><i>VS</i><span>{MODE_ICON[k][1]}</span></div>
              <strong>{md.name}</strong><small>{md.desc}</small>
            </button>
          ))}
        </div>
        <div className="lobbyopts">
          <div><h4>2 · BOT LEVEL</h4><div className="chips">{['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (diff === i + 1 ? 'sel' : '')} onClick={() => setDiff(i + 1)}>{d}</button>)}</div></div>
          <div><h4>3 · PLAY TO</h4><div className="chips">{[7, 11, 15].map((t) => <button key={t} className={'chip ' + (target === t ? 'sel' : '')} onClick={() => setTarget(t)}>{t} POINTS</button>)}</div></div>
          <div><h4>4 · SCORING</h4><div className="chips">{[['rally', 'RALLY: EVERY RALLY SCORES'], ['side', 'CLASSIC: ONLY THE SERVER SCORES']].map(([k, l]) => <button key={k} className={'chip ' + (scoring === k ? 'sel' : '')} onClick={() => { setScoring(k); pickleScoring.set(k) }}>{l}</button>)}</div></div>
        </div>
        <div className="lobbyinfo"><b>{m.name}</b> · {m.desc}<br /><small>{CTRL[mode]}</small></div>
        <button className="big" onClick={() => pickleActions.start(mode, diff, target, { scoring })}>▶ START MATCH</button>
        <small className="hint">Rules: serve diagonally underhand · ball must bounce once on each side before volleys · no volleys in the kitchen (teal zone) · RALLY scoring: the winner of every rally gets the point and takes the serve · CLASSIC: only the server scores (side-out) · win by 2.</small>
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
          {Object.entries(BMODES).filter(([, md]) => !md.online).map(([k, md]) => (
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

function MiniTetris() {
  const rows = ['..........', '..........', '....T.....', '...TTT.O..', '.J.....OO.', '.JJJ.S.OO.', '.L.SSS.OZ.', 'LLLZZSSIIZ', 'IIIIZZSIIZ'.replace(/I/g, 'I')]
  const cells = []
  const pat = ['..........', '.....T....', '....TTT.O.', '.J.....OO.', '.JJJ.SSOZZ', '.L..SSZZLL', 'LLLZZS.IIL', 'IIIIZZ.IIL']
  pat.forEach((r, ri) => [...r].forEach((k, ci) => cells.push(<i key={ri + '-' + ci} className={k === '.' ? 'e' : ''} style={k === '.' ? undefined : { background: TCOL[k], boxShadow: `inset 0 -3px 0 #0006, 0 0 6px ${TCOL[k]}66` }} />)))
  return <div className="miniTet">{cells}</div>
}

function TetrisLobby({ s, mode, setMode, diff, setDiff, level, setLevel }) {
  const p = s.profile
  const m = TMODES[mode]
  const GROUPS = [
    ['SOLO', ['marathon', 'sprint', 'ultra', 'zen']],
    ['1 vs 1', ['bot', 'versus']],
    ['WATCH', ['demo']],
  ]
  const ICON = { marathon: '🏃', sprint: '⏱', ultra: '🚀', zen: '🧘', bot: '🧍 vs 🤖', versus: '🧍 vs 🧍', demo: '🤖 vs 🤖' }
  return (
    <div className="lobby">
      <div className="lobbyL">
        {GROUPS.map(([g, list]) => (
          <div key={g}>
            <h4>{g}</h4>
            <div className="modegrid">
              {list.map((k) => (
                <button key={k} className={'modecard ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>
                  <div className="vs"><span>{ICON[k]}</span></div>
                  <strong>{TMODES[k].name}</strong><small>{TMODES[k].desc}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="lobbyopts">
          <div><h4>START LEVEL</h4><div className="chips">{[1, 3, 5, 8, 10].map((v) => <button key={v} className={'chip ' + (level === v ? 'sel' : '')} onClick={() => setLevel(v)}>LV {v}</button>)}</div></div>
          {m.versus && <div><h4>BOT LEVEL</h4><div className="chips">{['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (diff === i + 1 ? 'sel' : '')} onClick={() => setDiff(i + 1)}>{d}</button>)}</div></div>}
        </div>
        <div className="lobbyinfo"><b>{m.name}</b> · {m.desc}<br /><small>{mode === 'versus' ? 'P1: WASD + Q E SPACE   ·   P2: arrows + , . ENTER' : m.humans && m.humans.length === 0 ? 'Just watch. Press Esc to leave.' : 'Arrows / WASD move · SPACE hard drop · X rotate · Z rotate left · C hold'}</small></div>
        <button className="big" onClick={() => tetrisActions.start(mode, level, diff)}>▶ START</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY TETRA STATS</h4><div className="kv"><span>LINES CLEARED</span><b>{p.tetrisLines || 0}</b><span>TETRISES</span><b>{p.tetrises || 0}</b><span>T-SPINS</span><b>{p.tspins || 0}</b><span>BATTLES WON</span><b>{p.tetrisWins || 0}</b><span>SPRINTS DONE</span><b>{p.sprints || 0}</b></div></div>
        <TopPlayers s={s} initial="tetris" compact fixed />
      </div>
    </div>
  )
}

function MiniChomp() {
  const rows = ['#########', '#o.....o#', '#.##.##.#', '#.......#', '#.#.G.#.#', '#...P...#', '#.##.##.#', '#o.....o#', '#########']
  return (
    <div className="miniChomp">
      {rows.map((r, ri) => [...r].map((ch, ci) => (
        <i key={ri + '-' + ci} className={ch === '#' ? 'w' : ''}>
          {ch === '.' && <u className="d" />}{ch === 'o' && <u className="o" />}{ch === 'P' && <u className="p" />}{ch === 'G' && <u className="g" />}
        </i>
      )))}
    </div>
  )
}
function ChompLobby({ s, mode, setMode, level, setLevel }) {
  const p = s.profile
  const m = CMODES[mode]
  const ICON = { classic: '🟡', coop: '🟡🟡', ghost: '🟡 vs 👻', auto: '🤖' }
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · CHOOSE A MODE</h4>
        <div className="modegrid">
          {Object.entries(CMODES).map(([k, md]) => (
            <button key={k} className={'modecard ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>
              <div className="vs"><span>{ICON[k]}</span></div><strong>{md.name}</strong><small>{md.desc}</small>
            </button>
          ))}
        </div>
        <div className="lobbyopts"><div><h4>2 · START LEVEL</h4><div className="chips">{[1, 3, 5, 8].map((v) => <button key={v} className={'chip ' + (level === v ? 'sel' : '')} onClick={() => setLevel(v)}>LEVEL {v}</button>)}</div></div></div>
        <div className="lobbyinfo"><b>{m.name}</b> · {m.desc}<br /><small>{mode === 'coop' || mode === 'ghost' ? 'P1: WASD   ·   P2: arrow keys' : mode === 'auto' ? 'Press Esc to leave.' : 'WASD or arrow keys steer'}</small></div>
        <button className="big" onClick={() => chompActions.start(mode, level)}>▶ START</button>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY CHOMP STATS</h4><div className="kv"><span>DOTS EATEN</span><b>{(p.chompDots || 0).toLocaleString()}</b><span>GHOSTS EATEN</span><b>{p.chompGhosts || 0}</b><span>MAZES CLEARED</span><b>{p.chompLevels || 0}</b><span>BEST SCORE</span><b>{(p.chompHi || 0).toLocaleString()}</b></div></div>
        <TopPlayers s={s} initial="chomp" compact fixed />
      </div>
    </div>
  )
}

function CardRoomLobby({ s, onOnline }) {
  const [game, setGame] = useState('uno')
  const [count, setCount] = useState(3)
  const [stack, setStack] = useState(true)
  const [seven, setSeven] = useState(false)
  const [target, setTarget] = useState(200)
  const [stake, setStake] = useState(50)
  const [bots, setBots] = useState(0)
  const p = s.profile
  const GAMES = [
    ['uno', '🟥', 'UNO', 'Match colours and numbers. Skip, reverse, +2, +4 and wilds. 2-4 players.'],
    ['pusoy', '👑', 'PUSOY DOS', 'Filipino Big Two. 13 cards each, shed them first. Pairs, straights, full houses.'],
    ['lucky9', '🎰', 'LUCKY 9', 'Bet chips, get closest to 9 against the house. Naturals and bonuses.'],
    ['tongits', '🀄', 'TONG-ITS', 'Filipino rummy. Meld, sapaw, call Draw or go Tong-its!'],
    ['baccarat', '🎴', 'BACCARAT', 'Bet on PLAYER, BANKER or TIE. Closest to 9 wins. Real third-card rules.'],
    ['poker', '♠️', "TEXAS HOLD'EM", 'Poker against bots or friends: hole cards, flop, turn, river. Fold, call, raise or go all in.'],
  ]
  const start = (auto) => {
    const opts = game === 'uno' ? { count, stack, target, auto, sevenZero: seven } : game === 'pusoy' ? { target: 40, auto } : game === 'lucky9' || game === 'baccarat' ? { bots, auto } : game === 'poker' ? { bots: Math.max(1, bots), auto } : { stake, auto }
    cardsActions.start(game, opts)
  }
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>1 · PICK A GAME</h4>
        <div className="gamepick">{GAMES.map(([k, ico, n, d]) => <button key={k} className={game === k ? 'sel' : ''} onClick={() => setGame(k)}><span className="ico">{ico}</span><strong>{n}</strong><small>{d}</small></button>)}</div>
        <h4>2 · OPTIONS</h4>
        <div className="lobbyopts">
          {game === 'uno' && <>
            <div><h4>PLAYERS</h4><div className="chips">{[2, 3, 4].map((v) => <button key={v} className={'chip ' + (count === v ? 'sel' : '')} onClick={() => setCount(v)}>{v} PLAYERS</button>)}</div></div>
            <div><h4>STACKING +2/+4</h4><div className="chips">{[[true, 'ON'], [false, 'OFF']].map(([v, n]) => <button key={n} className={'chip ' + (stack === v ? 'sel' : '')} onClick={() => setStack(v)}>{n}</button>)}</div></div>
            <div><h4>SEVEN-0 RULE 🔄</h4><div className="chips">{[[true, 'ON'], [false, 'OFF']].map(([v, n]) => <button key={n} className={'chip ' + (seven === v ? 'sel' : '')} onClick={() => setSeven(v)}>{n}</button>)}</div></div>
            <div><h4>PLAY TO</h4><div className="chips">{[100, 200, 500].map((v) => <button key={v} className={'chip ' + (target === v ? 'sel' : '')} onClick={() => setTarget(v)}>{v} PTS</button>)}</div></div>
          </>}
          {game === 'pusoy' && <div><h4>MATCH</h4><div className="chips"><button className="chip sel">FIRST TO 40 POINTS · 4 PLAYERS</button></div></div>}
          {(game === 'lucky9' || game === 'baccarat' || game === 'poker') && <div><h4>OTHER PLAYERS</h4><div className="chips">{[0, 1, 2, 3].map((v) => <button key={v} className={'chip ' + (bots === v ? 'sel' : '')} onClick={() => setBots(v)}>{v} BOTS</button>)}</div></div>}
          {game === 'tongits' && <div><h4>STAKE PER ROUND</h4><div className="chips">{[50, 100, 200].map((v) => <button key={v} className={'chip ' + (stake === v ? 'sel' : '')} onClick={() => setStake(v)}>🪙 {v}</button>)}</div></div>}
        </div>
        <div className="lobbyinfo"><b>{GAMES.find((g) => g[0] === game)[2]}</b> · {GAMES.find((g) => g[0] === game)[3]}<br /><small>{game === 'lucky9' || game === 'tongits' || game === 'baccarat' || game === 'poker' ? `Uses your chip bank: 🪙 ${Number(p.chips || 0).toLocaleString()}. Cash out to put your chips on the leaderboard.` : 'Click your cards to play. Glowing cards are playable.'}</small></div>
        <div className="chips"><button className="big" onClick={() => start(false)}>▶ SIT DOWN & PLAY</button><button className="big sec" onClick={() => start(true)}>👁 WATCH BOTS</button><button className="big sec" onClick={() => onOnline(game)}>🌐 PLAY WITH FRIENDS</button></div>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>MY CARD ROOM</h4><div className="kv"><span>CHIP BANK</span><b>🪙 {Number(p.chips || 0).toLocaleString()}</b><span>GAMES WON</span><b>{p.cardWins || 0}</b><span>UNO WINS</span><b>{p.unoWins || 0}</b><span>PUSOY WINS</span><b>{p.pusoyWins || 0}</b><span>LUCKY 9s</span><b>{p.luckyNines || 0}</b><span>TONG-ITS</span><b>{p.tongitsWins || 0}</b></div></div>
        <TopPlayers s={s} initial={game} compact fixed key={game} />
      </div>
    </div>
  )
}

function JoinBar({ name, onJoined }) {
  const rt = useSyncExternalStore(subscribeRt, getRt, getRt)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  if (rt.room) return <div className="joinbar"><span>🌐 You are in room <b>{rt.room.code}</b></span><button className="chip sel" onClick={() => onJoined()}>OPEN ROOM ▶</button></div>
  const go = async () => { setErr(''); try { await joinRoom(code, name || 'PLAYER'); onJoined() } catch (e) { setErr(e.message) } }
  return (
    <div className="joinbar">
      <span>🌐 FRIEND SENT YOU A ROOM CODE?</span>
      <input className="nameIn" value={code} maxLength={5} placeholder="CODE" onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && code.length >= 4) go() }} />
      <button className="chip sel" disabled={code.length < 4 || rt.busy} onClick={go}>JOIN</button>
      {err && <small className="joinerr">{err}</small>}
    </div>
  )
}
function FlamesLobby({ s }) {
  const p = s.profile
  const hist = p.flamesHistory || []
  return (
    <div className="lobby">
      <div className="lobbyL">
        <h4>🔥 FLAMES · THE NAME GAME</h4>
        <div className="lobbyinfo">Type two names. Matching letters are crossed out, the rest are counted, and the count eliminates letters of <b>F·L·A·M·E·S</b> until one is left:<br />
          <small>F = Friends · L = Lovers · A = Affection · M = Marriage · E = Enemies · S = Siblings. Each result plays its own animated scene!</small></div>
        <div className="flameslegend">{Object.entries(FOUT).map(([k, o]) => <span key={k} style={{ '--c': o.color }}><b>{k}</b> {o.icon} {o.word}</span>)}</div>
        <div className="chips"><button className="big" onClick={flamesActions.start}>▶ START</button></div>
      </div>
      <div className="lobbyR">
        <div className="panel"><h4>RECENT RESULTS</h4>
          {hist.length === 0 && <div className="lobbyinfo"><small>Nothing yet. Try your name and your crush's!</small></div>}
          {hist.slice(0, 8).map((h, i) => <div key={i} className="kv"><span>{h.a} + {h.b}</span><b style={{ color: FOUT[h.r].color }}>{FOUT[h.r].icon} {FOUT[h.r].word}</b></div>)}
        </div>
      </div>
    </div>
  )
}
function FlamesHUD() {
  const g = useSyncExternalStore(subscribeFlames, getFlamesSnap)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  if (!g) return null
  const go = () => flamesActions.reveal(a, b)
  return (
    <div className="hud flames">
      <div className="top"><div className="col"><div className="lbl">🔥 FLAMES</div></div><div className="col right"><SoundBtn /></div></div>
      {g.phase === 'input' && (
        <div className="flamesform">
          <h2>WHO ARE WE TALKING ABOUT?</h2>
          <input className="nameinp" value={a} maxLength={18} placeholder="FIRST NAME" onChange={(e) => setA(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') go() }} autoFocus />
          <div className="plus">+</div>
          <input className="nameinp" value={b} maxLength={18} placeholder="SECOND NAME" onChange={(e) => setB(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') go() }} />
          {g.note && <div className="fnote">{g.note}</div>}
          <button className="big blink" onClick={go}>🔥 REVEAL OUR FLAMES</button>
          <button className="big sec" onClick={flamesActions.quit}>DASHBOARD</button>
        </div>
      )}
      {g.phase !== 'input' && (
        <div className="flamesboard">
          <div className="fnames">
            {[[g.A, g.crossedA, g.a], [g.B, g.crossedB, g.b]].map(([letters, crossed, full], r) => (
              <div key={r} className="fname">{letters.map((ch, i) => <span key={i} className={'fl ' + (crossed[i] ? 'x' : '')}>{ch}</span>)}<small>{full}</small></div>
            ))}
          </div>
          {g.phase !== 'cross' && <div className="fcount">{g.phase === 'result' ? '' : <>LETTERS LEFT <b>{g.remaining}</b>{g.counter ? <> · COUNT <b className="cn">{g.counter}</b></> : null}</>}</div>}
          <div className="fletters">{g.letters.map((l) => <span key={l.ch} className={'fl2 ' + (l.out ? 'out ' : '') + (l.hot ? 'hot' : '')} style={{ '--c': FOUT[l.ch].color }}>{l.ch}</span>)}</div>
          {g.phase === 'result' && g.out && (
            <div className="fresult" style={{ '--c': g.out.color }}>
              <div className="fword">{g.out.icon} {g.out.word}</div>
              <div className="ftag">{g.out.tag}</div>
              <div className="fbtns"><button className="big" onClick={flamesActions.again}>↻ ANOTHER PAIR</button><button className="big sec" onClick={flamesActions.quit}>DASHBOARD</button></div>
            </div>
          )}
        </div>
      )}
      <div className="scan" />
    </div>
  )
}

// ---------- TURBO RUSH (racing game) ----------
const fmtT = (t) => { if (!t) return '--:--.--'; const m = Math.floor(t / 60), sec = t - m * 60; return `${m}:${sec.toFixed(2).padStart(5, '0')}` }
function TrackMap({ ti, cars }) {
  const { P } = buildTrack(ti)
  const { pts, minX, minZ, k } = useMemo(() => {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9
    for (const p of P) { a = Math.min(a, p.x); b = Math.max(b, p.x); c = Math.min(c, p.z); d = Math.max(d, p.z) }
    const k2 = 88 / Math.max(b - a, d - c)
    return { pts: P.filter((_, i) => i % 3 === 0).map((p) => `${((p.x - a) * k2 + 6).toFixed(1)},${((p.z - c) * k2 + 6).toFixed(1)}`).join(' '), minX: a, minZ: c, k: k2 }
  }, [P])
  return (
    <svg viewBox="0 0 100 100" className="rmap">
      <polyline points={pts} fill="none" stroke="#1c2450" strokeWidth="6" strokeLinejoin="round" />
      <polyline points={pts} fill="none" stroke="#6f86d8" strokeWidth="2.4" strokeLinejoin="round" />
      {(cars || []).map((c) => <circle key={c.i} cx={(c.x - minX) * k + 6} cy={(c.z - minZ) * k + 6} r={c.me ? 3.6 : 2.4} fill={c.color} stroke={c.me ? '#fff' : 'none'} strokeWidth="1" />)}
    </svg>
  )
}
function RaceTouch() {
  const [touch, setTouch] = useState(false)
  useEffect(() => { try { setTouch(isTouchPrimary()) } catch { /* ignore */ } }, [])
  if (!touch) return null
  const hold = (code) => ({
    onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); engineKey(code, true) },
    onPointerUp: (e) => { e.preventDefault(); engineKey(code, false) },
    onPointerCancel: () => engineKey(code, false),
    onContextMenu: (e) => e.preventDefault(),
  })
  return (
    <div className="touchpad rtouch">
      <div className="rsteer"><button {...hold('ArrowLeft')}>◀</button><button {...hold('ArrowRight')}>▶</button></div>
      <div className="rpedals"><button className="nit" {...hold('ShiftLeft')}>NITRO</button><button className="dft" {...hold('Space')}>DRIFT</button><button className="nit" {...hold('KeyF')}>ITEM</button><button className="brk" {...hold('ArrowDown')}>BRAKE</button><button className="gas" {...hold('ArrowUp')}>GAS</button></div>
    </div>
  )
}
function RaceLobby({ s }) {
  const p = s.profile
  const [track, setTrack] = useState(typeof p.raceTrack === 'number' ? p.raceTrack : 0)
  const [car, setCar] = useState(typeof p.racePick === 'number' ? p.racePick : 0)
  const [laps, setLaps] = useState(3)
  const [diff, setDiff] = useState(2)
  const [ai, setAi] = useState(5)
  const best = p.raceBest || {}
  const T = TRACKS[track], C = CARS[car]
  const [kart, setKart] = useState(!!p.raceKart)
  const go = () => raceActions.start({ track, car, laps, diff, ai, type: 'race', kart })
  const stat = (v, max = 1.5) => <div className="fstat"><div><b style={{ width: Math.min(100, (v / max) * 100) + '%' }} /></div></div>
  return (
    <div className="lobby racelobby">
      <div className="lobbyL">
        <h4>🏁 TURBO RUSH · PICK A TRACK</h4>
        <div className="rtracks">{TRACKS.map((t, i) => (
          <button key={t.id} className={'rtrack ' + (track === i ? 'sel' : '')} style={{ '--c': t.accent }} onClick={() => { setTrack(i); setRacePick(undefined, i) }}>
            <TrackMap ti={i} /><strong>{t.name}</strong><small>{best[i] ? 'BEST ' + fmtT(best[i]) : 'NO LAP YET'}</small>
          </button>))}
        </div>
        <h4>PICK A CAR</h4>
        <div className="rcars">{CARS.map((c) => (
          <button key={c.id} className={'rcar ' + (car === c.id ? 'sel' : '')} style={{ '--c': c.color }} onClick={() => { setCar(c.id); setRacePick(c.id) }}><i /><strong>{c.name}</strong></button>))}
        </div>
        <div className="lobbyopts">
          <div><h4>MODE</h4><div className="chips"><button className={'chip ' + (!kart ? 'sel' : '')} onClick={() => { setKart(false); p.raceKart = false }}>🏁 CLASSIC</button><button className={'chip ' + (kart ? 'sel' : '')} onClick={() => { setKart(true); p.raceKart = true }}>🍌 KART ITEMS</button></div></div>
          <div><h4>LAPS</h4><div className="chips">{[1, 2, 3, 5].map((n) => <button key={n} className={'chip ' + (laps === n ? 'sel' : '')} onClick={() => setLaps(n)}>{n}</button>)}</div></div>
          <div><h4>RIVALS</h4><div className="chips">{[1, 3, 5, 7].map((n) => <button key={n} className={'chip ' + (ai === n ? 'sel' : '')} onClick={() => setAi(n)}>{n} BOTS</button>)}</div></div>
          <div><h4>DIFFICULTY</h4><div className="chips">{['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (diff === i + 1 ? 'sel' : '')} onClick={() => setDiff(i + 1)}>{d}</button>)}</div></div>
        </div>
        <div className="chips"><button className="big" onClick={go}>🏁 START RACE</button><button className="big sec" onClick={() => { setRacePick(car, track); window.dispatchEvent(new CustomEvent('si-open-tab', { detail: kart ? 'online:kart' : 'online:race' })) }}>🌐 INVITE FRIEND</button></div>
        <small className="hint">{kart ? '🍌 KART ITEMS: drive through the rainbow boxes to get an item, press F / Q / SHIFT to use it. Bananas trip, shells home in on the car ahead, the blue shell hunts the leader, stars make you unstoppable, lightning slows everybody else.' : ''}</small>
        <small className="hint">↑/W gas · ↓/S brake · ←→/AD steer · SPACE drift (release for a mini-turbo) · SHIFT/E nitro · R reset car · blue pads boost · green canisters refill nitro</small>
      </div>
      <div className="lobbyR">
        <div className="panel fdetail" style={{ '--el': C.color }}>
          <div className="fdhead"><div className="rcarbig" style={{ '--c': C.color }}><i /></div><div><h4>{C.name}</h4><small>{C.desc}</small></div></div>
          <div className="fstat"><span>TOP SPEED</span><div><b style={{ width: Math.min(100, C.top / 1.15 * 100) + '%', background: '#ff4d4d' }} /></div></div>
          <div className="fstat"><span>ACCEL</span><div><b style={{ width: Math.min(100, C.acc / 1.2 * 100) + '%', background: '#ffe84a' }} /></div></div>
          <div className="fstat"><span>HANDLING</span><div><b style={{ width: Math.min(100, C.han / 1.15 * 100) + '%', background: '#3de8ff' }} /></div></div>
          <div className="fstat"><span>GRIP</span><div><b style={{ width: Math.min(100, C.grip / 1.2 * 100) + '%', background: '#3dff7a' }} /></div></div>
          <div className="fstat"><span>NITRO</span><div><b style={{ width: Math.min(100, C.nitro / 1.5 * 100) + '%', background: '#ff4de1' }} /></div></div>
          <small className="hint">{T.desc}</small>
        </div>
        <div className="panel"><h4>MY RACING</h4><div className="kv"><span>RACES</span><b>{p.raceRaces || 0}</b><span>WINS</span><b>{p.raceWins || 0}</b><span>PODIUMS</span><b>{p.racePodiums || 0}</b></div></div>
        <TopPlayers s={s} initial="race" compact fixed />
      </div>
    </div>
  )
}
function RaceHUD() {
  const g = useSyncExternalStore(subscribeRace, getRaceSnap)
  if (!g) return null
  const m = g.me
  return (
    <div className="hud rhud">
      {g.phase !== 'results' && m && (
        <>
          <div className="rpos"><b>{m.pos}</b><span>/{m.total}</span><small>POSITION</small></div>
          <div className="rlap"><div>LAP <b>{m.lap}</b>/{g.laps}</div><small>{fmtT(m.lapTime)}</small><small>BEST {fmtT(m.best)}</small></div>
          <div className="rmapbox"><TrackMap ti={g.track} cars={g.map} /></div>
          {g.kart && <div className={'ritem' + (m.item ? ' has' : '')}><b>{m.item ? ({ boost: '🚀', triple: '🚀', banana: '🍌', shell: '🔴', blue: '🔵', star: '⭐', bolt: '⚡' })[m.item] : '❔'}</b>{m.item === 'triple' && <em>x{m.itemN}</em>}<small>ITEM · F</small></div>}
          <div className="rboard">{g.board.slice(0, 6).map((c, i) => <div key={c.i} className={c.human ? 'me' : ''}><i style={{ background: c.color }} />{i + 1}. {c.name}</div>)}</div>
          <div className="rspeed"><strong>{m.kmh}</strong><span>KM/H</span>
            <div className="rbars"><div className="rn"><i style={{ width: m.nitro + '%' }} /><em>NITRO</em></div><div className="rd"><i style={{ width: m.charge * 100 + '%' }} className={m.charge >= 1 ? 'full' : ''} /><em>DRIFT</em></div></div>
          </div>
          {g.count > 0 && <div className="rcount" key={g.count}>{g.count > 3 ? 'READY' : g.count}</div>}
          {g.msg && <div className="rmsg" key={g.msg.text} style={{ color: g.msg.color || '#ffe84a' }}><h1>{g.msg.text}</h1>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
          {m.wrong && <div className="rwrong">⚠ WRONG WAY</div>}
          {m.off && <div className="roff">OFF ROAD</div>}
          {m.boost && <div className="rboostfx" />}
          <div className="pctl">↑ GAS · ↓ BRAKE · ←→ STEER · SPACE DRIFT · SHIFT NITRO · R RESET · P PAUSE</div>
          <RaceTouch />
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={raceActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('race')}>❓ HOW TO PLAY</button><button className="big sec" onClick={raceActions.quit}>QUIT TO MENU</button></div>}
      {g.phase === 'results' && g.results && (
        <div className="screen victory">
          <h1 className="gold">{g.results.pos === 1 ? '🏆 YOU WIN!' : g.results.pos <= 3 ? '🥇 PODIUM FINISH!' : `FINISHED ${g.results.pos}/${g.results.total}`}</h1>
          <ul>
            {g.results.rows.slice(0, 8).map((r, i) => <li key={r.i} style={{ borderColor: r.color }} className={r.human ? 'bonus' : ''}><span>{i + 1}. {r.name}</span><b>{r.t ? fmtT(r.t) : 'DNF'}</b></li>)}
            <li><span>YOUR BEST LAP</span><b>{fmtT(g.results.best)}{g.results.record ? ' 🆕 RECORD!' : ''}</b></li>
            {g.results.score !== undefined && <li className="bonus"><span>SCORE</span><b>{g.results.score.toLocaleString()}</b></li>}
          </ul>
          <div className="overboard"><TopPlayersMini game="race" /></div>
          <button className="big" onClick={raceActions.rematch}>↻ RACE AGAIN</button>
          <button className="big sec" onClick={raceActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

// ---------- IRON FISTS (fighting game) ----------
function FighterFace({ c, size = 44, sel = '' }) {
  return (
    <div className={'ffig ' + sel} style={{ '--skin': c.skin, '--hair': c.hair, '--top': c.top, '--trim': c.trim, '--el': ELS[c.element].color, width: size, height: size }}>
      <i className={'hair ' + c.hairStyle} /><i className="head" /><i className="eyes" /><i className="body" />{c.acc === 'mask' && <i className="mask" />}{c.acc === 'visor' && <i className="visor" />}{c.acc === 'headband' && <i className="hband" />}
    </div>
  )
}
function Stat({ label, v, max = 100, color }) { return <div className="fstat"><span>{label}</span><div><b style={{ width: Math.min(100, (v / max) * 100) + '%', background: color }} /></div></div> }
function FightLobby({ s }) {
  const p = s.profile
  const beaten = p.fightBeaten || {}
  const [mine, setMine] = useState(typeof p.fightPick === 'number' ? p.fightPick : 0)
  const [opp, setOpp] = useState('random')
  const [target, setTarget] = useState('you')
  const [mode, setMode] = useState('cpu')
  const [diff, setDiff] = useState(2)
  const [rounds, setRounds] = useState(2)
  const c = ROSTER[mine]
  const o = opp === 'random' ? null : ROSTER[opp]
  const show = target === 'you' ? c : (o || c)
  const pick = (id) => { if (target === 'you') { setMine(id); setFightPick(id) } else setOpp(id) }
  const go = () => fightActions.start({ type: mode, p1: mine, p2: mode === 'demo' ? 'random' : opp, diff, rounds })
  return (
    <div className="lobby fightlobby">
      <div className="lobbyL">
        <h4>🥊 IRON FISTS · 40 FIGHTERS · {Object.keys(beaten).length}/40 BEATEN</h4>
        <div className="chips">
          {[['cpu', 'VS CPU'], ['2p', '2 PLAYERS'], ['demo', 'WATCH CPU vs CPU']].map(([k, l]) => <button key={k} className={'chip ' + (mode === k ? 'sel' : '')} onClick={() => setMode(k)}>{l}</button>)}
          <span className="sep" />
          {['EASY', 'MEDIUM', 'HARD'].map((d, i) => <button key={d} className={'chip ' + (diff === i + 1 ? 'sel' : '')} onClick={() => setDiff(i + 1)}>{d}</button>)}
          <span className="sep" />
          {[1, 2, 3].map((r) => <button key={r} className={'chip ' + (rounds === r ? 'sel' : '')} onClick={() => setRounds(r)}>FIRST TO {r}</button>)}
        </div>
        <div className="chips">
          <button className={'chip ' + (target === 'you' ? 'sel' : '')} onClick={() => setTarget('you')}>PICK YOUR FIGHTER</button>
          <button className={'chip ' + (target === 'opp' ? 'sel' : '')} onClick={() => setTarget('opp')}>PICK THE OPPONENT {opp === 'random' ? '(RANDOM)' : '(' + ROSTER[opp].name + ')'}</button>
          {opp !== 'random' && <button className="chip" onClick={() => setOpp('random')}>🎲 RANDOM</button>}
        </div>
        <div className="fgrid">
          {ROSTER.map((r) => (
            <button key={r.id} className={'ftile ' + (mine === r.id ? 'p1 ' : '') + (opp === r.id ? 'p2 ' : '') + (beaten[r.id] ? 'beat' : '')} style={{ '--el': ELS[r.element].color }} onClick={() => pick(r.id)} title={`${r.name} · ${r.styleName} · ${ELS[r.element].name}`}>
              <FighterFace c={r} size={40} /><small>{r.name}</small>{beaten[r.id] && <b className="chk">✓</b>}
            </button>
          ))}
        </div>
        <div className="chips">
          <button className="big" onClick={go}>🥊 {mode === 'demo' ? 'WATCH' : 'FIGHT'}!</button>
          <button className="big sec" onClick={() => { setFightPick(mine); window.dispatchEvent(new CustomEvent('si-open-tab', { detail: 'online:fight' })) }}>🌐 INVITE FRIEND</button>
        </div>
        <small className="hint">P1: A/D move · W jump · S crouch · J K punch · U I kick · L special · O super (full meter) &nbsp;|&nbsp; P2: arrows · N M punch · , . kick · / special · Right Shift super. Hold back to block. Online: use WASD or arrows.</small>
      </div>
      <div className="lobbyR">
        <div className="panel fdetail" style={{ '--el': ELS[show.element].color }}>
          <div className="fdhead"><FighterFace c={show} size={86} /><div><h4>{show.name}</h4><small>{show.styleName} · {ELS[show.element].name}</small><small>{show.tag}</small></div></div>
          <Stat label="HEALTH" v={show.hp} max={140} color="#3dff7a" />
          <Stat label="SPEED" v={show.spd * 100} max={125} color="#3de8ff" />
          <Stat label="POWER" v={show.pow * 100} max={130} color="#ff4d4d" />
          <Stat label="REACH" v={show.reach * 100} max={130} color="#ffe84a" />
          <div className="fmoves">
            <div><b>L · SPECIAL</b> <em style={{ color: ELS[show.element].color }}>{show.special.name}</em><small>{show.special.tip} · {show.special.dmg} dmg · {show.special.cd}s cooldown</small></div>
            <div><b>O · SUPER</b> <em style={{ color: ELS[show.element].color }}>{show.super.name}</em><small>{show.super.tip} · {show.super.dmg} dmg · needs a full meter</small></div>
          </div>
          <div className="fmovelist"><h5>COMMAND LIST (P1 = J · P2 = K · K1 = U · K2 = I; F = forward, B = back, D = down)</h5>{show.movelist.map((mv) => <div key={mv.input}><b>{mv.input}</b><span>{mv.name}</span><small>{mv.tags.join(' · ')} · {mv.dmg}</small></div>)}</div>
        </div>
        <div className="panel"><h4>MY RECORD</h4><div className="kv"><span>FIGHTS</span><b>{p.fightGames || 0}</b><span>WINS</span><b>{p.fightWins || 0}</b><span>FIGHTERS BEATEN</span><b>{Object.keys(beaten).length}/40</b></div></div>
      </div>
    </div>
  )
}
function FightTouch() {
  const [touch, setTouch] = useState(false)
  useEffect(() => { try { setTouch(isTouchPrimary()) } catch { /* ignore */ } }, [])
  if (!touch) return null
  const hold = (code) => ({
    onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); engineKey(code, true) },
    onPointerUp: (e) => { e.preventDefault(); engineKey(code, false) },
    onPointerCancel: () => engineKey(code, false),
    onContextMenu: (e) => e.preventDefault(),
  })
  return (
    <div className="touchpad ftouch">
      <div className="dpad"><button className="up" {...hold('KeyW')}>▲</button><button className="lf" {...hold('KeyA')}>◀</button><button className="rt" {...hold('KeyD')}>▶</button><button className="dn" {...hold('KeyS')}>▼</button></div>
      <div className="fbtns6">
        <button {...hold('KeyJ')}>LP</button><button {...hold('KeyK')}>HP</button><button {...hold('KeyL')} className="spc">SP</button>
        <button {...hold('KeyU')}>LK</button><button {...hold('KeyI')}>HK</button><button {...hold('KeyO')} className="sup">SU</button>
      </div>
    </div>
  )
}
function FightHUD() {
  const g = useSyncExternalStore(subscribeFight, getFightSnap)
  const [portrait, setPortrait] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const f = () => { try { setPortrait(window.innerHeight > window.innerWidth && (isTouchPrimary())) } catch { /* ignore */ } }
    f(); window.addEventListener('resize', f); window.addEventListener('orientationchange', f)
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f) }
  }, [])
  if (!g) return null
  const [a, b] = g.f
  const bar = (f, right) => (
    <div className={'fbar ' + (right ? 'r' : '')} style={{ '--c': f.color }}>
      <div className="fname"><b>{f.name}</b><small>{f.style} · {f.element.toUpperCase()}</small></div>
      <div className="hp"><i style={{ width: (f.hp / f.max) * 100 + '%' }} /></div>
      <div className="mt"><i className={f.meter >= 100 ? 'full' : ''} style={{ width: f.meter + '%' }} /><span>{f.meter >= 100 ? 'SUPER READY!' : 'SUPER'}</span></div>
      <div className="sp"><i style={{ width: (f.spCd > 0 ? (1 - f.spCd / f.spMax) : 1) * 100 + '%' }} /><span>{f.spCd > 0 ? f.sp : f.sp + ' READY'}</span></div>
    </div>
  )
  const pips = (w, right) => <div className={'fpips ' + (right ? 'r' : '')}>{Array.from({ length: g.rounds }, (_, i) => <i key={i} className={i < w ? 'on' : ''} />)}</div>
  return (
    <div className="hud fhud">
      {g.mode !== 'over' && (
        <>
          <div className="ftop">{bar(a, false)}<div className="ftimer"><strong>{g.timer}</strong><small>ROUND {g.round}</small></div>{bar(b, true)}</div>
          <div className="fpiprow">{pips(g.wins[0], false)}<span>{g.type === 'online' ? 'ONLINE' : g.diff}</span>{pips(g.wins[1], true)}</div>
          {a.combo > 1 && <div className="fcombo l" key={a.combo}>{a.combo} HITS!</div>}
          {b.combo > 1 && <div className="fcombo r" key={'b' + b.combo}>{b.combo} HITS!</div>}
          {g.say && <div className="fsay" key={g.say.id} style={{ color: g.say.color, textShadow: `0 0 18px ${g.say.color}` }}>{g.say.text}</div>}
          {g.msg && <div className="fmsg" key={g.msg.text + g.round} style={{ color: g.msg.color, textShadow: `0 0 26px ${g.msg.color}` }}><h1>{g.msg.text}</h1>{g.msg.sub && <p>{g.msg.sub}</p>}</div>}
          {g.cine && <div className="fcine" style={{ '--c': g.cine.color }}><div className="band" /><h1>{g.cine.name}</h1><small>{g.f[g.cine.owner].name}</small></div>}
          <div className="pctl">{g.type === 'online' ? 'WASD/ARROWS MOVE · J K U I ATTACK · L SPECIAL · O SUPER · HOLD BACK TO BLOCK' : g.type === '2p' ? 'P1: WASD · J K U I · L · O   |   P2: ARROWS · N M , . · / · R-SHIFT' : 'WASD MOVE · J K PUNCH · U I KICK · L SPECIAL · O SUPER · P PAUSE'}</div>
          <FightTouch />
          {portrait && !dismissed && <div className="rotatefull"><div className="rot">📱</div><h2>TURN YOUR PHONE SIDEWAYS</h2><p>Fighting games need the wide screen.</p><button className="big sec" onClick={() => setDismissed(true)}>PLAY ANYWAY</button></div>}
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={fightActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('fight')}>❓ HOW TO PLAY</button><button className="big sec" onClick={fightActions.quit}>QUIT TO MENU</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className="gold">{g.over.left ? 'OPPONENT LEFT: YOU WIN!' : g.type === 'cpu' ? (g.over.human ? 'YOU WIN!' : 'YOU LOSE') : g.over.name + ' WINS!'}</h1>
          <ul>
            <li><span>WINNER</span><b style={{ color: ELS[g.over.element].color }}>{g.over.name}</b></li>
            <li><span>ROUNDS</span><b>{g.over.wins[0]} - {g.over.wins[1]}</b></li>
            <li><span>BIGGEST COMBO</span><b>{g.over.stats.maxCombo}</b></li>
            <li><span>SPECIALS / SUPERS</span><b>{g.over.stats.specials} / {g.over.stats.supers}</b></li>
          </ul>
          <button className="big" onClick={fightActions.rematch}>↻ REMATCH</button>
          <button className="big sec" onClick={fightActions.quit}>CHARACTER SELECT</button>
        </div>
      )}
    </div>
  )
}

function Notices({ list }) {
  if (!list || !list.length) return null
  return <div className="notices">{list.map((n) => <div key={n.id} className="notice" style={{ borderColor: n.color, color: n.color }}>{n.text}</div>)}</div>
}
function DailyPanel({ q }) {
  if (!q) return null
  const amt = 100 + 50 * Math.min(q.streak - 1, 6)
  return (
    <div className="panel daily">
      <div className="dailyhead"><h4>📅 DAILY QUESTS</h4><span className="streak2">🔥 {q.streak} DAY STREAK</span>
        <button className={'chip ' + (q.bonusClaimed ? '' : 'sel pulsebtn')} disabled={q.bonusClaimed} onClick={claimDaily}>{q.bonusClaimed ? '✓ BONUS CLAIMED' : `CLAIM DAILY BONUS +${amt} 🪙`}</button></div>
      <div className="quests">
        {q.list.map((x) => (
          <div key={x.id} className={'quest' + (x.done ? ' done' : '')}>
            <span>{x.done ? '✅' : '🎯'} {x.desc}</span>
            <div className="bar"><b style={{ width: (x.value / x.goal) * 100 + '%' }} /></div>
            <em>{x.value}/{x.goal} · +{x.reward} 🪙</em>
          </div>
        ))}
      </div>
    </div>
  )
}

function GameCard({ cls, title, tag, hi, hiLabel, art, onPlay, label, sub, onInvite, extra }) {
  return (
    <div className={'gcard ' + cls}>
      <h4>{title}</h4>
      <small>{tag}</small>
      <div className="gart">{art}</div>
      <div className="kv"><span>{hiLabel}</span><b>{hi}</b>{sub}</div>
      {extra}
      <button className="big" onClick={onPlay}>{label}</button>
      {onInvite && <button className="big sec" onClick={onInvite}>🌐 INVITE FRIEND</button>}
    </div>
  )
}

function Hub({ s }) {
  const [tab, setTab] = useState('home')
  const [cat, setCat] = useState('all')
  const [ogame, setOgame] = useState('tetris')
  useEffect(() => { const h = (e) => { const [t, g] = String(e.detail || '').split(':'); if (g) setOgame(g); if (t) setTab(t) }; window.addEventListener('si-open-tab', h); return () => window.removeEventListener('si-open-tab', h) }, [])
  useEffect(() => { try { if (new URLSearchParams(location.search).get('join')) setTab('online') } catch { /* ignore */ } }, [])
  const [pmode, setPmode] = useState('bot')
  const [pdiff, setPdiff] = useState(2)
  const [ptarget, setPtarget] = useState(11)
  const [bmode, setBmode] = useState('ffa')
  const [bdiff, setBdiff] = useState(2)
  const [brounds, setBrounds] = useState(3)
  const [tmode, setTmode] = useState('marathon')
  const [tdiff, setTdiff] = useState(2)
  const [tlevel, setTlevel] = useState(1)
  const [cmode, setCmode] = useState('classic')
  const [clevel, setClevel] = useState(1)
  const p = s.profile
  const xp = xpOf(p)
  let ri = 0
  RANKS.forEach(([x], i) => { if (xp >= x) ri = i })
  const next = RANKS[ri + 1]
  const pct = next ? ((xp - RANKS[ri][0]) / (next[0] - RANKS[ri][0])) * 100 : 100
  const doneAch = ACH.filter(([, , g, goal]) => g(p, s.unlocked) >= goal).length
  const GAME_TABS = { pickle: '🏓 PICKLEBALL', bomber: '💣 BOMBER', tetris: '🧱 TETRIS', chomp: '🟡 CHOMP', cards: '🃏 CARDS', race: '🏁 RACE', fight: '🥊 FIGHT', flames: '🔥 FLAMES', hockey: '🏒 AIR HOCKEY', pool: '🎱 BILLIARDS', td: '🛡 DEFENSE', rogue: '🗡 DEPTHS', rhythm: '🎵 BEAT', word: '🔤 WORD HUNT', merge: '🔢 2048', c4: '🔴 CONNECT 4', snake: '🐍 SNAKE', breaker: '🧱 BREAKER', mines: '💣 SWEEP', empire: '🏰 EMPIRE', ssx: '🏂 SNOW RUSH', orb: '🔮 ORB RUSH' }
  // the tab bar stays short: dashboard, the game you opened (if any), and the utility tabs. Games are opened from the dashboard cards.
  const TABS = [['home', 'DASHBOARD'], ...(GAME_TABS[tab] ? [[tab, GAME_TABS[tab]]] : []), ['online', '🌐 ONLINE'], ['story', '📖 STORY'], ['top', '🏆 TOP PLAYERS'], ['ship', 'CUSTOMIZE SHIP'], ['levels', 'SPACE LEVELS'], ['skills', 'CONTROLS'], ['settings', '⚙ SETTINGS'], ['awards', `AWARDS ${doneAch}/${ACH.length}`]]
  const CATS = [['all', 'ALL GAMES'], ['action', '⚔ ACTION'], ['sports', '🏅 SPORTS'], ['strategy', '🧠 STRATEGY'], ['puzzle', '🧩 PUZZLE'], ['cards', '🃏 CARDS'], ['music', '🎵 MUSIC']]
  const show = (...c) => cat === 'all' || c.includes(cat)
  return (
    <div className="screen hub">
      <div className="hubtop">
        <div className="logo2"><img className="logoimg" src="/logo.svg" alt="My Space Arcade" /></div>
        <div className="tabs">{TABS.map(([k, n]) => <button key={k} className={'tab ' + (tab === k ? 'sel' : '')} onClick={() => setTab(k)}>{n}</button>)}</div>
        <SoundBtn />
        <button className="tab" title="Fullscreen" onClick={() => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen() } catch { /* ignore */ } }}>⛶</button>
      </div>
      <AudioNotice />
      {tab === 'home' && (
        <>
          <JoinBar name={p.name} onJoined={() => setTab('online')} />
          <div className="catchips">{CATS.map(([k, n]) => <button key={k} className={'chip ' + (cat === k ? 'sel' : '')} onClick={() => setCat(k)}>{n}</button>)}</div>
          <div className="cards4">
            {show('action') && <GameCard cls="space" title="🚀 SPACE IMPACT: NEON" tag="10 levels · 10 bosses · squad of 3 ships" hiLabel="HI-SCORE" hi={p.spaceHi.toLocaleString()}
              art={<ShipPreview ship={p.ship} />} label="▶ PLAY" onPlay={startGame} onInvite={() => { setOgame('space'); setTab('online') }}
              extra={<div className="squadsel"><div className="sqrow"><small>TEAM</small>{[[0, 'SOLO'], [1, 'DUO'], [2, 'TRIO']].map(([n, l]) => <button key={n} className={'chip ' + ((s.squadSize === n) ? 'sel' : '')} onClick={() => setSquad(n, s.squadHuman, s.squadBots)}>{l}</button>)}<button className={'chip ic ' + (s.squadHuman ? 'sel' : '')} disabled={s.squadSize < 1} onClick={() => setSquad(s.squadSize, !s.squadHuman, s.squadBots)} title="A friend flies a ship on this keyboard: arrows + Enter">👥</button><button className={'chip ic ' + (s.squadBots ? 'sel' : '')} disabled={s.squadSize < 1} onClick={() => setSquad(s.squadSize, s.squadHuman, !s.squadBots)} title="Fill empty team slots with AI wingmen">🤖</button></div><small className="dim">{s.squadSize === 0 ? 'Flying solo' : s.squadBots ? 'AI flies empty slots' : '👥 same keyboard · 🤖 AI · or invite friends'}</small></div>}
              sub={<><span>LEVELS</span><b>{s.unlocked + 1}/10</b></>} />}
            {show('strategy', 'action') && <GameCard cls="empire" title="🏰 EMPIRE RISE" tag="Village to empire · raiders · up to 4 kingdoms online" hiLabel="RANK" hi={['VILLAGE', 'VILLAGE', 'TOWN', 'CITY', 'EMPIRE'][p.empireHall || 1]}
              art={<div className="miniEmpire"><span>🏠</span><span>🏰</span><span>🗽</span></div>} label="BUILD KINGDOM ▶" onPlay={() => setTab('empire')} onInvite={() => { setOgame('empire'); setTab('online') }}
              sub={<><span>VICTORIES</span><b>{p.empireWins || 0}</b></>} />}
            {show('cards') && <GameCard cls="cards" title="🃏 CARD ROOM" tag="UNO · Pusoy Dos · Lucky 9 · Tong-its" hiLabel="CHIPS" hi={'🪙 ' + Number(p.chips || 0).toLocaleString()}
              art={<div className="miniCards"><i>♥</i><i>♠</i><i>9</i><i>+2</i></div>} label="SELECT GAME ▶" onPlay={() => setTab('cards')} onInvite={() => { setOgame('uno'); setTab('online') }}
              sub={<><span>WON</span><b>{p.cardWins || 0}</b></>} />}
            {show('action') && <GameCard cls="slug" title="🪖 OPERATION GROUND ZERO" tag="Run & gun · POWs · tank · 3 bosses" hiLabel="HI-SCORE" hi={p.slugHi.toLocaleString()}
              art={<SpriteArt scene={[[SP.palm, 22, false, 3], [SP.vsv, 110, false, 3], [SP.heroS, 66, false, 4], [SP.solS, 178, true, 4], [SP.runS, 206, true, 4]]} />} label="▶ PLAY" onPlay={() => slugActions.start(0)}
              sub={<><span>WINS</span><b>{p.slugWins}</b></>} />}
            {show('sports') && <GameCard cls="pickle" title="🏓 PICKLEBALL" tag="Bots · 1v1 · 2v2 · real rules" hiLabel="WINS" hi={p.pickleWins || 0}
              art={<div className="miniCourt"><i className="net" /><i className="ball" /><b className="pa">🧍</b><b className="pb">🤖</b></div>} label="SELECT MODE ▶" onPlay={() => setTab('pickle')} onInvite={() => { setOgame('pickle'); setTab('online') }}
              sub={<><span>ACES</span><b>{p.aces || 0}</b></>} />}
            {show('action') && <GameCard cls="bomber" title="💣 BOMBER BLAST" tag="Battle arena · bots · 1v1 · 2v2" hiLabel="WINS" hi={p.bomberWins || 0}
              art={<MiniBomber />} label="SELECT MODE ▶" onPlay={() => setTab('bomber')} onInvite={() => { setOgame('bomber'); setTab('online') }}
              sub={<><span>BLOCKS</span><b>{p.bricks || 0}</b></>} />}
            {show('puzzle') && <GameCard cls="tetris" title="🧱 TETRA BLAST" tag="Solo · 1v1 vs bot · 2P · T-spins" hiLabel="LINES" hi={p.tetrisLines || 0}
              art={<MiniTetris />} label="SELECT MODE ▶" onPlay={() => setTab('tetris')} onInvite={() => { setOgame('tetris'); setTab('online') }}
              sub={<><span>TETRISES</span><b>{p.tetrises || 0}</b></>} />}
            {show('action','puzzle') && <GameCard cls="chomp" title="🟡 MAZE CHOMP" tag="Ghosts · pellets · fruit · co-op" hiLabel="BEST" hi={(p.chompHi || 0).toLocaleString()}
              art={<MiniChomp />} label="SELECT MODE ▶" onPlay={() => setTab('chomp')}
              sub={<><span>GHOSTS</span><b>{p.chompGhosts || 0}</b></>} />}
            {show('sports','action') && <GameCard cls="race" title="🏁 TURBO RUSH" tag="5 tracks · 6 cars · drift · nitro" hiLabel="WINS" hi={p.raceWins || 0}
              art={<div className="miniRace"><span>🏎️</span><b>💨</b></div>} label="START ENGINES ▶" onPlay={() => setTab('race')} onInvite={() => { setOgame('race'); setTab('online') }}
              sub={<><span>RACES</span><b>{p.raceRaces || 0}</b></>} />}
            {show('action','sports') && <GameCard cls="fight" title="🥊 IRON FISTS" tag="40 fighters · specials · supers · 1v1" hiLabel="WINS" hi={p.fightWins || 0}
              art={<div className="miniFight"><span>🥋</span><b>VS</b><span>🥷</span></div>} label="CHOOSE FIGHTER ▶" onPlay={() => setTab('fight')} onInvite={() => { setOgame('fight'); setTab('online') }}
              sub={<><span>BEATEN</span><b>{Object.keys(p.fightBeaten || {}).length}/40</b></>} />}
            {show('puzzle') && <GameCard cls="flames" title="🔥 FLAMES" tag="Friends · Lovers · Affection · Marriage · Enemies · Siblings" hiLabel="TRIED" hi={p.flamesGames || 0}
              art={<div className="miniFlames"><i>F</i><i>L</i><i>A</i><i>M</i><i>E</i><i>S</i></div>} label="PLAY FLAMES ▶" onPlay={() => setTab('flames')}
              sub={<><span>LAST</span><b>{(p.flamesHistory && p.flamesHistory[0]) ? FOUT[p.flamesHistory[0].r].word : '-'}</b></>} />}
            {show('puzzle', 'sports') && <GameCard cls="c4" title="🔴 CONNECT FOUR" tag="Bot · 2P · online 1v1" hiLabel="WINS" hi={p.c4Wins || 0}
              art={<div className="miniC4"><i /><i /><i /><i /><i /></div>} label="SELECT MODE ▶" onPlay={() => setTab('c4')} onInvite={() => { setOgame('c4'); setTab('online') }}
              sub={<><span>GAMES</span><b>{p.c4Games || 0}</b></>} />}
            {show('action') && <GameCard cls="snake" title="🐍 NEON SNAKE" tag="Solo · vs bot · 2 players" hiLabel="BEST" hi={p.snakeBest || 0}
              art={<div className="miniSnake"><i /><i /><i /><i /><b>🍎</b></div>} label="SELECT MODE ▶" onPlay={() => setTab('snake')}
              sub={<><span>GAMES</span><b>{p.snakeGames || 0}</b></>} />}
            {show('puzzle', 'action') && <GameCard cls="orb" title="🔮 ORB RUSH" tag="Marble shooter · 10 levels · online versus" hiLabel="BEST" hi={fmtN(p.orbBest || 0)}
              art={<div className="miniOrb"><i /><i /><i /><i /><b>🐸</b></div>} label="PLAY ▶" onPlay={() => setTab('orb')} onInvite={() => { setOgame('orb'); setTab('online') }}
              sub={<><span>VS WINS</span><b>{p.orbWins || 0}</b></>} />}
            {show('action', 'sports') && <GameCard cls="ssx" title="🏂 SNOW RUSH" tag="3D snowboarding · race · tricks · rails" hiLabel="BEST" hi={fmtN(p.ssxBest || 0)}
              art={<div className="miniSsx"><i /><b>🏂</b></div>} label="DROP IN ▶" onPlay={() => setTab('ssx')}
              sub={<><span>WINS</span><b>{p.ssxWins || 0}</b></>} />}
            {show('action') && <GameCard cls="breaker" title="🧱 NEON BREAKER" tag="5 levels · power-ups" hiLabel="BEST" hi={fmtN(p.breakerBest || 0)}
              art={<div className="miniBreaker"><i /><i /><i /><i /><i /><i /></div>} label="PLAY ▶" onPlay={() => setTab('breaker')}
              sub={<><span>GAMES</span><b>{p.breakerGames || 0}</b></>} />}
            {show('puzzle') && <GameCard cls="mines" title="💣 MINE SWEEP" tag="3 boards · flags · chording" hiLabel="CLEARED" hi={p.minesWins || 0}
              art={<div className="miniMines"><i>1</i><i>2</i><i>🚩</i><i>1</i></div>} label="PLAY ▶" onPlay={() => setTab('mines')}
              sub={<><span>GAMES</span><b>{p.minesGames || 0}</b></>} />}
            {show('sports') && <GameCard cls="hockey" title="🏒 AIR HOCKEY" tag="Neon table · bot · 2P · online" hiLabel="WINS" hi={p.hockeyWins || 0}
              art={<div className="miniHockey"><i className="puck" /><b className="ma" /><b className="mb" /></div>} label="SELECT MODE ▶" onPlay={() => setTab('hockey')} onInvite={() => { setOgame('hockey'); setTab('online') }}
              sub={<><span>MATCHES</span><b>{p.hockeyGames || 0}</b></>} />}
            {show('sports') && <GameCard cls="pool" title="🎱 BILLIARDS" tag="8-ball · bot · 2P · online" hiLabel="WINS" hi={p.poolWins || 0}
              art={<div className="miniPool"><i /><i /><i /><i /><i /><u /></div>} label="SELECT MODE ▶" onPlay={() => setTab('pool')} onInvite={() => { setOgame('pool'); setTab('online') }}
              sub={<><span>POTTED</span><b>{p.poolPots || 0}</b></>} />}
            {show('strategy') && <GameCard cls="td" title="🛡 NEON DEFENSE" tag="3 maps · 6 towers · 25 waves" hiLabel="BEST WAVE" hi={(p.tdBest || 0) + '/25'}
              art={<div className="miniTd"><i /><i /><i /><b>🛡</b></div>} label="SELECT MAP ▶" onPlay={() => setTab('td')}
              sub={<><span>VICTORIES</span><b>{p.tdWins || 0}</b></>} />}
            {show('strategy', 'action') && <GameCard cls="rogue" title="🗡 NEON DEPTHS" tag="3D roguelike · co-op · story · bosses" hiLabel="DEEPEST" hi={(p.rogueDeep || 0) + '/12'}
              art={<div className="miniRogue"><span>🗡</span><b>👾</b><span>💎</span></div>} label="CHOOSE HERO ▶" onPlay={() => setTab('rogue')} onInvite={() => { setOgame('rogue'); setTab('online') }}
              sub={<><span>RUNS</span><b>{p.rogueRuns || 0}</b></>} />}
            {show('music') && <GameCard cls="rhythm" title="🎵 NEON BEAT" tag="4 lanes · 5 songs · hold notes" hiLabel="PLAYED" hi={p.rhythmPlays || 0}
              art={<div className="miniBeat"><i /><i /><i /><i /></div>} label="PICK A SONG ▶" onPlay={() => setTab('rhythm')}
              sub={<><span>FULL COMBOS</span><b>{p.rhythmFC || 0}</b></>} />}
            {show('puzzle') && <GameCard cls="word" title="🔤 WORD HUNT" tag="Daily word · English + Filipino" hiLabel="STREAK" hi={(p.word && p.word.streak) || 0}
              art={<div className="miniWord"><i className="g">W</i><i className="y">O</i><i>R</i><i className="g">D</i><i>S</i></div>} label="PLAY ▶" onPlay={() => setTab('word')}
              sub={<><span>WON</span><b>{(p.word && p.word.wins) || 0}</b></>} />}
            {show('puzzle') && <GameCard cls="merge" title="🔢 2048 MERGE" tag="Swipe · undo · hammer · 3 sizes" hiLabel="BIGGEST" hi={p.mergeMax || 0}
              art={<div className="miniMerge"><i>2</i><i>4</i><i>8</i><i>16</i></div>} label="PLAY ▶" onPlay={() => setTab('merge')}
              sub={<><span>GAMES</span><b>{p.mergeGames || 0}</b></>} />}
            {cat === 'all' && <GameCard cls="topcard" title="🏆 TOP PLAYERS" tag="Global leaderboards for every game" hiLabel="YOUR RANK" hi={RANKS[ri][1]}
              art={<div className="miniPodium"><i>🥈</i><i>🥇</i><i>🥉</i></div>} label="SEE LEADERBOARDS ▶" onPlay={() => setTab('top')}
              sub={<><span>XP</span><b>{xp.toLocaleString()}</b></>} />}
            {cat === 'all' && <GameCard cls="shipcard" title="🛠 CUSTOMIZE SHIP" tag="Models · paints · trails · bullets" hiLabel="MODEL" hi={'#' + ((p.ship.model || 0) + 1)}
              art={<ShipPreview ship={p.ship} />} label="OPEN HANGAR ▶" onPlay={() => setTab('ship')}
              sub={<><span>PAINT</span><b>#{(p.ship.paint || 0) + 1}</b></>} />}
          </div>
          <DailyPanel q={s.quests} />
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
      {tab === 'race' && <RaceLobby s={s} />}
      {tab === 'hockey' && <HockeyLobby s={s} TopPlayers={TopPlayers} onInvite={() => { setOgame('hockey'); setTab('online') }} />}
      {tab === 'pool' && <PoolLobby s={s} TopPlayers={TopPlayers} onInvite={() => { setOgame('pool'); setTab('online') }} />}
      {tab === 'td' && <TdLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'rogue' && <RogueLobby s={s} TopPlayers={TopPlayers} onInvite={() => { setOgame('rogue'); setTab('online') }} />}
      {tab === 'rhythm' && <RhythmLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'word' && <WordLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'merge' && <MergeLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'empire' && <EmpireLobby s={s} TopPlayers={TopPlayers} onInvite={() => { setOgame('empire'); setTab('online') }} />}
      {tab === 'c4' && <C4Lobby s={s} TopPlayers={TopPlayers} onInvite={() => { setOgame('c4'); setTab('online') }} />}
      {tab === 'snake' && <SnakeLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'orb' && <OrbLobby s={s} TopPlayers={TopPlayers} onInvite={() => { setOgame('orb'); setTab('online') }} />}
      {tab === 'ssx' && <SsxLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'breaker' && <BreakerLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'mines' && <MinesLobby s={s} TopPlayers={TopPlayers} />}
      {tab === 'fight' && <FightLobby s={s} />}
      {tab === 'flames' && <FlamesLobby s={s} />}
      {tab === 'cards' && <CardRoomLobby s={s} onOnline={(g) => { setOgame(g || 'uno'); setTab('online') }} />}
      {tab === 'online' && <OnlineLobby s={s} TopPlayers={TopPlayers} initGame={ogame} />}
      {tab === 'chomp' && <ChompLobby s={s} mode={cmode} setMode={setCmode} level={clevel} setLevel={setClevel} />}
      {tab === 'tetris' && <TetrisLobby s={s} mode={tmode} setMode={setTmode} diff={tdiff} setDiff={setTdiff} level={tlevel} setLevel={setTlevel} />}
      {tab === 'bomber' && <BomberLobby s={s} mode={bmode} setMode={setBmode} diff={bdiff} setDiff={setBdiff} rounds={brounds} setRounds={setBrounds} />}
      {tab === 'story' && <StoryTab s={s} />}
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
  const GAMES = [['space', 'SPACE IMPACT'], ['slug', 'GROUND ZERO'], ['pickle', 'PICKLEBALL'], ['bomber', 'BOMBER BLAST'], ['tetris', 'TETRA BLAST'], ['chomp', 'MAZE CHOMP'], ['uno', 'UNO'], ['pusoy', 'PUSOY DOS'], ['lucky9', 'LUCKY 9'], ['tongits', 'TONG-ITS'], ['race', 'TURBO RUSH'], ['kart', 'KART CLASH'], ['hockey', 'AIR HOCKEY'], ['pool', 'BILLIARDS'], ['td', 'NEON DEFENSE'], ['rogue', 'NEON DEPTHS'], ['rhythm', 'NEON BEAT'], ['word', 'WORD HUNT'], ['merge', '2048 MERGE'], ['baccarat', 'BACCARAT'], ['poker', 'POKER'], ['c4', 'CONNECT FOUR'], ['snake', 'NEON SNAKE'], ['breaker', 'NEON BREAKER'], ['mines', 'MINE SWEEP'], ['empire', 'EMPIRE RISE'], ['ssx', 'SNOW RUSH'], ['orb', 'ORB RUSH']]
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

// On-screen controls for touch devices: a D-pad plus one big action button (bomb)
function TouchPad({ action, actionKey = 'Space', label = '💣' }) {
  const [touch, setTouch] = useState(false)
  useEffect(() => { try { setTouch(isTouchPrimary()) } catch { /* ignore */ } }, [])
  if (!touch) return null
  const hold = (code) => ({
    onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); engineKey(code, true) },
    onPointerUp: (e) => { e.preventDefault(); engineKey(code, false) },
    onPointerCancel: () => engineKey(code, false),
    onContextMenu: (e) => e.preventDefault(),
  })
  return (
    <div className="touchpad">
      <div className="dpad">
        <button className="up" {...hold('KeyW')}>▲</button><button className="lf" {...hold('KeyA')}>◀</button><button className="rt" {...hold('KeyD')}>▶</button><button className="dn" {...hold('KeyS')}>▼</button>
      </div>
      <button className="act" {...hold(actionKey)}>{label}<small>{action}</small></button>
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
          <TouchPad action="BOMB" />
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

const fmtTime = (t) => { const m = Math.floor(t / 60), sec = (t % 60).toFixed(1).padStart(4, '0'); return `${m}:${sec}` }
function TetrisHUD() {
  const g = useSyncExternalStore(subscribeTetris, getTetrisSnap)
  if (!g) return null
  const solo = !g.versus
  const b0 = g.boards[0]
  const goal = g.goal
  return (
    <div className="hud">
      {g.mode !== 'over' && (
        <>
          {solo ? (
            <>
              <div className="tside left">
                <div className="tstat"><span>SCORE</span><b>{b0.score.toLocaleString()}</b></div>
                <div className="tstat"><span>LEVEL</span><b>{b0.level}</b></div>
                <div className="tstat"><span>LINES</span><b>{b0.lines}{goal && goal.lines ? ` / ${goal.lines}` : ''}</b></div>
              </div>
              <div className="tside right">
                <div className="tstat"><span>{goal && goal.time ? 'TIME LEFT' : 'TIME'}</span><b>{goal && goal.time ? fmtTime(Math.max(0, goal.time - g.time)) : fmtTime(g.time)}</b></div>
                <div className="tstat"><span>PIECES/SEC</span><b>{b0.pps}</b></div>
                {b0.combo > 0 && <div className="tstat hot" key={b0.combo}><span>COMBO</span><b>×{b0.combo}</b></div>}
                {b0.b2b && <div className="tstat hot"><span>BACK-TO-BACK</span><b>ON</b></div>}
                {b0.fever > 0 && <div className="tstat hot fever"><span>🔥 FEVER ×2</span><b>{b0.fever}s</b></div>}
                <div className="tstat"><span>MODE</span><b>{g.modeName}</b></div>
              </div>
            </>
          ) : (
            <div className="tvs">
              {g.boards.map((b) => (
                <div key={b.id} className={'tvcard ' + (b.id ? 'b' : 'a') + (b.dead ? ' dead' : '') + (b.danger ? ' danger' : '')}>
                  <strong>{b.name}</strong><b>{b.score.toLocaleString()}</b><small>LV {b.level} · {b.lines} LINES · SENT {b.attack}{b.combo > 0 ? ` · ×${b.combo}` : ''}{b.b2b ? ' · B2B' : ''}</small>
                </div>
              ))}
              <div className="tvmid"><span>{g.modeName}</span><small>{g.diff}</small></div>
            </div>
          )}
          {g.msgs.map((m) => {
            const cx = g.boards[m.board] ? (solo ? 50 : m.board === 0 ? 23 : 77) : 50
            return <div key={m.id} className="tmsg" style={{ left: cx + '%', color: m.color, textShadow: `0 0 18px ${m.color}` }}><b>{m.text}</b>{m.sub && <small>{m.sub}</small>}</div>
          })}
          {g.phase === 'ready' && g.countdown > 0 && <div className="bcount" key={g.countdown}>{g.countdown > 3 ? 'READY' : g.countdown}</div>}
          <div className="pctl">{solo ? '←→ MOVE · ↓ SOFT · SPACE DROP · ↑/X ROTATE · Z ROTATE LEFT · C HOLD · P PAUSE' : g.type === 'versus' ? 'P1: A D S · W Q SPACE E   |   P2: ← → ↓ · ↑ , ENTER .' : '←→ MOVE · ↓ SOFT · SPACE DROP · ↑ ROTATE · C HOLD · P PAUSE'}</div>
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={tetrisActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('tetris')}>❓ HOW TO PLAY</button><button className="big sec" onClick={tetrisActions.quit}>QUIT TO DASHBOARD</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win ? 'gold' : 'red'}>{g.over.title}</h1>
          {g.over.type === 'sprint' && g.over.win && <div className="bigscore">{fmtTime(g.over.time)}</div>}
          <ul>
            <li><span>SCORE</span><b>{g.over.boardScore.toLocaleString()}</b></li>
            <li><span>LINES</span><b>{g.over.lines}</b></li>
            <li><span>TETRISES · T-SPINS · MAX COMBO</span><b>{g.over.tetrises} · {g.over.tspins} · {g.over.maxCombo}</b></li>
            <li><span>PIECES · PER SECOND · TIME</span><b>{g.over.pieces} · {g.over.pps} · {fmtTime(g.over.time)}</b></li>
            {g.over.score > 0 && <li className="bonus"><span>LEADERBOARD SCORE</span><b>{g.over.score.toLocaleString()}</b></li>}
          </ul>
          {g.over.score > 0 && <div className="overboard"><TopPlayersMini game="tetris" /></div>}
          <button className="big" onClick={tetrisActions.rematch}>↻ PLAY AGAIN</button>
          <button className="big sec" onClick={tetrisActions.quit}>DASHBOARD</button>
        </div>
      )}
    </div>
  )
}

function ChompHUD() {
  const g = useSyncExternalStore(subscribeChomp, getChompSnap)
  if (!g) return null
  return (
    <div className="hud">
      {g.mode !== 'over' && (
        <>
          <div className="top">
            <div className="col"><div className="lbl">SCORE</div><div className="val">{fmt(g.score)}</div><div className="lbl dim">HI {fmt(g.hi)}</div></div>
            <div className="col mid"><div className="lbl">LEVEL {g.level} · {g.modeName}</div><div className="prog"><b style={{ width: (g.dots / Math.max(1, g.dotsTotal)) * 100 + '%' }} /></div></div>
            <div className="col right"><div className="lbl">LIVES</div><div className="val cred">{Array.from({ length: Math.max(0, g.lives) }, (_, i) => <span key={i} className="pacico" />)}</div><SoundBtn /></div>
          </div>
          <div className="tside left"><div className="tstat"><span>DOTS</span><b>{g.dots} / {g.dotsTotal}</b></div><div className="tstat"><span>FRUIT</span><b style={{ fontSize: '.9em' }}>{g.fruit[0]}</b></div></div>
          {g.ghostMode && <div className="tside right"><div className="tstat"><span>GHOST BOUNTY</span><b>{g.ghostScore}</b></div></div>}
          {g.fright && <div className="tstat hot" style={{ position: 'absolute', right: '2.4cqw', bottom: '3cqw' }}><span>POWER!</span><b>EAT GHOSTS</b></div>}
          {g.phase === 'ready' && <div className="readytxt">READY!</div>}
          {g.msg && <div className="readytxt small">{g.msg.text}</div>}
          <div className="pctl">{g.type === 'classic' ? 'WASD / ARROWS STEER · P PAUSE' : g.type === 'auto' ? 'AUTO DEMO · ESC TO LEAVE' : 'P1: WASD · P2: ARROWS · P PAUSE'}</div>
          <div className="scan" />
        </>
      )}
      {g.paused && <div className="screen pause"><h1>PAUSED</h1><button className="big" onClick={chompActions.resume}>RESUME</button><button className="big sec" onClick={() => openHelp('chomp')}>❓ HOW TO PLAY</button><button className="big sec" onClick={chompActions.quit}>QUIT TO DASHBOARD</button></div>}
      {g.mode === 'over' && g.over && (
        <div className="screen victory">
          <h1 className={g.over.win || g.over.title === 'GAME OVER' ? 'gold' : 'red'}>{g.over.title}</h1>
          <ul>
            <li><span>SCORE</span><b>{g.over.score.toLocaleString()}</b></li>
            <li><span>LEVEL REACHED</span><b>{g.over.level}</b></li>
            <li><span>DOTS · GHOSTS · FRUIT</span><b>{g.over.dots} · {g.over.ghosts} · {g.over.fruits}</b></li>
            {g.over.type === 'ghost' && <li className="bonus"><span>GHOST BOUNTY (P2)</span><b>{g.over.ghostScore}</b></li>}
          </ul>
          {g.over.type !== 'coop' && g.over.type !== 'auto' && <div className="overboard"><TopPlayersMini game="chomp" /></div>}
          <button className="big" onClick={chompActions.rematch}>↻ PLAY AGAIN</button>
          <button className="big sec" onClick={chompActions.quit}>DASHBOARD</button>
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

function RotateHint({ mode }) {
  const [portrait, setPortrait] = useState(false)
  useEffect(() => {
    const f = () => { try { setPortrait(window.innerHeight > window.innerWidth && isTouchPrimary()) } catch { /* ignore */ } }
    f(); window.addEventListener('resize', f); window.addEventListener('orientationchange', f)
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f) }
  }, [])
  const dom = ['menu', 'word', 'merge', 'c4', 'mines', 'cards', 'flames'].includes(mode)
  if (!portrait || dom) return null
  return <div className="rotatehint">🔄 TURN YOUR PHONE SIDEWAYS FOR A BIGGER GAME</div>
}
export default function HUD() {
  const s = useSyncExternalStore(subscribe, getSnap)
  return (
    <>
      <RotateHint mode={s.mode} />
      <HUDInner s={s} />
      <Notices list={s.notices} />
      <div className="hud helplayer"><HelpLayer s={s} /></div>
      <StoryOverlay />
    </>
  )
}
function HUDInner({ s }) {
  if (s.mode === 'slug') return <SlugHUD />
  if (s.mode === 'pickle') return <PickleHUD />
  if (s.mode === 'bomber') return <BomberHUD />
  if (s.mode === 'tetris') return <TetrisHUD />
  if (s.mode === 'chomp') return <ChompHUD />
  if (s.mode === 'flames') return <FlamesHUD />
  if (s.mode === 'fight') return <FightHUD />
  if (s.mode === 'race') return <RaceHUD />
  if (MORE_MODES.includes(s.mode)) return <MoreHUD mode={s.mode} openHelp={openHelp} />
  if (MORE2_MODES.includes(s.mode)) return <More2HUD mode={s.mode} openHelp={openHelp} />
  if (s.mode === 'ssx') return <SsxHUD openHelp={openHelp} />
  if (s.mode === 'orb') return <OrbHUD openHelp={openHelp} />
  if (s.mode === 'empire') return <EmpireHUD openHelp={openHelp} />
  if (s.mode === 'cards') return <CardsHUD SoundBtn={SoundBtn} openHelp={openHelp} TopPlayersMini={TopPlayersMini} />
  const playing = s.mode === 'playing' || s.mode === 'paused'
  return (
    <div className="hud">
      {playing && <TopBar s={s} />}
      {playing && <Banner b={s.banner} />}
      {playing && s.net && s.net.role === 'guest' && (
        <>
          <div className="coopbadge">👥 CO-OP · YOU ARE SHIP <b>#{(s.net.me >= 0 ? s.net.me : 0) + 2}</b> · ESC TO LEAVE</div>
          {s.net.wait && <div className="screen pause"><h1 style={{ fontSize: '1.4em', textAlign: 'center' }}>{s.net.wait}</h1><button className="big sec" onClick={toMenu}>LEAVE GAME</button></div>}
        </>
      )}
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
