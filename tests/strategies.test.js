import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSpinSequence, runSessionCRN, runSession } from '../js/strategies.js';
import { EXPERIMENTAL_PROFILE } from '../js/config.js';

test('CRN: mesma seed produz mesma sequência', () => {
  const a = generateSpinSequence(42, 50, EXPERIMENTAL_PROFILE);
  const b = generateSpinSequence(42, 50, EXPERIMENTAL_PROFILE);
  assert.equal(a.length, b.length);
  assert.deepEqual(a.map(x=>x.multiplier), b.map(x=>x.multiplier));
});

test('CRN: sessão reproduzível', () => {
  const seq = generateSpinSequence(7, 30, EXPERIMENTAL_PROFILE);
  const r1 = runSessionCRN({ sequence: seq, initialBalance: 1000, baseBet: 10, config: EXPERIMENTAL_PROFILE, maxRounds: 30, stopProfit: null, stopLoss: null, strategyName: 'fixed', strategyParams: {} });
  const r2 = runSessionCRN({ sequence: seq, initialBalance: 1000, baseBet: 10, config: EXPERIMENTAL_PROFILE, maxRounds: 30, stopProfit: null, stopLoss: null, strategyName: 'fixed', strategyParams: {} });
  assert.equal(r1.finalBalance, r2.finalBalance);
  assert.equal(r1.rounds, r2.rounds);
});

test('CRN: stop-loss interrompe', () => {
  const seq = generateSpinSequence(1, 100, EXPERIMENTAL_PROFILE);
  const r = runSessionCRN({ sequence: seq, initialBalance: 100, baseBet: 10, config: EXPERIMENTAL_PROFILE, maxRounds: 100, stopProfit: null, stopLoss: 30, strategyName: 'fixed', strategyParams: {} });
  assert.ok(r.finalBalance >= 70 || r.ruined);
});

test('runSession: saldo insuficiente encerra', () => {
  const r = runSession({ initialBalance: 5, baseBet: 10, config: EXPERIMENTAL_PROFILE, seed: 1, maxRounds: 10, stopProfit: null, stopLoss: null, strategyName: 'fixed', strategyParams: {} });
  assert.equal(r.rounds, 0);
  assert.equal(r.ruined, false);
});
