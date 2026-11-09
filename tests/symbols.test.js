import test from 'node:test';
import assert from 'node:assert/strict';
import { SYMBOLS, REGULAR_SYMBOLS, WILD_SYMBOL, getSymbol, isWild } from '../js/symbols.js';

test('quantidade de símbodos é 7 (1 Wild + 6 regulares)', () => {
  assert.equal(SYMBOLS.length, 7);
  assert.equal(REGULAR_SYMBOLS.length, 6);
  assert.equal(WILD_SYMBOL.id, 'WILD');
});

test('paytable: Wild 250, Ingot 100, ..., Orange 3', () => {
  assert.equal(getSymbol('WILD').lineMultiplier, 250);
  assert.equal(getSymbol('INGOT').lineMultiplier, 100);
  assert.equal(getSymbol('CHARM').lineMultiplier, 25);
  assert.equal(getSymbol('BAG').lineMultiplier, 10);
  assert.equal(getSymbol('ENVELOPE').lineMultiplier, 8);
  assert.equal(getSymbol('FIRECRACKER').lineMultiplier, 5);
  assert.equal(getSymbol('ORANGE').lineMultiplier, 3);
});

test('isWild funciona', () => {
  assert.equal(isWild('WILD'), true);
  assert.equal(isWild('ORANGE'), false);
});
