export const WIN_LEVELS = {
  NONE: 0,
  SMALL: 1,
  MEDIUM: 2,
  BIG: 3,
  EPIC: 4,
};

export function classifyWin(multiplier) {
  const m = Number(multiplier);
  if (!Number.isFinite(m) || m <= 0) return WIN_LEVELS.NONE;
  if (m < 2) return WIN_LEVELS.SMALL;
  if (m < 10) return WIN_LEVELS.MEDIUM;
  if (m < 50) return WIN_LEVELS.BIG;
  return WIN_LEVELS.EPIC;
}

export function levelName(level) {
  return ['Nenhuma', 'Pequena', 'Média', 'Grande', 'Extraordinária'][level] || 'Nenhuma';
}

const LEVEL_DURATION = { 1: 700, 2: 1100, 3: 1600, 4: 2600 };

export class EffectsController {
  constructor() {
    this.layer = document.getElementById('effectsLayer');
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.timeouts = [];
  }

  schedule(fn, delay) {
    const id = setTimeout(() => {
      this.timeouts = this.timeouts.filter((x) => x !== id);
      fn();
    }, delay);
    this.timeouts.push(id);
    return id;
  }

  clearTimers() {
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts = [];
  }

  clear() {
    if (!this.layer) return;
    this.clearTimers();
    this.layer.innerHTML = '';
    this.layer.classList.remove('level-1', 'level-2', 'level-3', 'level-4');
  }

  async celebrate({ level, multiplier, winAmount, fullGrid }) {
    if (!this.layer || level === WIN_LEVELS.NONE) return;
    this.clear();
    this.layer.classList.add('level-' + level);

    const duration = LEVEL_DURATION[level] || 800;
    const count = this.reduced ? Math.max(4, Math.floor(6 / level)) : 12 + level * 10;

    // glow
    const glow = document.createElement('div');
    glow.className = 'effect-glow level-' + level;
    this.layer.appendChild(glow);

    // particles
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle level-' + level;
      const angle = (Math.PI * 2 * i) / count;
      const dist = 60 + Math.random() * 80;
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.left = '50%';
      p.style.top = '50%';
      this.layer.appendChild(p);
    }

    // coins for medium+
    if (level >= 2 && !this.reduced) {
      const coins = level === 4 ? 24 : level === 3 ? 16 : 10;
      for (let i = 0; i < coins; i++) {
        const c = document.createElement('div');
        c.className = 'coin level-' + level;
        c.textContent = '🪙';
        c.style.left = (20 + Math.random() * 60) + '%';
        c.style.animationDelay = (Math.random() * 0.4) + 's';
        this.layer.appendChild(c);
      }
    }

    // fireworks for big+
    if (level >= 3 && !this.reduced) {
      const bursts = level === 4 ? 5 : 3;
      for (let b = 0; b < bursts; b++) {
        this.schedule(() => this.spawnFirework(), b * 300);
      }
    }

    // epic overlay
    if (level === 4) {
      const overlay = document.createElement('div');
      overlay.className = 'epic-overlay';
      overlay.innerHTML = `<div class="epic-title">GRANDE VITÓRIA!</div><div class="epic-amount"></div><div class="epic-mult">×${multiplier.toFixed(2)}</div>`;
      const amt = overlay.querySelector('.epic-amount');
      amt.textContent = formatMoney(winAmount);
      this.layer.appendChild(overlay);
    }

    if (fullGrid) {
      const mg = document.createElement('div');
      mg.className = 'fullgrid-flash';
      this.layer.appendChild(mg);
    }

    await new Promise((res) => {
      const id = setTimeout(() => {
        this.timeouts = this.timeouts.filter((x) => x !== id);
        res();
      }, duration);
      this.timeouts.push(id);
    });
    this.clear();
  }

  spawnFirework() {
    if (!this.layer) return;
    const fw = document.createElement('div');
    fw.className = 'firework';
    fw.style.left = (10 + Math.random() * 80) + '%';
    fw.style.top = (10 + Math.random() * 40) + '%';
    const sparks = this.reduced ? 6 : 16;
    for (let i = 0; i < sparks; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      const a = (Math.PI * 2 * i) / sparks;
      const d = 40 + Math.random() * 60;
      s.style.setProperty('--sx', Math.cos(a) * d + 'px');
      s.style.setProperty('--sy', Math.sin(a) * d + 'px');
      fw.appendChild(s);
    }
    this.layer.appendChild(fw);
    this.schedule(() => { if (fw.parentNode) fw.remove(); }, 900);
  }
}

function formatMoney(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}