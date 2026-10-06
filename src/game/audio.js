// Procedural WebAudio: synthesized SFX + chiptune sequencer + announcer voice. No audio files needed.
import { settings, subscribeSettings } from './settings.js'
let ctx = null, master, sfxG, musG, noiseBuf, analyser, anBuf
let muted = false // session-only on purpose: a saved mute made the game look "broken" after a reload
try { localStorage.removeItem('si_muted') } catch { /* ignore */ }

const audioListeners = new Set()
const ping = () => audioListeners.forEach((f) => f())
export const onAudioState = (f) => { audioListeners.add(f); return () => audioListeners.delete(f) }
export const audioState = () => (ctx ? ctx.state : 'off')
export const isMuted = () => muted

export function initAudio() {
  if (typeof window === 'undefined') return
  if (ctx) { if (ctx.state !== 'running') ctx.resume().then(ping).catch(() => {}); return }
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  try {
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2
    comp.connect(ctx.destination)
    master = ctx.createGain(); master.gain.value = muted ? 0 : settings.master; master.connect(comp)
    sfxG = ctx.createGain(); sfxG.gain.value = 2.2 * settings.sfx; sfxG.connect(master)
    musG = ctx.createGain(); musG.gain.value = 2.1 * settings.music; musG.connect(master)
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; master.connect(analyser)
    anBuf = new Uint8Array(analyser.fftSize)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    ctx.onstatechange = ping
    ctx.resume().then(ping).catch(() => {})
    if (M.mode) { M.next = ctx.currentTime + 0.05; startTimer() }
  } catch (e) { console.error('[audio] init failed', e); ctx = null }
}
subscribeSettings(() => {
  if (!ctx) return
  master.gain.setTargetAtTime(muted ? 0 : settings.master, ctx.currentTime, 0.03)
  sfxG.gain.setTargetAtTime(2.2 * settings.sfx, ctx.currentTime, 0.03)
  musG.gain.setTargetAtTime(2.1 * settings.music, ctx.currentTime, 0.03)
})
export function unlockAudio() { initAudio(); if (ctx && ctx.state !== 'running') ctx.resume().then(ping).catch(() => {}) }
export function setMuted(v) {
  muted = v
  if (master) master.gain.setTargetAtTime(v ? 0 : settings.master, ctx.currentTime, 0.02)
  if (v && typeof speechSynthesis !== 'undefined') try { speechSynthesis.cancel() } catch { /* ignore */ }
  ping()
}
/** 0..1 loudness of what is actually being generated right now (used by the on-screen meter) */
export function audioLevel() {
  if (!analyser) return 0
  analyser.getByteTimeDomainData(anBuf)
  let m = 0
  for (let i = 0; i < anBuf.length; i++) m = Math.max(m, Math.abs(anBuf[i] - 128))
  return Math.min(1, m / 90)
}

// ---------- primitives ----------
function tone(type, f0, f1, dur, vol = 0.2, when = 0, dest) {
  if (!ctx) return
  const t = ctx.currentTime + when
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(dest || sfxG)
  o.start(t); o.stop(t + dur + 0.02)
}
function noise(dur, vol, f0, f1, when = 0, type = 'lowpass', dest) {
  if (!ctx) return
  const t = ctx.currentTime + when
  const s = ctx.createBufferSource(); s.buffer = noiseBuf
  const f = ctx.createBiquadFilter(); f.type = type
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f); f.connect(g); g.connect(dest || sfxG)
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02)
}
const arp = (notes, type, dur, vol, gap) => notes.forEach((f, i) => tone(type, f, f, dur, vol, i * gap))

