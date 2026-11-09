import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBRL, toCents, fromCents, addCredits } from '../js/wallet.js';

test('toCents/fromCents', () => {
  assert.equal(toCents(1.23), 123);
  assert.equal(fromCents(123), 1.23);
});

test('addCredits preciso', () => {
  assert.equal(addCredits(100.00, 2.50), 102.50);
  assert.equal(addCredits(0.10, 0.20), 0.30);
});

test('formatBRL', () => {
  assert.equal(formatBRL(1.5), 'R$\u00a01,50');
});