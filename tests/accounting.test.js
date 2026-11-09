import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resultCents,
  resultKind,
  canPlaceBet,
  addCredits,
} from '../js/wallet.js';

test('resultado operacional positivo (lucro)', () => {
  assert.equal(resultCents(10, 15), 500);
  assert.equal(resultKind(resultCents(10, 15)), 'profit');
});

test('resultado operacional negativo (prejuizo)', () => {
  assert.equal(resultCents(10, 4), -600);
  assert.equal(resultKind(resultCents(10, 4)), 'loss');
});

test('resultado operacional zero (empate)', () => {
  assert.equal(resultCents(10, 10), 0);
  assert.equal(resultKind(0), 'even');
});

test('resultado operacional usa centavos inteiros', () => {
  assert.equal(resultCents(0.1 + 0.2, 0.3), 0);
  assert.equal(resultCents(1.005, 1.005), 0);
  assert.equal(resultCents(0.01, 0.02), 1);
});

test('adicao de creditos nao altera o resultado operacional', () => {
  const totals = { bet: 10, win: 12 };
  const before = resultCents(totals.bet, totals.win);
  addCredits(100, 50);
  const after = resultCents(totals.bet, totals.win);
  assert.equal(before, after);
  assert.equal(after, 200);
});

test('zeragem do saldo nao altera o resultado operacional', () => {
  const totals = { bet: 25, win: 10 };
  const before = resultCents(totals.bet, totals.win);
  const balance = 0;
  const after = resultCents(totals.bet, totals.win);
  assert.equal(balance, 0);
  assert.equal(before, after);
  assert.equal(after, -1500);
  assert.equal(resultKind(after), 'loss');
});

test('resultado nao deriva do saldo disponivel', () => {
  // Mesmo saldo, historicos diferentes => resultados diferentes.
  assert.equal(resultCents(10, 20), 1000);
  assert.equal(resultCents(20, 10), -1000);
});

test('canPlaceBet valida saldo e valor', () => {
  assert.equal(canPlaceBet(10, 10), true);
  assert.equal(canPlaceBet(10, 10.01), false);
  assert.equal(canPlaceBet(0, 1), false);
  assert.equal(canPlaceBet(10, 0), false);
  assert.equal(canPlaceBet(10, -1), false);
  assert.equal(canPlaceBet(10, NaN), false);
  assert.equal(canPlaceBet(10, Infinity), false);
  assert.equal(canPlaceBet(0.3, 0.1 + 0.2), true);
});
