export const SYMBOL_DISPLAY = {
  WILD: { src: 'assets/symbols/wild.svg', label: 'Wild' },
  INGOT: { src: 'assets/symbols/ingot.svg', label: 'Ingot' },
  CHARM: { src: 'assets/symbols/charm.svg', label: 'Charm' },
  BAG: { src: 'assets/symbols/bag.svg', label: 'Bag' },
  ENVELOPE: { src: 'assets/symbols/envelope.svg', label: 'Envelope' },
  FIRECRACKER: { src: 'assets/symbols/firecracker.svg', label: 'Firecracker' },
  ORANGE: { src: 'assets/symbols/orange.svg', label: 'Orange' },
};

export function symbolCell(sym) {
  const d = SYMBOL_DISPLAY[sym] || { emoji: '?', label: sym };
  return `<div class="cell symbol-${sym}" data-symbol="${sym}"><span class="sym-emoji">${d.emoji}</span></div>`;
}

export class GameUI {
  constructor() {
    this.reelsEl = document.getElementById('reels');
    this.reelEls = [...this.reelsEl.querySelectorAll('.reel')];
    this.featureOverlay = document.getElementById('featureOverlay');
    this.featureText = document.getElementById('featureText');
    this.featureChosen = document.getElementById('featureChosen');
    this.multiplierPopup = document.getElementById('multiplierPopup');
    this.linesInfo = document.getElementById('linesInfo');
    this.spinInterval = null;
  }

  renderGrid(grid) {
    this.reelEls.forEach((reel, c) => {
      reel.innerHTML = '';
      for (let r = 0; r < 3; r++) {
        const sym = grid[r][c];
        const div = document.createElement('div');
        div.className = 'cell' + (sym === null ? ' blank-cell' : ` symbol-${sym}`);
        if (sym === null) div.textContent = '·';
        else {
          const img = document.createElement('img');
          img.src = SYMBOL_DISPLAY[sym]?.src || '';
          img.alt = SYMBOL_DISPLAY[sym]?.label || sym;
          img.className = 'sym-img';
          div.appendChild(img);
        }
        reel.appendChild(div);
      }
    });
  }

  setSpinning(on) {
    this.reelEls.forEach((reel) => {
      if (on) reel.classList.add('spinning');
      else reel.classList.remove('spinning');
    });
    if (on) {
      if (this.spinInterval) clearInterval(this.spinInterval);
      const syms = Object.keys(SYMBOL_DISPLAY);
      this.spinInterval = setInterval(() => {
        this.reelEls.forEach((reel) => {
          const cells = reel.querySelectorAll('.cell');
          cells.forEach((cell) => {
            const s = syms[Math.floor(Math.random() * syms.length)];
            cell.textContent = '';
            const img = document.createElement('img');
            img.src = SYMBOL_DISPLAY[s].src;
            img.alt = SYMBOL_DISPLAY[s].label;
            img.className = 'sym-img';
            cell.appendChild(img);
          });
        });
      }, 80);
    } else {
      if (this.spinInterval) clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
  }

  clearHighlights() {
    this.reelsEl.querySelectorAll('.cell').forEach((c) => c.classList.remove('win-cell', 'sticky'));
    this.linesInfo.textContent = '';
    this.featureOverlay.hidden = true;
    if (this.featureText) this.featureText.hidden = true;
    if (this.featureChosen) this.featureChosen.hidden = true;
    this.multiplierPopup.hidden = true;
  }

  highlightWins(lineWins) {
    const cellSet = new Set();
    for (const lw of lineWins) {
      for (const [r, c] of lw.line) cellSet.add(`${r},${c}`);
    }
    this.reelsEl.querySelectorAll('.cell').forEach((cell, i) => {
      // map index to r,c: reel-major? We rendered per reel columns: reel c, row r.
    });
    // Apply by position:
    this.reelEls.forEach((reel, c) => {
      const cells = reel.querySelectorAll('.cell');
      cells.forEach((cell, r) => {
        if (cellSet.has(`${r},${c}`)) cell.classList.add('win-cell');
      });
    });
    if (lineWins.length > 0) {
      this.linesInfo.textContent = `${lineWins.length} linha(s) vencedora(s): ` +
        lineWins.map((l) => l.multiplier + '×').join(', ');
    } else {
      this.linesInfo.textContent = 'Sem prêmio.';
    }
  }

  showFeature(chosen, fullGrid) {
    if (this.featureText) this.featureText.hidden = false;
    if (this.featureChosen) {
      this.featureChosen.hidden = false;
      this.featureChosen.textContent = `Símbodo escolhido: ${SYMBOL_DISPLAY[chosen]?.label || chosen}`;
    }
    this.featureOverlay.hidden = false;
    this.featureOverlay.classList.remove('is-active');
    void this.featureOverlay.offsetWidth;
    this.featureOverlay.classList.add('is-active');
    // sticky cells = non-blank
    this.reelEls.forEach((reel) => {
      reel.querySelectorAll('.cell').forEach((cell) => {
        if (cell.textContent.trim() !== '·' && !cell.classList.contains('blank-cell')) {
          cell.classList.add('sticky');
        }
      });
    });
  }

  showMultiplier() {
    this.multiplierPopup.hidden = false;
    setTimeout(() => { this.multiplierPopup.hidden = true; }, 1200);
  }
}
