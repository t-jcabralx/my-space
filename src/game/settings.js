// User settings, saved in localStorage. Read by audio, engine (screen shake) and GameApp (quality).
const DEFAULTS = { master: 1, music: 1, sfx: 1, voice: true, shake: true, quality: 'auto' }
export const settings = { ...DEFAULTS }
try { Object.assign(settings, JSON.parse(localStorage.getItem('si_settings') || '{}')) } catch { /* ignore */ }
const subs = new Set()
export const subscribeSettings = (f) => { subs.add(f); return () => subs.delete(f) }
let snap = { ...settings }
export const getSettings = () => snap
export function setSetting(k, v) {
  settings[k] = v
  snap = { ...settings }
  try { localStorage.setItem('si_settings', JSON.stringify(settings)) } catch { /* ignore */ }
  subs.forEach((f) => f())
}
export function resetSettings() { Object.assign(settings, DEFAULTS); snap = { ...settings }; try { localStorage.removeItem('si_settings') } catch { /* ignore */ } subs.forEach((f) => f()) }