// ---------- sound effects ----------
const SFX = {
  // space ship weapons
  shoot: () => tone('square', 900, 260, 0.07, 0.07),
  laser: () => { tone('sawtooth', 1400, 200, 0.16, 0.08); tone('square', 600, 100, 0.12, 0.05) },
  missile: () => { noise(0.18, 0.12, 2400, 300, 0, 'bandpass'); tone('triangle', 300, 120, 0.15, 0.1) },
  eshot: () => tone('sawtooth', 520, 200, 0.09, 0.05),
  // impacts
  hit: () => tone('square', 420, 160, 0.05, 0.06),
  bossHit: () => { tone('square', 180, 90, 0.06, 0.1); noise(0.05, 0.06, 3000, 800, 0, 'highpass') },
  boom: () => { noise(0.32, 0.38, 2200, 90); tone('sawtooth', 160, 40, 0.25, 0.14) },
  bigBoom: () => { noise(0.9, 0.55, 1800, 40); tone('sawtooth', 120, 25, 0.8, 0.28); tone('square', 70, 20, 0.7, 0.14) },
  hurt: () => { noise(0.35, 0.4, 1200, 80); tone('sawtooth', 300, 40, 0.4, 0.2) },
  // pickups / rewards
  pickup: () => arp([660, 880, 1320], 'square', 0.09, 0.09, 0.06),
  power: () => arp([440, 554, 659, 880, 1109], 'square', 0.1, 0.09, 0.05),
  coin: () => { tone('square', 1318, 1318, 0.05, 0.07); tone('square', 1760, 1760, 0.12, 0.07, 0.05) },
  life: () => arp([523, 659, 784, 1046, 1318, 1568], 'triangle', 0.14, 0.14, 0.07),
  ding: (combo = 0) => { const f = 700 + Math.min(combo, 20) * 45; tone('triangle', f, f * 1.5, 0.09, 0.06) },
  rescue: () => { arp([523, 659, 784, 1046], 'triangle', 0.12, 0.16, 0.08); tone('square', 1568, 1568, 0.3, 0.07, 0.34) },
  reload: () => { tone('square', 200, 120, 0.05, 0.1); tone('square', 320, 200, 0.05, 0.1, 0.09) },
  // skills
  bomb: () => { noise(1.1, 0.6, 3000, 40); tone('sawtooth', 400, 30, 0.9, 0.3); tone('sine', 90, 30, 1, 0.4) },
  shield: () => { tone('sine', 300, 900, 0.25, 0.14); tone('triangle', 600, 1200, 0.2, 0.08, 0.05) },
  deflect: () => tone('triangle', 1400, 700, 0.06, 0.08),
  laserWarn: () => { for (let i = 0; i < 4; i++) tone('square', 1500, 1500, 0.05, 0.05, i * 0.25) },
  laserFire: () => { noise(0.9, 0.3, 4000, 400, 0, 'bandpass'); tone('sawtooth', 220, 110, 0.9, 0.14) },
  overdrive: () => { tone('sawtooth', 100, 900, 0.7, 0.16); arp([392, 523, 659, 784, 1046, 1318], 'square', 0.12, 0.1, 0.07); noise(0.6, 0.3, 500, 6000, 0, 'bandpass') },
  // world / bosses
  alarm: () => { for (let i = 0; i < 6; i++) { tone('sawtooth', 520, 520, 0.2, 0.14, i * 0.5); tone('sawtooth', 380, 380, 0.2, 0.14, i * 0.5 + 0.25) } },
  roar: () => { tone('sawtooth', 90, 38, 1.1, 0.22); tone('square', 60, 30, 1.1, 0.12); noise(1, 0.25, 800, 60) },
  blink: () => { tone('sine', 1800, 200, 0.25, 0.1); tone('sine', 200, 1800, 0.2, 0.08, 0.2) },
  ufo: () => { for (let i = 0; i < 6; i++) tone('sine', i % 2 ? 620 : 880, i % 2 ? 880 : 620, 0.12, 0.07, i * 0.12) },
  phase: () => { noise(0.8, 0.4, 2000, 50); tone('sawtooth', 80, 400, 0.8, 0.2) },
  warp: () => { tone('sawtooth', 100, 1600, 1.4, 0.12); noise(1.4, 0.2, 300, 5000, 0, 'bandpass') },
  // run & gun
  crowd: () => { noise(1.4, 0.3, 500, 2600, 0, 'bandpass'); for (let i = 0; i < 9; i++) noise(0.05, 0.22, 2800, 1800, 0.1 + i * 0.1, 'highpass'); tone('triangle', 330, 660, 0.4, 0.06, 0.1) },
  event: () => { tone('sawtooth', 220, 880, 0.35, 0.14); tone('square', 440, 1320, 0.3, 0.08, 0.1); noise(0.4, 0.2, 400, 5000, 0, 'bandpass') },
  jackpot: () => { arp([523, 659, 784, 1046, 1318, 1568, 2093, 2637], 'square', 0.12, 0.14, 0.06); for (let i = 0; i < 14; i++) tone('square', 2600 + (i % 3) * 400, 2000, 0.05, 0.07, 0.5 + i * 0.05); noise(1, 0.2, 800, 7000, 0.2, 'bandpass') },
  cDeal: () => { noise(0.07, 0.22, 4500, 1500, 0, 'bandpass'); tone('sine', 1300, 700, 0.04, 0.05) },
  cFlip: () => { noise(0.07, 0.2, 6000, 2000, 0, 'highpass'); tone('triangle', 700, 1150, 0.05, 0.08) },
  cPlay: () => { tone('sine', 230, 110, 0.08, 0.22); noise(0.05, 0.16, 2500, 600, 0, 'bandpass') },
  cShuffle: () => { for (let i = 0; i < 14; i++) noise(0.05, 0.14, 3500 + (i % 3) * 800, 1500, i * 0.04, 'bandpass') },
  cDraw: () => { noise(0.1, 0.18, 2200, 5000, 0, 'bandpass'); tone('triangle', 500, 800, 0.06, 0.07) },
  cUno: () => arp([659, 880, 1175, 1568], 'square', 0.1, 0.12, 0.06),
  cSkip: () => { tone('square', 1000, 200, 0.18, 0.12); tone('sawtooth', 600, 150, 0.2, 0.06) },
  cReverse: () => { tone('triangle', 400, 1200, 0.15, 0.12); tone('triangle', 1200, 400, 0.15, 0.1, 0.14) },
  cWild: () => arp([523, 659, 784, 1046, 1318, 1568, 2093], 'triangle', 0.1, 0.1, 0.045),
  cWin: () => { arp([523, 659, 784, 1046, 1318], 'square', 0.16, 0.12, 0.09); arp([659, 784, 1046, 1318, 1568], 'triangle', 0.3, 0.1, 0.5); noise(0.7, 0.14, 800, 6000, 0.1, 'bandpass') },
  cLose: () => [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, f * 0.96, 0.22, 0.14, i * 0.16)),
  cBad: () => { tone('square', 170, 150, 0.12, 0.12); tone('square', 130, 110, 0.14, 0.1, 0.1) },
  cSelect: () => tone('triangle', 900, 1250, 0.05, 0.07),
  cPass: () => tone('triangle', 520, 330, 0.12, 0.09),
  cChip: () => { tone('square', 2600, 2000, 0.05, 0.07); tone('square', 3300, 2500, 0.07, 0.05, 0.03); tone('sine', 1400, 1000, 0.1, 0.05, 0.05) },
  waka: (a = 0) => { const f = a ? 380 : 520; tone('triangle', f, f * 0.55, 0.09, 0.2); tone('square', f * 2, f, 0.05, 0.04) },
  pPower: () => { tone('sawtooth', 200, 900, 0.3, 0.14); arp([392, 523, 659, 784], 'square', 0.08, 0.08, 0.05) },
  pEat: (n = 1) => { const f = 400 + n * 160; tone('square', f, f * 3, 0.22, 0.14); tone('triangle', f * 1.5, f * 4, 0.2, 0.1, 0.05) },
  pDie: () => { [880, 780, 700, 620, 540, 460, 380, 300, 220, 160, 110].forEach((f, i) => tone('square', f, f * 0.93, 0.12, 0.14, i * 0.1)); noise(0.35, 0.18, 800, 100, 1.15) },
  pFruit: () => arp([784, 988, 1175, 1568], 'square', 0.1, 0.12, 0.06),
  pFruitSpawn: () => { tone('triangle', 880, 1320, 0.12, 0.1); tone('triangle', 1320, 880, 0.12, 0.08, 0.1) },
  pClear: () => arp([523, 659, 784, 1046, 784, 1046, 1318, 1568], 'square', 0.12, 0.12, 0.08),
  pSiren: (p = 0) => { const f = 150 + p * 150; tone('triangle', f, f * 1.6, 0.2, 0.09); tone('triangle', f * 1.6, f, 0.2, 0.07, 0.2) },
  pFright: () => { tone('square', 280, 340, 0.08, 0.06); tone('square', 340, 280, 0.08, 0.05, 0.09) },
  pEyes: () => tone('sine', 1400, 600, 0.16, 0.08),
  pIntro: () => { [494, 988, 740, 622, 988, 740, 622, 523, 1046, 784, 659, 1046, 784, 659].forEach((f, i) => tone('square', f, f, 0.1, 0.09, i * 0.095)); },
  tMove: () => tone('square', 700, 650, 0.02, 0.04),
  tRotate: () => tone('square', 980, 1180, 0.04, 0.06),
  tHold: () => { tone('triangle', 520, 780, 0.08, 0.1); tone('triangle', 780, 520, 0.08, 0.08, 0.07) },
  tLock: () => { tone('sine', 190, 110, 0.07, 0.2); noise(0.03, 0.12, 900, 300) },
  tDrop: () => { tone('sine', 260, 70, 0.14, 0.32); noise(0.1, 0.25, 1600, 200); tone('square', 1500, 400, 0.05, 0.05) },
  tClear: (n = 1) => arp([523, 659, 784, 1046].slice(0, n + 1).map((f) => f), 'square', 0.09, 0.1, 0.05),
  tTetris: () => { arp([392, 523, 659, 784, 1046, 1318], 'square', 0.12, 0.12, 0.05); noise(0.5, 0.25, 600, 6000, 0, 'bandpass'); tone('sine', 90, 40, 0.4, 0.4) },
  tSpin: () => { tone('sawtooth', 300, 1200, 0.25, 0.12); tone('square', 1200, 1800, 0.2, 0.08, 0.1) },
  tCombo: (n = 1) => { const f = 500 + Math.min(n, 12) * 70; tone('triangle', f, f * 1.5, 0.1, 0.12); tone('triangle', f * 1.5, f * 2, 0.1, 0.1, 0.07) },
  tLevel: () => arp([523, 659, 784, 1046, 1318, 1568], 'triangle', 0.12, 0.14, 0.06),
  tGarbage: () => { noise(0.25, 0.4, 500, 80); tone('sawtooth', 120, 60, 0.2, 0.2) },
  tTop: () => { [440, 370, 311, 247, 185, 131].forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.16, 0.14, i * 0.1)); noise(0.6, 0.3, 1500, 60, 0.3) },
  tPC: () => { arp([523, 659, 784, 1046, 1318, 1568, 2093], 'square', 0.14, 0.12, 0.06); noise(0.8, 0.2, 800, 7000, 0.1, 'bandpass') },
  tWarn: () => tone('square', 440, 440, 0.06, 0.06),
  bombPlace: () => { tone('sine', 220, 120, 0.1, 0.22); noise(0.05, 0.12, 900, 300) },
  bombBoom: () => { noise(0.6, 0.6, 2400, 70); tone('sawtooth', 150, 32, 0.5, 0.3); tone('sine', 80, 28, 0.45, 0.4); noise(0.12, 0.3, 6000, 1200, 0.02, 'highpass') },
  die: () => { [520, 420, 330, 230, 150].forEach((f, i) => tone('square', f, f * 0.8, 0.12, 0.14, i * 0.07)); noise(0.3, 0.2, 900, 120, 0.1) },
  kick: () => { tone('sine', 180, 90, 0.1, 0.25); noise(0.05, 0.1, 700, 300) },
  beep: () => tone('square', 880, 880, 0.14, 0.14),
  go: () => { tone('square', 1320, 1320, 0.28, 0.16); tone('square', 1760, 1760, 0.35, 0.12, 0.06) },
  knife: () => { noise(0.1, 0.25, 6000, 1500, 0, 'highpass'); tone('sawtooth', 1800, 500, 0.08, 0.1) },
  vulcan: () => { noise(0.04, 0.35, 2800, 500, 0, 'highpass'); tone('square', 520, 150, 0.05, 0.12); tone('sine', 110, 60, 0.05, 0.2) },
  cannon: () => { noise(0.45, 0.6, 2200, 120); tone('sawtooth', 130, 38, 0.4, 0.3); tone('sine', 70, 30, 0.35, 0.4) },
  tankEngine: () => { tone('sawtooth', 62, 48, 0.2, 0.12); noise(0.2, 0.08, 220, 90) },
  crate: () => { noise(0.12, 0.3, 1500, 300); tone('square', 240, 120, 0.08, 0.12) },
  chute: () => noise(0.5, 0.12, 400, 2200, 0, 'bandpass'),
  jeep: () => { tone('sawtooth', 95, 70, 0.18, 0.1); noise(0.16, 0.08, 400, 200, 0, 'bandpass') },
  plane: () => { tone('sawtooth', 150, 130, 0.35, 0.07); noise(0.35, 0.07, 500, 300, 0, 'bandpass') },
  grunt: () => { tone('sawtooth', 300, 110, 0.18, 0.16); noise(0.1, 0.12, 900, 200) },
  sniperAim: () => tone('sine', 2400, 2600, 0.25, 0.05),
  bird: () => { tone('sine', 2400, 3200, 0.07, 0.05); tone('sine', 3000, 2300, 0.08, 0.05, 0.1); tone('sine', 2600, 3400, 0.06, 0.04, 0.22) },
  wind: () => noise(1.6, 0.1, 300, 900, 0, 'bandpass'),
  distant: () => noise(0.9, 0.2, 500, 60),
  clank: () => { tone('square', 620, 480, 0.05, 0.1); tone('triangle', 310, 240, 0.12, 0.12, 0.03); noise(0.05, 0.1, 5000, 3000, 0, 'highpass') },
  hum: () => tone('sawtooth', 58, 56, 0.9, 0.05),
  medal: () => { arp([1175, 1568, 2349], 'square', 0.07, 0.08, 0.05) },
  vehIn: () => { arp([262, 330, 392, 523], 'sawtooth', 0.1, 0.12, 0.06); noise(0.3, 0.2, 400, 120) },
  pistol: () => { noise(0.06, 0.3, 4000, 800, 0, 'highpass'); tone('square', 1100, 260, 0.06, 0.09) },
  hmg: () => { noise(0.05, 0.28, 3500, 700, 0, 'highpass'); tone('square', 760, 210, 0.045, 0.09) },
  shotgun: () => { noise(0.3, 0.55, 3200, 250); tone('sawtooth', 170, 45, 0.25, 0.22) },
  rocketLaunch: () => { noise(0.5, 0.35, 2600, 260, 0, 'bandpass'); tone('sawtooth', 160, 640, 0.35, 0.12) },
  throw: () => { tone('sine', 280, 520, 0.12, 0.1); noise(0.08, 0.06, 1200, 500, 0, 'bandpass') },
  jump: () => tone('square', 280, 700, 0.1, 0.07),
  land: () => noise(0.06, 0.18, 500, 120),
  step: () => noise(0.035, 0.07, 900, 400, 0, 'bandpass'),
  whistle: () => tone('sine', 2000, 380, 0.7, 0.06),
  rotor: () => noise(0.1, 0.12, 280, 120, 0, 'bandpass'),
  rumble: () => { noise(0.4, 0.2, 200, 60); tone('sawtooth', 55, 40, 0.4, 0.1) },
  // ui / flow
  ui: () => tone('square', 880, 880, 0.04, 0.06),
  select: () => { tone('square', 660, 660, 0.05, 0.08); tone('square', 990, 990, 0.08, 0.08, 0.05) },
  buy: () => { tone('square', 988, 988, 0.07, 0.09); tone('square', 1319, 1319, 0.14, 0.09, 0.07) },
  deny: () => { tone('square', 200, 200, 0.1, 0.1); tone('square', 150, 150, 0.15, 0.1, 0.1) },
  mission: () => arp([392, 523, 659, 784], 'square', 0.18, 0.1, 0.12),
  clear: () => arp([523, 659, 784, 1046, 784, 1046, 1318], 'square', 0.16, 0.1, 0.1),
  over: () => [440, 392, 349, 294, 220, 147].forEach((f, i) => tone('sawtooth', f, f * 0.96, 0.3, 0.14, i * 0.2)),
  win: () => arp([523, 659, 784, 1046, 1318, 1046, 1318, 1568, 2093], 'square', 0.2, 0.1, 0.13),
  paddle: () => { noise(0.03, 0.4, 5000, 2200, 0, 'highpass'); tone('square', 1500, 800, 0.04, 0.12) },
  smash: () => { noise(0.08, 0.55, 5000, 800, 0, 'highpass'); tone('square', 900, 220, 0.09, 0.18); tone('sine', 140, 60, 0.12, 0.3) },
  bounce: () => { tone('sine', 640, 380, 0.04, 0.12); noise(0.02, 0.12, 4000, 2500, 0, 'highpass') },
  net: () => { noise(0.18, 0.3, 700, 150); tone('triangle', 180, 110, 0.14, 0.14) },
  point: () => { arp([659, 784, 988, 1319], 'triangle', 0.14, 0.14, 0.07); noise(0.7, 0.14, 700, 3500, 0.05, 'bandpass') },
  fault: () => { tone('sawtooth', 160, 120, 0.3, 0.14); tone('square', 120, 90, 0.3, 0.1, 0.05) },
  test: () => { arp([523, 659, 784, 1046], 'square', 0.16, 0.12, 0.11); noise(0.3, 0.3, 2000, 100, 0.5) },
}
const MIN_GAP = { vulcan: 45, tankEngine: 150, grunt: 60, jeep: 200, plane: 300, crate: 60, shoot: 50, pistol: 60, hmg: 42, eshot: 90, rotor: 110, hit: 25, boom: 35, coin: 30, ding: 40, step: 80, whistle: 70, bossHit: 40, deflect: 50 }
const lastAt = {}
export function sfx(name, arg) {
  if (!ctx || muted || !SFX[name]) return
  const gap = MIN_GAP[name]
  if (gap) { const n = performance.now(); if (n - (lastAt[name] || 0) < gap) return; lastAt[name] = n }
  try { SFX[name](arg) } catch (e) { console.error('[audio] sfx', name, e) }
}

