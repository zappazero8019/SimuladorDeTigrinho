import test from 'node:test';
import assert from 'node:assert/strict';
import { playSpin, runFeature } from '../js/game-engine.js';
import { createSeededRng } from '../js/rng.js';
import { EXPERIMENTAL_PROFILE } from '../js/config.js';

const CONFIG = EXPERIMENTAL_PROFILE;

test('playSpin desconta aposta e credita prêmio uma vez', () => {
  const rng = createSeededRng(10);
  const bet = 10;
  const bal = 1000;
  const res = playSpin({ bet, rng, config: CONFIG, balance: bal });
  assert.equal(res.balanceBefore, bal);
  assert.equal(res.balanceAfter, Math.round((bal - bet + res.totalWin) * 100) / 100);
});

test('playSpin retorna grid 3x3', () => {
  const rng = createSeededRng(11);
  const res = playSpin({ bet: 10, rng, config: CONFIG });
  assert.equal(res.grid.length, 3);
  assert.equal(res.grid[0].length, 3);
});

test('playSpin hit consistente com totalWin', () => {
  const rng = createSeededRng(12);
  for (let i = 0; i < 50; i++) {
    const res = playSpin({ bet: 10, rng, config: CONFIG });
    assert.equal(res.hit, res.totalWin > 0);
  }
});

test('runFeature retorna grid com chosen/wild/blank', () => {
  const rng = createSeededRng(13);
  const f = runFeature(rng, CONFIG);
  assert.ok(f.chosenSymbol);
  assert.equal(f.grid.length, 3);
  const cells = f.grid.flat();
  for (const c of cells) {
    assert.ok(c === null || c === f.chosenSymbol || c === 'WILD');
  }
});

test('Feature respeita sticky: nenhum blank em posição travada após respin? (sanity)', () => {
  const rng = createSeededRng(14);
  const f = runFeature(rng, CONFIG);
  // apenas garantir que não há erro e grid 3x3
  assert.equal(f.grid.flat().length, 9);
});

test('reprodutibilidade: mesma semente => mesmo resultado', () => {
  const r1 = playSpin({ bet: 10, rng: createSeededRng(999), config: CONFIG });
  const r2 = playSpin({ bet: 10, rng: createSeededRng(999), config: CONFIG });
  assert.deepEqual(r1.grid, r2.grid);
  assert.equal(r1.totalWin, r2.totalWin);
  assert.equal(r1.featureTriggered, r2.featureTriggered);
});
