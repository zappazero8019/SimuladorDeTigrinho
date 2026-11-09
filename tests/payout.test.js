import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGrid, isFullGridWin, applyFullGridMultiplier } from '../js/payout.js';

const BET = 10; // aposta total
const PER_LINE = BET / 5;

test('3 Wilds em uma linha => 250 * aposta/linha', () => {
  const grid = [
    ['WILD', 'WILD', 'WILD'],
    ['ORANGE', 'ORANGE', 'ORANGE'], // outra linha? vamos manter simples
    ['ORANGE', 'ORANGE', 'ORANGE'],
  ];
  // apenas testar linha superior via evaluateGrid total pode incluir outras; use grid com blanks? Sem blanks no base game.
  // Construir grid onde só linha superior é wild e demais não formam vitória:
  const g = [
    ['WILD', 'WILD', 'WILD'],
    ['ORANGE', 'INGOT', 'CHARM'],
    ['BAG', 'ENVELOPE', 'FIRECRACKER'],
  ];
  const res = evaluateGrid(g, PER_LINE);
  const wildWin = res.lineWins.find((l) => l.multiplier === 250);
  assert.ok(wildWin);
  assert.equal(wildWin.win, 250 * PER_LINE);
});

test('Wild substitui: WILD ORANGE WILD na linha => vitória de Orange', () => {
  const g = [
    ['WILD', 'ORANGE', 'WILD'],
    ['INGOT', 'CHARM', 'BAG'],
    ['ENVELOPE', 'FIRECRACKER', 'ORANGE'],
  ];
  const res = evaluateGrid(g, PER_LINE);
  const win = res.lineWins.find((l) => l.multiplier === 3);
  assert.ok(win, 'deveria haver vitória de Orange com Wild substituindo');
});

test('combinação perdedora: 2 iguais + 1 diferente', () => {
  const g = [
    ['ORANGE', 'ORANGE', 'INGOT'],
    ['INGOT', 'CHARM', 'BAG'],
    ['ENVELOPE', 'FIRECRACKER', 'ORANGE'],
  ];
  const res = evaluateGrid(g, PER_LINE);
  // linha superior não deve vencer
  const topWin = res.lineWins.find((l) => l.line === g[0] /* placeholder */);
  // checar que nenhuma linha tem multiplier 3 na superior: simplesmente total não inclui 3*PER_LINE por essa linha
  assert.ok(!res.lineWins.some((l) => l.symbols[0] === 'ORANGE' && l.symbols[1] === 'ORANGE' && l.symbols[2] === 'INGOT'));
});

test('múltiplas linhas vencedoras somam', () => {
  const g = [
    ['ORANGE', 'ORANGE', 'ORANGE'],
    ['ORANGE', 'ORANGE', 'ORANGE'],
    ['INGOT', 'CHARM', 'BAG'],
  ];
  const res = evaluateGrid(g, PER_LINE);
  assert.equal(res.lineWins.length, 2);
  assert.equal(res.totalWin, 2 * 3 * PER_LINE);
});

test('full grid win detectado e ×10 aplicado', () => {
  const g = [
    ['ORANGE', 'ORANGE', 'ORANGE'],
    ['ORANGE', 'ORANGE', 'ORANGE'],
    ['ORANGE', 'ORANGE', 'ORANGE'],
  ];
  const res = evaluateGrid(g, PER_LINE);
  assert.equal(res.fullGrid, true);
  const boosted = applyFullGridMultiplier(res.totalWin, res.fullGrid);
  assert.equal(boosted, res.totalWin * 10);
});

test('full grid com Wild substituindo', () => {
  const g = [
    ['WILD', 'ORANGE', 'ORANGE'],
    ['ORANGE', 'WILD', 'ORANGE'],
    ['ORANGE', 'ORANGE', 'WILD'],
  ];
  const res = evaluateGrid(g, PER_LINE);
  assert.equal(res.fullGrid, true);
});

test('grid com blank não é full grid', () => {
  const g = [
    [null, 'ORANGE', 'ORANGE'],
    ['ORANGE', 'ORANGE', 'ORANGE'],
    ['ORANGE', 'ORANGE', 'ORANGE'],
  ];
  assert.equal(isFullGridWin(g), false);
});
