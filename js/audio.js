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
  else if (level === 3) { playTone(523,0.1,'square',0.09); setTimeout(()=>playTone(659,0.1,'square',0.09),100); setTimeout(()=>playTone(784,0.15,'square',0.09),200); }
  else if (level === 4) { playTone(523,0.12,'sawtooth',0.1); setTimeout(()=>playTone(659,0.12,'sawtooth',0.1),120); setTimeout(()=>playTone(784,0.12,'sawtooth',0.1),240); setTimeout(()=>playTone(1047,0.2,'sawtooth',0.1),360); }
}
