import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../js/simulator.js';
import { EXPERIMENTAL_PROFILE } from '../js/config.js';

test('simulador retorna rtpHistory e base/feature', () => {
  const r = simulate({ spins: 1000, bet: 10, config: EXPERIMENTAL_PROFILE, seed: 5 });
  assert.ok(Array.isArray(r.rtpHistory));
  assert.ok(r.rtpHistory.length > 0);
  assert.equal(r.baseBet + r.featureBet, r.totalBet);
  assert.ok(r.winHistogram.length === 8);
});

test('rtpHistory último valor igual RTP', () => {
  const r = simulate({ spins: 1000, bet: 10, config: EXPERIMENTAL_PROFILE, seed: 5 });
  const last = r.rtpHistory[r.rtpHistory.length-1].rtp;
  assert.ok(Math.abs(last - r.rtp) < 1e-6);
});
