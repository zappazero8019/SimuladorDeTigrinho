import test from 'node:test';
import assert from 'node:assert/strict';
import { spinGrid, chooseFeatureSymbol, spinFeatureCell, spinFeatureGrid } from '../js/reels.js';
import { createSeededRng } from '../js/rng.js';

test('spinGrid retorna 3x3', () => {
  const rng = createSeededRng(1);
  const grid = spinGrid(rng, { ORANGE: 1 });
  assert.equal(grid.length, 3);
  assert.equal(grid[0].length, 3);
});

test('spinGrid com peso zero para um símbodo nunca o retorna', () => {
  const rng = createSeededRng(2);
  const weights = { WILD: 0, INGOT: 0, CHARM: 0, BAG: 0, ENVELOPE: 0, FIRECRACKER: 0, ORANGE: 1 };
  const grid = spinGrid(rng, weights);
  for (const row of grid) for (const c of row) assert.equal(c, 'ORANGE');
});

test('chooseFeatureSymbol exclui Wild', () => {
  const rng = createSeededRng(3);
  for (let i = 0; i < 100; i++) {
    const s = chooseFeatureSymbol(rng, null);
    assert.notEqual(s, 'WILD');
  }
});

test('spinFeatureCell retorna chosen/wild/null', () => {
  const rng = createSeededRng(4);
  const vals = new Set();
  for (let i = 0; i < 200; i++) vals.add(spinFeatureCell(rng, 'ORANGE', { chosen: 1, wild: 1, blank: 1 }));
  assert.ok(vals.has('ORANGE'));
  assert.ok(vals.has('WILD'));
  assert.ok(vals.has(null));
});

test('spinFeatureGrid retorna 3x3', () => {
  const rng = createSeededRng(5);
  const g = spinFeatureGrid(rng, 'ORANGE', { chosen: 1, wild: 1, blank: 1 });
  assert.equal(g.length, 3);
  assert.equal(g[0].length, 3);
});
