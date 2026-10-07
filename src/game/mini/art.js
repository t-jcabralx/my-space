// Animated 3D thumbnails for the dashboard game cards (drawn with the same software renderer as the mini games).
// Each scene is (r, t) => void on a 320 x 180 canvas; r.look sets the camera, r.begin paints the sky.
const hsl = (h, s = 75, l = 55) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`
const sway = (r, t, h = 40, d = 92, ty = 10, k = 22) => r.look(Math.sin(t * 0.35) * k, h, -d, 0, ty, 0, 45)
const ground = (r, c = '#2f7a2f') => r.floor(-220, -140, 220, 200, 0, c)
const tree = (r, x, z, s = 1, c = '#2a8a3a') => { r.cyl(x, 0, z, 1.2 * s, 5 * s, '#5a3a1a', { seg: 8 }); r.pyramid(x, 4 * s, z, 8 * s, 11 * s, 8 * s, c) }
const stars = (r, t, n = 30, sp = 25) => { for (let i = 0; i < n; i++) r.sphere((((i * 37 - t * sp) % 160) + 160) % 160 - 80, ((i * 53) % 55) + 4, ((i * 29) % 50) + 20, 0.55, '#ffffff', { shine: false, glow: 1.3 }) }
const person = (r, x, y, z, c, sw = 0) => { r.box(x, y + 4, z, 4, 6, 3, c); r.sphere(x, y + 9, z, 2.4, '#e8b890', { shine: false }); r.box(x - 1, y + 0.8, z, 1.4, 3.6 + sw, 1.6, '#222'); r.box(x + 1, y + 0.8, z, 1.4, 3.6 - sw, 1.6, '#222') }

export const ART = {
  space(r, t) {
    sway(r, t, 30, 90, 22); r.begin('#0a1030', '#02030a'); stars(r, t, 36, 28)
    const sy = 24 + Math.sin(t * 2) * 3
    r.box(-26, sy, 0, 16, 5, 7, '#3de8ff'); r.pyramid(-18, sy, 0, 7, 8, 7, '#bff6ff', { rz: -1.5708 }); r.box(-28, sy, 0, 7, 1.2, 22, '#2fb8d4'); r.box(-33, sy + 3, 0, 5, 4, 2, '#ff9a3a', { glow: 1.4 })
    for (let k = 0; k < 4; k++) r.sphere(-12 + ((t * 70 + k * 24) % 100), sy, 0, 1.4, '#ffe84a', { glow: 1.6, shine: false })
    for (let k = 0; k < 3; k++) { const ex = 30 + k * 14, ey = 16 + k * 9 + Math.sin(t * 2 + k) * 3; r.box(ex, ey, 0, 8, 6, 8, '#ff5a6a', { ry: t + k }); r.sphere(ex, ey, -4, 1.6, '#ffe84a', { shine: false, glow: 1.5 }) }
    r.sphere(8, 46, 14, 5 + Math.sin(t * 6), '#ff9a3a', { glow: 1.5, alpha: 0.7, shine: false })
  },
  empire(r, t) {
    sway(r, t, 46, 100, 8, 28); r.begin('#7fb4ff', '#d8ecff'); ground(r, '#3a8a3a')
    r.box(0, 6, 0, 18, 12, 18, '#8a8a99'); r.box(0, 14, 0, 22, 3, 22, '#3de8ff')
    for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { r.cyl(x, 0, z, 2.4, 20, '#8a8a99'); r.pyramid(x, 20, z, 6, 5, 6, '#3de8ff') }
    r.box(0, 22, 0, 1, 10, 1, '#6a4a2a'); r.box(3, 27, 0, 6, 3, 0.4, '#ff5a6a', { glow: 1.3 })
    for (const [x, z, c] of [[-30, -6, '#ff9a3a'], [-30, 12, '#ff5a6a'], [30, -2, '#b27aff'], [32, 14, '#ffd23a']]) { r.box(x, 4, z, 10, 8, 9, '#cdbba0'); r.pyramid(x, 8, z, 13, 7, 12, c) }
    for (let i = 0; i < 8; i++) tree(r, -62 + i * 18, 34 + (i % 2) * 6, 1 + (i % 3) * 0.2)
    person(r, -12 + Math.sin(t) * 6, 0, -14, '#ff5a6a', Math.sin(t * 8) * 1.2); person(r, 14 - Math.sin(t) * 6, 0, -16, '#3de8ff', Math.sin(t * 8) * 1.2)
    for (let k = 0; k < 3; k++) r.sphere(2 + k * 2 + ((t * 6 + k) % 6), 30 + ((t * 8 + k * 2) % 14), 0, 1.5 + k * 0.4, '#ffffff', { alpha: 0.5, shine: false })
  },
  cards(r, t) {
    r.look(0, 50, -80, 0, 8, 0, 45); r.begin('#1f8454', '#08382a'); ground(r, '#14683f')
    const cs = [['#e8384a', '♥'], ['#222222', '♠'], ['#2f6df0', '9'], ['#2fb85a', '+2']]
    cs.forEach(([c, s2], i) => { const a = -0.5 + i * 0.33, x = -30 + i * 20, y = 6 + Math.sin(t * 1.5 + i) * 2; r.box(x, y + 6, 0, 22, 32, 1.4, '#f6f2e6', { rz: -a * 0.5, ry: Math.sin(t * 0.8 + i) * 0.25 }); r.text(x, y + 6, -1.6, s2, 7, c) })
    r.cyl(40, 0, -10, 8, 3, '#e8384a'); r.cyl(40, 3, -10, 8, 3, '#ffd23a'); r.cyl(40, 6, -10, 8, 3, '#3de8ff'); r.cyl(48, 0, -4, 8, 3, '#7dff6a')
  },
  slug(r, t) {
    sway(r, t, 34, 90, 10, 18); r.begin('#e8a860', '#f6d8a0'); r.floor(-220, -80, 220, 120, 0, '#8a7a4a')
    r.box(-8, 4, 0, 24, 6, 14, '#5a7a3a'); r.cyl(-8, 7, 0, 5, 5, '#6a8a44'); r.box(8, 11, 0, 16, 2.2, 2.2, '#3a4a2a', { rz: 0.15 })
    for (let i = 0; i < 6; i++) r.cyl(-18 + i * 4, 0, -7.5, 2.2, 3, '#222222', { seg: 8 })
    const f = (t * 3) % 1; r.sphere(18 + f * 40, 12 + f * 4, 0, 1.4, '#ffe84a', { glow: 1.6, shine: false }); r.sphere(60, 6, 0, 5 + Math.sin(t * 9) * 1.5, '#ff7a2a', { glow: 1.5, alpha: 0.8, shine: false })
    for (const x of [-42, -52]) person(r, x, 0, -4, '#4a7a3a', Math.sin(t * 8)); r.box(44, 5, 6, 12, 10, 10, '#7a6a5a'); r.box(52, 8, 6, 3, 12, 3, '#555555')
  },
  pickle(r, t) {
    r.look(0, 38, -78, 0, 4, 6, 50); r.begin('#8ad0ff', '#d6f0ff'); r.floor(-200, -120, 200, 200, -0.5, '#2a6a3a')
    r.box(0, 0.4, 0, 70, 0.8, 90, '#2f7ac0'); r.box(0, 0.9, 0, 66, 0.6, 2, '#ffffff', { edge: false }); r.box(0, 0.9, -22, 66, 0.6, 1.2, '#ffffff', { edge: false }); r.box(0, 0.9, 22, 66, 0.6, 1.2, '#ffffff', { edge: false })
    r.box(0, 5, 0, 70, 7, 1, '#e8e8f0', { alpha: 0.85 }); r.cyl(-36, 0, 0, 1, 9, '#555555'); r.cyl(36, 0, 0, 1, 9, '#555555')
    const bx = Math.sin(t * 1.4) * 22, bz = Math.cos(t * 1.4) * 26, by = 4 + Math.abs(Math.sin(t * 4)) * 8
    r.shadow(bx, bz, 2.2, 0.35, 0.8); r.sphere(bx, by, bz, 2.2, '#ffe84a', { glow: 1.3 })
    r.box(-Math.sin(t * 1.4) * 14, 3, -34, 4, 6, 1.4, '#ff5a6a', { rz: 0.3 }); r.box(Math.sin(t * 1.4) * 18, 3, 34, 4, 6, 1.4, '#3de8ff', { rz: -0.3 })
  },
  bomber(r, t) {
    sway(r, t, 56, 86, 4, 16); r.begin('#3a2a1a', '#150e08'); r.floor(-200, -140, 200, 140, 0, '#4a4a58')
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { if (i % 2 === 0 && j % 2 === 0) r.box(i * 11, 5, j * 11, 10, 10, 10, '#6a6a7a'); else if ((i * 7 + j * 3 + 20) % 4 === 0) r.box(i * 11, 4.5, j * 11, 9, 9, 9, '#c9783a') }
    r.sphere(-11, 3.5, 11, 3.5 + Math.abs(Math.sin(t * 6)) * 0.6, '#222222', { glow: 1.1 }); r.sphere(-11 + Math.sin(t * 20) * 1.2, 8.5, 11, 1.2, '#ffe84a', { glow: 1.8, shine: false })
    const a = (t * 2) % 1
    for (let k = 1; k <= 3; k++) { r.sphere(-11 + k * 6, 3, 11, 2.2 * (1 - a * 0.4), '#ff9a3a', { glow: 1.6, alpha: 0.8 - a * 0.5, shine: false }); r.sphere(-11 - k * 6, 3, 11, 2.2 * (1 - a * 0.4), '#ff9a3a', { glow: 1.6, alpha: 0.8 - a * 0.5, shine: false }) }
    person(r, 22, 0, -11, '#3de8ff', Math.sin(t * 8)); person(r, -33, 0, -22, '#ff5a6a', 0)
  },
  tetris(r, t) {
    r.look(Math.sin(t * 0.4) * 14, 40, -70, 0, 24, 0, 50); r.begin('#12163a', '#07091f'); r.box(0, 24, 8, 64, 56, 2, '#0e1230')
    const shape = [[0, 0], [1, 0], [2, 0], [1, 1]], cols = ['#ff5a6a', '#ffd23a', '#3de8ff', '#7dff6a', '#b27aff', '#ff9a3a']
    const rows = [[0, 1, 2, 3, 4, 5], [0, 2, 3, 5], [1, 2, 3, 4], [2, 3]]
    rows.forEach((row, j) => row.forEach((i) => r.box(-24 + i * 8, 4 + j * 8, 0, 7.4, 7.4, 7.4, cols[(i + j * 2) % 6], { glow: 1.05 })))
    const fy = 52 - ((t * 14) % 36); shape.forEach(([sx, sy]) => r.box(-8 + sx * 8, fy - sy * 8, 0, 7.4, 7.4, 7.4, '#3de8ff', { glow: 1.25 }))
  },
  chomp(r, t) {
    sway(r, t, 54, 86, 4, 14); r.begin('#05051a', '#0a0a2a'); r.floor(-200, -140, 200, 140, 0, '#0a0a22')
    for (let i = -4; i <= 4; i++) { r.box(i * 12, 3, -22, 11, 6, 3, '#2a3aff'); r.box(i * 12, 3, 22, 11, 6, 3, '#2a3aff') }
    for (const x of [-26, 26]) r.box(x, 3, 0, 3, 6, 30, '#2a3aff')
    for (let i = -4; i <= 4; i++) r.sphere(i * 12, 2, 0, 1.2, '#ffe0a0', { shine: false })
    const px = Math.sin(t * 1.3) * 40, m = Math.abs(Math.sin(t * 9)); r.sphere(px, 5, 0, 6, '#ffe84a', { glow: 1.2 }); r.box(px + Math.sign(Math.cos(t * 1.3)) * 4, 5, -3.5, 5, 1 + m * 4, 2, '#000000', { edge: false })
    for (let k = 0; k < 3; k++) { const gx = Math.sin(t * 1.3 - 1.2 - k * 0.6) * 40, c = ['#ff5a6a', '#ff9ad0', '#3de8ff'][k]; r.sphere(gx, 5, 0, 5.4, c); r.box(gx, 2, 0, 10, 4, 10, c); r.sphere(gx - 1.6, 6, -4.6, 1.3, '#ffffff', { shine: false }); r.sphere(gx + 1.6, 6, -4.6, 1.3, '#ffffff', { shine: false }) }
  },
  race(r, t) {
    r.look(Math.sin(t * 0.6) * 4, 12, -34, 0, 6, 40, 70); r.begin('#ff9a5a', '#ffe2a0'); r.floor(-300, -50, 300, 600, 0, '#3a7a3a'); r.floor(-26, -50, 26, 600, 0.1, '#33333c')
    r.box(-27, 0.8, 250, 2, 1.6, 700, '#ffd23a', { edge: false }); r.box(27, 0.8, 250, 2, 1.6, 700, '#ffd23a', { edge: false })
    for (let z = -((t * 40) % 24); z < 300; z += 24) r.box(0, 0.2, z, 1.4, 0.3, 11, '#ffffffcc', { edge: false })
    for (let k = 0; k < 8; k++) { const z = ((k * 38 - t * 40) % 300 + 300) % 300; for (const sx of [-44, 44]) tree(r, sx, z, 1.3) }
    r.box(0, 2.4, 6, 11, 4, 20, '#ff5a6a'); r.box(0, 5.6, 4, 9, 3, 10, '#111118'); r.box(-5, 1.4, 16, 2.4, 2.8, 4, '#222222'); r.box(5, 1.4, 16, 2.4, 2.8, 4, '#222222'); r.box(0, 3, -4.2, 10, 0.6, 1.6, '#ffff00')
    r.box(Math.sin(t * 0.9) * 10, 2.4, 60, 11, 4, 20, '#3de8ff'); r.box(14 - Math.sin(t * 0.7) * 6, 2.4, 110, 11, 4, 20, '#ffd23a')
  },
  fight(r, t) {
    sway(r, t, 30, 80, 14, 10); r.begin('#3a1a1a', '#120808'); r.floor(-200, -100, 200, 100, 0, '#4a3a2a'); r.box(0, -1, 0, 120, 2, 60, '#6a2a2a')
    const hit = Math.max(0, Math.sin(t * 3))
    const fighter = (x, dir, c, a) => { r.box(x, 15, 0, 9, 13, 6, c); r.sphere(x, 25, 0, 4.6, '#e8b890'); r.box(x - 2.4, 5, 0, 3.4, 10, 4, '#222222'); r.box(x + 2.4, 5, 0, 3.4, 10, 4, '#222222'); r.box(x + dir * (6 + a * 7), 17, 0, 10 + a * 6, 3.2, 3.2, '#e8b890'); r.sphere(x + dir * (12 + a * 8), 17, 0, 2.8, '#ff5a6a', { glow: 1.1 }) }
    fighter(-18 + hit * 4, 1, '#3de8ff', hit); fighter(18 - hit * 2, -1, '#ff5a6a', 0)
    if (hit > 0.7) { r.sphere(0, 18, -6, 5 * hit, '#ffe84a', { glow: 1.8, alpha: 0.8, shine: false }); r.text(0, 30, -8, 'POW', 7, '#ffe84a') }
  },
  flames(r, t) {
    r.look(Math.sin(t * 0.4) * 10, 34, -76, 0, 14, 0, 50); r.begin('#3a0a2a', '#0a0210'); r.floor(-200, -100, 200, 100, 0, '#1a0618')
    'FLAMES'.split('').forEach((ch, i) => { const x = -30 + i * 12, y = 8 + Math.sin(t * 2 + i) * 2.5; r.box(x, y, 0, 10, 12, 5, hsl(i * 50 + 340, 80, 55), { glow: 1.1, ry: Math.sin(t + i) * 0.2 }); r.text(x, y, -3.2, ch, 8, '#ffffff') })
    for (let k = 0; k < 12; k++) { const a = (t * 0.8 + k * 0.17) % 1, x = -34 + k * 6.2 + Math.sin(t * 3 + k) * 2; r.sphere(x, 16 + a * 22, 0, 3 * (1 - a) + 0.4, k % 2 ? '#ff9a3a' : '#ffd23a', { glow: 1.6, alpha: 1 - a * 0.7, shine: false }) }
    r.sphere(0, 36, 6, 4, '#ff4d8a', { glow: 1.4 })
  },
  c4(r, t) {
    r.look(0, 26, -78, 0, 24, 0, 50); r.begin('#12203a', '#08101e'); r.box(0, 24, 4, 76, 62, 6, '#1d4aa0')
    const grid = [[0, 0, 1, 0, 2, 0, 0], [0, 0, 1, 1, 2, 2, 0], [0, 1, 2, 2, 1, 1, 0], [0, 2, 1, 1, 2, 1, 2]]
    for (let j = 0; j < 6; j++) for (let i = 0; i < 7; i++) { const v = j >= 2 ? (grid[j - 2] ? grid[j - 2][i] : 0) : 0, c = v === 1 ? '#ff5a6a' : v === 2 ? '#ffd23a' : '#0a1230'; r.disc(-30 + i * 10, 6 + j * 9.4, -1, 4, 1.5, c, { glow: v ? 1.1 : 1 }) }
    r.disc(-10, 52 - ((t * 20) % 40), -4, 4, 2, '#ff5a6a', { glow: 1.2 })
  },
  snake(r, t) {
    sway(r, t, 46, 84, 4, 14); r.begin('#0a2a1a', '#04140c'); r.floor(-200, -140, 200, 140, 0, '#0b3a22')
    for (let i = -8; i <= 8; i++) r.line([i * 8, 0.3, -30], [i * 8, 0.3, 30], '#ffffff12', 1)
    for (let k = 0; k < 12; k++) { const a = k * 0.5 - t * 1.5; r.sphere(-4 + Math.cos(a) * 30 + k * 0.3, 4, Math.sin(a * 1.2) * 10, 4.2 - k * 0.1, k === 0 ? '#7dff6a' : hsl(135 - k * 3, 70, 48 - k)) }
    r.sphere(30, 3.5, -8, 3.4, '#ff4d4d', { glow: 1.2 }); r.box(30, 7.4, -8, 0.8, 2.6, 0.8, '#6a4a2a')
  },
  climb(r, t) {
    sway(r, t, 34, 96, 18, 18); r.begin('#8ad0ff', '#eaf6ff'); r.floor(-260, -140, 260, 160, 0, '#dfeaf5')
    r.pyramid(-30, 0, 20, 70, 60, 50, '#8a9ab0'); r.pyramid(-30, 40, 20, 24, 20, 17, '#ffffff'); r.pyramid(34, 0, 14, 80, 74, 56, '#7a8aa0'); r.pyramid(34, 48, 14, 30, 26, 21, '#ffffff'); r.pyramid(0, 0, 40, 60, 42, 40, '#9aaac0')
    for (let k = 0; k < 4; k++) r.box(-26 + k * 10, 3 + k * 4.6, -12, 12, 2, 6, '#9fd8ff', { alpha: 0.9 })
    const c = (t * 0.5) % 1; person(r, -26 + c * 30, 2 + c * 13.8, -12, '#ff6ab8', Math.sin(t * 10)); r.box(-26 + c * 30 + 3, 10 + c * 13.8, -12, 1, 6, 1, '#6a4a2a'); r.box(-26 + c * 30 + 3, 13 + c * 13.8, -12, 4, 2.4, 2.4, '#bbbbbb')
    for (let i = 0; i < 22; i++) r.sphere(((i * 41 + t * 6) % 120) - 60, 56 - ((i * 13 + t * 12) % 56), -20 + (i % 5) * 4, 0.7, '#ffffff', { shine: false })
  },
  kong(r, t) {
    sway(r, t, 34, 88, 20, 10); r.begin('#1a0a2a', '#0a0414'); r.box(0, 20, 20, 130, 60, 2, '#150a24')
    for (let k = 0; k < 4; k++) r.box(0, 4 + k * 13, 0, 100, 3, 14, '#d9503a', { rz: (k % 2 ? 1 : -1) * 0.05 })
    for (const [x, y] of [[-30, 10], [28, 23], [-26, 36]]) r.box(x, y + 3, 0, 2, 11, 3, '#3de8ff')
    r.box(-38, 49, 0, 12, 12, 8, '#6a3a1a'); r.sphere(-38, 58, 0, 5, '#7a4a22'); r.box(-46, 52, 0, 4, 9, 4, '#6a3a1a'); r.box(-30, 52, 0, 4, 9, 4, '#6a3a1a')
    for (let k = 0; k < 3; k++) { const f = (t * 0.25 + k / 3) % 1; r.sphere(-28 + f * 60, 50 - f * 40, 0, 3.2, '#a2662a', { glow: 1.05 }) }
    person(r, 20 + Math.sin(t) * 6, 0, 0, '#ff5a6a', Math.sin(t * 9))
  },
  hunt(r, t) {
    sway(r, t, 22, 82, 14, 10); r.begin('#05060f', '#0b1030'); r.floor(-200, -140, 200, 140, 0, '#0a140a')
    r.sphere(32, 42, 50, 8, '#e8f0ff', { glow: 1.5, shine: false }); r.sphere(32, 42, 52, 14, '#8aa0ff', { glow: 1.2, alpha: 0.2, shine: false })
    for (let i = 0; i < 12; i++) tree(r, -66 + i * 12 + (i % 3) * 3, 18 + (i % 4) * 8, 1.6 + (i % 3) * 0.3, '#14301a')
    const fl = 0.7 + Math.sin(t * 7) * 0.2; r.sphere(-6, 8, -14, 3, '#ffd080', { glow: 1.8 * fl, alpha: 0.9, shine: false }); r.cyl(-6, 0, -14, 0.5, 6, '#6a4a2a')
    person(r, -6, 0, -10, '#a0a0b0', Math.sin(t * 6) * 0.3)
    const e = 0.5 + 0.5 * Math.sin(t * 2.2); r.sphere(24, 12, 4, 1.1, '#ff2a2a', { glow: 2 * e + 0.4, shine: false }); r.sphere(28, 12, 4, 1.1, '#ff2a2a', { glow: 2 * e + 0.4, shine: false }); r.box(26, 7, 5, 9, 14, 3, '#0a0a0a', { alpha: 0.6, edge: false })
  },
  garden(r, t) {
    sway(r, t, 38, 84, 8, 16); r.begin('#8ad0ff', '#d6f0ff'); ground(r, '#4aa83a')
    for (let j = -1; j <= 1; j++) for (let i = -4; i <= 4; i++) r.box(i * 12, 0.25, j * 12, 11.4, 0.4, 11.4, (i + j) % 2 ? '#52b042' : '#47a038', { edge: false })
    r.cyl(-30, 0, 0, 0.8, 9, '#2a8a2a'); r.sphere(-30, 11, 0, 4.6, '#ffd23a', { glow: 1.2 }); r.sphere(-30, 11, -2.5, 2.2, '#6a3a1a', { shine: false })
    for (let k = 0; k < 8; k++) { const a = k * 0.785 + t; r.sphere(-30 + Math.cos(a) * 5, 11 + Math.sin(a) * 5, 0, 1.6, '#ffe84a', { shine: false }) }
    r.cyl(-12, 0, 12, 0.8, 7, '#2a8a2a'); r.sphere(-12, 9, 12, 3.4, '#5ae05a'); r.box(-8, 9, 12, 5, 2, 2, '#4ac04a'); r.sphere(-4 + ((t * 2) % 1) * 40, 9, 12, 1.2, '#9aff7a', { glow: 1.4, shine: false })
    const zx = 34 - ((t * 3) % 20); r.box(zx, 8, -12, 6, 10, 4, '#6a8a6a'); r.sphere(zx, 15.5, -12, 3.2, '#9ac49a'); r.box(zx - 4, 10, -12, 5, 1.6, 1.6, '#6a8a6a', { rz: 0.3 }); r.box(zx - 1.4, 2, -12, 2, 5, 2.2, '#3a4a5a'); r.box(zx + 1.4, 2, -12, 2, 5, 2.2, '#3a4a5a')
    for (let k = 0; k < 3; k++) r.sphere(-36 + k * 8, 30 + ((t * 8 + k * 6) % 12), 18, 3.2, '#ffe84a', { glow: 1.6, alpha: 0.9, shine: false })
  },
  orb(r, t) {
    r.look(0, 34, -80, 0, 12, 0, 50); r.begin('#10301a', '#04120a'); r.floor(-200, -140, 200, 140, 0, '#0b3a22')
    const cols = ['#ff5a6a', '#ffd23a', '#3de8ff', '#7dff6a', '#b27aff']
    for (let k = 0; k < 11; k++) { const a = -0.8 + k * 0.26, x = -46 + (k + ((t * 0.5) % 1)) * 8.4, z = 14 + Math.sin(a * 2.4) * 10 - k * 0.4; r.sphere(x, 4.2, z, 4, cols[(k * 3 + 1) % 5]) }
    r.cyl(0, 0, -16, 7, 3, '#2a8a3a'); r.sphere(0, 8, -16, 6.4, '#5ae05a'); r.sphere(-2.4, 11, -21, 2, '#ffffff', { shine: false }); r.sphere(2.4, 11, -21, 2, '#ffffff', { shine: false }); r.sphere(-2.4, 11, -22.5, 0.9, '#111111', { shine: false }); r.sphere(2.4, 11, -22.5, 0.9, '#111111', { shine: false }); r.sphere(0, 6, -21, 3.2, '#ffd23a')
    const sh = (t * 1.3) % 1; r.sphere(sh * 4, 8 + sh * 22, -16 + sh * 24, 3.6, cols[(Math.floor(t * 1.3) * 2) % 5], { glow: 1.3 })
    r.sphere(44, 2, 14, 3.4, '#000000', { shine: false }); r.box(44, 0.6, 14, 8, 1.2, 8, '#111111', { edge: false })
  },
  ssx(r, t) {
    r.look(Math.sin(t * 0.5) * 8, 30, -64, 0, 12, 20, 60); r.begin('#8ad0ff', '#f0f8ff'); r.quad([[-120, -6, -30], [120, -6, -30], [120, 60, 220], [-120, 60, 220]], '#f4f8ff')
    for (let k = 0; k < 10; k++) { const z = ((k * 24 - t * 30) % 240 + 240) % 240; tree(r, k % 2 ? -34 : 36, z * 0.9, 1.6, '#2a6a3a') }
    r.box(0, 1.2 + Math.abs(Math.sin(t * 3)) * 2, 0, 3, 0.8, 14, '#ff5a6a', { rz: Math.sin(t * 2) * 0.1 }); r.box(0, 5, 0, 4, 6, 3, '#3de8ff'); r.sphere(0, 10, 0, 2.4, '#e8b890', { shine: false }); r.sphere(0, 12, 0, 2.6, '#ff5a6a')
    for (let i = 0; i < 20; i++) r.sphere(((i * 41 + t * 3) % 140) - 70, 40 - ((i * 13 + t * 16) % 40), 20, 0.5, '#ffffff', { shine: false })
  },
  breaker(r, t) {
    r.look(0, 30, -78, 0, 22, 0, 50); r.begin('#120a2a', '#06030f'); r.box(0, 22, 8, 80, 56, 2, '#0e0820')
    for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) if ((i * 5 + j * 3 + Math.floor(t * 0.4)) % 7 !== 0) r.box(-35 + i * 10, 44 - j * 5.5, 0, 9.2, 4.6, 5, hsl(j * 55 + 330, 80, 55), { glow: 1.08 })
    r.sphere(Math.sin(t * 1.6) * 30, 8 + Math.abs(Math.sin(t * 2.4)) * 18, 0, 2.6, '#ffffff', { glow: 1.3 }); r.box(Math.sin(t * 1.6 - 0.3) * 30, 3, 0, 18, 3, 5, '#3de8ff', { glow: 1.2 })
  },
  mines(r, t) {
    r.look(Math.sin(t * 0.4) * 10, 50, -70, 0, 6, 0, 50); r.begin('#1a1a30', '#0a0a18')
    const nums = [[1, 2, 0, 0, 1], [0, 3, 'm', 1, 1], [0, 2, 'f', 2, 0], [1, 1, 1, 1, 1]]
    nums.forEach((row, j) => row.forEach((v, i) => { const open = v !== 'f' && !(i === 2 && j === 1), x = -24 + i * 12, z = 16 - j * 12; r.box(x, open ? 1.5 : 4, z, 11, open ? 3 : 8, 11, open ? '#c8c8d8' : '#5a6ab0'); if (open && typeof v === 'number' && v > 0) r.text(x, 4, z - 1.5, String(v), 7, ['#2a4aff', '#2a8a2a', '#ff2a2a'][v - 1] || '#000000'); if (v === 'f') { r.box(x, 9, z, 0.8, 7, 0.8, '#222222'); r.box(x + 2, 11, z, 4, 2.4, 0.8, '#ff2a2a') } }))
    r.sphere(0, 6 + Math.abs(Math.sin(t * 3)) * 2, 4, 3.6, '#222222')
    for (let k = 0; k < 8; k++) { const a = k * 0.785; r.box(Math.cos(a) * 4, 7 + Math.abs(Math.sin(t * 3)) * 2, 4 + Math.sin(a) * 4, 3, 1, 1, '#222222', { ry: a }) }
  },
  hockey(r, t) {
    r.look(0, 34, -74, 0, 4, 4, 52); r.begin('#0a1a3a', '#04101e'); r.floor(-200, -120, 200, 120, -0.4, '#101a40'); r.box(0, 0.6, 0, 78, 1.2, 50, '#e8f4ff'); r.box(0, 1.3, 0, 1, 0.4, 50, '#ff5a6a', { edge: false }); r.cyl(0, 1.2, 0, 7, 0.2, '#3de8ff', { seg: 20 })
    for (const sz of [-26, 26]) r.box(0, 2.2, sz, 80, 3.6, 2, '#2a4aa0')
    for (const sx of [-40, 40]) r.box(sx, 2.2, 0, 2, 3.6, 54, '#2a4aa0')
    const px = Math.sin(t * 1.7) * 28, pz = Math.cos(t * 1.1) * 14; r.shadow(px, pz, 3, 0.3, 1.3); r.cyl(px, 1.2, pz, 2.6, 1.4, '#111111', { top: '#333333' })
    r.cyl(Math.sin(t * 1.7 - 0.6) * 24, 1.2, -18, 5, 3, '#ff5a6a', { top: '#ff8a96' }); r.cyl(Math.sin(t * 1.7 + 0.5) * 24, 1.2, 18, 5, 3, '#3de8ff', { top: '#8af0ff' })
  },
  pool(r, t) {
    r.look(0, 36, -72, 0, 4, 2, 52); r.begin('#2a1608', '#120a04'); r.floor(-200, -120, 200, 120, -2, '#2a1a0a'); r.box(0, 0, 0, 84, 3, 48, '#1f7a44', { top: '#1f8a4c' })
    r.box(0, 2, -25, 90, 5, 4, '#6a3a1a'); r.box(0, 2, 25, 90, 5, 4, '#6a3a1a'); r.box(-44, 2, 0, 4, 5, 54, '#6a3a1a'); r.box(44, 2, 0, 4, 5, 54, '#6a3a1a')
    const cols = ['#ffd23a', '#2a4aff', '#ff2a2a', '#7a2aff', '#ff7a2a', '#2aaa4a']
    let k = 0; for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) { r.shadow(12 + i * 4.2, -j * 4.8 + i * 2.4, 2, 0.3, 1.6); r.sphere(12 + i * 4.2, 3.6, -j * 4.8 + i * 2.4, 2.1, cols[k++ % 6]) }
    r.sphere(-20, 3.6, 0, 2.1, '#ffffff'); r.box(-38, 4.6, Math.sin(t * 1.2) * 2, 30, 0.8, 0.8, '#d8b070', { rz: 0.06 })
  },
  td(r, t) {
    sway(r, t, 56, 86, 4, 16); r.begin('#1a2a1a', '#0a140a'); r.floor(-200, -140, 200, 140, 0, '#2a5a2a')
    const path = [[-50, 14], [-20, 14], [-20, -10], [14, -10], [14, 14], [48, 14]]
    for (let i = 0; i < path.length - 1; i++) { const [a, b] = path[i], [c, d] = path[i + 1]; r.box((a + c) / 2, 0.5, (b + d) / 2, Math.abs(c - a) + 8, 1, Math.abs(d - b) + 8, '#8a7a5a', { edge: false }) }
    for (const [x, z, c] of [[-34, 2, '#3de8ff'], [-4, 2, '#ff5a6a'], [30, 0, '#ffd23a']]) { r.cyl(x, 0, z, 4, 6, '#6a6a7a'); r.sphere(x, 8, z, 3.4, c, { glow: 1.2 }); r.box(x + 4, 8, z, 6, 1.4, 1.4, '#444444', { ry: t + x }) }
    for (let k = 0; k < 4; k++) { const f = (t * 0.2 + k * 0.25) % 1, px = -50 + f * 98, pz = px < -20 ? 14 : px < 14 ? -10 : 14; r.sphere(px, 3, pz, 2.6, ['#ff4d4d', '#b27aff', '#7dff6a', '#ff9a3a'][k], { glow: 1.1 }) }
    const sh = (t * 2) % 1; r.sphere(-34 + sh * 24, 8 + sh * 2, 2 - 12 * sh, 1.1, '#ffe84a', { glow: 1.6, shine: false })
  },
  rogue(r, t) {
    sway(r, t, 30, 80, 12, 10); r.begin('#0a0a14', '#14101c'); r.floor(-200, -100, 200, 100, 0, '#2a2433'); r.box(0, 16, 24, 130, 36, 3, '#3a3445')
    for (const x of [-40, -14, 14, 40]) r.box(x, 12, 22, 12, 24, 4, '#2c2638')
    const fl = 0.7 + Math.sin(t * 9) * 0.3
    for (const x of [-26, 26]) { r.cyl(x, 8, 20, 0.6, 8, '#6a4a2a'); r.sphere(x, 18, 20, 2.2, '#ff9a3a', { glow: 1.8 * fl, shine: false }); r.sphere(x, 18, 18, 8, '#ff9a3a', { glow: 1.2, alpha: 0.12 * fl, shine: false }) }
    r.box(-12, 8, 0, 8, 12, 5, '#3de8ff'); r.sphere(-12, 17, 0, 3.4, '#e8b890'); r.box(-12 + 7 + Math.sin(t * 5) * 2, 11, -3, 2, 14, 1.4, '#e6e6ee', { rz: -0.4 + Math.sin(t * 5) * 0.3 }); r.box(-14.4, 1.4, 0, 3, 6, 4, '#222222'); r.box(-9.6, 1.4, 0, 3, 6, 4, '#222222')
    r.sphere(14, 4 + Math.abs(Math.sin(t * 4)) * 2, 0, 5, '#7dff6a', { alpha: 0.9 }); r.sphere(12.4, 6, -4, 1, '#111111', { shine: false }); r.sphere(15.6, 6, -4, 1, '#111111', { shine: false })
    r.sphere(30, 5, 4, 2.4, '#ffd23a', { glow: 1.5 + Math.sin(t * 4) * 0.3 })
  },
  rhythm(r, t) {
    r.look(0, 30, -48, 0, 4, 40, 62); r.begin('#1a0a3a', '#06020f'); r.floor(-200, -40, 200, 400, -0.3, '#0e0820')
    const cols = ['#ff5a6a', '#ffd23a', '#3de8ff', '#7dff6a']
    for (let i = 0; i < 4; i++) { r.box(-24 + i * 16, 0.4, 150, 14, 0.8, 360, hsl(i * 70 + 340, 50, 18), { edge: false }); r.box(-24 + i * 16, 1.4, 4, 14, 2.4, 8, cols[i], { glow: 1.2 }) }
    for (let k = 0; k < 8; k++) { const z = 160 - ((t * 60 + k * 40) % 320), lane = (k * 3 + 1) % 4; r.box(-24 + lane * 16, 3, z, 12.4, 3, 6, cols[lane], { glow: 1.25 }) }
    for (let k = 0; k < 6; k++) r.sphere(-40 + k * 16, 20 + Math.sin(t * 4 + k) * 4, 70, 2.4, cols[k % 4], { glow: 1.5, shine: false, alpha: 0.7 })
  },
  word(r, t) {
    r.look(Math.sin(t * 0.5) * 6, 30, -70, 0, 14, 0, 50); r.begin('#1a1a30', '#0a0a18'); const st = ['#2a8a3a', '#c9b037', '#3a3a50', '#2a8a3a', '#3a3a50']
    'WORDS'.split('').forEach((ch, i) => { const flip = Math.max(0, Math.min(1, (t * 0.8 - i * 0.25) % 3)); r.box(-24 + i * 12, 22 + Math.sin(t * 2 + i) * 1.6, 0, 10.4, 10.4, 5, flip > 0.5 ? st[i] : '#2a2a44', { ry: flip * 0.6 }); r.text(-24 + i * 12, 22, -3.2, ch, 7, '#ffffff') })
    ;[['H', '#3a3a50'], ['E', '#c9b037'], ['A', '#2a8a3a'], ['R', '#3a3a50'], ['T', '#3a3a50']].forEach(([ch, c], i) => { r.box(-24 + i * 12, 9, 0, 10.4, 10.4, 5, c); r.text(-24 + i * 12, 9, -3.2, ch, 7, '#ffffff') })
  },
  merge(r, t) {
    r.look(Math.sin(t * 0.4) * 8, 44, -64, 0, 8, 0, 50); r.begin('#2a2438', '#120e1a'); r.box(0, 0, 0, 56, 3, 56, '#3a3450')
    const v = [[2, 4, 8, 16], [0, 2, 32, 4], [0, 0, 64, 2], [128, 2, 0, 0]], col = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72' }
    v.forEach((row, j) => row.forEach((n, i) => { if (!n) return; const pop = n === 64 ? Math.sin(t * 4) * 0.6 : 0; r.box(-21 + i * 14, 4 + pop, 21 - j * 14, 12.6, 6 + pop, 12.6, col[n]); r.text(-21 + i * 14, 8 + pop, 21 - j * 14 - 4, String(n), n > 99 ? 4.4 : 6, n > 4 ? '#ffffff' : '#776e65') }))
  },
  mini(r, t) {
    sway(r, t, 40, 90, 12, 20); r.begin('#2a1a5a', '#0a0624'); r.floor(-200, -140, 200, 140, 0, '#1a1040')
    r.box(-30, 6, 4, 16, 12, 16, '#3de8ff', { ry: t }); r.box(-30, 16, 4, 12, 8, 12, '#7af0ff', { ry: t * 1.2 }); r.sphere(0, 10 + Math.abs(Math.sin(t * 3)) * 5, 0, 7, '#ff5a6a'); r.gem(30, 12 + Math.sin(t * 2) * 2, 4, 14, '#b27aff', { ry: t }); r.cyl(-8, 0, -18, 5, 10, '#ffd23a'); r.sphere(14, 5, -18, 5, '#7dff6a'); r.sphere(46, 6, -10, 6, '#ff9a3a'); r.pyramid(-50, 0, -10, 12, 18, 12, '#ff4de1')
    for (let i = 0; i < 10; i++) r.sphere(((i * 31 + t * 8) % 120) - 60, 30 + (i * 7) % 18, 20, 0.9, '#ffffff', { shine: false })
  },
  topcard(r, t) {
    r.look(0, 30, -70, 0, 14, 0, 50); r.begin('#2a2008', '#100c02'); r.floor(-200, -100, 200, 100, 0, '#3a2c10')
    r.box(-18, 6, 0, 16, 12, 12, '#c0c0c8'); r.box(0, 9, 0, 16, 18, 12, '#ffd23a', { glow: 1.1 }); r.box(18, 4.5, 0, 16, 9, 12, '#c98a4a'); r.text(0, 9, -6.5, '1', 9, '#6a4a00'); r.text(-18, 6, -6.5, '2', 8, '#555555'); r.text(18, 4.5, -6.5, '3', 8, '#5a3a10')
    r.cyl(0, 18, 0, 4, 1, '#ffd23a'); r.cyl(0, 19, 0, 6, 5, '#ffd23a', { glow: 1.3, top: '#ffe84a' }); r.sphere(-6, 24, 0, 1.4, '#ffe84a', { glow: 1.8 + Math.sin(t * 6), shine: false }); r.sphere(7, 27, 3, 1.2, '#ffffff', { glow: 1.8 + Math.sin(t * 5), shine: false })
  },
  shipcard(r, t) {
    sway(r, t, 28, 74, 6, 18); r.begin('#0a1030', '#02030a'); stars(r, t, 24, 8)
    const y = 12 + Math.sin(t * 2) * 1.5
    r.box(0, y, 0, 22, 6, 9, '#3de8ff', { ry: t * 0.6 }); r.pyramid(14, y, 0, 9, 11, 9, '#bff6ff', { rz: -1.5708, ry: t * 0.6 }); r.box(-3, y, 0, 9, 1.4, 30, '#2fb8d4', { ry: t * 0.6 })
    r.sphere(-16, y, 0, 3.4 + Math.sin(t * 20) * 0.5, '#ff9a3a', { glow: 1.7, shine: false })
    r.cyl(-40, 0, 0, 5, 14, '#6a6a7a'); r.box(36, 8, 0, 10, 2, 10, '#ffd23a'); r.box(36, 4, 0, 2, 8, 2, '#8a8a9a'); r.sphere(36, 14, 0, 3, '#ff4de1', { glow: 1.4 })
  },
}
