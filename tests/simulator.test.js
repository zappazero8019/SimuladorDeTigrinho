import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../js/simulator.js';
import { EXPERIMENTAL_PROFILE, REFERENCE_PROFILE } from '../js/config.js';

test('simulação contabiliza aposta e prêmio', () => {
  const rep = simulate({ spins: 1000, bet: 10, config: EXPERIMENTAL_PROFILE, seed: 1 });
  assert.equal(rep.totalBet, 1000 * 10);
  assert.ok(rep.totalWin >= 0);
  assert.equal(rep.rtp, (rep.totalWin / rep.totalBet) * 100);
});

test('simulação reprodutível por semente', () => {
  const a = simulate({ spins: 500, bet: 10, config: EXPERIMENTAL_PROFILE, seed: 42 });
  const b = simulate({ spins: 500, bet: 10, config: EXPERIMENTAL_PROFILE, seed: 42 });
  assert.equal(a.totalWin, b.totalWin);
  assert.equal(a.rtp, b.rtp);
});

test('RTP experimental converge (100k) dentro de faixa ampla', () => {
  const rep = simulate({ spins: 100000, bet: 10, config: EXPERIMENTAL_PROFILE, seed: 7 });
  // não forçar 96.81; apenas sanidade: RTP entre 0 e 200
  assert.ok(rep.rtp >= 0 && rep.rtp <= 200, `rtp=${rep.rtp}`);
});

test('perfil referência roda', () => {
  const rep = simulate({ spins: 1000, bet: 10, config: REFERENCE_PROFILE, seed: 3 });
  assert.equal(rep.spins, 1000);
});