// ---------- announcer voice (browser speech synthesis) ----------
export function speak(text, pitch = 0.55, rate = 1.05) {
  if (muted || !settings.voice || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.pitch = pitch; u.rate = rate; u.volume = 1
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  } catch { /* ignore */ }
}
export function testSound() { unlockAudio(); sfx('test'); speak('Sound check. Ready for action.') }

// ---------------- music ----------------
const M = { mode: null, step: 0, next: 0, timer: null, mission: 0, bpm: 120, trans: 0 }
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
const PROG = { cards: [0, 5, 3, 7], tetris: [0, -2, -4, -5], bomber: [0, 3, 5, 2], pickle: [0, 5, 7, 9], play: [0, -4, -2, -5], boss: [0, 0, 1, -1], menu: [0, -4, -7, -5], slug: [0, 0, -5, -2], slugboss: [0, 1, 0, -2] }
const CH = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 11]]
const ARP = [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 3, 2, 1]
const CHP = [[0, 4, 7, 12], [0, 4, 7, 12], [0, 4, 7, 12], [0, 3, 7, 12]]
const MEL = [
  [0, null, null, 3, 5, null, 3, null, 0, null, 3, null, 5, 7, 5, 3],
  [7, null, null, 5, 3, null, 5, null, 7, null, 10, null, 12, 10, 7, 5],
  [5, null, null, 3, 0, null, 3, null, 5, null, 7, null, 5, 3, 0, null],
  [7, null, 5, null, 3, null, 0, null, 3, 5, 7, 10, 12, null, null, null],
]

