// A tiny skeletal rig for the voxel characters: a limb is a box hung from a joint and swung by an angle (radians, 0 = straight down,
// positive = towards +x, PI = straight up). It returns the far end so the next segment (forearm, shin, hammer) can be chained on.
export function limb(put3, jx, jy, jz, phi, len, th, thz, c, k = 1) {
  const s = Math.sin(phi), co = Math.cos(phi)
  put3(jx + s * len / 2, jy - co * len / 2, jz, th, len, thz, Math.PI - phi, c[0] * k, c[1] * k, c[2] * k, 0)
  return [jx + s * len, jy - co * len]
}
export const lerp = (a, b, t) => a + (b - a) * t
export const ease = (t) => t * t * (3 - 2 * t)
