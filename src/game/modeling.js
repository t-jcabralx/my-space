import { BufferGeometry, Float32BufferAttribute } from 'three'

// 44 triangles, regardless of bevel size. Shared by thousands of instanced props.
export function beveledBoxGeometry(bevel = 0.08) {
  const h = 0.5, a = h - Math.max(0.001, Math.min(0.49, bevel)), positions = []
  function face(points) {
    const u = points[1].map((v, i) => v - points[0][i]), v = points[2].map((v, i) => v - points[0][i])
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (n.reduce((s, v, i) => s + v * points[0][i], 0) < 0) points.reverse()
    for (let i = 1; i < points.length - 1; i++) positions.push(...points[0], ...points[i], ...points[i + 1])
  }
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const j = (axis + 1) % 3, k = (axis + 2) % 3
    face([[-a, -a], [a, -a], [a, a], [-a, a]].map(([u, v]) => { const p = [0, 0, 0]; p[axis] = sign * h; p[j] = u; p[k] = v; return p }))
  }
  for (let axis = 0; axis < 3; axis++) for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const j = (axis + 1) % 3, k = (axis + 2) % 3
    face([[-a, h, a], [a, h, a], [a, a, h], [-a, a, h]].map(([u, v, w]) => { const p = [0, 0, 0]; p[axis] = u; p[j] = s * v; p[k] = t * w; return p }))
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) face([[x * h, y * a, z * a], [x * a, y * h, z * a], [x * a, y * a, z * h]])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

// Opt in at an entity boundary. Simulation/test writers keep the same API.
const adapters = new WeakMap()
export function modelApi(api) {
  if (!api.putBody) return api
  let result = adapters.get(api)
  if (!result) { result = { ...api, put3: api.putBody, putM: api.putBodyM || api.putM }; adapters.set(api, result) }
  return result
}
