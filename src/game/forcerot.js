// Forced landscape for phones held upright: the game stage is turned 90 degrees with CSS so it fills the screen, and every
// pointer/mouse/click event is rotated back into the stage's own coordinates before the game sees it (games read pointer
// positions as fractions of an element's bounding box, so we hand them coordinates that give the right fractions).
const state = { on: false, dir: 1 }
let installed = false
const TYPES = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'contextmenu']
function remap(e) {
  if (!state.on || e.__fr || typeof e.clientX !== 'number') return
  const t = e.target
  if (!t || !t.closest || !t.closest('.wrap.forced')) return
  const stage = document.querySelector('.wrap.forced .stage')
  const ref = t.closest('[data-frref]') || stage
  if (!ref) return
  const r = ref.getBoundingClientRect(), ew = ref.offsetWidth || 1, eh = ref.offsetHeight || 1
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
  const fu = state.dir > 0 ? 0.5 + dy / ew : 0.5 - dy / ew
  const fv = state.dir > 0 ? 0.5 - dx / eh : 0.5 + dx / eh
  const init = { bubbles: e.bubbles, cancelable: e.cancelable, composed: true, view: window, clientX: r.left + fu * r.width, clientY: r.top + fv * r.height, screenX: e.screenX, screenY: e.screenY, button: e.button, buttons: e.buttons, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, detail: e.detail }
  let ne
  try {
    if (typeof PointerEvent !== 'undefined' && e instanceof PointerEvent) ne = new PointerEvent(e.type, { ...init, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, width: e.width, height: e.height, pressure: e.pressure })
    else ne = new MouseEvent(e.type, init)
  } catch { return }
  ne.__fr = true
  e.stopImmediatePropagation()
  t.dispatchEvent(ne)
}
export function setForceRot(on, dir = 1) {
  state.on = !!on; state.dir = dir >= 0 ? 1 : -1
  if (!installed && typeof window !== 'undefined') { installed = true; for (const ty of TYPES) window.addEventListener(ty, remap, true) }
}
export const forceRotState = () => state
