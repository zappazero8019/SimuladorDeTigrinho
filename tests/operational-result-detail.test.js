import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resultCentsWithBaseline,
  resultKind,
  resultCents,
  toCents,
} from '../js/wallet.js';

test('ganho maior que perda => lucro', () => {
  const gainCents = resultCentsWithBaseline(0, 100, 0, 0);
  const lossCents = toCents(60) - toCents(0);
  const netCents = resultCentsWithBaseline(60, 100, 0, 0);
  assert.equal(gainCents, 10000);
  assert.equal(lossCents, 6000);
  assert.equal(netCents, 4000);
  assert.equal(resultKind(netCents), 'profit');
});

test('perda maior que ganho => prejuízo', () => {
  const gainCents = resultCentsWithBaseline(0, 40, 0, 0);
  const lossCents = toCents(100) - toCents(0);
  const netCents = resultCentsWithBaseline(100, 40, 0, 0);
  assert.equal(gainCents, 4000);
  assert.equal(lossCents, 10000);
  assert.equal(netCents, -6000);
  assert.equal(resultKind(netCents), 'loss');
});

test('ganho igual à perda => empate', () => {
  const gainCents = resultCentsWithBaseline(0, 50, 0, 0);
  const lossCents = toCents(50) - toCents(0);
  const netCents = resultCentsWithBaseline(50, 50, 0, 0);
  assert.equal(gainCents, 5000);
  assert.equal(lossCents, 5000);
  assert.equal(netCents, 0);
  assert.equal(resultKind(netCents), 'even');
});

test('reset dos três indicadores (baseline = totais)', () => {
  const bet = 250;
  const win = 100;
  const gainCents = resultCentsWithBaseline(0, win, 0, win);
  const lossCents = toCents(bet) - toCents(bet);
  const netCents = resultCentsWithBaseline(bet, win, bet, win);
  assert.equal(gainCents, 0);
  assert.equal(lossCents, 0);
  assert.equal(netCents, 0);
  assert.equal(resultKind(netCents), 'even');
});

test('valores monetários com centavos', () => {
  const gainCents = resultCentsWithBaseline(0, 0.3, 0, 0);
  const lossCents = toCents(0.1 + 0.2) - toCents(0);
  const netCents = resultCentsWithBaseline(0.1 + 0.2, 0.3, 0, 0);
  assert.equal(gainCents, 30);
  assert.equal(lossCents, 30);
  assert.equal(netCents, 0);
  assert.equal(resultKind(netCents), 'even');
});

test('reset preserva totais históricos (não altera totais)', () => {
  const totalsBet = 100;
  const totalsWin = 150;
  const baselineBet = 100;
  const baselineWin = 150;
  const netCents = resultCentsWithBaseline(totalsBet, totalsWin, baselineBet, baselineWin);
  assert.equal(netCents, 0);
  assert.equal(resultCents(totalsBet, totalsWin), 5000);
  assert.equal(resultCents(baselineBet, baselineWin), 5000);
});

test('resultado parcial após reset considera apenas movimentos posteriores', () => {
  const gainCents = resultCentsWithBaseline(0, 100, 0, 40);
  const lossCents = toCents(250) - toCents(100);
  const netCents = resultCentsWithBaseline(250, 100, 100, 40);
  assert.equal(gainCents, 6000);
  assert.equal(lossCents, 15000);
  assert.equal(netCents, -9000);
  assert.equal(resultKind(netCents), 'loss');
});
