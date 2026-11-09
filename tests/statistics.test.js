import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, stddev, confidenceInterval95 } from '../js/statistics.js';

test('mean/stddev básicos', () => {
  assert.equal(mean([1,2,3]), 2);
  assert.ok(Math.abs(stddev([1,2,3]) - 1) < 1e-9);
});

test('CI95 retorna intervalo', () => {
  const [lo, hi] = confidenceInterval95(10, 2, 100);
  assert.ok(lo < 10 && hi > 10);
});
