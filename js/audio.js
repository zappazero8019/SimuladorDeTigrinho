let ctx = null;
function ensure() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  return ctx;
}
export function playTone(freq, duration, type='sine', gain=0.08) {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + duration);
}
export function soundSpin() { playTone(220, 0.05, 'square', 0.05); }
export function soundWin() { playTone(660, 0.15, 'triangle', 0.1); setTimeout(()=>playTone(880,0.15,'triangle',0.1),120); }
export function soundFeature() { playTone(440,0.1,'sawtooth',0.08); setTimeout(()=>playTone(660,0.1,'sawtooth',0.08),100); setTimeout(()=>playTone(880,0.2,'sawtooth',0.08),200); }
export function soundLose() { playTone(180, 0.12, 'sawtooth', 0.05); }
export function soundWinLevel(level) {
  if (level === 1) { playTone(660, 0.12, 'triangle', 0.08); }
  else if (level === 2) { playTone(660, 0.12, 'triangle', 0.09); setTimeout(()=>playTone(880,0.12,'triangle',0.09),120); }
  else if (level === 3) {
    playTone(523,0.1,'square',0.1);
    setTimeout(()=>playTone(659,0.1,'square',0.1),100);
    setTimeout(()=>playTone(784,0.1,'square',0.1),200);
    setTimeout(()=>playTone(1047,0.15,'square',0.12),300);
    setTimeout(()=>playTone(1318,0.2,'square',0.14),450);
  }
  else if (level === 4) {
    playTone(523,0.12,'sawtooth',0.12);
    setTimeout(()=>playTone(659,0.12,'sawtooth',0.12),100);
    setTimeout(()=>playTone(784,0.12,'sawtooth',0.12),220);
    setTimeout(()=>playTone(1047,0.15,'sawtooth',0.14),340);
    setTimeout(()=>playTone(1318,0.15,'sawtooth',0.14),460);
    setTimeout(()=>playTone(1567,0.25,'sawtooth',0.16),580);
    setTimeout(()=>playTone(2093,0.35,'sawtooth',0.18),720);
  }
}

export function soundWinPopup() {
  playTone(880, 0.08, 'triangle', 0.06);
  setTimeout(() => playTone(1320, 0.12, 'triangle', 0.08), 80);
}