function playStep(step, t) {
  const w = t - ctx.currentTime
  const s = step % 16, bar = Math.floor(step / 16) % 4
  const mode = M.mode
  const base = mode === 'slug' || mode === 'slugboss' ? 43 : 45
  const root = base + M.trans + PROG[mode][bar]
  const tn = (type, n, dur, vol) => tone(type, mtof(n), mtof(n), dur, vol, w, musG)
  if (mode === 'menu') {
    if (s % 2 === 0) tn('triangle', root + 12 + CH[bar][ARP[s]], 0.2, 0.14)
    if (s === 0) tn('sine', root - 12, 1.2, 0.3)
    return
  }
  if (mode === 'cards') {
    const rc = 48 + PROG.cards[bar], sw = s % 4 === 3 ? 0.02 : 0
    if (s % 4 === 0) tone('triangle', mtof(rc - 12), mtof(rc - 12), 0.28, 0.3, w, musG)
    if (s % 4 === 2) tone('triangle', mtof(rc - 5), mtof(rc - 5), 0.2, 0.22, w, musG)
    if (s % 8 === 2 || s % 8 === 6) for (const iv of [0, 3, 7, 10]) tone('triangle', mtof(rc + 12 + iv), mtof(rc + 12 + iv), 0.3, 0.035, w + sw, musG)
    if ([0, 3, 6, 9, 12, 14].includes(s) && (bar % 2 === 0 || s % 3 === 0)) { const n = rc + 24 + [0, 3, 5, 7, 10, 12][(s + bar * 2) % 6]; tone('sine', mtof(n), mtof(n), 0.22, 0.05, w, musG) }
    if (s % 4 === 2) noise(0.05, 0.07, 6500, 4000, w, 'highpass', musG)
    if (s % 8 === 0) tone('sine', 120, 50, 0.1, 0.25, w, musG)
    return
  }
  if (mode === 'tetris') {
    const TM = [
      [9, null, null, 5, 7, null, 9, null, 12, null, 9, null, 7, null, 5, null],
      [4, null, null, 7, 9, null, 11, null, 9, null, 7, null, 4, null, 2, null],
      [0, null, 2, null, 4, null, 5, null, 7, null, null, 9, 11, null, 12, null],
      [14, null, 12, null, 11, null, 9, null, 7, null, 4, null, 2, null, null, null],
    ]
    const rt = 45 + PROG.tetris[bar]
    if (s % 2 === 0) tone('triangle', mtof(rt - 12 + (s % 8 === 6 ? 7 : 0)), mtof(rt - 12 + (s % 8 === 6 ? 7 : 0)), 0.13, 0.3, w, musG)
    const m = TM[bar][s]
    if (m !== null) { const n = 57 + m; tone('square', mtof(n), mtof(n), 0.14, 0.075, w, musG) }
    if (s % 4 === 2) { const n = rt + 12 + [0, 3, 7, 12][(s >> 2) % 4]; tone('square', mtof(n), mtof(n), 0.05, 0.03, w, musG) }
    if (s % 4 === 0) tone('sine', 150, 40, 0.12, 0.45, w, musG)
    if (s % 8 === 4) noise(0.09, 0.2, 4500, 1500, w, 'highpass', musG)
    if (s % 2 === 1) noise(0.02, 0.04, 9500, 8000, w, 'highpass', musG)
    return
  }
  if (mode === 'bomber') {
    const rb = 50 + PROG.bomber[bar], ch = [0, 3, 7, 12]
    if (s % 2 === 0) tone('sawtooth', mtof(rb - 12 + (s % 4 === 2 ? 12 : 0)), mtof(rb - 12 + (s % 4 === 2 ? 12 : 0)), 0.1, 0.26, w, musG)
    const m = MEL[bar][s]
    if (m !== null) { const n = rb + 12 + m; tone('square', mtof(n), mtof(n), 0.11, 0.07, w, musG); tone('triangle', mtof(n + 12), mtof(n + 12), 0.09, 0.05, w, musG) }
    else if (s % 2 === 1) { const n = rb + 24 + ch[(s >> 1) % 4]; tone('square', mtof(n), mtof(n), 0.05, 0.035, w, musG) }
    if (s % 4 === 0) tone('sine', 150, 40, 0.14, 0.5, w, musG)
    if (s % 8 === 4) { noise(0.1, 0.22, 4800, 1500, w, 'highpass', musG); tone('triangle', 210, 120, 0.07, 0.12, w, musG) }
    noise(0.025, 0.05, 9500, 8000, w, 'highpass', musG)
    return
  }
  if (mode === 'pickle') {
    const ch = CHP[bar], base2 = 48 + M.trans + PROG.pickle[bar]
    if ([0, 3, 6, 8, 11, 14].includes(s)) tone('triangle', mtof(base2 - 12 + (s === 6 || s === 14 ? 7 : 0)), mtof(base2 - 12 + (s === 6 || s === 14 ? 7 : 0)), 0.13, 0.32, w, musG)
    if (s % 2 === 0) { const n = base2 + 12 + ch[ARP[s]]; tone('square', mtof(n), mtof(n), 0.07, 0.06, w, musG) }
    if (s === 6 || s === 14) { const n = base2 + 24 + ch[(s / 2) % 4]; tone('triangle', mtof(n), mtof(n), 0.12, 0.09, w, musG) }
    if (s % 8 === 4) { noise(0.08, 0.2, 2500, 1200, w, 'bandpass', musG) }
    if (s % 8 === 0) tone('sine', 150, 45, 0.12, 0.38, w, musG)
    if (s % 2 === 1) noise(0.025, 0.05, 9500, 8000, w, 'highpass', musG)
    return
  }
  if (mode === 'slug' || mode === 'slugboss') {
    const boss = mode === 'slugboss'
    // oom-pah march bass
    if (boss || s % 4 === 0) tn('triangle', root - (s % 4 === 2 ? -7 : 0), 0.14, 0.34)
    else if (s % 4 === 2) tn('triangle', root + 7, 0.12, 0.26)
    // brass-like lead melody
    const m = MEL[bar][s]
    if (m !== null) { tn('square', root + 12 + m, boss ? 0.1 : 0.17, boss ? 0.075 : 0.065); if (boss) tn('square', root + 19 + m, 0.1, 0.035) }
    // snare-driven drums
    if (s % 4 === 0 || (boss && s === 10)) tone('sine', 150, 40, 0.14, 0.5, w, musG)
    if (s % 8 === 4 || (boss && s % 4 === 2)) { noise(0.1, 0.22, 5200, 1500, w, 'highpass', musG); tone('triangle', 230, 120, 0.07, 0.12, w, musG) }
    if (s === 14 || s === 15) noise(0.05, 0.12, 6000, 2000, w, 'highpass', musG)
    if (s % 2 === 1) noise(0.03, 0.05, 9000, 7000, w, 'highpass', musG)
    return
  }
  const chord = mode === 'boss' ? [0, 3, 7, 12] : CH[bar]
  if (mode === 'boss') tn('sawtooth', root + (s % 4 === 2 ? 12 : 0), 0.1, 0.17)
  else if (s % 2 === 0) tn('triangle', root + (s % 8 === 6 ? 12 : 0), 0.16, 0.3)
  tn('square', root + 24 + chord[ARP[s]], 0.09, mode === 'boss' ? 0.07 : 0.055)
  if (s % 4 === 0 || (mode === 'boss' && s === 10)) tone('sine', 160, 38, 0.14, 0.5, w, musG)
  if (s % 8 === 4) { noise(0.12, 0.2, 5000, 1500, w, 'highpass', musG); tone('triangle', 220, 120, 0.08, 0.12, w, musG) }
  if (mode === 'boss' || s % 2 === 1) noise(0.03, 0.05, 9000, 7000, w, 'highpass', musG)
}
const stepDur = () => 60 / M.bpm / 4
function sched() {
  if (!ctx || !M.mode || ctx.state !== 'running') return
  while (M.next < ctx.currentTime + 0.2) {
    if (!muted) playStep(M.step, M.next)
    M.next += stepDur(); M.step++
  }
}
function startTimer() { if (!M.timer) M.timer = setInterval(sched, 40) }

export const music = {
  set(mode, mission = 0) {
    if (M.mode === mode && M.mission === mission) return
    const keepStep = M.mode && mode !== 'menu'
    M.mode = mode; M.mission = mission
    const m = mission
    const bpms = [120, 124, 128, 132, 136, 140, 144, 148, 152, 156]
    M.bpm = mode === 'menu' ? 92 : mode === 'cards' ? 100 : mode === 'tetris' ? 128 + m * 5 : mode === 'bomber' ? 134 : mode === 'pickle' ? 116 : mode === 'boss' ? 150 + m * 2 : mode === 'slug' ? 112 + m * 6 : mode === 'slugboss' ? 146 + m * 4 : bpms[m] || 120
    M.trans = mode === 'slug' || mode === 'slugboss' ? [0, 2, -3][m] || 0 : [0, 2, -2, 3, 5, -3, 1, -5, 4, 0][m] || 0
    if (!keepStep) M.step = 0
    if (ctx) { M.next = Math.max(M.next, ctx.currentTime + 0.05); startTimer() }
  },
  stop() { M.mode = null },
}
