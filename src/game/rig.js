// A compact jointed rig for the arcade characters: a limb is a box hung from a joint and swung by an angle (radians, 0 = straight down,
// positive = towards +x, PI = straight up). It returns the far end so the next segment (forearm, shin, hammer) can be chained on.
export function limb(put3, jx, jy, jz, phi, len, th, thz, c, k = 1) {
  const s = Math.sin(phi), co = Math.cos(phi)
  // Overlapping tapered sections keep elbows/knees connected through the full swing.
  put3(jx + s * len * 0.24, jy - co * len * 0.24, jz, th, len * 0.56, thz, Math.PI - phi, c[0] * k, c[1] * k, c[2] * k, 0)
  put3(jx + s * len * 0.73, jy - co * len * 0.73, jz, th * 0.82, len * 0.56, thz * 0.86, Math.PI - phi, c[0] * k, c[1] * k, c[2] * k, 0)
  return [jx + s * len, jy - co * len]
}
export const lerp = (a, b, t) => a + (b - a) * t
export const ease = (t) => t * t * (3 - 2 * t)
