import test from 'node:test';
import assert from 'node:assert/strict';
import { EffectsController, WIN_LEVELS } from '../js/effects.js';

function makeEnv() {
  const layer = { innerHTML: '', classList: { add(){}, remove(){} }, appendChild(){} };
  global.document = {
    getElementById: () => layer,
    createElement: () => ({ className: '', style: { setProperty(){} }, textContent: '', appendChild() {}, querySelector() { return { textContent: '' }; } }),
  };
  global.window = { matchMedia: () => ({ matches: false }) };
  return layer;
}

test('celebrate level 1 cleans timers', async () => {
  const layer = makeEnv();
  const fx = new EffectsController();
  await fx.celebrate({ level: 1, multiplier: 1.5, winAmount: 15, fullGrid: false });
  assert.equal(fx.timeouts.length, 0);
});

test('celebrate level 4 cleans timers', async () => {
  const layer = makeEnv();
  const fx = new EffectsController();
  await fx.celebrate({ level: 4, multiplier: 60, winAmount: 600, fullGrid: true });
  assert.equal(fx.timeouts.length, 0);
});
