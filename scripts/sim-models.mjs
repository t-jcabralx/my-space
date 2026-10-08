import { ART_CAPACITY } from '../src/game/artDirection.js'
import { drawCinematic, STORY_WORLDS } from '../src/game/cinematics.js'
import assert from 'node:assert/strict'
import { beveledBoxGeometry, modelApi } from '../src/game/modeling.js'
import { games, update } from '../src/game/engine.js'
import { MINI } from '../src/game/mini/games.js'
import { ART } from '../src/game/mini/art.js'
import { makeR3 } from '../src/game/mini/r3.js'

// A closed, outward-facing mesh is essential: otherwise the beveled parts disappear at some angles.
for (const bevel of [0.045, 0.1, 0.24]) {
  const geo = beveledBoxGeometry(bevel), p = geo.getAttribute('position'), n = geo.getAttribute('normal'), edges = new Map()
  assert.equal(p.count / 3, 44)
  for (let i = 0; i < p.count; i++) {
    assert.ok([p.getX(i), p.getY(i), p.getZ(i)].every(v => Number.isFinite(v) && Math.abs(v) <= 0.5))
    assert.ok(p.getX(i) * n.getX(i) + p.getY(i) * n.getY(i) + p.getZ(i) * n.getZ(i) > 0)
  }
  for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
    const vertex = k => [p.getX(k), p.getY(k), p.getZ(k)].join(',')
    const edge = [vertex(i + j), vertex(i + (j + 1) % 3)].sort().join('|')
    edges.set(edge, (edges.get(edge) || 0) + 1)
  }
  assert.ok([...edges.values()].every(count => count === 2), 'closed manifold geometry')
  geo.dispose()
}
console.log('PASS all bevel meshes: 44 triangles, closed surfaces, outward normals')

const counts = {}
const finite = args => assert.ok(args.flat(Infinity).every(Number.isFinite), 'finite render arguments')
const writer = name => (...args) => { finite(args); counts[name] = (counts[name] || 0) + 1 }
const api = Object.fromEntries(['put', 'putBall', 'put3', 'putM', 'putS', 'putBody', 'putBodyM', 'putCyl'].map(name => [name, writer(name)]))
api.putShape = (kind,...args) => { assert.ok(kind in ART_CAPACITY); finite(args); counts[kind]=(counts[kind]||0)+1 }
api.bulk = (matrices, colors, count) => {
  finite(Array.from(matrices.subarray(0, count * 16))); finite(Array.from(colors.subarray(0, count * 3)))
  counts.put3 = (counts.put3 || 0) + count
}
assert.equal(modelApi(api), modelApi(api))
assert.equal(modelApi(api).put3, api.putBody)
assert.equal(modelApi(api).putM, api.putBodyM)
const fallback = { put3: writer('fallback') }
assert.equal(modelApi(fallback), fallback)

const modes = ['fight', 'race', 'rogue', 'empire', 'hunt', 'garden', 'climb', 'kong', 'ssx', 'orb', 'hockey', 'pool', 'td', 'snake', 'breaker', 'rhythm']
for (const mode of modes) {
  const mod = await import('../src/game/' + mode + '.js'), actions = mod[mode + 'Actions']
  actions.start(mode === 'fight' ? { type: 'demo' } : {})
  if (mode === 'rogue') actions.skipTale()
  const peak = {}
  for (let frame = 0; frame < 180; frame++) {
    update(1 / 60)
    if (frame % 30 !== 0) continue
    for (const name of Object.keys(counts)) counts[name] = 0
    games[mode].draw3(api)
    for (const [name, count] of Object.entries(counts)) peak[name] = Math.max(peak[name] || 0, count)
  }
  assert.ok(Object.values(peak).some(v => v > 0), mode + ' rendered')
  assert.ok((peak.putBody || 0) + (peak.putBodyM || 0) <= 8192, mode + ' body capacity')
  assert.ok((peak.putCyl || 0) <= 1024, mode + ' cylinder capacity')
  for(const [kind,max] of Object.entries(ART_CAPACITY)) assert.ok((peak[kind]||0)<=max,mode+' '+kind+' capacity: '+peak[kind])
  if (actions.stop) actions.stop()
  else if (actions.quit) actions.quit()
  console.log('PASS ' + mode + ': finite model transforms, within instance capacity')
}

api.sprite = () => {}; api.text = () => []; api.pops = () => {}
for (const mode of ['pickle', 'bomber', 'tetris', 'chomp', 'slug', 'flames']) {
  const mod = await import('../src/game/' + mode + '.js'), actions = mod[mode + 'Actions']
  actions.start()
  for (let frame = 0; frame < 60; frame++) {
    update(1 / 60)
    if (frame % 15 === 0) games[mode].draw(api)
  }
  if (actions.stop) actions.stop()
  else if (actions.quit) actions.quit()
  console.log('PASS ' + mode + ': finite raised sprite and round prop geometry')
}

// Exercise real 2D canvas rendering, including all gallery art, without a browser.
const gradient = { addColorStop() {} }
const canvas = new Proxy({}, {
  get: (_, name) => name.startsWith('create') ? () => gradient : (...args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), name + ' received a non-finite coordinate')
  },
  set: () => true,
})
for (const def of MINI) {
  const g = def.make(); g.reset()
  for (let i = 0; i < 5; i++) { g.update(1 / 60); g.draw(canvas) }
}
for (const draw of Object.values(ART)) {
  if (typeof draw !== 'function') continue
  draw(makeR3(canvas), 1)
}
for(const game of Object.keys(STORY_WORLDS)) for(const phase of ['intro','outro','lost']) drawCinematic(makeR3(canvas,960,540),{game,cast:['echo','nova','arc'],speaker:'echo',talking:true,phase},1)
console.log('PASS every chapter environment and cast: finite cinematic geometry')
console.log('PASS all ' + MINI.length + ' mini-games and gallery scenes: finite canvas geometry')

// The audio scheduler keeps an interval alive even in headless simulations.
process.exit(0)
