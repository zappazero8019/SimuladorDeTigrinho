/**
 * Distribuição dos símbodos nos rolos.
 *
 * PARÂMETROS EXPERIMENTAIS: pesos por símbodo (não oficiais).
 * A mecânica (Feature, respins, ×10) é confirmada.
 */

import { SYMBOLS, REGULAR_SYMBOLS, BLANK } from './symbols.js';

function normalizeWeights(weights) {
  const out = {};
  for (const s of SYMBOLS) {
    const w = weights && weights[s.id];
    out[s.id] = Number.isFinite(w) && w >= 0 ? w : 0;
  }
  return out;
}

function weightedPickSymbol(rng, weights) {
  const entries = SYMBOLS.map((s) => s.id);
  const id = rng.pickWeighted(entries, (x) => weights[x] ?? 0);
  return id;
}

// PARÂMETRO CONFIRMADO: grade 3x3.
export function spinGrid(rng, weights) {
  const w = normalizeWeights(weights);
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      row.push(weightedPickSymbol(rng, w));
    }
    grid.push(row);
  }
  return grid;
}

// PARÂMETRO CONFIRMADO: escolhe um símbodo regular (excluindo Wild) para o Feature.
export function chooseFeatureSymbol(rng, weights) {
  // weights: null/uniforme ou objeto id->peso
  const entries = REGULAR_SYMBOLS.map((s) => s.id);
  if (!weights) return rng.pick(entries);
  return rng.pickWeighted(entries, (id) => {
    const w = weights[id];
    return Number.isFinite(w) && w >= 0 ? w : 0;
  });
}

// PARÂMETRO EXPERIMENTAL: pesos das células no Feature (chosen/wild/blank).
export function spinFeatureCell(rng, chosenSymbolId, cellWeights) {
  const w = cellWeights || { chosen: 1, wild: 1, blank: 1 };
  const entries = ['chosen', 'wild', 'blank'];
  const kind = rng.pickWeighted(entries, (k) => w[k] ?? 0);
  if (kind === 'chosen') return chosenSymbolId;
  if (kind === 'wild') return 'WILD';
  return null; // blank
}

export function spinFeatureGrid(rng, chosenSymbolId, cellWeights) {
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      row.push(spinFeatureCell(rng, chosenSymbolId, cellWeights));
    }
    grid.push(row);
  }
  return grid;
}

export { BLANK };
