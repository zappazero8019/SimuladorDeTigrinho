import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPERIMENTAL_MULTIPLIERS,
  EXPERIMENTAL_MULTIPLIER_CONFIG,
  drawExperimentalMultiplier,
  applyWinCap,
  toCents,
  fromCents,
} from '../js/experimental-multipliers.js';

// --- RNG controlado para testes ---
function makeRng(randomValues, pickWeightedValues) {
  let randomIndex = 0;
  let pickIndex = 0;
  return {
    random: () => {
      const v = randomValues[randomIndex];
      randomIndex++;
      return v;
    },
    pickWeighted: (values, weights) => {
      const v = pickWeightedValues[pickIndex];
      pickIndex++;
      return v;
    },
  };
}

test('multiplicadores disponíveis: 2, 5, 10, 50', () => {
  assert.equal(EXPERIMENTAL_MULTIPLIERS.X2.value, 2);
  assert.equal(EXPERIMENTAL_MULTIPLIERS.X5.value, 5);
  assert.equal(EXPERIMENTAL_MULTIPLIERS.X10.value, 10);
  assert.equal(EXPERIMENTAL_MULTIPLIERS.X50.value, 50);
});

test('sorteio com probabilidade 0 nunca ativa', () => {
  const rng = makeRng([0.99, 0.99], []);
  const config = { ...EXPERIMENTAL_MULTIPLIER_CONFIG, activationProbability: 0 };
  for (let i = 0; i < 100; i++) {
    assert.equal(drawExperimentalMultiplier(rng, config), 1);
  }
});

test('sorteio com probabilidade 1 sempre ativa', () => {
  // random() chamado duas vezes: activation check + threshold
  const rng = makeRng([0.01, 0.01], [2]);
  const config = { ...EXPERIMENTAL_MULTIPLIER_CONFIG, activationProbability: 1 };
  assert.equal(drawExperimentalMultiplier(rng, config), 2);
});

test('sorteio respeita pesos do multiplicador', () => {
  // random() chamado duas vezes: activation check + threshold
  // pickWeighted ignorado, threshold escolhido diretamente
  const rng = makeRng([0.01, 0.01], [50]);
  const config = {
    ...EXPERIMENTAL_MULTIPLIER_CONFIG,
    activationProbability: 1,
    multiplierWeights: { 2: 1, 5: 0, 10: 0, 50: 0 },
  };
  assert.equal(drawExperimentalMultiplier(rng, config), 2);
});

test('applyWinCap limita a 2500x a aposta', () => {
  // Aposta R$ 10,00 = 1000 centavos. Cap = 1000 * 2500 = 2.500.000 centavos.
  const betCents = toCents(10);
  const capCents = applyWinCap(toCents(100000), betCents); // R$ 1000,00
  assert.equal(capCents, betCents * 2500);
});

test('applyWinCap não reduz quando abaixo do limite', () => {
  const betCents = toCents(10);
  const winCents = toCents(100); // R$ 10,00, bem abaixo do cap
  assert.equal(applyWinCap(winCents, betCents), winCents);
});

test('toCents converte corretamente', () => {
  assert.equal(toCents(1.00), 100);
  assert.equal(toCents(5.50), 550);
  assert.equal(toCents(10.25), 1025);
});

test('fromCents converte corretamente', () => {
  assert.equal(fromCents(100), 1);
  assert.equal(fromCents(550), 5.5);
  assert.equal(fromCents(1025), 10.25);
});

test('multiplicador x2 dobra o prêmio em centavos', () => {
  const betCents = toCents(1); // R$ 1,00
  const baseWinCents = toCents(5); // R$ 5,00 (multiplicador de pagamento 5x)
  const multiplied = baseWinCents * 2;
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, 1000); // R$ 10,00
});

test('multiplicador x50 aplica ao prêmio', () => {
  const betCents = toCents(1);
  const baseWinCents = toCents(5);
  const multiplied = baseWinCents * 50;
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, 25000); // R$ 250,00
});

test('cap de 2500x é respeitado com multiplicador experimental alto', () => {
  // Aposta R$ 10,00 = 1000 centavos. Cap = 2.500.000 centavos (R$ 25.000,00).
  const betCents = toCents(10);
  const baseWinCents = toCents(10000); // R$ 100,00 (já alto)
  const multiplied = baseWinCents * 50; // R$ 5.000,00
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, betCents * 2500); // deve ser limitado a R$ 25.000,00
});

test('cap de 2500x é respeitado quando excedido', () => {
  // Aposta R$ 1,00 = 100 centavos. Cap = 250.000 centavos (R$ 2.500,00).
  const betCents = toCents(1);
  const baseWinCents = toCents(100); // R$ 1,00
  const multiplied = baseWinCents * 5000; // R$ 500,00 (acima do cap)
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, betCents * 2500);
});

test('proporcionalidade: aposta R$ 1,00 com multiplicador x5', () => {
  const betCents = toCents(1);
  const baseWinCents = toCents(5); // R$ 5,00 (multiplicador de pagamento 5x)
  const multiplied = baseWinCents * 5;
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, toCents(25)); // R$ 25,00
});

test('proporcionalidade: aposta R$ 5,00 com multiplicador x5', () => {
  const betCents = toCents(5);
  const baseWinCents = toCents(25); // R$ 25,00 (5x de R$ 5,00)
  const multiplied = baseWinCents * 5;
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, toCents(125)); // R$ 125,00
});

test('proporcionalidade: aposta R$ 10,00 com multiplicador x5', () => {
  const betCents = toCents(10);
  const baseWinCents = toCents(50); // R$ 50,00 (5x de R$ 10,00)
  const multiplied = baseWinCents * 5;
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, toCents(250)); // R$ 250,00
});

test('proporcionalidade: aposta R$ 30,00 com multiplicador x5', () => {
  const betCents = toCents(30);
  const baseWinCents = toCents(150); // R$ 150,00 (5x de R$ 30,00)
  const multiplied = baseWinCents * 5;
  const capped = applyWinCap(multiplied, betCents);
  assert.equal(capped, toCents(750)); // R$ 750,00
});
