import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWin, WIN_LEVELS, EffectsController } from '../js/effects.js';

test('classifyWin levels', () => {
  assert.equal(classifyWin(0), WIN_LEVELS.NONE);
  assert.equal(classifyWin(1.99), WIN_LEVELS.SMALL);
  assert.equal(classifyWin(2), WIN_LEVELS.MEDIUM);
  assert.equal(classifyWin(9.99), WIN_LEVELS.MEDIUM);
  assert.equal(classifyWin(10), WIN_LEVELS.BIG);
  assert.equal(classifyWin(49.99), WIN_LEVELS.BIG);
  assert.equal(classifyWin(50), WIN_LEVELS.EPIC);
  assert.equal(classifyWin(120), WIN_LEVELS.EPIC);
});

function makeEnv() {
  const layer = {
    innerHTML: '',
    classList: { add() {}, remove() {} },
    appendChild() {},
  };
  global.document = { getElementById: () => layer };
  global.window = { matchMedia: () => ({ matches: false }) };
  return layer;
}

test('EffectsController clear removes timers', async () => {
  makeEnv();
  const fx = new EffectsController();
  fx.schedule(() => {}, 1000);
  assert.equal(fx.timeouts.length, 1);
  fx.clear();
  assert.equal(fx.timeouts.length, 0);
});

test('celebrate NONE does not create effects', async () => {
  const layer = makeEnv();
  const fx = new EffectsController();
  await fx.celebrate({ level: 0, multiplier: 0, winAmount: 0, fullGrid: false });
  assert.equal(fx.timeouts.length, 0);
});