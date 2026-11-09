/**
 * Motor de jogo: orquestra rodada normal e Feature (respins, sticky, ×10).
 *
 * Mecânica do Feature (confirmada):
 * - aciona aleatoriamente;
 * - escolhe um símbodo regular;
 * - rolos contêm apenas chosen / Wild / blank;
 * - sticky: chosen e Wild ficam; respins até não haver novos ou tela cheia;
 * - tela cheia => ×10.
 */

import { GAME_CONSTANTS } from './config.js';
import { REGULAR_SYMBOLS } from './symbols.js';
import { spinGrid, chooseFeatureSymbol, spinFeatureGrid, spinFeatureCell } from './reels.js';
import { evaluateGrid, applyFullGridMultiplier, capWin } from './payout.js';

function cloneGrid(g) {
  return g.map((r) => r.slice());
}

function hasBlank(grid) {
  return grid.flat().some((c) => c === null);
}

function isFull(grid) {
  return grid.flat().every((c) => c !== null);
}

/**
 * Executa o Feature completo, retornando { chosenSymbol, grid }.
 */
export function runFeature(rng, config) {
  const featureCfg = config.feature || {};
  const triggerWeights = featureCfg.symbolChoiceWeights || null;
  const chosen = chooseFeatureSymbol(rng, triggerWeights);

  // grade inicial
  let grid = spinFeatureGrid(rng, chosen, featureCfg.cellWeights);

  // sticky: posições com chosen ou WILD ficam travadas
  const locked = grid.map((r) => r.map((c) => c === chosen || c === 'WILD'));

  // respins enquanto houver espaços vazios e não for tela cheia
  let safety = 0;
  let respins = 0;
  while (!isFull(grid) && safety < 100) {
    safety++;
    respins++;
    let newLockedThisRound = false;
    const newGrid = cloneGrid(grid);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (locked[r][c]) continue;
        const cell = spinFeatureCell(rng, chosen, featureCfg.cellWeights);
        newGrid[r][c] = cell;
        if (cell === chosen || cell === 'WILD') {
          locked[r][c] = true;
          newLockedThisRound = true;
        }
      }
    }
    grid = newGrid;
    if (!newLockedThisRound) break;
    if (isFull(grid)) break;
  }

  return { chosenSymbol: chosen, grid, respins };
}

/**
 * Executa uma rodada completa.
 * @param {object} params
 * @param {number} params.bet - aposta total da rodada
 * @param {object} params.rng - RNG
 * @param {object} params.config - perfil/config
 * @param {number} [params.balance] - saldo inicial (opcional, para retornar saldo final)
 */
export function playSpin({ bet, rng, config, balance }) {
  if (!Number.isFinite(bet) || bet <= 0) throw new Error('aposta inválida');
  if (!rng || typeof rng.random !== 'function') throw new Error('rng inválido');
  if (!config) throw new Error('config inválido');

  const lines = GAME_CONSTANTS.PAYLINE_COUNT;
  const betPerLine = bet / lines;

  // desconta aposta (conceitualmente) — saldo final calculado abaixo
  let featureTriggered = rng.random() < (config.feature?.triggerProbability ?? 0);

  let grid;
  let feature = null;

  if (featureTriggered) {
    feature = runFeature(rng, config);
    grid = feature.grid;
  } else {
    grid = spinGrid(rng, config.weights);
  }

  const evalRes = evaluateGrid(grid, betPerLine);
  let totalWin = evalRes.totalWin;
  if (applyFullGridMultiplier) {
    totalWin = applyFullGridMultiplier(totalWin, evalRes.fullGrid, GAME_CONSTANTS.FULL_GRID_MULTIPLIER);
  }
  if (config.enforceMaxWin) {
    totalWin = capWin(totalWin, bet, GAME_CONSTANTS.MAX_WIN_MULTIPLIER);
  }

  // arredondamento para evitar floats longos (2 casas)
  totalWin = Math.round(totalWin * 100) / 100;

  const balanceAfter = balance !== undefined
    ? Math.round((balance - bet + totalWin) * 100) / 100
    : undefined;

  return {
    bet,
    balanceBefore: balance,
    balanceAfter,
    grid,
    featureTriggered,
    feature,
    lineWins: evalRes.lineWins,
    fullGrid: evalRes.fullGrid,
    totalWin,
    hit: totalWin > 0,
  };
}
