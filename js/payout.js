/**
 * Avaliação de linhas e pagamentos.
 *
 * PARÂMETROS CONFIRMADOS: 5 linhas, paytable, Wild substitui, ×10 full screen.
 */

import { getSymbol, BLANK } from './symbols.js';
import { PAYLINES, GAME_CONSTANTS } from './config.js';

function isBlank(cell) {
  return cell === null || cell === undefined || cell === BLANK;
}

// Determina o símbodo "base" de uma linha (primeiro não-Wild), se houver.
function lineBaseSymbol(lineSymbols) {
  for (const s of lineSymbols) {
    if (isBlank(s)) return null;
    if (s !== 'WILD') return s;
  }
  // todos wild
  if (lineSymbols.every((s) => s === 'WILD')) return 'WILD';
  return null;
}

/**
 * Avalia uma única linha.
 * Retorna { win: number (em créditos), multiplier: number, symbols: string[] } ou null.
 */
export function evaluateLine(grid, line, betPerLine) {
  const symbols = line.map(([r, c]) => grid[r][c]);
  if (symbols.some(isBlank)) return null;
  const base = lineBaseSymbol(symbols);
  if (!base) return null;
  // todos devem ser base ou WILD
  for (const s of symbols) {
    if (s !== base && s !== 'WILD') return null;
  }
  const mult = getSymbol(base).lineMultiplier;
  return { symbols, multiplier: mult, win: mult * betPerLine };
}

export function evaluateGrid(grid, betPerLine) {
  const lineWins = [];
  let totalWin = 0;
  for (const line of PAYLINES) {
    const res = evaluateLine(grid, line, betPerLine);
    if (res) {
      lineWins.push({ line, ...res });
      totalWin += res.win;
    }
  }
  const fullGrid = isFullGridWin(grid);
  return { lineWins, totalWin, fullGrid };
}

export function isFullGridWin(grid) {
  // Todos os 9 espaços ocupados (sem blanks) e todos são o mesmo símbodo
  // (considerando Wild como substituto do símbodo base).
  const cells = grid.flat();
  if (cells.some(isBlank)) return false;
  // determina base
  let base = null;
  for (const c of cells) {
    if (c !== 'WILD') {
      base = c;
      break;
    }
  }
  if (base === null) base = 'WILD'; // todos wild
  for (const c of cells) {
    if (c !== base && c !== 'WILD') return false;
  }
  return true;
}

export function applyFullGridMultiplier(totalWin, isFullGrid, multiplier = GAME_CONSTANTS.FULL_GRID_MULTIPLIER) {
  if (!isFullGrid) return totalWin;
  return totalWin * multiplier;
}

export function capWin(totalWin, bet, maxMultiplier = GAME_CONSTANTS.MAX_WIN_MULTIPLIER) {
  const cap = bet * maxMultiplier;
  return totalWin > cap ? cap : totalWin;
}
