import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

test('main.js captura o saldo antes de atualizar state.balance', () => {
  const capture = source.indexOf('const balanceBefore = state.balance;');
  const mutation = source.indexOf('state.balance = balanceAfter;');

  assert.ok(capture >= 0, 'captura de balanceBefore ausente');
  assert.ok(mutation >= 0, 'atualização de state.balance ausente');
  assert.ok(
    capture < mutation,
    'balanceBefore deve ser capturado antes de state.balance = balanceAfter',
  );
});

test('registro da rodada usa o saldo capturado e não o saldo já atualizado', () => {
  assert.ok(source.includes('balanceBefore,'));
  assert.ok(!source.includes('balanceBefore: state.balance'));
});

test('invariante contábil do registro: balanceAfter = balanceBefore + net', () => {
  const cases = [
    { before: 100, bet: 1, win: 0 },
    { before: 100, bet: 1, win: 2.5 },
    { before: 100, bet: 1, win: 2500 },
    { before: 0.01, bet: 0.01, win: 0.02 },
    { before: 99.99, bet: 10.01, win: 0 },
    { before: 1234.56, bet: 0.33, win: 999.99 },
  ];

  for (const { before, bet, win } of cases) {
    const balanceBefore = before;
    const balanceAfter = Math.round((balanceBefore - bet + win) * 100) / 100;
    const net = win - bet;

    assert.equal(
      Math.round((balanceBefore + net) * 100) / 100,
      balanceAfter,
      `invariante violada para before=${before}, bet=${bet}, win=${win}`,
    );
  }
});
