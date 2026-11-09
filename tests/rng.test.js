import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, createSeededRng } from '../js/rng.js';

test('RNG com semente é reprodutível', () => {
  const a = createSeededRng(42);
  const b = createSeededRng(42);
  const seqA = Array.from({ length: 10 }, () => a.random());
  const seqB = Array.from({ length: 10 }, () => b.random());
  assert.deepEqual(seqA, seqB);
});

test('RNG seeded: sementes diferentes => sequências diferentes', () => {
  const a = createSeededRng(1);
  const b = createSeededRng(2);
  const x = a.random();
  const y = b.random();
  assert.notEqual(x, y);
});

test('nextInt dentro do intervalo', () => {
  const r = createSeededRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.nextInt(6);
    assert.ok(v >= 0 && v < 6);
  }
});

test('pickWeighted respeita pesos', () => {
  const r = createSeededRng(99);
  const items = ['a', 'b'];
  let countA = 0;
  for (let i = 0; i < 2000; i++) {
    if (r.pickWeighted(items, (x) => (x === 'a' ? 3 : 1)) === 'a') countA++;
  }
  // esperado ~75%
  assert.ok(countA > 1300 && countA < 1700, `countA=${countA}`);
});
