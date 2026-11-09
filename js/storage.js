export function loadState() {
  try {
    return JSON.parse(localStorage.getItem('fts_state') || '{}');
  } catch (e) {
    return {};
  }
}
export function saveState(state) {
  try {
    localStorage.setItem('fts_state', JSON.stringify(state));
  } catch (e) {}
}
export function clearState() {
  try { localStorage.removeItem('fts_state'); } catch (e) {}
}
